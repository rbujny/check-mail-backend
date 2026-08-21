import type { ProcessEmailRequest } from "./types";

export const createValidRequest = (
  overrides: Partial<ProcessEmailRequest> = {}
): ProcessEmailRequest => ({
  headers: {
    from: "Sender <sender@example.com>",
    to: "recipient@example.net",
    subject: "Project status",
  },
  receivedChain: ["from mail.example.com by mx.example.net with ESMTPS"],
  securityVerdicts: {
    spf: "pass",
    dkim: "pass",
    dmarc: "pass",
  },
  body: "The weekly project status is attached.",
  truncated: false,
  links: ["https://example.com/status"],
  ...overrides,
});
