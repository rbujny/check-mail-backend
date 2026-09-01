import assert from "node:assert/strict";
import test from "node:test";

import { buildStoredProcessResult } from "./result-store";
import type { AnalysisPipelineResult } from "./types";

const pipeline: AnalysisPipelineResult = {
  body: { result: "WARNING", comment: "Suspicious authentication signals." },
  analysis: {
    result: "WARNING",
    score: 25,
    comment: "Suspicious authentication signals.",
    findings: [{ code: "DKIM_FAIL", score: 20, message: "DKIM verification failed." }],
  },
  llm: {
    assessment: {
      result: "WARNING",
      confidence: 0.8,
      comment: "Suspicious authentication signals.",
      signals: ["DKIM_FAIL"],
    },
    model: "test-model",
    provider: "test-provider",
    rawOutput: "raw output must not be persisted",
    usage: { inputTokens: 100, outputTokens: 20 },
  },
  modelSelection: "gemini-3.7-flash",
  rag: {
    corpusVersion: "v1",
    documents: [{
      id: "doc-1",
      label: "phishing",
      source: "test",
      text: "retrieved text must not be persisted",
    }],
  },
  route: "llm",
};

test("builds a privacy-safe versioned processing result", () => {
  const result = buildStoredProcessResult(
    pipeline,
    123,
    new Date("2026-09-01T12:34:56.000Z"),
    "00000000-0000-4000-8000-000000000000"
  );
  const serialized = JSON.stringify(result);

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.id, "00000000-0000-4000-8000-000000000000");
  assert.equal(result.durationMs, 123);
  assert.equal(result.llm?.model, "test-model");
  assert.deepEqual(result.rag?.documentIds, ["doc-1"]);
  assert.doesNotMatch(serialized, /raw output must not be persisted/u);
  assert.doesNotMatch(serialized, /retrieved text must not be persisted/u);
});
