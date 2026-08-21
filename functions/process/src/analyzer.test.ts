import assert from "node:assert/strict";
import test from "node:test";

import { analyzeEmail, extractEmailDomain } from "./analyzer";
import { createValidRequest } from "./test-fixtures";

test("extracts and normalizes domains from common email header formats", () => {
  assert.equal(extractEmailDomain("Sender <user@Sub.Example.com>"), "sub.example.com");
  assert.equal(extractEmailDomain("user@example.com"), "example.com");
  assert.equal(extractEmailDomain("not an address"), null);
});

test("classifies a consistent authenticated message as OK", () => {
  const analysis = analyzeEmail(createValidRequest());

  assert.equal(analysis.result, "OK");
  assert.equal(analysis.score, 0);
  assert.deepEqual(
    analysis.findings.map((finding) => finding.code),
    ["AUTH_ALL_PASS"]
  );
});

test("does not classify missing authentication verdicts as phishing on their own", () => {
  const analysis = analyzeEmail(
    createValidRequest({
      securityVerdicts: { spf: "none", dkim: "none", dmarc: "none" },
    })
  );

  assert.equal(analysis.result, "OK");
  assert.equal(analysis.score, 15);
});

test("classifies combined SPF and DMARC failures as phishing", () => {
  const analysis = analyzeEmail(
    createValidRequest({
      securityVerdicts: { spf: "fail", dkim: "pass", dmarc: "fail" },
    })
  );

  assert.equal(analysis.result, "PHISHING");
  assert.equal(analysis.score, 50);
  assert.match(analysis.comment, /DMARC verification failed/u);
  assert.match(analysis.comment, /SPF verification failed/u);
});

test("combines identity, link, and credential language signals", () => {
  const analysis = analyzeEmail(
    createValidRequest({
      headers: {
        from: "Support <support@example.com>",
        "reply-to": "recovery@attacker.test",
        subject: "Urgent account verification",
      },
      body: "Click now to verify your password and avoid losing access.",
      links: ["https://attacker.test/login"],
    })
  );

  assert.equal(analysis.result, "PHISHING");
  assert.ok(analysis.score >= 50);
  assert.ok(analysis.findings.some((finding) => finding.code === "REPLY_TO_DOMAIN_MISMATCH"));
  assert.ok(analysis.findings.some((finding) => finding.code === "LINK_EXTERNAL_DOMAIN"));
  assert.ok(analysis.findings.some((finding) => finding.code === "MESSAGE_CREDENTIAL_LANGUAGE"));
});

test("detects technical URL indicators without exposing the URL in the comment", () => {
  const suspiciousUrl = "https://trusted.example.com@xn--paypa-4ve.test:8443/login";
  const analysis = analyzeEmail(
    createValidRequest({
      links: [suspiciousUrl],
    })
  );

  assert.equal(analysis.result, "PHISHING");
  assert.ok(analysis.findings.some((finding) => finding.code === "LINK_USERINFO"));
  assert.ok(analysis.findings.some((finding) => finding.code === "LINK_PUNYCODE_HOST"));
  assert.ok(analysis.findings.some((finding) => finding.code === "LINK_NON_STANDARD_PORT"));
  assert.doesNotMatch(analysis.comment, /xn--paypa-4ve/u);
});

test("analyzes malicious links even when the body is empty and truncated", () => {
  const analysis = analyzeEmail(
    createValidRequest({
      body: "",
      truncated: true,
      securityVerdicts: { spf: "fail", dkim: "none", dmarc: "fail" },
      links: ["http://192.0.2.1/login"],
    })
  );

  assert.equal(analysis.result, "PHISHING");
  assert.ok(analysis.findings.some((finding) => finding.code === "LINK_IP_HOST"));
  assert.ok(analysis.findings.some((finding) => finding.code === "LINK_INSECURE_HTTP"));
});

test("adds only one finding for repeated instances of the same link signal", () => {
  const analysis = analyzeEmail(
    createValidRequest({
      links: ["http://example.com/one", "http://example.com/two"],
    })
  );

  assert.equal(
    analysis.findings.filter((finding) => finding.code === "LINK_INSECURE_HTTP").length,
    1
  );
});
