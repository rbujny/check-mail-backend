import type { DashboardStatsResponse, ScanItem } from "./types";

export const getMockStats = (): DashboardStatsResponse => {
  return {
    isMockData: true,
    generatedAt: new Date().toISOString(),
    overview: {
      totalScans: 142,
      phishingCount: 48,
      warningCount: 22,
      okCount: 72,
      phishingRate: 33.8,
      warningRate: 15.5,
      okRate: 50.7,
      heuristicRouteCount: 38,
      llmRouteCount: 104,
      heuristicShieldRate: 26.8,
      avgDurationMs: 684,
      avgLlmDurationMs: 890,
      avgHeuristicDurationMs: 24,
      totalInputTokens: 114250,
      totalOutputTokens: 12400,
      estimatedCostUsd: 0.0653,
    },
    timeline: [
      { date: "2026-09-03", total: 18, phishing: 6, warning: 3, ok: 9 },
      { date: "2026-09-04", total: 24, phishing: 9, warning: 4, ok: 11 },
      { date: "2026-09-05", total: 15, phishing: 5, warning: 2, ok: 8 },
      { date: "2026-09-06", total: 22, phishing: 7, warning: 4, ok: 11 },
      { date: "2026-09-07", total: 29, phishing: 11, warning: 3, ok: 15 },
      { date: "2026-09-08", total: 20, phishing: 6, warning: 4, ok: 10 },
      { date: "2026-09-09", total: 14, phishing: 4, warning: 2, ok: 8 },
    ],
    models: [
      {
        model: "gemini-3.5-flash-lite",
        count: 78,
        avgDurationMs: 740,
        avgConfidence: 94.2,
        totalInputTokens: 82000,
        totalOutputTokens: 8600,
      },
      {
        model: "Heuristic Bypass",
        count: 38,
        avgDurationMs: 24,
        avgConfidence: 100.0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      },
      {
        model: "gemini-3.7-flash",
        count: 26,
        avgDurationMs: 1180,
        avgConfidence: 98.4,
        totalInputTokens: 32250,
        totalOutputTokens: 3800,
      },
    ],
    topHeuristicFindings: [
      { code: "SPF_FAIL", count: 34, label: "SPF Authentication Failed" },
      { code: "LINK_IP_HOST", count: 28, label: "IP-based Link Hostname" },
      { code: "MESSAGE_CREDENTIAL_LANGUAGE", count: 24, label: "Credential Harvester Keywords" },
      { code: "LINK_MAILTO_DOMAIN_MISMATCH", count: 19, label: "Mailto Domain Mismatch" },
      { code: "DKIM_FAIL", count: 17, label: "DKIM Signature Invalid" },
      { code: "MESSAGE_URGENCY_AND_ACTION", count: 15, label: "Psychological Urgency Trigger" },
      { code: "LINK_PUNYCODE_HOST", count: 11, label: "Punycode/Homograph Domain" },
      { code: "AUTH_ALL_PASS", count: 52, label: "Security passes (SPF/DKIM/DMARC)" },
    ],
  };
};

export const getMockScans = (): ScanItem[] => {
  return [
    {
      id: "9f8a7b6c-1234-4567-89ab-cdef01234567",
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      durationMs: 21,
      finalResult: "PHISHING",
      comment:
        "Critical heuristic detection: sender spoofing with numeric IP link and urgent password credential harvesting.",
      route: "heuristic",
      heuristicResult: "PHISHING",
      heuristicScore: 85,
      model: null,
      confidence: 1.0,
      tokens: { input: 0, output: 0 },
      ragHitCount: 0,
      details: {
        heuristic: {
          score: 85,
          result: "PHISHING",
          findings: [
            { code: "SPF_FAIL", score: 30, message: "SPF validation failed" },
            { code: "LINK_IP_HOST", score: 35, message: "Link target is raw IP" },
            {
              code: "MESSAGE_CREDENTIAL_LANGUAGE",
              score: 20,
              message: "Demands login credentials",
            },
          ],
        },
      },
    },
    {
      id: "1a2b3c4d-5678-90ab-cdef-1234567890ab",
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      durationMs: 765,
      finalResult: "PHISHING",
      comment:
        "LLM confirmed phishing: deceptive email posing as IT support with malicious account re-verification link.",
      route: "llm",
      heuristicResult: "WARNING",
      heuristicScore: 40,
      model: "gemini-3.5-flash-lite",
      confidence: 0.96,
      tokens: { input: 1120, output: 140 },
      ragHitCount: 5,
      details: {
        heuristic: {
          score: 40,
          result: "WARNING",
          findings: [
            {
              code: "MESSAGE_URGENCY_AND_ACTION",
              score: 25,
              message: "Account closure threat within 24h",
            },
            {
              code: "LINK_MULTIPLE_DOMAINS",
              score: 15,
              message: "Multiple untrusted domains linked",
            },
          ],
        },
        llm: {
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          assessment: {
            result: "PHISHING",
            confidence: 0.96,
            comment:
              "Deceptive account suspension notice matching known corporate spear-phishing patterns.",
            signals: ["URGENT_CALL_TO_ACTION", "FAKE_PORTAL_LINK"],
          },
          usage: { inputTokens: 1120, outputTokens: 140 },
        },
        rag: {
          corpusVersion: "v1",
          hitCount: 5,
          documentIds: ["doc-phish-881", "doc-phish-421", "doc-phish-109"],
        },
      },
    },
    {
      id: "2b3c4d5e-6789-01bc-def2-2345678901bc",
      createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
      durationMs: 620,
      finalResult: "OK",
      comment:
        "Analysis complete: legitimate newsletter from verified domain with passing authentication.",
      route: "llm",
      heuristicResult: "OK",
      heuristicScore: -20,
      model: "gemini-3.5-flash-lite",
      confidence: 0.98,
      tokens: { input: 980, output: 95 },
      ragHitCount: 5,
      details: {
        heuristic: {
          score: -20,
          result: "OK",
          findings: [
            { code: "AUTH_ALL_PASS", score: -20, message: "SPF, DKIM, and DMARC all passed" },
          ],
        },
        llm: {
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          assessment: {
            result: "OK",
            confidence: 0.98,
            comment: "Clean newsletter without suspicious links or deceptive language.",
            signals: [],
          },
          usage: { inputTokens: 980, outputTokens: 95 },
        },
      },
    },
    {
      id: "3c4d5e6f-7890-12cd-ef34-3456789012cd",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      durationMs: 1250,
      finalResult: "WARNING",
      comment:
        "Suspicious invoice notification with unverified external attachments and payment inquiry.",
      route: "llm",
      heuristicResult: "WARNING",
      heuristicScore: 35,
      model: "gemini-3.7-flash",
      confidence: 0.78,
      tokens: { input: 1350, output: 160 },
      ragHitCount: 5,
      details: {
        heuristic: {
          score: 35,
          result: "WARNING",
          findings: [
            {
              code: "MESSAGE_PAYMENT_LANGUAGE",
              score: 20,
              message: "Overdue invoice notification",
            },
            {
              code: "LINK_MAILTO_DOMAIN_MISMATCH",
              score: 15,
              message: "Reply address domain mismatch",
            },
          ],
        },
        llm: {
          provider: "gemini",
          model: "gemini-3.7-flash",
          assessment: {
            result: "WARNING",
            confidence: 0.78,
            comment: "Potential vendor payment fraud attempt; recommend secondary validation.",
            signals: ["FINANCIAL_URGENCY", "EXTERNAL_SENDER"],
          },
          usage: { inputTokens: 1350, outputTokens: 160 },
        },
      },
    },
  ];
};
