import { http } from "@google-cloud/functions-framework";
import express, { type NextFunction, type Request, type Response } from "express";

import { processRequest, type ProcessDependencies } from "./process-request";
import { createResultStoreFromEnv, type ResultStore } from "./result-store";
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

export const createProcessPostHandler =
  (
    dependencies?: ProcessDependencies,
    resultStore: ResultStore | undefined = createResultStoreFromEnv()
  ) =>
  (
    req: Request<Record<string, never>, ProcessEmailResponse | ProcessEmailErrorResponse, unknown>,
    res: Response<ProcessEmailResponse | ProcessEmailErrorResponse>
  ): Promise<void> => {
    const startedAt = Date.now();
    return processRequest(req.body, dependencies).then(async (result) => {
      if (result.status !== 200) {
        res.status(result.status).json(result.body);
        return;
      }

      const durationMs = Date.now() - startedAt;
      let storedResult;
      try {
        if (!resultStore) {
          throw new Error("PostgreSQL result persistence is not configured.");
        }
        storedResult = await resultStore.save(result.pipeline, durationMs);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "email_analysis_persistence_failed",
            errorType: error instanceof Error ? error.name : "unknown",
          })
        );
        res.status(503).json({ error: "Analysis service temporarily unavailable." });
        return;
      }

      console.info(
        JSON.stringify({
          event: "email_analysis_completed",
          route: result.pipeline.route,
          heuristicResult: result.pipeline.analysis.result,
          heuristicScore: result.pipeline.analysis.score,
          findingCodes: result.pipeline.analysis.findings.map((finding) => finding.code),
          result: result.body.result,
          modelSelection: result.pipeline.modelSelection,
          provider: result.pipeline.llm?.provider,
          model: result.pipeline.llm?.model,
          confidence: result.pipeline.llm?.assessment.confidence,
          inputTokens: result.pipeline.llm?.usage.inputTokens,
          outputTokens: result.pipeline.llm?.usage.outputTokens,
          ragCorpusVersion: result.pipeline.rag?.corpusVersion,
          ragHitCount: result.pipeline.rag?.documents.length,
          durationMs,
          resultId: storedResult?.resultId,
          storage: storedResult?.storage,
          storageTable: storedResult?.table,
        })
      );

      res.status(result.status).json(result.body);
    });
  };

export const processPostHandler = createProcessPostHandler();

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
