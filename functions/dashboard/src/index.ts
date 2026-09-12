import { http } from "@google-cloud/functions-framework";
import express, { type NextFunction, type Request, type Response } from "express";

import { dashboardAuthMiddleware } from "./auth";
import { closeDatabasePool } from "./database";
import { getDashboardStats, getRecentScansList } from "./stats-service";
import type { DashboardStatsResponse, ScansListResponse } from "./types";
import { renderDashboardHtml } from "./ui";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Normalize Cloud Functions Gen 2 URL path prefix if accessed via cloudfunctions.net
app.use((req: Request, _res: Response, next: NextFunction): void => {
  if (req.url.startsWith("/checkmail-dashboard")) {
    req.url = req.url.replace(/^\/checkmail-dashboard/, "") || "/";
  }
  next();
});

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com data:; " +
      "img-src 'self' data:; " +
      "connect-src 'self' https://unpkg.com https://cdn.jsdelivr.net; " +
      "frame-ancestors 'none';"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  next();
});

// Favicon handler
app.get("/favicon.ico", (_req: Request, res: Response): void => {
  res.status(204).end();
});

// Healthcheck (publicly accessible for Cloud Run/GCP liveness checks)
app.get("/health", (_req: Request, res: Response): void => {
  res.status(200).json({ status: "healthy", service: "checkmail-dashboard" });
});

// Apply authentication middleware to admin routes
app.use(dashboardAuthMiddleware);

// Web Dashboard UI
app.get("/", (_req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(renderDashboardHtml());
});

// Stats API
app.get(
  "/api/stats",
  async (
    req: Request,
    res: Response<DashboardStatsResponse | { error: string; dbStatus: string }>
  ): Promise<void> => {
    try {
      const range = typeof req.query.range === "string" ? req.query.range : "all";
      const stats = await getDashboardStats(range);
      res.status(200).json(stats);
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "Error fetching dashboard stats",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load dashboard statistics.",
        dbStatus: "error",
      });
    }
  }
);

// Recent Scans Feed API
app.get(
  "/api/scans",
  async (req: Request, res: Response<ScansListResponse | { error: string }>): Promise<void> => {
    try {
      const rawLimit = Number(req.query.limit);
      const limit = Math.min(
        Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 1),
        200
      );
      const verdict = typeof req.query.verdict === "string" ? req.query.verdict : undefined;
      const scansList = await getRecentScansList(limit, verdict);
      res.status(200).json(scansList);
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "Error fetching recent scans list",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      res.status(500).json({ error: "Failed to load scans feed." });
    }
  }
);

// Fallback 404
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: "Not found." });
});

// Error handling middleware
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  console.error(
    JSON.stringify({
      severity: "ERROR",
      message: "Unhandled dashboard server error",
      error: error instanceof Error ? error.message : String(error),
    })
  );
  res.status(500).json({ error: "Internal server error in dashboard." });
});

// Graceful shutdown
const handleShutdown = async (signal: string): Promise<void> => {
  console.info(
    JSON.stringify({
      severity: "INFO",
      message: `Received ${signal}, terminating dashboard pool`,
    })
  );
  await closeDatabasePool();
};

process.once("SIGTERM", () => {
  void handleShutdown("SIGTERM");
});
process.once("SIGINT", () => {
  void handleShutdown("SIGINT");
});

http("dashboardHttp", app);

export { app };
