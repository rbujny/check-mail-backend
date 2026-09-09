import assert from "node:assert/strict";
import test from "node:test";

import { buildStoredProcessResult, PostgresResultStore } from "./result-store";
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
    documents: [
      {
        id: "doc-1",
        label: "phishing",
        source: "test",
        text: "retrieved text must not be persisted",
      },
    ],
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

test("initializes the PostgreSQL schema once and inserts privacy-safe results", async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const store = new PostgresResultStore(async () => ({
    async query(text: string, values?: unknown[]) {
      queries.push({ text, values });
      return {};
    },
  }));

  const first = await store.save(pipeline, 123);
  await store.save(pipeline, 456);

  const inserts = queries.filter((query) => query.text.includes("INSERT INTO process_results"));
  const schemaInitializations = queries.filter((query) =>
    query.text.includes("CREATE TABLE IF NOT EXISTS process_results")
  );
  const storedJson = String(inserts[0]?.values?.[16]);

  assert.equal(first.storage, "postgresql");
  assert.equal(first.table, "process_results");
  assert.equal(schemaInitializations.length, 1);
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0]?.values?.[3], "WARNING");
  assert.equal(inserts[0]?.values?.[10], "test-model");
  assert.doesNotMatch(storedJson, /raw output must not be persisted/u);
  assert.doesNotMatch(storedJson, /retrieved text must not be persisted/u);
});
