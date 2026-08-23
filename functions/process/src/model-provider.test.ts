import assert from "node:assert/strict";
import test from "node:test";

import { buildPrompt } from "./model-provider";
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
  ragDocuments: [{
    id: "safe-1",
    label: "safe",
    source: "test",
    text: "Example for person@example.com with id 987654",
  }],
};

test("buildPrompt minimizes addresses, URL paths, long identifiers, and received headers", () => {
  const prompt = buildPrompt(input);

  assert.doesNotMatch(prompt, /user@example\.net|victim@example\.net|person@example\.com/u);
  assert.doesNotMatch(prompt, /private|token=|raw private routing data|123456|987654/u);
  assert.match(prompt, /<EMAIL@example\.net>/u);
  assert.match(prompt, /https:\/\/example\.org/u);
  assert.match(prompt, /"receivedHopCount":1/u);
});
