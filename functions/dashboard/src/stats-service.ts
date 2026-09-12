import {
  databaseConfigFromEnv,
  getDatabasePool,
  queryModelStats,
  queryOverviewMetrics,
  queryRecentScans,
  queryTimelineBuckets,
  queryTopHeuristics,
} from "./database";
import type { DashboardStatsResponse, ScanItem, ScansListResponse } from "./types";

const emptyStats = (): DashboardStatsResponse => ({
  overview: {
    totalScans: 0,
    phishingCount: 0,
    warningCount: 0,
    okCount: 0,
    phishingRate: 0,
    warningRate: 0,
    okRate: 0,
    heuristicRouteCount: 0,
    llmRouteCount: 0,
    heuristicShieldRate: 0,
    avgDurationMs: 0,
    avgLlmDurationMs: 0,
    avgHeuristicDurationMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCostUsd: 0,
  },
  timeline: [],
  models: [],
  topHeuristicFindings: [],
  isMockData: false,
  generatedAt: new Date().toISOString(),
  dbStatus: "no_config",
});

export const getDashboardStats = async (range = "all"): Promise<DashboardStatsResponse> => {
  const config = databaseConfigFromEnv();
  const pool = await getDatabasePool();

  // If no database config exists (local dev without GCP), return empty dashboard
  if (!pool || !config) {
    console.info(
      JSON.stringify({
        severity: "INFO",
        event: "dashboard_no_database",
        message: "No database configuration found — returning empty dashboard",
      })
    );
    return emptyStats();
  }

  try {
    const overview = await queryOverviewMetrics(pool, range);

    // If database is connected but table is empty, return real zeros (no mock data)
    if (overview.totalScans === 0) {
      return {
        overview,
        timeline: [],
        models: [],
        topHeuristicFindings: [],
        isMockData: false,
        generatedAt: new Date().toISOString(),
        dbStatus: "connected_empty",
      };
    }

    const [timeline, models, topHeuristicFindings] = await Promise.all([
      queryTimelineBuckets(pool, range),
      queryModelStats(pool, range),
      queryTopHeuristics(pool, range),
    ]);

    return {
      overview,
      timeline,
      models,
      topHeuristicFindings,
      isMockData: false,
      generatedAt: new Date().toISOString(),
      dbStatus: "connected",
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "dashboard_query_error",
        message: "Failed to query live metrics from PostgreSQL",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );

    // Surface the real error instead of masking it with mock data
    throw error;
  }
};

export const getRecentScansList = async (
  limit = 50,
  verdict?: string
): Promise<ScansListResponse> => {
  const clampedLimit = Math.min(Math.max(limit, 1), 200);
  const config = databaseConfigFromEnv();
  const pool = await getDatabasePool();

  if (!pool || !config) {
    return {
      scans: [],
      total: 0,
      isMockData: false,
    };
  }

  try {
    const rows = await queryRecentScans(pool, clampedLimit, verdict);

    const scans: ScanItem[] = rows.map((r) => ({
      id: r.id,
      createdAt:
        typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
      durationMs: r.duration_ms,
      finalResult: r.final_result,
      comment: r.comment,
      route: r.route,
      heuristicResult: r.heuristic_result,
      heuristicScore: r.heuristic_score,
      model: r.model,
      confidence: r.confidence,
      tokens: {
        input: r.input_tokens || 0,
        output: r.output_tokens || 0,
      },
      ragHitCount: r.rag_hit_count || 0,
      details: (r.details as Record<string, unknown>) || {},
    }));

    return {
      scans,
      total: scans.length,
      isMockData: false,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "dashboard_recent_scans_error",
        message: "Failed to query recent scans from PostgreSQL",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );

    throw error;
  }
};
