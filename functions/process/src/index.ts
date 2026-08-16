import { http } from "@google-cloud/functions-framework";
import express, { type NextFunction, type Request, type Response } from "express";

import {
  dkimVerdictValues,
  dmarcVerdictValues,
  spfVerdictValues,
  type ProcessEmailErrorResponse,
  type ProcessEmailRequest,
  type ProcessEmailResponse,
} from "./types";

const app = express();

const headerNames = ["from", "to", "subject", "reply-to", "return-path"] as const;

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

const isProcessedEmailRequest = (value: unknown): value is ProcessEmailRequest => {
  if (!isRecord(value)) {
    return false;
  }

  const requiredKeys = [
    "headers",
    "receivedChain",
    "securityVerdicts",
    "body",
    "truncated",
    "links",
  ];

  if (!hasOnlyKeys(value, requiredKeys) || !requiredKeys.every((key) => key in value)) {
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

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((_req: Request, res: Response, next: NextFunction): void => {
  res.set("access-control-allow-headers", "content-type, authorization");
  res.set("access-control-allow-methods", "OPTIONS, POST");
  res.set("access-control-allow-origin", "*");
  next();
});
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  next();
});

app.post(
  "/",
  (
    req: Request<Record<string, never>, ProcessEmailResponse | ProcessEmailErrorResponse, unknown>,
    res: Response<ProcessEmailResponse | ProcessEmailErrorResponse>
  ): void => {
    if (!isProcessedEmailRequest(req.body)) {
      res.status(400).json({
        error: "Request body does not match the ProcessedEmailData contract.",
      });
      return;
    }

    res.status(200).json({
      result: "WARNING",
      comment: "Placeholder response: phishing analysis is not implemented yet.",
    });
  }
);

app.all("/", (_req: Request, res: Response<ProcessEmailErrorResponse>): void => {
  res.status(405).json({
    error: "Method not allowed. Use POST.",
  });
});

app.use((_req: Request, res: Response<ProcessEmailErrorResponse>): void => {
  res.status(404).json({
    error: "Not found.",
  });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response<ProcessEmailErrorResponse>,
    _next: NextFunction
  ): void => {
    if (error instanceof SyntaxError) {
      res.status(400).json({
        error: "Request body must be valid JSON.",
      });
      return;
    }

    res.status(500).json({
      error: "Unexpected server error.",
    });
  }
);

http("processHttp", app);
