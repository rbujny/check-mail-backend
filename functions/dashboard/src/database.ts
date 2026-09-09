import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";

import type {
  HeuristicFindingStat,
  ModelStat,
  OverviewMetrics,
  ProcessResultRow,
  TimelineBucket,
} from "./types";

export type DatabaseConfig = {
  database: string;
  instanceConnectionName: string;
  password: string;
  user: string;
};

export const databaseConfigFromEnv = (): DatabaseConfig | undefined => {
  const instanceConnectionName = process.env.DB_INSTANCE_CONNECTION_NAME;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  return instanceConnectionName && database && user && password
    ? { instanceConnectionName, database, user, password }
    : undefined;
};

let cachedPool: Pool | undefined;
let cachedConnector: Connector | undefined;

export const getDatabasePool = async (): Promise<Pool | null> => {
  if (cachedPool) {
    return cachedPool;
  }

  const config = databaseConfigFromEnv();
  if (!config) {
    return null;
  }

  try {
    cachedConnector = new Connector();
    const connectionOptions = await cachedConnector.getOptions({
      instanceConnectionName: config.instanceConnectionName,
      ipType: IpAddressTypes.PUBLIC,
    });
    cachedPool = new Pool({
      ...connectionOptions,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      query_timeout: 10000,
      statement_timeout: 10000,
    });
    cachedPool.on("error", (error: Error) => {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          event: "postgres_dashboard_pool_error",
          message: error.message,
        })
      );
    });
    return cachedPool;
  } catch (error) {
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "Failed to connect to Cloud SQL PostgreSQL",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    if (cachedConnector) {
      cachedConnector.close();
      cachedConnector = undefined;
    }
    return null;
  }
};

export const closeDatabasePool = async (): Promise<void> => {
  if (cachedPool) {
    try {
      await cachedPool.end();
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "WARNING",
          message: "Error during pool shutdown",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      cachedPool = undefined;
    }
  }

  if (cachedConnector) {
    try {
      cachedConnector.close();
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "WARNING",
          message: "Error closing Cloud SQL connector",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      cachedConnector = undefined;
    }
  }
};

export const getRangeInterval = (range: string): string => {
  switch (range) {
    case "24h":
      return "24 hours";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    default:
      return "36500 days";
  }
};

export const getDateFormat = (range: string): string => {
  return range === "24h" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";
};

export const queryOverviewMetrics = async (pool: Pool, range: string): Promise<OverviewMetrics> => {
  const interval = getRangeInterval(range);
  const result = await pool.query(
    `SELECT
      COUNT(*)::integer AS total_scans,
      COUNT(*) FILTER (WHERE final_result = 'PHISHING')::integer AS phishing_count,
      COUNT(*) FILTER (WHERE final_result = 'WARNING')::integer AS warning_count,
      COUNT(*) FILTER (WHERE final_result = 'OK')::integer AS ok_count,
      COUNT(*) FILTER (WHERE route = 'heuristic')::integer AS heuristic_count,
      COUNT(*) FILTER (WHERE route = 'llm')::integer AS llm_count,
      COALESCE(AVG(duration_ms), 0)::double precision AS avg_duration,
      COALESCE(AVG(duration_ms) FILTER (WHERE route = 'llm'), 0)::double precision AS avg_llm_duration,
      COALESCE(AVG(duration_ms) FILTER (WHERE route = 'heuristic'), 0)::double precision AS avg_heuristic_duration,
      COALESCE(SUM(input_tokens), 0)::integer AS total_input_tokens,
      COALESCE(SUM(output_tokens), 0)::integer AS total_output_tokens
    FROM process_results
    WHERE created_at >= NOW() - $1::interval`,
    [interval]
  );

  const row = result.rows[0];
  const total = Number(row.total_scans) || 0;
  const phishing = Number(row.phishing_count) || 0;
  const warning = Number(row.warning_count) || 0;
  const ok = Number(row.ok_count) || 0;
  const heuristicCount = Number(row.heuristic_count) || 0;
  const llmCount = Number(row.llm_count) || 0;
  const inTokens = Number(row.total_input_tokens) || 0;
  const outTokens = Number(row.total_output_tokens) || 0;

  // Pricing estimate formula (approx $0.30 / 1M in, $2.50 / 1M out for Flash-Lite)
  const estimatedCost = (inTokens * 0.3 + outTokens * 2.5) / 1_000_000;

  return {
    totalScans: total,
    phishingCount: phishing,
    warningCount: warning,
    okCount: ok,
    phishingRate: total > 0 ? Number(((phishing / total) * 100).toFixed(1)) : 0,
    warningRate: total > 0 ? Number(((warning / total) * 100).toFixed(1)) : 0,
    okRate: total > 0 ? Number(((ok / total) * 100).toFixed(1)) : 0,
    heuristicRouteCount: heuristicCount,
    llmRouteCount: llmCount,
    heuristicShieldRate: total > 0 ? Number(((heuristicCount / total) * 100).toFixed(1)) : 0,
    avgDurationMs: Math.round(Number(row.avg_duration) || 0),
    avgLlmDurationMs: Math.round(Number(row.avg_llm_duration) || 0),
    avgHeuristicDurationMs: Math.round(Number(row.avg_heuristic_duration) || 0),
    totalInputTokens: inTokens,
    totalOutputTokens: outTokens,
    estimatedCostUsd: Number(estimatedCost.toFixed(4)),
  };
};

export const queryTimelineBuckets = async (
  pool: Pool,
  range: string
): Promise<TimelineBucket[]> => {
  const interval = getRangeInterval(range);
  const dateFormat = getDateFormat(range);

  const result = await pool.query(
    `SELECT
      TO_CHAR(created_at, $2) AS date_bucket,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE final_result = 'PHISHING')::integer AS phishing,
      COUNT(*) FILTER (WHERE final_result = 'WARNING')::integer AS warning,
      COUNT(*) FILTER (WHERE final_result = 'OK')::integer AS ok
    FROM process_results
    WHERE created_at >= NOW() - $1::interval
    GROUP BY date_bucket
    ORDER BY date_bucket ASC
    LIMIT 30`,
    [interval, dateFormat]
  );

  return result.rows.map((r) => ({
    date: r.date_bucket,
    total: Number(r.total),
    phishing: Number(r.phishing),
    warning: Number(r.warning),
    ok: Number(r.ok),
  }));
};

export const queryModelStats = async (pool: Pool, range: string): Promise<ModelStat[]> => {
  const interval = getRangeInterval(range);
  const result = await pool.query(
    `SELECT
      COALESCE(model, 'Heuristic Bypass') AS model_name,
      COUNT(*)::integer AS count,
      COALESCE(AVG(duration_ms), 0)::double precision AS avg_duration,
      COALESCE(AVG(confidence), 0)::double precision AS avg_confidence,
      COALESCE(SUM(input_tokens), 0)::integer AS in_tokens,
      COALESCE(SUM(output_tokens), 0)::integer AS out_tokens
    FROM process_results
    WHERE created_at >= NOW() - $1::interval
    GROUP BY model_name
    ORDER BY count DESC`,
    [interval]
  );

  return result.rows.map((r) => ({
    model: r.model_name,
    count: Number(r.count),
    avgDurationMs: Math.round(Number(r.avg_duration)),
    avgConfidence: Number((Number(r.avg_confidence) * 100).toFixed(1)),
    totalInputTokens: Number(r.in_tokens),
    totalOutputTokens: Number(r.out_tokens),
  }));
};

export const queryTopHeuristics = async (
  pool: Pool,
  range: string
): Promise<HeuristicFindingStat[]> => {
  const interval = getRangeInterval(range);
  try {
    const result = await pool.query(
      `SELECT
        finding->>'code' AS code,
        COUNT(*)::integer AS count
      FROM process_results,
      jsonb_array_elements(details->'heuristic'->'findings') AS finding
      WHERE created_at >= NOW() - $1::interval
      GROUP BY code
      ORDER BY count DESC
      LIMIT 8`,
      [interval]
    );

    const labels: Record<string, string> = {
      AUTH_ALL_PASS: "Security passes (SPF/DKIM/DMARC)",
      SPF_FAIL: "SPF Authentication Failed",
      SPF_NONE: "No SPF Record",
      SPF_SOFTFAIL: "SPF Softfail",
      DKIM_FAIL: "DKIM Signature Invalid",
      DMARC_FAIL: "DMARC Policy Violation",
      LINK_IP_HOST: "IP-based Link Hostname",
      LINK_PUNYCODE_HOST: "Punycode/Homograph Domain",
      LINK_MAILTO_DOMAIN_MISMATCH: "Mailto Domain Mismatch",
      MESSAGE_CREDENTIAL_LANGUAGE: "Credential Harvester Keywords",
      MESSAGE_PAYMENT_LANGUAGE: "Urgent Payment Demand",
      MESSAGE_URGENCY_AND_ACTION: "Psychological Urgency Trigger",
      LINK_MULTIPLE_DOMAINS: "Excessive Foreign Domains",
      IDENTITY_CREDENTIAL_LINK_COMBINATION: "Spoofed Identity + Login Link",
    };

    return result.rows.map((r) => ({
      code: r.code,
      count: Number(r.count),
      label: labels[r.code] || r.code,
    }));
  } catch (error) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "Could not query fine-grained findings",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return [];
  }
};

export const queryRecentScans = async (
  pool: Pool,
  limit = 50,
  verdict?: string
): Promise<ProcessResultRow[]> => {
  const clampedLimit = Math.min(Math.max(limit, 1), 200);
  let query = `
    SELECT
      id, created_at, duration_ms, final_result, comment, route,
      heuristic_result, heuristic_score, model_selection, provider,
      model, confidence, input_tokens, output_tokens, rag_corpus_version,
      rag_hit_count, details
    FROM process_results
  `;
  const values: unknown[] = [];

  if (verdict && ["OK", "WARNING", "PHISHING"].includes(verdict)) {
    query += ` WHERE final_result = $1 ORDER BY created_at DESC LIMIT $2`;
    values.push(verdict, clampedLimit);
  } else {
    query += ` ORDER BY created_at DESC LIMIT $1`;
    values.push(clampedLimit);
  }

  const result = await pool.query(query, values);
  return result.rows as ProcessResultRow[];
};
