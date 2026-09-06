# check-mail-backend

Basic GCP infrastructure setup for the backend using Terraform.

## What is included

- Terraform backend stored in GCS bucket `checkmail-plugin-backend-dev-state`
- Basic Google Cloud Functions Gen2 deployment
- Cloud SQL for PostgreSQL setup
- TypeScript HTTP function source
- Auto-discovery of functions from the `functions/*/function.json` files
- Express-wrapped handlers registered with `@google-cloud/functions-framework`
- Cost-aware heuristic, RAG, and LLM phishing-classification pipeline
- Firestore vector index and a dedicated least-privilege processing service account
- Manual public-dataset preparation, RAG synchronization, and model benchmark workflows

## Structure

- `docs/` - repository documentation
- `docs/openapi.yaml` - canonical API contract for future gateway integration
- `docs/postman/` - Postman collection, environment template, and execution guide
- `infra/` - Terraform configuration
- `infra/apigateway.tf` - optional API Gateway definition for the public REST entrypoint
- `functions/basic-http/` - healthcheck HTTP function
- `functions/auth/` - JWT issuing HTTP function
- `functions/process/` - heuristic, RAG, and LLM email phishing analysis HTTP function
- `functions/common/email-processing/types.ts` - shared request/response contract types for email processing

## Deployment

The repository uses one shared GCP environment. Infrastructure deployment runs only through the manually triggered `.github/workflows/deploy.yml` GitHub Actions workflow.

Configure these GitHub repository variables before running it:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

Configure these GitHub repository secrets before running it:

- `CHECKMAIL_PROJECT_ID`
- `CHECKMAIL_REGION`
- `CHECKMAIL_DB_PASSWORD`
- `CHECKMAIL_API_GATEWAY_JWT_ISSUER`
- `CHECKMAIL_API_GATEWAY_JWT_AUDIENCE`
- `CHECKMAIL_JWT_PRIVATE_KEY`
- `CHECKMAIL_JWT_KEY_ID`
- `CHECKMAIL_JWT_EXPIRES_IN`

Start the deployment from GitHub Actions by selecting the `Deploy` workflow and choosing `Run workflow`. It runs Terraform formatting, initialization, validation, plan, and apply, then applies the idempotent PostgreSQL result-schema migration.

Terraform deploys PostgreSQL 18 as an explicit Cloud SQL Enterprise instance using the shared-core `db-f1-micro` tier. Apply runs serially to avoid concurrent Cloud Functions Gen2 initialization races.

The Terraform backend is configured to use the existing bucket:

- `checkmail-plugin-backend-dev-state`

Do not run `terraform apply` locally against the shared environment.

## Local development

Start the local CUDA-accelerated Gemma server used by the self-hosted benchmark runner:

```sh
./tools/llama/start-gemma-server.sh
```

The script auto-detects the existing `gemma-4-E4B-it-Q8_0.gguf` Hugging Face cache entry and the CUDA build under `~/tools/llama.cpp`. Override paths or runtime sizing when needed:

```sh
GEMMA_MODEL_PATH=/path/to/model.gguf \
LLAMA_SERVER_BIN=/path/to/llama-server \
LLAMA_PORT=8080 \
LLAMA_CTX_SIZE=8192 \
./tools/llama/start-gemma-server.sh
```

Keep the server running while the repository self-hosted runner executes a Gemma benchmark. The default endpoint and model alias are `http://127.0.0.1:8080` and `gemma-4-e4b-it`. For another llama.cpp-compatible GGUF checkpoint, set `GEMMA_MODEL_PATH` and `GEMMA_MODEL_ALIAS`. Set the matching repository variable: `GEMMA_12B_MODEL_ID` for Gemma 4 12B Q8_0 or `GEMMA_26B_A4B_MODEL_ID` for Gemma 4 26B A4B Q4_0. The generic `GEMMA_MODEL_ID` remains a fallback for all Gemma variants. Local benchmark requests allow up to 1,024 completion tokens in regular mode and 4,096 in thinking mode, including a 3,072-token reasoning budget.

Local development is intended for Cloud Functions. Run a function from its own directory:

```sh
cd functions/basic-http
npm install
npm run start
```

## Adding another function

To add a new function, create a new directory under `functions/` with:

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `function.json`

Terraform automatically discovers every `functions/*/function.json` file and deploys it as a separate Cloud Function Gen2.

Function conventions are documented in `docs/functions.md`.

The canonical backend API contract is documented in `docs/openapi.yaml`.

API Gateway resources are always provisioned by Terraform. Terraform routes `/token` to the auto-discovered `auth` function and `/process` to the auto-discovered `process` function. The gateway exposes:

- `POST /token` without JWT authentication, using an API key for quota attribution
- `POST /process` with API key and JWT authentication enforced by API Gateway

Both routes have configurable per-minute, per-consumer-project quotas. Defaults are 10 token requests and 60 processing requests. The auth function signs tokens with RS256 and requires `JWT_PRIVATE_KEY`; its issuer and audience must match the corresponding API Gateway variables.

The processing function validates the documented request contract and performs deterministic heuristic analysis of authentication verdicts, sender-domain alignment, links, and message language. Decisive heuristic phishing results return immediately. Clean and warning results use versioned Firestore vector retrieval and either the Terraform-configured default model or an allowlisted managed model selected through the request's optional `model` field before returning `OK`, `WARNING`, or `PHISHING`. Exact case variants of those three model result values are normalized before validation, while aliases and other values remain invalid. Runtime choices are `gemini-3.5-flash-lite` and `gemini-3.7-flash`; arbitrary providers, endpoints, regions, and model IDs are rejected. The public response remains limited to `result` and `comment`. Every successful analysis is synchronously recorded in PostgreSQL; a database, model, or RAG dependency failure returns `503`. Stored records contain queryable result/model columns and privacy-safe JSONB analysis metadata, but not the input message content, addresses, full headers, URLs, raw model output, or retrieved RAG text. Rule behavior is documented in `docs/heuristic-analysis.md`, while model configuration, RAG synchronization, persistence, benchmarks, privacy boundaries, and cost estimates are documented in `docs/llm-rag-analysis.md`.

Production defaults to `gemini-3.5-flash-lite` with RAG enabled. These non-secret Terraform variables can be overridden through `TF_VAR_*` in the deployment workflow: `llm_provider`, `llm_model_id`, `llm_timeout_ms`, `vertex_ai_location`, `rag_enabled`, `rag_collection`, `rag_corpus_version`, `rag_top_k`, `rag_embedding_model_id`, and `rag_embedding_dimension`. `process_results_retention_days` now applies only to objects written to the legacy process-result bucket before the PostgreSQL migration.

Run the manual `Sync RAG corpus` workflow before deploying a production configuration that enables RAG. The manual `Benchmark LLM pipeline` workflow prepares the same public evaluation data and tests one explicitly selected model with or without RAG on a bounded online sample. Benchmark jobs run on a repository self-hosted Linux x64 runner; this lets Gemma variants call an OpenAI-compatible server through a local `GEMMA_ENDPOINT`, while cloud-model and RAG variants continue to authenticate through Workload Identity. Gemma can be benchmarked both with reasoning disabled and with a bounded thinking budget, independently of RAG. Full reports contain sanitized false-positive/false-negative emails, model outputs, diagnostics, and privacy-safe per-email heuristic/RAG/model/total processing times; they are retained in a private Cloud Storage bucket for 90 days by default and as GitHub artifacts for 14 days. A separate private bucket retains aggregate summaries, including per-email processing-time statistics, without per-message data for long-term comparisons. Production messages remain excluded from benchmark persistence and logs.

RAG v2 enrichment can be prepared manually from the exact RAG v1 records. Run `python3 tools/datasets/prepare_rag_v2_enrichment_batches.py` to create deterministic 20-email JSON batches, then process each batch with the prompt in `docs/rag-v2-enrichment-prompt.md`. Save the model's JSON-only enrichment patches under matching filenames in `datasets/generated/rag-v2-enrichment-output/`; a later validation step will join them to the immutable v1 messages by ID.

Clients cannot override the token issuer, audience, or add arbitrary claims. These values are controlled by backend configuration.

Terraform creates a restricted client API key for quota attribution and a dedicated gateway service account with Cloud Functions and Cloud Run invoker access. Retrieve the key with `terraform output -raw api_gateway_client_key`.

The public key is stored in `infra/jwks.json`. Terraform publishes it from a dedicated public Cloud Storage bucket in the same GCP project and configures API Gateway to use that URL. The matching private key is supplied only through the `CHECKMAIL_JWT_PRIVATE_KEY` GitHub Secret.

Pull request checks are documented in `docs/pr-checks.md`.

## Codex team setup

Repo includes shared Codex guidance and bootstrap files:

- `AGENTS.md` for repository rules
- `tools/codex/skills/gcp-backend/SKILL.md` for a shared skill
- `tools/codex/setup-codex.sh` to install the repo skill locally and append an MCP entry to `~/.codex/config.toml`

Run:

```sh
sh tools/codex/setup-codex.sh
```
