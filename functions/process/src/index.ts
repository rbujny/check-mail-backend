import { http } from "@google-cloud/functions-framework";
import express, { type NextFunction, type Request, type Response } from "express";

import { processRequest } from "./process-request";
import type { ProcessEmailErrorResponse, ProcessEmailResponse } from "./types";

export const app = express();

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

export const processPostHandler = (
  req: Request<Record<string, never>, ProcessEmailResponse | ProcessEmailErrorResponse, unknown>,
  res: Response<ProcessEmailResponse | ProcessEmailErrorResponse>
): void => {
  const startedAt = Date.now();
  const result = processRequest(req.body);

  if (result.status === 400) {
    res.status(result.status).json(result.body);
    return;
  }

  console.info(
    JSON.stringify({
      event: "email_analysis_completed",
      result: result.analysis.result,
      score: result.analysis.score,
      findingCodes: result.analysis.findings.map((finding) => finding.code),
      durationMs: Date.now() - startedAt,
    })
  );

  res.status(result.status).json(result.body);
};

export const methodNotAllowedHandler = (
  _req: Request,
  res: Response<ProcessEmailErrorResponse>
): void => {
  res.status(405).json({
    error: "Method not allowed. Use POST.",
  });
};

export const notFoundHandler = (_req: Request, res: Response<ProcessEmailErrorResponse>): void => {
  res.status(404).json({
    error: "Not found.",
  });
};

export const errorHandler = (
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
};

app.post("/", processPostHandler);
app.all("/", methodNotAllowedHandler);
app.use(notFoundHandler);
app.use(errorHandler);

http("processHttp", app);
