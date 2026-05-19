import { http } from "@google-cloud/functions-framework";
import express, { type NextFunction, type Request, type Response } from "express";

import type { BasicHttpErrorResponse, BasicHttpResponse } from "./types";

const app = express();

app.disable("x-powered-by");
app.use((_req: Request, res: Response, next: NextFunction): void => {
  res.set("access-control-allow-headers", "content-type, authorization");
  res.set("access-control-allow-methods", "GET, OPTIONS");
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

app.get("/", (req: Request, res: Response<BasicHttpResponse>): void => {
  res.status(200).json({
    message: "check-mail backend is alive",
    method: req.method ?? "UNKNOWN",
  });
});

app.all("/", (_req: Request, res: Response<BasicHttpErrorResponse>): void => {
  res.status(405).json({
    error: "Method not allowed. Use GET.",
  });
});

app.use((_req: Request, res: Response<BasicHttpErrorResponse>): void => {
  res.status(404).json({
    error: "Not found.",
  });
});

http("helloHttp", app);
