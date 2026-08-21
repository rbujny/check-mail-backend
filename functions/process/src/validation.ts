import {
  dkimVerdictValues,
  dmarcVerdictValues,
  spfVerdictValues,
  type ProcessEmailRequest,
} from "./types";

const headerNames = ["from", "to", "subject", "reply-to", "return-path"] as const;
const requestKeys = [
  "headers",
  "receivedChain",
  "securityVerdicts",
  "body",
  "truncated",
  "links",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === "string";

const isStringArray = (value: unknown, maxItems?: number, maxItemLength?: number): boolean =>
  Array.isArray(value) &&
  (maxItems === undefined || value.length <= maxItems) &&
  value.every(
    (item) =>
      typeof item === "string" && (maxItemLength === undefined || item.length <= maxItemLength)
  );

export const isProcessedEmailRequest = (value: unknown): value is ProcessEmailRequest => {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOnlyKeys(value, requestKeys) || !requestKeys.every((key) => key in value)) {
    return false;
  }

  const headers = value.headers;
  if (!isRecord(headers) || !hasOnlyKeys(headers, headerNames)) {
    return false;
  }

  if (!headerNames.every((name) => isOptionalString(headers[name]))) {
    return false;
  }

  const securityVerdicts = value.securityVerdicts;
  if (!isRecord(securityVerdicts) || !hasOnlyKeys(securityVerdicts, ["spf", "dkim", "dmarc"])) {
    return false;
  }

  const { spf, dkim, dmarc } = securityVerdicts;
  const validSpf =
    spf === undefined || (typeof spf === "string" && spfVerdictValues.includes(spf as never));
  const validDkim =
    dkim === undefined || (typeof dkim === "string" && dkimVerdictValues.includes(dkim as never));
  const validDmarc =
    dmarc === undefined ||
    (typeof dmarc === "string" && dmarcVerdictValues.includes(dmarc as never));

  return (
    validSpf &&
    validDkim &&
    validDmarc &&
    isStringArray(value.receivedChain) &&
    typeof value.body === "string" &&
    value.body.length <= 1000 &&
    typeof value.truncated === "boolean" &&
    isStringArray(value.links, 50, 2048)
  );
};
