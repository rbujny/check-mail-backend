# LLM and RAG Email Analysis

## Runtime pipeline

`POST /process` validates and normalizes the request, then runs the deterministic heuristic analyzer. A heuristic `PHISHING` result is returned immediately and never consumes an embedding or model request. Heuristic `OK` and `WARNING` results follow this path:

1. create one query embedding with `gemini-embedding-001`
2. retrieve the five closest documents from the active, versioned Firestore corpus
3. send a minimized representation of the email, heuristic signals, and retrieved examples to the selected model
4. validate the model's strict JSON response and return only `result` and `comment`

RAG and model calls are retried once. Each external attempt has a 10-second default timeout, and API Gateway allows the process backend up to 55 seconds so the function can still return a controlled response. If either dependency still fails, the endpoint returns `503`; it does not silently downgrade to a clean result. A successful analysis is returned only after its result record has also been written to PostgreSQL; database failures likewise return `503`.

The request may select an allowlisted managed model at runtime through the optional `model` field: `gemini-3.5-flash-lite` or `gemini-3.7-flash`. Omitting the field uses the Terraform-configured deployment default. The backend maps each value to a fixed provider and Vertex AI location, so clients cannot inject arbitrary model IDs, providers, endpoints, or regions. RAG remains controlled by deployment configuration and decisive heuristic phishing results bypass the selected model. Claude remains available to benchmarks and deployment-level configuration but is not exposed through request-level selection. Local Gemma is intentionally benchmark-only until it is exposed through a network endpoint reachable from the deployed process function.

## Model matrix

| Cost class | Model | Integration |
| --- | --- | --- |
| Cheapest | Gemma 4 E4B IT | OpenAI-compatible local or self-hosted endpoint |
| Cheap / production default | Gemini 3.5 Flash-Lite | Vertex AI `generateContent` |
| Medium | Gemini 3.7 Flash | Vertex AI `generateContent` |
| Expensive reference | Claude Sonnet 5 | Vertex AI partner model `rawPredict` |

Every benchmark model has no-RAG and RAG variants. Gemma variants are included only when `GEMMA_ENDPOINT` is configured because the open model needs separately provisioned compute.

## Prompt and privacy boundary

The model receives the normalized subject/body, authentication verdicts, sender-domain relationships, URL schemes and hostnames, received-hop count, heuristic score/codes, and retrieved corpus snippets. Recipient addresses, full sender addresses, URL paths/query strings, and raw `Received` headers are excluded. Production email inputs and prompts are not persisted and are never written to logs. The benchmark-only exception is the sanitized public evaluation dataset described below.

The prompt treats both the email and retrieved examples as untrusted data to reduce prompt-injection risk. Model output must be JSON with a supported result, confidence in the `0-1` range, a short comment, and signal identifiers.

## Processing result persistence

Each successful request inserts one row into the Cloud SQL PostgreSQL `process_results` table. Indexed columns cover creation time, final result, route, heuristic result/score, selected and actual model, provider, confidence, token usage, RAG corpus version/hit count, and duration. A `details` JSONB column contains the schema-versioned privacy-safe analysis record, including findings and RAG document identifiers. It excludes the request email, sender and recipient addresses, full headers, URL values, raw model output, and retrieved document text.

The deployment workflow runs the idempotent `db:migrate` command after Terraform apply to create the table and indexes before traffic uses them. The process runtime repeats the same schema check before its first insert as a fail-safe. It uses a two-connection pool and the official Cloud SQL Node.js Connector over public IP; connector enforcement rejects direct database connections. The function and deployment service accounts have `roles/cloudsql.client`, while database authentication uses the Terraform-managed application user and password.

The old `<project-id>-process-results` Cloud Storage bucket remains managed temporarily so previously written objects are not destroyed during migration. The process function no longer receives its name or write permission, so new results cannot enter it. Existing objects continue to follow the configurable 90-day lifecycle rule and the bucket is exposed as `legacy_process_results_bucket_name`.

## RAG corpus

The tracked `datasets/sources.json` manifest references public phishing and ham sources. Run:

```sh
python tools/datasets/prepare_public_dataset.py
cd functions/process
npm ci
GOOGLE_CLOUD_PROJECT=project-id RAG_CORPUS_VERSION=v1 npm run rag:ingest -- ../../datasets/generated/rag-corpus.jsonl
```

Generated messages are sanitized, deduplicated, deterministically split, validated against the `/process` contract, and gitignored. The current source manifest produces 2,000 corpus records and 4,394 evaluation records. Ingestion embeds each corpus record and upserts it under the selected `corpusVersion`. Switching `rag_corpus_version` makes a newly imported corpus active without overwriting an older version.

This is retrieval corpus construction, not model training or fine-tuning.

## Benchmarking

The `Benchmark LLM pipeline` workflow is manual. Each run selects exactly one model variant, explicitly with or without RAG, and defaults to five evaluation records. The workflow limits the selectable sample sizes to 1, 5, 10, 50, or 100 to prevent an accidental high-cost online run. It selects only records eligible for model review, so a one-record workflow run performs one model call instead of potentially stopping at a heuristic `PHISHING` bypass. A no-RAG run does not create embeddings or query Firestore. Managed-model and non-thinking Gemma responses are capped at 256 output tokens. Thinking Gemma variants request a 1,536-token reasoning budget and enforce a 2,048-token total completion limit, leaving room for the final JSON assessment. The total completion limit remains the hard fallback when a particular OpenAI-compatible server or model template does not enforce the requested reasoning budget. This larger local-only allowance has no per-token API charge, but increases benchmark duration and electricity use. Benchmark requests use a 60-second per-operation timeout to tolerate Vertex AI cold starts, but are not retried automatically. Progress logs identify whether a failure happened during RAG retrieval or model inference without logging input message content. Invalid model outputs, finish reasons, reasoning-output size, and truncation metadata are recorded per evaluation record in benchmark logs and the full report artifact; this diagnostic output is enabled only for the sanitized public evaluation dataset and is never logged by the production `/process` handler. Requests continue after isolated failures, but a variant aborts after three consecutive model failures to avoid wasting local runtime or paid API calls. The report artifact is uploaded even when the workflow ultimately fails. For every false positive or false negative, the report's `misclassifications` array stores the sanitized evaluation email, expected label, heuristic result, decision source, raw model response, parsed assessment, and usage metadata. These values are written only to the full report artifact, not workflow logs, and GitHub retains the artifact for 14 days. The report also includes confusion matrices, accuracy, decisive accuracy, precision, recall, F1, warning rate, decisive coverage, model attempts/failures, token usage, reasoning characters, model-call count, heuristic bypass count, and p50/p95 model latency.

Every completed report also produces `benchmark-summary.json`. The summary keeps aggregate metrics, token and call totals, latency percentiles, failure and misclassification counts, selected variants, RAG corpus version, sample size, and GitHub run metadata. It excludes evaluation messages, individual heuristics, parsed and raw model responses, and model-error diagnostics. When `BENCHMARK_SUMMARY_BUCKET` is configured by the workflow, this file is uploaded to the private `<project-id>-benchmark-summaries` bucket under `summaries/YYYY/MM/DD/`. Summary objects are retained until explicitly deleted so they can form a long-term comparison history. The workflow identity has create-only access to this bucket.

For a local authenticated run:

```sh
cd functions/process
BENCHMARK_VARIANT=gemini-3.5-flash-lite-rag \
BENCHMARK_MAX_RECORDS=5 \
BENCHMARK_MODEL_ELIGIBLE_ONLY=true \
LLM_TIMEOUT_MS=60000 \
GOOGLE_CLOUD_PROJECT=project-id \
RAG_CORPUS_VERSION=v1 \
npm run benchmark -- ../../datasets/generated/evaluation.jsonl benchmark-report.json benchmark-summary.json
```

Supported `BENCHMARK_VARIANT` values are `gemini-3.5-flash-lite`, `gemini-3.5-flash-lite-rag`, `gemini-3.7-flash`, `gemini-3.7-flash-rag`, `claude-sonnet-5`, `claude-sonnet-5-rag`, `gemma-4-e4b`, `gemma-4-e4b-rag`, `gemma-4-e4b-thinking`, and `gemma-4-e4b-thinking-rag`. Gemma requires both `GEMMA_ENDPOINT` and, optionally, `GEMMA_MODEL_ID`.

The online runner is intentionally bounded. A full 10,000-message experiment should use provider batch APIs after the online sample confirms model IDs, permissions, output compatibility, and prompt quality.

## Cost estimate

Pricing was checked on 2026-08-23. Current global online list prices per one million text tokens are:

| Model | Input | Output |
| --- | ---: | ---: |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 |
| Gemini 3.7 Flash, introductory through 2026-12-31 | $0.75 | $3.75 |
| Claude Sonnet 5 in `europe-west1` | $2.20 | $11.00 |
| Gemma 4 E4B | Compute-based | Compute-based |

Google lists Gemini Embedding online requests at $0.00015 per 1,000 inputs. Firestore additionally bills document/vector-index reads, writes, and storage, but the initial corpus and experiment normally fit inside or close to the default database's free daily operation quotas.

Using a deliberately conservative assumption of 10,000 model-eligible messages, 1,000 input and 100 output tokens without RAG, and 1,500 input and 100 output tokens with RAG, both variants cost approximately:

| Model pair: no-RAG + RAG | Estimated online cost |
| --- | ---: |
| Gemini 3.5 Flash-Lite | $12.50 |
| Gemini 3.7 Flash | $26.25 |
| Claude Sonnet 5 | $77.00 |

The managed-model total is about $115.75 in this worst-case assumption, or about $5.79 for the default 500-message online sample. If heuristics bypass half the evaluation set, model cost is approximately halved. Embedding 2,000 corpus records plus 10,000 queries is about $0.002 at the listed per-request price, before Firestore operations.

Gemma has no per-token model fee when self-hosted. Its experiment cost is runtime: Google documents L4 as a supported accelerator for Gemma 4 E4B, and the standalone on-demand L4 GPU list price starts around $0.56/hour before the VM, disk, networking, and serving overhead. Measure actual throughput before treating Gemma as the cheapest option at low traffic, because idle GPU time can dominate token cost.

Official references:

- [Google generative model and embedding pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- [Firestore pricing](https://cloud.google.com/firestore/pricing)
- [Gemma model catalog](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/open-models/use-gemma)
- [Google Cloud GPU pricing](https://cloud.google.com/products/compute/gpus-pricing)
