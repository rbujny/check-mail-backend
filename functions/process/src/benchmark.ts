import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { analyzeEmail } from "./analyzer";
import { createBenchmarkSummary } from "./benchmark-summary";
import { CloudStorageJsonWriter } from "./cloud-storage-json-writer";
import { getProcessConfig, type ProcessConfig } from "./config";
import {
  createModelProvider,
  InvalidModelResponseError,
  type ModelRequestOptions,
} from "./model-provider";
import { createRagRetriever } from "./rag";
import type {
  AnalysisResult,
  ModelAssessment,
  ProcessEmailRequest,
  RagRetrievalResult,
} from "./types";
import { isProcessedEmailRequest } from "./validation";

type DatasetRecord = {
  id: string;
  label: "safe" | "phishing";
  request: ProcessEmailRequest;
};

type Variant = {
  id: string;
  provider: ProcessConfig["llmProvider"];
  model: string;
  rag: boolean;
  location: string;
  endpoint?: string;
  requestOptions?: ModelRequestOptions;
};

const variants = (): Variant[] => {
  const gemmaEndpoint = process.env.GEMMA_ENDPOINT;
  const definitions: Variant[] = [
    { id: "gemini-3.5-flash-lite", provider: "gemini", model: "gemini-3.5-flash-lite", rag: false, location: "global" },
    { id: "gemini-3.5-flash-lite-rag", provider: "gemini", model: "gemini-3.5-flash-lite", rag: true, location: "global" },
    { id: "gemini-3.7-flash", provider: "gemini", model: "gemini-3.7-flash", rag: false, location: "global" },
    { id: "gemini-3.7-flash-rag", provider: "gemini", model: "gemini-3.7-flash", rag: true, location: "global" },
    { id: "claude-sonnet-5", provider: "claude", model: "claude-sonnet-5", rag: false, location: "europe-west1" },
    { id: "claude-sonnet-5-rag", provider: "claude", model: "claude-sonnet-5", rag: true, location: "europe-west1" },
  ];
  if (gemmaEndpoint) {
    definitions.push(
      { id: "gemma-4-e4b", provider: "openai-compatible", model: process.env.GEMMA_MODEL_ID ?? "gemma-4-e4b-it", rag: false, location: "local", endpoint: gemmaEndpoint, requestOptions: { maxOutputTokens: 256, reasoningMode: "disabled" } },
      { id: "gemma-4-e4b-rag", provider: "openai-compatible", model: process.env.GEMMA_MODEL_ID ?? "gemma-4-e4b-it", rag: true, location: "local", endpoint: gemmaEndpoint, requestOptions: { maxOutputTokens: 256, reasoningMode: "disabled" } },
      { id: "gemma-4-e4b-thinking", provider: "openai-compatible", model: process.env.GEMMA_MODEL_ID ?? "gemma-4-e4b-it", rag: false, location: "local", endpoint: gemmaEndpoint, requestOptions: { maxOutputTokens: 2048, reasoningBudget: 1536, reasoningMode: "enabled" } },
      { id: "gemma-4-e4b-thinking-rag", provider: "openai-compatible", model: process.env.GEMMA_MODEL_ID ?? "gemma-4-e4b-it", rag: true, location: "local", endpoint: gemmaEndpoint, requestOptions: { maxOutputTokens: 2048, reasoningBudget: 1536, reasoningMode: "enabled" } }
    );
  }
  return definitions;
};

const selectedVariants = (): Variant[] => {
  const available = variants();
  const selectedId = process.env.BENCHMARK_VARIANT;
  if (!selectedId) {
    return available;
  }

  const selected = available.filter((variant) => variant.id === selectedId);
  if (selected.length === 0) {
    throw new Error(
      `Unknown or unavailable BENCHMARK_VARIANT '${selectedId}'. Available variants: ${available.map((variant) => variant.id).join(", ")}.`
    );
  }
  return selected;
};

const loadDataset = async (path: string): Promise<DatasetRecord[]> => {
  const lines = (await readFile(path, "utf8")).split(/\r?\n/u).filter(Boolean);
  return lines.map((line, index) => {
    const value = JSON.parse(line) as Partial<DatasetRecord>;
    if (
      typeof value.id !== "string" ||
      (value.label !== "safe" && value.label !== "phishing") ||
      !isProcessedEmailRequest(value.request)
    ) {
      throw new Error(`Invalid evaluation record at line ${index + 1}.`);
    }
    return value as DatasetRecord;
  });
};

const percentile = (values: number[], ratio: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
};

type EvaluationCache = {
  heuristic: AnalysisResult;
  rag?: RagRetrievalResult;
};

type ConfusionMatrix = {
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  warningOnPhishing: number;
  warningOnSafe: number;
};

type BenchmarkModelError = {
  diagnostics?: InvalidModelResponseError["diagnostics"];
  error: string;
  invalidOutput?: string;
  record: number;
};

type BenchmarkMisclassification = {
  actualResult: "OK" | "PHISHING";
  classification: "falseNegative" | "falsePositive";
  decisionSource: "heuristic" | "model";
  email: ProcessEmailRequest;
  expectedLabel: DatasetRecord["label"];
  heuristic: AnalysisResult;
  modelOutput: ModelAssessment | null;
  record: number;
  recordId: string;
};

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const metricsFor = (matrix: ConfusionMatrix, total: number) => {
  const decisive = matrix.truePositive + matrix.trueNegative + matrix.falsePositive + matrix.falseNegative;
  const precision = ratio(matrix.truePositive, matrix.truePositive + matrix.falsePositive);
  const recall = ratio(matrix.truePositive, matrix.truePositive + matrix.falseNegative);
  return {
    accuracy: ratio(matrix.truePositive + matrix.trueNegative, total),
    decisiveAccuracy: ratio(matrix.truePositive + matrix.trueNegative, decisive),
    precision,
    recall,
    f1: ratio(2 * precision * recall, precision + recall),
    warningRate: ratio(matrix.warningOnPhishing + matrix.warningOnSafe, total),
    decisiveCoverage: ratio(decisive, total),
    confusionMatrix: matrix,
  };
};

const main = async (): Promise<void> => {
  const datasetPath = process.argv[2];
  const outputPath = process.argv[3] ?? "benchmark-report.json";
  const summaryOutputPath = process.argv[4] ?? "benchmark-summary.json";
  const limit = Number.parseInt(process.env.BENCHMARK_MAX_RECORDS ?? "500", 10);
  const maxConsecutiveFailures = Number.parseInt(
    process.env.BENCHMARK_MAX_CONSECUTIVE_FAILURES ?? "3",
    10
  );
  if (!datasetPath) {
    throw new Error(
      "Usage: npm run benchmark -- <evaluation.jsonl> [report.json] [summary.json]"
    );
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("BENCHMARK_MAX_RECORDS must be a positive integer.");
  }
  if (!Number.isInteger(maxConsecutiveFailures) || maxConsecutiveFailures <= 0) {
    throw new Error("BENCHMARK_MAX_CONSECUTIVE_FAILURES must be a positive integer.");
  }
  const benchmarkVariants = selectedVariants();
  const modelEligibleOnly = (process.env.BENCHMARK_MODEL_ELIGIBLE_ONLY ?? "false").toLowerCase() === "true";
  const dataset = await loadDataset(datasetPath);
  const records = (modelEligibleOnly
    ? dataset.filter((record) => analyzeEmail(record.request).result !== "PHISHING")
    : dataset
  ).slice(0, limit);
  if (records.length === 0) {
    throw new Error("No evaluation records matched the benchmark selection.");
  }
  const baseConfig = getProcessConfig();
  const needsRag = benchmarkVariants.some((variant) => variant.rag);
  const ragRetriever = needsRag
    ? createRagRetriever({ ...baseConfig, ragEnabled: true })
    : undefined;
  const evaluationCache = new Map<string, EvaluationCache>();

  for (const [index, record] of records.entries()) {
    const heuristic = analyzeEmail(record.request);
    let rag: RagRetrievalResult | undefined;
    if (heuristic.result !== "PHISHING" && ragRetriever) {
      console.info(JSON.stringify({
        event: "benchmark_rag_retrieval_started",
        record: index + 1,
        total: records.length,
      }));
      try {
        rag = await ragRetriever.retrieve(record.request);
      } catch (error) {
        throw new Error(
          `RAG retrieval failed for evaluation record ${index + 1}: ${errorMessage(error)}`
        );
      }
    }
    evaluationCache.set(record.id, { heuristic, rag });
  }

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    modelEligibleOnly,
    ragCorpusVersion: process.env.RAG_CORPUS_VERSION,
    records: records.length,
    selectedVariants: benchmarkVariants.map((variant) => variant.id),
    note: needsRag
      ? "Heuristic PHISHING decisions bypass every model. RAG retrieval is computed once per eligible message and reused across selected RAG variants."
      : "Heuristic PHISHING decisions bypass every model. No embeddings or Firestore retrievals were performed for this no-RAG benchmark.",
    variants: {},
  };

  for (const variant of benchmarkVariants) {
    const config: ProcessConfig = {
      ...baseConfig,
      llmProvider: variant.provider,
      llmModelId: variant.model,
      llmEndpoint: variant.endpoint,
      vertexLocation: variant.location,
      ragEnabled: variant.rag,
    };
    const provider = createModelProvider(config);
    const matrix: ConfusionMatrix = {
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
      warningOnPhishing: 0,
      warningOnSafe: 0,
    };
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningCharacters = 0;
    let modelCalls = 0;
    let modelAttempts = 0;
    let modelFailures = 0;
    const modelErrors: BenchmarkModelError[] = [];
    const misclassifications: BenchmarkMisclassification[] = [];
    let heuristicBypasses = 0;
    let consecutiveModelFailures = 0;
    let abortedAfterConsecutiveFailures = false;
    const latencies: number[] = [];

    for (const [index, record] of records.entries()) {
      const cached = evaluationCache.get(record.id);
      if (!cached) {
        throw new Error(`Missing evaluation cache entry for ${record.id}.`);
      }
      const { heuristic } = cached;
      if (heuristic.result === "PHISHING") {
        heuristicBypasses += 1;
        if (record.label === "phishing") {
          matrix.truePositive += 1;
        } else {
          matrix.falsePositive += 1;
          misclassifications.push({
            actualResult: "PHISHING",
            classification: "falsePositive",
            decisionSource: "heuristic",
            email: record.request,
            expectedLabel: record.label,
            heuristic,
            modelOutput: null,
            record: index + 1,
            recordId: record.id,
          });
        }
        continue;
      }
      const startedAt = Date.now();
      console.info(JSON.stringify({
        event: "benchmark_model_request_started",
        record: index + 1,
        total: records.length,
        variant: variant.id,
      }));
      modelAttempts += 1;
      let response;
      try {
        response = await provider.assess(
          {
            request: record.request,
            heuristic,
            ragDocuments: variant.rag ? cached.rag?.documents ?? [] : [],
          },
          variant.requestOptions
        );
      } catch (error) {
        const message = errorMessage(error);
        const modelError: BenchmarkModelError = {
          error: message,
          record: index + 1,
          ...(error instanceof InvalidModelResponseError ? {
            diagnostics: error.diagnostics,
            invalidOutput: error.debugOutput,
          } : {}),
        };
        modelFailures += 1;
        consecutiveModelFailures += 1;
        modelErrors.push(modelError);
        console.error(JSON.stringify({
          event: "benchmark_model_request_failed",
          error: message,
          ...(error instanceof InvalidModelResponseError ? {
            diagnostics: error.diagnostics,
            invalidOutput: error.debugOutput,
          } : {}),
          record: index + 1,
          variant: variant.id,
        }));
        if (consecutiveModelFailures >= maxConsecutiveFailures) {
          abortedAfterConsecutiveFailures = true;
          console.error(JSON.stringify({
            event: "benchmark_variant_aborted",
            consecutiveFailures: consecutiveModelFailures,
            variant: variant.id,
          }));
          break;
        }
        continue;
      }
      consecutiveModelFailures = 0;
      modelCalls += 1;
      latencies.push(Date.now() - startedAt);
      inputTokens += response.usage.inputTokens ?? 0;
      outputTokens += response.usage.outputTokens ?? 0;
      reasoningCharacters += response.usage.reasoningCharacters ?? 0;
      const predicted = response.assessment.result;
      if (predicted === "WARNING") {
        if (record.label === "phishing") {
          matrix.warningOnPhishing += 1;
        } else {
          matrix.warningOnSafe += 1;
        }
      } else if (predicted === "PHISHING" && record.label === "phishing") {
        matrix.truePositive += 1;
      } else if (predicted === "PHISHING") {
        matrix.falsePositive += 1;
        misclassifications.push({
          actualResult: predicted,
          classification: "falsePositive",
          decisionSource: "model",
          email: record.request,
          expectedLabel: record.label,
          heuristic,
          modelOutput: response,
          record: index + 1,
          recordId: record.id,
        });
      } else if (record.label === "safe") {
        matrix.trueNegative += 1;
      } else {
        matrix.falseNegative += 1;
        misclassifications.push({
          actualResult: predicted,
          classification: "falseNegative",
          decisionSource: "model",
          email: record.request,
          expectedLabel: record.label,
          heuristic,
          modelOutput: response,
          record: index + 1,
          recordId: record.id,
        });
      }
    }

    (report.variants as Record<string, unknown>)[variant.id] = {
      ...metricsFor(matrix, records.length),
      modelCalls,
      modelAttempts,
      modelFailures,
      modelFailureRate: ratio(modelFailures, modelAttempts),
      modelErrors,
      misclassifications,
      abortedAfterConsecutiveFailures,
      heuristicBypasses,
      inputTokens,
      outputTokens,
      reasoningCharacters,
      latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    };
  }

  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.info(`Benchmark report written to ${outputPath}`);

  const summary = createBenchmarkSummary(report);
  await writeFile(summaryOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.info(`Benchmark summary written to ${summaryOutputPath}`);

  const summaryBucket = process.env.BENCHMARK_SUMMARY_BUCKET;
  if (summaryBucket) {
    const [date] = String(summary.generatedAt).split("T", 1);
    const [year, month, day] = date.split("-");
    const run = process.env.GITHUB_RUN_ID
      ? `run-${process.env.GITHUB_RUN_ID}-attempt-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
      : randomUUID();
    const variant = benchmarkVariants.map((item) => item.id).join("+");
    const object = `summaries/${year}/${month}/${day}/${summary.generatedAt}-${variant}-${run}.json`;
    await new CloudStorageJsonWriter(summaryBucket).write(object, summary);
    console.info(JSON.stringify({
      event: "benchmark_summary_uploaded",
      bucket: summaryBucket,
      object,
    }));
  }

  const failures = Object.values(report.variants as Record<string, { modelFailures: number }>)
    .reduce((total, variant) => total + variant.modelFailures, 0);
  if (failures > 0) {
    throw new Error(`Benchmark completed with ${failures} model response failure(s). See ${outputPath}.`);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
