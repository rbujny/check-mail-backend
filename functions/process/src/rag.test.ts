import assert from "node:assert/strict";
import test from "node:test";

import { buildRagQueryText } from "./rag";
import { createValidRequest } from "./test-fixtures";
import type { AnalysisResult } from "./types";

const heuristic: AnalysisResult = {
  score: 30,
  result: "WARNING",
  comment: "Internal aggregate comment.",
  findings: [
    {
      code: "REPLY_TO_DOMAIN_MISMATCH",
      score: 20,
      message: "Reply-To uses a different domain than the sender.",
    },
    {
      code: "MESSAGE_CREDENTIAL_LANGUAGE",
      score: 10,
      message: "The message asks for credentials or account verification.",
    },
  ],
};

test("RAG v1 query retains the original representation", () => {
  const query = buildRagQueryText(createValidRequest(), heuristic, "v1");

  assert.match(query, /Project status/u);
  assert.match(query, /SPF=pass/u);
  assert.doesNotMatch(query, /Observed security signals/u);
  assert.doesNotMatch(query, /different domain than the sender/u);
});

test("RAG v2 query adds heuristic evidence without score or verdict", () => {
  const query = buildRagQueryText(createValidRequest(), heuristic, "v2");

  assert.match(query, /Observed security signals:/u);
  assert.match(query, /reply-to uses a different domain than the sender/u);
  assert.match(query, /asks for credentials or account verification/u);
  assert.doesNotMatch(query, /Internal aggregate comment/u);
  assert.doesNotMatch(query, /REPLY_TO_DOMAIN_MISMATCH/u);
  assert.doesNotMatch(query, /score=30|WARNING/u);
});
