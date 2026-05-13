import { http } from "@google-cloud/functions-framework";
import express, { type Request, type Response } from "express";

import type { BasicHttpErrorResponse, BasicHttpResponse } from "./types";

const app = express();

app.disable("x-powered-by");

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
