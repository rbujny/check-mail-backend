import { isIP } from "node:net";
import { domainToASCII } from "node:url";

import type {
  AnalysisResult,
  HeuristicFinding,
  HeuristicFindingCode,
  ProcessEmailRequest,
  ProcessEmailResponse,
} from "./types";

const MAX_SCORE = 100;
const WARNING_THRESHOLD = 20;
const PHISHING_THRESHOLD = 50;

const urgencyPatterns = [
  /\baction required\b/iu,
  /\bimmediately\b/iu,
  /\bnatychmiast\b/iu,
  /\bpiln(?:e|ie|y)\b/iu,
  /\burgent\b/iu,
];
const actionPatterns = [
  /\bclick\b/iu,
  /\bkliknij\b/iu,
  /\blog in\b/iu,
  /\blogin\b/iu,
  /\bzaloguj\b/iu,
  /\bverify\b/iu,
  /\bpotwierd(?:ź|z)\b/iu,
];
const credentialPatterns = [
  /\bcredential/iu,
  /\bhasł/iu,
  /\bpassword/iu,
  /\bverify (?:your )?account\b/iu,
  /\bpotwierd(?:ź|z) (?:swoje )?konto\b/iu,
];
const paymentPatterns = [
  /\bbank transfer\b/iu,
  /\binvoice\b/iu,
  /\bpłatno/iu,
  /\bpayment\b/iu,
  /\bprzelew/iu,
];
const threatPatterns = [
  /\baccount (?:is )?(?:blocked|locked|suspended)\b/iu,
  /\bkonto (?:zostanie |jest )?(?:zablokowane|zawieszone)\b/iu,
  /\blose access\b/iu,
  /\butracisz dostęp\b/iu,
];

const addFinding = (
  findings: HeuristicFinding[],
  code: HeuristicFindingCode,
  score: number,
  message: string
): void => {
  if (!findings.some((finding) => finding.code === code)) {
    findings.push({ code, score, message });
  }
};

const normalizeDomain = (domain: string): string | null => {
  const normalized = domainToASCII(
    domain
      .trim()
      .replace(/^\[|\]$/gu, "")
      .toLowerCase()
  );
  return normalized && /^[a-z0-9.-]+$/u.test(normalized) ? normalized.replace(/\.$/u, "") : null;
};

export const extractEmailDomain = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }

  const angleAddress = headerValue.match(/<([^<>\s]+@[^<>\s]+)>/u)?.[1];
  const plainAddress = headerValue.match(/[^\s<>,;]+@[^\s<>,;]+/u)?.[0];
  const address = angleAddress ?? plainAddress;

  if (!address) {
    return null;
  }

  const separator = address.lastIndexOf("@");
  return separator > 0 ? normalizeDomain(address.slice(separator + 1)) : null;
};

const domainsMatch = (first: string, second: string): boolean =>
  first === second || first.endsWith(`.${second}`) || second.endsWith(`.${first}`);

const analyzeAuthentication = (
  request: ProcessEmailRequest,
  findings: HeuristicFinding[]
): void => {
  const { spf, dkim, dmarc } = request.securityVerdicts;

  if (spf === "fail") {
    addFinding(findings, "SPF_FAIL", 20, "SPF verification failed.");
  } else if (spf === "softfail") {
    addFinding(findings, "SPF_SOFTFAIL", 10, "SPF produced a soft failure.");
  } else if (spf === "none") {
    addFinding(findings, "SPF_NONE", 5, "SPF verification is unavailable.");
  }

  if (dkim === "fail") {
    addFinding(findings, "DKIM_FAIL", 20, "DKIM verification failed.");
  } else if (dkim === "none") {
    addFinding(findings, "DKIM_NONE", 5, "DKIM verification is unavailable.");
  }

  if (dmarc === "fail") {
    addFinding(findings, "DMARC_FAIL", 30, "DMARC verification failed.");
  } else if (dmarc === "none") {
    addFinding(findings, "DMARC_NONE", 5, "DMARC verification is unavailable.");
  }

  if (spf === "pass" && dkim === "pass" && dmarc === "pass") {
    addFinding(findings, "AUTH_ALL_PASS", -10, "SPF, DKIM, and DMARC verification passed.");
  }
};

const analyzeIdentity = (
  request: ProcessEmailRequest,
  findings: HeuristicFinding[]
): string | null => {
  const fromDomain = extractEmailDomain(request.headers.from);
  const replyToDomain = extractEmailDomain(request.headers["reply-to"]);
  const returnPathDomain = extractEmailDomain(request.headers["return-path"]);

  if (!fromDomain) {
    addFinding(findings, "FROM_ADDRESS_INVALID", 10, "The sender address cannot be verified.");
    return null;
  }

  if (replyToDomain && !domainsMatch(fromDomain, replyToDomain)) {
    addFinding(
      findings,
      "REPLY_TO_DOMAIN_MISMATCH",
      20,
      "Reply-To uses a different domain than the sender."
    );
  }

  if (returnPathDomain && !domainsMatch(fromDomain, returnPathDomain)) {
    addFinding(
      findings,
      "RETURN_PATH_DOMAIN_MISMATCH",
      15,
      "Return-Path uses a different domain than the sender."
    );
  }

  return fromDomain;
};

const analyzeLinks = (
  request: ProcessEmailRequest,
  senderDomain: string | null,
  findings: HeuristicFinding[]
): void => {
  const webDomains = new Set<string>();

  for (const link of request.links) {
    if (link.toLowerCase().startsWith("mailto:")) {
      const mailtoAddress = link.slice("mailto:".length).split("?", 1)[0];
      const mailtoDomain = extractEmailDomain(mailtoAddress);
      if (senderDomain && mailtoDomain && !domainsMatch(senderDomain, mailtoDomain)) {
        addFinding(
          findings,
          "LINK_MAILTO_DOMAIN_MISMATCH",
          10,
          "A contact link uses a domain different from the sender."
        );
      }
      continue;
    }

    let url: URL;
    try {
      url = new URL(link);
    } catch {
      addFinding(findings, "LINK_INVALID", 10, "The message contains an invalid link.");
      continue;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      addFinding(findings, "LINK_INVALID", 10, "The message contains an unsupported link.");
      continue;
    }

    const hostname = normalizeDomain(url.hostname);
    if (!hostname) {
      addFinding(findings, "LINK_INVALID", 10, "The message contains an invalid link host.");
      continue;
    }

    webDomains.add(hostname);

    if (url.protocol === "http:") {
      addFinding(findings, "LINK_INSECURE_HTTP", 5, "A link uses unencrypted HTTP.");
    }

    if (isIP(hostname) !== 0) {
      addFinding(findings, "LINK_IP_HOST", 20, "A link points directly to an IP address.");
    }

    if (url.username || url.password) {
      addFinding(findings, "LINK_USERINFO", 20, "A link contains misleading user information.");
    }

    if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
      addFinding(
        findings,
        "LINK_PUNYCODE_HOST",
        15,
        "A link uses an encoded international domain."
      );
    }

    if (hostname.split(".").length >= 5) {
      addFinding(
        findings,
        "LINK_EXCESSIVE_SUBDOMAINS",
        10,
        "A link uses an unusually deep subdomain."
      );
    }

    if (url.port && url.port !== "80" && url.port !== "443") {
      addFinding(
        findings,
        "LINK_NON_STANDARD_PORT",
        10,
        "A link uses a non-standard network port."
      );
    }
  }

  if (senderDomain && [...webDomains].some((domain) => !domainsMatch(senderDomain, domain))) {
    addFinding(
      findings,
      "LINK_EXTERNAL_DOMAIN",
      10,
      "A link points to a domain different from the sender."
    );
  }

  if (webDomains.size >= 3) {
    addFinding(
      findings,
      "LINK_MULTIPLE_DOMAINS",
      10,
      "The message links to multiple unrelated domains."
    );
  }
};

const matchesAny = (value: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(value));

const analyzeContent = (request: ProcessEmailRequest, findings: HeuristicFinding[]): void => {
  const text = `${request.headers.subject ?? ""}\n${request.body}`;
  const hasUrgency = matchesAny(text, urgencyPatterns);
  const hasAction = matchesAny(text, actionPatterns);

  if (hasUrgency && hasAction) {
    addFinding(
      findings,
      "MESSAGE_URGENCY_AND_ACTION",
      10,
      "The message combines urgency with a call to action."
    );
  }

  if (matchesAny(text, credentialPatterns)) {
    addFinding(
      findings,
      "MESSAGE_CREDENTIAL_LANGUAGE",
      10,
      "The message asks about credentials or account verification."
    );
  }

  if (matchesAny(text, paymentPatterns)) {
    addFinding(
      findings,
      "MESSAGE_PAYMENT_LANGUAGE",
      5,
      "The message contains payment-related language."
    );
  }

  if (matchesAny(text, threatPatterns)) {
    addFinding(
      findings,
      "MESSAGE_THREAT_LANGUAGE",
      10,
      "The message threatens loss of account access."
    );
  }
};

const applyCombinationRules = (findings: HeuristicFinding[]): void => {
  const findingCodes = new Set(findings.map((finding) => finding.code));
  const technicalLinkCodes: HeuristicFindingCode[] = [
    "LINK_EXCESSIVE_SUBDOMAINS",
    "LINK_IP_HOST",
    "LINK_NON_STANDARD_PORT",
    "LINK_PUNYCODE_HOST",
    "LINK_USERINFO",
  ];
  const technicalLinkCount = technicalLinkCodes.filter((code) => findingCodes.has(code)).length;

  if (technicalLinkCount >= 2) {
    addFinding(
      findings,
      "LINK_MULTIPLE_TECHNICAL_INDICATORS",
      15,
      "A link combines multiple techniques commonly used to obscure its destination."
    );
  }

  if (
    findingCodes.has("REPLY_TO_DOMAIN_MISMATCH") &&
    findingCodes.has("LINK_EXTERNAL_DOMAIN") &&
    findingCodes.has("MESSAGE_CREDENTIAL_LANGUAGE")
  ) {
    addFinding(
      findings,
      "IDENTITY_CREDENTIAL_LINK_COMBINATION",
      20,
      "Sender identity mismatch accompanies a credential request and an external link."
    );
  }
};

const classify = (score: number): ProcessEmailResponse["result"] => {
  if (score >= PHISHING_THRESHOLD) {
    return "PHISHING";
  }

  if (score >= WARNING_THRESHOLD) {
    return "WARNING";
  }

  return "OK";
};

const buildComment = (
  result: ProcessEmailResponse["result"],
  findings: HeuristicFinding[]
): string => {
  const reasons = findings
    .filter((finding) => finding.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 3)
    .map((finding) => finding.message);

  if (reasons.length === 0) {
    return "No significant phishing indicators were detected by the current heuristic rules.";
  }

  if (result === "OK") {
    return `Low-risk indicators: ${reasons.join(" ")}`;
  }

  return reasons.join(" ");
};

export const analyzeEmail = (request: ProcessEmailRequest): AnalysisResult => {
  const findings: HeuristicFinding[] = [];

  analyzeAuthentication(request, findings);
  const senderDomain = analyzeIdentity(request, findings);
  analyzeLinks(request, senderDomain, findings);
  analyzeContent(request, findings);
  applyCombinationRules(findings);

  if (request.receivedChain.length === 0) {
    addFinding(
      findings,
      "EMPTY_RECEIVED_CHAIN",
      5,
      "The message does not contain a Received header chain."
    );
  }

  const score = Math.min(
    MAX_SCORE,
    Math.max(
      0,
      findings.reduce((total, finding) => total + finding.score, 0)
    )
  );
  const result = classify(score);

  return {
    score,
    result,
    findings,
    comment: buildComment(result, findings),
  };
};
