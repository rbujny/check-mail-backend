import assert from "node:assert/strict";
import test from "node:test";

import { createBenchmarkSummary } from "./benchmark-summary";

test("creates an aggregate benchmark summary without diagnostic or email data", () => {
  const summary = createBenchmarkSummary({
    generatedAt: "2026-09-01T12:00:00.000Z",
    modelEligibleOnly: true,
    records: 5,
    selectedVariants: ["test-variant"],
    note: "test",
    ragCorpusVersion: "v1",
    variants: {
      "test-variant": {
        accuracy: 0.8,
        emailProcessingTimeMs: { average: 125.5, min: 100, max: 151, p50: 151, p95: 151 },
        emailProcessingTimes: [{ recordId: "email-1", totalMs: 125.5 }],
        modelCalls: 5,
        modelErrors: [{ invalidOutput: "raw model output" }],
        misclassifications: [{ email: { body: "private email body" } }],
      },
    },
  }, {
    GITHUB_REPOSITORY: "owner/repository",
    GITHUB_RUN_ID: "123",
  });
  const serialized = JSON.stringify(summary);

  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.githubRun?.runId, "123");
  assert.equal(summary.ragCorpusVersion, "v1");
  assert.equal(summary.variants["test-variant"]?.accuracy, 0.8);
  assert.deepEqual(summary.variants["test-variant"]?.emailProcessingTimeMs, {
    average: 125.5,
    min: 100,
    max: 151,
    p50: 151,
    p95: 151,
  });
  assert.equal(summary.variants["test-variant"]?.modelErrorCount, 1);
  assert.equal(summary.variants["test-variant"]?.misclassificationCount, 1);
  assert.doesNotMatch(serialized, /raw model output/u);
  assert.doesNotMatch(serialized, /private email body/u);
  assert.doesNotMatch(serialized, /email-1/u);
});
