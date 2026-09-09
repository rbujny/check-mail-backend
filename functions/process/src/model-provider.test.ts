import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenAiCompatibleRequestBody, buildPrompt, parseAssessment } from "./model-provider";
import type { ModelInput } from "./model-provider";

const input: ModelInput = {
  request: {
    headers: {
      from: "Sender <sender@example.com>",
      to: "recipient@example.net",
      subject: "Call user@example.net about case 123456",
      "reply-to": "reply@example.org",
      "return-path": "bounce@example.com",
    },
    receivedChain: ["raw private routing data"],
    securityVerdicts: { spf: "pass", dkim: "pass", dmarc: "pass" },
    body: "Contact victim@example.net and open https://example.org/private?token=secret-123456",
    truncated: false,
    links: ["https://example.org/private?token=secret-123456"],
  },
  heuristic: { result: "OK", score: 0, comment: "ok", findings: [] },
  ragDocuments: [
    {
      id: "safe-1",
      label: "safe",
      source: "test",
      text: "Example for person@example.com with id 987654",
    },
  ],
};

test("buildPrompt minimizes addresses, URL paths, long identifiers, and received headers", () => {
  const prompt = buildPrompt(input);

  assert.doesNotMatch(prompt, /user@example\.net|victim@example\.net|person@example\.com/u);
  assert.doesNotMatch(prompt, /private|token=|raw private routing data|123456|987654/u);
  assert.match(prompt, /<EMAIL@example\.net>/u);
  assert.match(prompt, /https:\/\/example\.org/u);
  assert.match(prompt, /"receivedHopCount":1/u);
});

test("parseAssessment accepts a complete JSON object wrapped in a markdown fence", () => {
  assert.deepEqual(
    parseAssessment(`\`\`\`json
{"result":"WARNING","confidence":0.75,"comment":"Suspicious authentication signals.","signals":["AUTH_FAILURE"]}
\`\`\``),
    {
      result: "WARNING",
      confidence: 0.75,
      comment: "Suspicious authentication signals.",
      signals: ["AUTH_FAILURE"],
    }
  );
});

test("parseAssessment normalizes exact result case variants", () => {
  for (const [result, expected] of [
    ["ok", "OK"],
    ["Warning", "WARNING"],
    ["phishing", "PHISHING"],
  ] as const) {
    assert.equal(
      parseAssessment(
        JSON.stringify({
          result,
          confidence: 0.9,
          comment: "Case-normalized assessment.",
          signals: [],
        })
      ).result,
      expected
    );
  }
});

test("parseAssessment rejects result values that differ by more than case", () => {
  assert.throws(
    () =>
      parseAssessment(
        JSON.stringify({
          result: "safe",
          confidence: 0.9,
          comment: "Unsupported result alias.",
          signals: [],
        })
      ),
    /assessment contract/u
  );
});

test("OpenAI-compatible request disables reasoning for the regular Gemma variant", () => {
  const body = buildOpenAiCompatibleRequestBody("gemma-test", input, {
    maxOutputTokens: 256,
    reasoningMode: "disabled",
  });

  assert.equal(body.max_tokens, 256);
  assert.equal(body.reasoning_effort, "none");
  assert.equal(body.reasoning_budget, 0);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
});

test("OpenAI-compatible request bounds reasoning for the thinking Gemma variant", () => {
  const body = buildOpenAiCompatibleRequestBody("gemma-test", input, {
    maxOutputTokens: 2048,
    reasoningBudget: 1536,
    reasoningMode: "enabled",
  });

  assert.equal(body.max_tokens, 2048);
  assert.equal(body.reasoning_effort, undefined);
  assert.equal(body.reasoning_budget, 1536);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: true });
});
