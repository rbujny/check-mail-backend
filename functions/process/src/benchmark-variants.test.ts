import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  durationSummary,
  exponentialBackoffMs,
  isResourceExhaustedError,
  variants,
} from "./benchmark";

const gemmaEnvironmentKeys = [
  "GEMMA_ENDPOINT",
  "GEMMA_MODEL_ID",
  "GEMMA_E4B_MODEL_ID",
  "GEMMA_12B_MODEL_ID",
  "GEMMA_26B_A4B_MODEL_ID",
] as const;

afterEach(() => {
  for (const key of gemmaEnvironmentKeys) {
    delete process.env[key];
  }
});

test("adds RAG and thinking modes for every local Gemma family", () => {
  process.env.GEMMA_ENDPOINT = "http://127.0.0.1:8080";

  const localVariants = variants().filter((variant) => variant.provider === "openai-compatible");

  assert.deepEqual(
    localVariants.map((variant) => variant.id),
    [
      "gemma-4-e4b",
      "gemma-4-e4b-rag",
      "gemma-4-e4b-thinking",
      "gemma-4-e4b-thinking-rag",
      "gemma-4-12b-q8_0",
      "gemma-4-12b-q8_0-rag",
      "gemma-4-12b-q8_0-thinking",
      "gemma-4-12b-q8_0-thinking-rag",
      "gemma-4-26b-a4b",
      "gemma-4-26b-a4b-rag",
      "gemma-4-26b-a4b-thinking",
      "gemma-4-26b-a4b-thinking-rag",
    ]
  );
  assert.equal(
    localVariants.find((variant) => variant.id === "gemma-4-12b-q8_0")?.requestOptions
      ?.reasoningMode,
    "disabled"
  );
  assert.equal(
    localVariants.find((variant) => variant.id === "gemma-4-12b-q8_0")?.requestOptions
      ?.maxOutputTokens,
    1024
  );
  assert.equal(
    localVariants.find((variant) => variant.id === "gemma-4-26b-a4b-thinking-rag")?.requestOptions
      ?.reasoningMode,
    "enabled"
  );
  assert.equal(
    localVariants.find((variant) => variant.id === "gemma-4-26b-a4b-thinking-rag")?.requestOptions
      ?.maxOutputTokens,
    4096
  );
  assert.equal(
    localVariants.find((variant) => variant.id === "gemma-4-26b-a4b-thinking-rag")?.requestOptions
      ?.reasoningBudget,
    3072
  );
});

test("uses model-family aliases before the legacy Gemma alias", () => {
  process.env.GEMMA_ENDPOINT = "http://127.0.0.1:8080";
  process.env.GEMMA_MODEL_ID = "legacy";
  process.env.GEMMA_12B_MODEL_ID = "gemma-12b-local";
  process.env.GEMMA_26B_A4B_MODEL_ID = "gemma-26b-local";

  const definitions = variants();

  assert.equal(definitions.find((variant) => variant.id === "gemma-4-e4b")?.model, "legacy");
  assert.equal(
    definitions.find((variant) => variant.id === "gemma-4-12b-q8_0")?.model,
    "gemma-12b-local"
  );
  assert.equal(
    definitions.find((variant) => variant.id === "gemma-4-26b-a4b")?.model,
    "gemma-26b-local"
  );
});

test("summarizes per-email processing durations", () => {
  assert.deepEqual(durationSummary([30, 10, 20]), {
    average: 20,
    min: 10,
    max: 30,
    p50: 20,
    p95: 30,
  });
  assert.deepEqual(durationSummary([]), {
    average: 0,
    min: 0,
    max: 0,
    p50: 0,
    p95: 0,
  });
});

test("recognizes Gemini resource exhaustion errors", () => {
  assert.equal(isResourceExhaustedError(new Error("Resource has been exhausted")), true);
  assert.equal(isResourceExhaustedError({ response: { status: 429 } }), true);
  assert.equal(isResourceExhaustedError({ code: "RESOURCE_EXHAUSTED" }), true);
  assert.equal(isResourceExhaustedError(new Error("Model response is not valid JSON")), false);
});

test("caps exponential Gemini backoff", () => {
  assert.equal(exponentialBackoffMs(0, 10_000, 60_000), 10_000);
  assert.equal(exponentialBackoffMs(1, 10_000, 60_000), 20_000);
  assert.equal(exponentialBackoffMs(2, 10_000, 60_000), 40_000);
  assert.equal(exponentialBackoffMs(3, 10_000, 60_000), 60_000);
  assert.equal(exponentialBackoffMs(4, 10_000, 60_000), 60_000);
});
