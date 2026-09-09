import {
  databaseConfigFromEnv,
  getDatabasePool,
  queryModelStats,
  queryOverviewMetrics,
  queryRecentScans,
  queryTimelineBuckets,
  queryTopHeuristics,
} from "./database";
import { getMockScans, getMockStats } from "./mock-data";
import type { DashboardStatsResponse, ScanItem, ScansListResponse } from "./types";

const isProduction = (): boolean => {
  return process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
};

export const getDashboardStats = async (range = "all"): Promise<DashboardStatsResponse> => {
  const config = databaseConfigFromEnv();
  const pool = await getDatabasePool();

  // If no database config exists (local dev without GCP), return mock preview
  if (!pool || !config) {
    console.info(
      JSON.stringify({
        severity: "INFO",
        event: "dashboard_mock_preview",
        message: "No database configuration found, serving local mock preview",
      })
    );
    return getMockStats();
  }

  try {
    const overview = await queryOverviewMetrics(pool, range);
    // If the table is legitimately empty (0 scans yet)
    if (overview.totalScans === 0) {
      console.warn(
        JSON.stringify({
          severity: "WARNING",
          event: "dashboard_empty_database",
          message: "process_results table has 0 records, falling back to mock preview",
        })
      );
      return getMockStats();
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
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "dashboard_query_error",
        message: "Failed to query live metrics from PostgreSQL",
        error: error instanceof Error ? error.message : String(error),
      })
    );

    // In production, do not mask real database failures with fake data
    if (isProduction()) {
      throw error;
    }

    return getMockStats();
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
    const mock = getMockScans();
    const filtered =
      verdict && verdict !== "ALL" ? mock.filter((s) => s.finalResult === verdict) : mock;
    return {
      scans: filtered.slice(0, clampedLimit),
      total: filtered.length,
      isMockData: true,
    };
  }

  try {
    const rows = await queryRecentScans(pool, clampedLimit, verdict);
    if (rows.length === 0) {
      const mock = getMockScans();
      const filtered =
        verdict && verdict !== "ALL" ? mock.filter((s) => s.finalResult === verdict) : mock;
      return {
        scans: filtered.slice(0, clampedLimit),
        total: filtered.length,
        isMockData: true,
      };
    }

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
      })
    );

    if (isProduction()) {
      throw error;
    }

    const mock = getMockScans();
    const filtered =
      verdict && verdict !== "ALL" ? mock.filter((s) => s.finalResult === verdict) : mock;
    return {
      scans: filtered.slice(0, clampedLimit),
      total: filtered.length,
      isMockData: true,
    };
  }
};
