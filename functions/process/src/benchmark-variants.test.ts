import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { durationSummary, variants } from "./benchmark";

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
      "gemma-4-12b-sfp8",
      "gemma-4-12b-sfp8-rag",
      "gemma-4-12b-sfp8-thinking",
      "gemma-4-12b-sfp8-thinking-rag",
      "gemma-4-26b-a4b",
      "gemma-4-26b-a4b-rag",
      "gemma-4-26b-a4b-thinking",
      "gemma-4-26b-a4b-thinking-rag",
    ]
  );
  assert.equal(localVariants.find((variant) => variant.id === "gemma-4-12b-sfp8")?.requestOptions?.reasoningMode, "disabled");
  assert.equal(localVariants.find((variant) => variant.id === "gemma-4-26b-a4b-thinking-rag")?.requestOptions?.reasoningMode, "enabled");
});

test("uses model-family aliases before the legacy Gemma alias", () => {
  process.env.GEMMA_ENDPOINT = "http://127.0.0.1:8080";
  process.env.GEMMA_MODEL_ID = "legacy";
  process.env.GEMMA_12B_MODEL_ID = "gemma-12b-local";
  process.env.GEMMA_26B_A4B_MODEL_ID = "gemma-26b-local";

  const definitions = variants();

  assert.equal(definitions.find((variant) => variant.id === "gemma-4-e4b")?.model, "legacy");
  assert.equal(definitions.find((variant) => variant.id === "gemma-4-12b-sfp8")?.model, "gemma-12b-local");
  assert.equal(definitions.find((variant) => variant.id === "gemma-4-26b-a4b")?.model, "gemma-26b-local");
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
