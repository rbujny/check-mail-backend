export type ScanVerdict = "OK" | "WARNING" | "PHISHING";
export type DecisionRoute = "heuristic" | "llm";

export interface ProcessResultRow {
  id: string;
  created_at: string;
  duration_ms: number;
  final_result: ScanVerdict;
  comment: string;
  route: DecisionRoute;
  heuristic_result: ScanVerdict;
  heuristic_score: number;
  model_selection: string;
  provider: string | null;
  model: string | null;
  confidence: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  rag_corpus_version: string | null;
  rag_hit_count: number | null;
  details: Record<string, unknown>;
}

export interface OverviewMetrics {
  totalScans: number;
  phishingCount: number;
  warningCount: number;
  okCount: number;
  phishingRate: number;
  warningRate: number;
  okRate: number;
  heuristicRouteCount: number;
  llmRouteCount: number;
  heuristicShieldRate: number;
  avgDurationMs: number;
  avgLlmDurationMs: number;
  avgHeuristicDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
}

export interface TimelineBucket {
  date: string;
  total: number;
  phishing: number;
  warning: number;
  ok: number;
}

export interface ModelStat {
  model: string;
  count: number;
  avgDurationMs: number;
  avgConfidence: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface HeuristicFindingStat {
  code: string;
  count: number;
  label: string;
}

export interface DashboardStatsResponse {
  overview: OverviewMetrics;
  timeline: TimelineBucket[];
  models: ModelStat[];
  topHeuristicFindings: HeuristicFindingStat[];
  isMockData: boolean;
  generatedAt: string;
  dbStatus?: "connected" | "connected_empty" | "no_config" | "error";
}

export interface ScanItem {
  id: string;
  createdAt: string;
  durationMs: number;
  finalResult: ScanVerdict;
  comment: string;
  route: DecisionRoute;
  heuristicResult: ScanVerdict;
  heuristicScore: number;
  model: string | null;
  confidence: number | null;
  tokens: {
    input: number;
    output: number;
  };
  ragHitCount: number;
  details: Record<string, unknown>;
}

export interface ScansListResponse {
  scans: ScanItem[];
  total: number;
  isMockData: boolean;
}

export interface TimeRangeFilter {
  range: "24h" | "7d" | "30d" | "all";
  verdict?: ScanVerdict;
}
