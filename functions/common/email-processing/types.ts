export const scanResultValues = ["OK", "WARNING", "PHISHING"] as const;

export const spfVerdictValues = ["pass", "fail", "softfail", "none"] as const;
export const dkimVerdictValues = ["pass", "fail", "none"] as const;
export const dmarcVerdictValues = ["pass", "fail", "none"] as const;
export const runtimeModelValues = ["gemini-3.5-flash-lite", "gemini-3.7-flash"] as const;

export type ScanResult = (typeof scanResultValues)[number];
export type SpfVerdict = (typeof spfVerdictValues)[number];
export type DkimVerdict = (typeof dkimVerdictValues)[number];
export type DmarcVerdict = (typeof dmarcVerdictValues)[number];
export type RuntimeModel = (typeof runtimeModelValues)[number];

export interface ProcessedEmailHeaders {
  from?: string;
  to?: string;
  subject?: string;
  "reply-to"?: string;
  "return-path"?: string;
}

export interface SecurityVerdicts {
  spf?: SpfVerdict;
  dkim?: DkimVerdict;
  dmarc?: DmarcVerdict;
}

export interface ProcessedEmailData {
  headers: ProcessedEmailHeaders;
  receivedChain: string[];
  securityVerdicts: SecurityVerdicts;
  body: string;
  truncated: boolean;
  links: string[];
  model?: RuntimeModel;
}

export interface ProcessEmailResponse {
  result: ScanResult;
  comment: string;
}
