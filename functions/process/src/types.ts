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
