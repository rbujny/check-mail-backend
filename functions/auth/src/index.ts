import { http } from "@google-cloud/functions-framework";
import { createPrivateKey } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import type { AuthErrorResponse, AuthSuccessResponse, TokenRequestBody } from "./types";

const app = express();

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

const parseDurationSeconds = (value: number | string): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d+$/u.test(trimmed)) {
    return Number(trimmed);
  }

  const match = trimmed.match(/^(\d+)([smhd])$/iu);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    d: 60 * 60 * 24,
    h: 60 * 60,
    m: 60,
    s: 1,
  };

  return amount * multipliers[unit];
};

const getDecodedPayload = (token: string): JwtPayload | null => {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded === "string") {
    return null;
  }

  return decoded;
};

const getPrivateKey = (): ReturnType<typeof createPrivateKey> | null => {
  const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/gu, "\n");
  return privateKey ? createPrivateKey(privateKey) : null;
};

app.post(
  "/",
  (
    req: Request<Record<string, never>, AuthSuccessResponse | AuthErrorResponse, TokenRequestBody>,
    res: Response<AuthSuccessResponse | AuthErrorResponse>
  ): void => {
    const privateKey = getPrivateKey();
    if (!privateKey) {
      res.status(500).json({
        error: "JWT_PRIVATE_KEY environment variable is not configured with a valid RSA key.",
      });
      return;
    }

    if (
      req.body === undefined ||
      req.body === null ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      res.status(400).json({
        error: "Request body must be a JSON object.",
      });
      return;
    }

    const body = req.body;

    if (!body.subject || typeof body.subject !== "string") {
      res.status(400).json({
        error: "Field 'subject' is required and must be a string.",
      });
      return;
    }

    const defaultExpiresIn = process.env.JWT_EXPIRES_IN ?? "1h";
    const expiresInSeconds = parseDurationSeconds(body.expiresIn ?? defaultExpiresIn);

    if (!expiresInSeconds) {
      res.status(400).json({
        error: "Invalid token lifetime. Use seconds or a suffix like 15m, 1h, or 7d.",
      });
      return;
    }

    const issuer = process.env.JWT_ISSUER ?? "checkmail-backend";
    const audience = process.env.JWT_AUDIENCE ?? "checkmail-clients";
    const payload = {};
    const signOptions: SignOptions = {
      algorithm: "RS256",
      audience,
      expiresIn: expiresInSeconds,
      issuer,
      keyid: process.env.JWT_KEY_ID ?? "checkmail-primary",
      subject: body.subject,
    };
    const token = jwt.sign(payload, privateKey, signOptions);
    const decodedPayload = getDecodedPayload(token);

    if (
      !decodedPayload ||
      typeof decodedPayload.exp !== "number" ||
      typeof decodedPayload.iat !== "number"
    ) {
      res.status(500).json({
        error: "Failed to decode the generated token.",
      });
      return;
    }

    res.status(200).json({
      audience,
      expiresAt: decodedPayload.exp,
      issuedAt: decodedPayload.iat,
      issuer,
      subject: body.subject,
      token,
      tokenType: "Bearer",
    });
  }
);

app.all("/", (_req: Request, res: Response<AuthErrorResponse>): void => {
  res.status(405).json({
    error: "Method not allowed. Use POST.",
  });
});

app.use((_req: Request, res: Response<AuthErrorResponse>): void => {
  res.status(404).json({
    error: "Not found.",
  });
});

app.use(
  (error: unknown, _req: Request, res: Response<AuthErrorResponse>, _next: NextFunction): void => {
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

http("authHttp", app);
