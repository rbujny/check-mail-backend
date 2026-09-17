import assert from "node:assert/strict";
import test from "node:test";

import { buildCorpusDocument } from "./rag-ingest";

const record = {
  id: "record-hash",
  label: "phishing" as const,
  text: "Subject: Verify account\nBody: Open the supplied link.",
  source: "public-test-corpus",
  sourceRecordId: "source-1",
  signals: ["credential request", "urgent call to action"],
  explanation: "The message requests account verification through a link.",
};

test("RAG v1 embeds and returns the unchanged source text", () => {
  assert.deepEqual(buildCorpusDocument(record, "v1"), {
    contextText: record.text,
    documentId: record.id,
    embeddingText: record.text,
  });
});

test("RAG v2 separates retrieval features from the model context", () => {
  const document = buildCorpusDocument(record, "v2");

  assert.equal(document.documentId, `v2-${record.id}`);
  assert.match(document.embeddingText, /Observed security signals:/u);
  assert.match(document.embeddingText, /credential request/u);
  assert.doesNotMatch(document.embeddingText, /Reviewed explanation/u);
  assert.doesNotMatch(document.embeddingText, /requests account verification through a link/u);
  assert.match(document.contextText, /Reviewed security signals:/u);
  assert.match(document.contextText, /Reviewed explanation:/u);
  assert.match(document.contextText, /requests account verification through a link/u);
});

test("RAG v2 rejects a record without enrichment", () => {
  assert.throws(
    () => buildCorpusDocument({ ...record, signals: undefined, explanation: undefined }, "v2"),
    /require signals and explanation/u
  );
});
