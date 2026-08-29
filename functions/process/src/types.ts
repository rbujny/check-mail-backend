export const spfVerdictValues = ["pass", "fail", "softfail", "none"] as const;
export const dkimVerdictValues = ["pass", "fail", "none"] as const;
export const dmarcVerdictValues = ["pass", "fail", "none"] as const;

export type ProcessedEmailHeaders = {
  from?: string;
  to?: string;
  subject?: string;
  "reply-to"?: string;
  "return-path"?: string;
};

export type SecurityVerdicts = {
  spf?: (typeof spfVerdictValues)[number];
  dkim?: (typeof dkimVerdictValues)[number];
  dmarc?: (typeof dmarcVerdictValues)[number];
};

export type ProcessEmailRequest = {
  headers: ProcessedEmailHeaders;
  receivedChain: string[];
  securityVerdicts: SecurityVerdicts;
  body: string;
  truncated: boolean;
  links: string[];
};

export type ProcessEmailResponse = {
  result: "OK" | "WARNING" | "PHISHING";
  comment: string;
};

export type ProcessEmailErrorResponse = {
  error: string;
};

export type LlmScanResult = ProcessEmailResponse["result"];

export type LlmAssessment = {
  result: LlmScanResult;
  confidence: number;
  comment: string;
  signals: string[];
};

export type ModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningCharacters?: number;
};

export type ModelAssessment = {
  assessment: LlmAssessment;
  model: string;
  provider: string;
  usage: ModelUsage;
};

export type RagDocument = {
  id: string;
  label: "safe" | "phishing";
  text: string;
  source: string;
};

export type RagRetrievalResult = {
  documents: RagDocument[];
  corpusVersion: string;
};

export type AnalysisPipelineResult = {
  body: ProcessEmailResponse;
  analysis: AnalysisResult;
  llm?: ModelAssessment;
  rag?: RagRetrievalResult;
  route: "heuristic" | "llm";
};

export type HeuristicFindingCode =
  | "AUTH_ALL_PASS"
  | "DKIM_FAIL"
  | "DKIM_NONE"
  | "DMARC_FAIL"
  | "DMARC_NONE"
  | "EMPTY_RECEIVED_CHAIN"
  | "FROM_ADDRESS_INVALID"
  | "LINK_EXCESSIVE_SUBDOMAINS"
  | "LINK_EXTERNAL_DOMAIN"
  | "LINK_INSECURE_HTTP"
  | "LINK_INVALID"
  | "LINK_IP_HOST"
  | "LINK_MAILTO_DOMAIN_MISMATCH"
  | "LINK_MULTIPLE_TECHNICAL_INDICATORS"
  | "LINK_MULTIPLE_DOMAINS"
  | "LINK_NON_STANDARD_PORT"
  | "LINK_PUNYCODE_HOST"
  | "LINK_USERINFO"
  | "MESSAGE_CREDENTIAL_LANGUAGE"
  | "MESSAGE_PAYMENT_LANGUAGE"
  | "MESSAGE_THREAT_LANGUAGE"
  | "MESSAGE_URGENCY_AND_ACTION"
  | "IDENTITY_CREDENTIAL_LINK_COMBINATION"
  | "REPLY_TO_DOMAIN_MISMATCH"
  | "RETURN_PATH_DOMAIN_MISMATCH"
  | "SPF_FAIL"
  | "SPF_NONE"
  | "SPF_SOFTFAIL";

export type HeuristicFinding = {
  code: HeuristicFindingCode;
  score: number;
  message: string;
};

export type AnalysisResult = {
  score: number;
  result: ProcessEmailResponse["result"];
  findings: HeuristicFinding[];
  comment: string;
};

export type ProcessRequestResult =
  | {
      status: 200;
      body: ProcessEmailResponse;
      pipeline: AnalysisPipelineResult;
    }
  | {
      status: 400;
      body: ProcessEmailErrorResponse;
    }
  | {
      status: 503;
      body: ProcessEmailErrorResponse;
    };
