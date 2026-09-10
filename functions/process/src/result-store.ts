import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import {
  createDatabasePool,
  databaseConfigFromEnv,
  initializeProcessResultsSchema,
  type DatabaseClient,
} from "./database";
import type { AnalysisPipelineResult } from "./types";

export type StoredProcessResult = {
  createdAt: string;
  durationMs: number;
  heuristic: {
    findings: AnalysisPipelineResult["analysis"]["findings"];
    result: AnalysisPipelineResult["analysis"]["result"];
    score: number;
  };
  id: string;
  llm?: {
    assessment: NonNullable<AnalysisPipelineResult["llm"]>["assessment"];
    model: string;
    provider: string;
    usage: NonNullable<AnalysisPipelineResult["llm"]>["usage"];
  };
  modelSelection: AnalysisPipelineResult["modelSelection"];
  rag?: {
    corpusVersion: string;
    documentIds: string[];
    hitCount: number;
  };
  result: AnalysisPipelineResult["body"];
  route: AnalysisPipelineResult["route"];
  schemaVersion: 1;
};

export type StoredResultReference = {
  resultId: string;
  storage: "postgresql";
  table: "process_results";
};

export interface ResultStore {
  save(pipeline: AnalysisPipelineResult, durationMs: number): Promise<StoredResultReference>;
}

export const buildStoredProcessResult = (
  pipeline: AnalysisPipelineResult,
  durationMs: number,
  createdAt = new Date(),
  id = randomUUID()
): StoredProcessResult => ({
  schemaVersion: 1,
  id,
  createdAt: createdAt.toISOString(),
  durationMs,
  result: pipeline.body,
  route: pipeline.route,
  modelSelection: pipeline.modelSelection,
  heuristic: {
    result: pipeline.analysis.result,
    score: pipeline.analysis.score,
    findings: pipeline.analysis.findings,
  },
  ...(pipeline.llm
    ? {
        llm: {
          assessment: pipeline.llm.assessment,
          model: pipeline.llm.model,
          provider: pipeline.llm.provider,
          usage: pipeline.llm.usage,
        },
      }
    : {}),
  ...(pipeline.rag
    ? {
        rag: {
          corpusVersion: pipeline.rag.corpusVersion,
          documentIds: pipeline.rag.documents.map((document) => document.id),
          hitCount: pipeline.rag.documents.length,
        },
      }
    : {}),
});

export class PostgresResultStore implements ResultStore {
  private initialized: Promise<void> | undefined;

  constructor(private readonly getClient: () => Promise<DatabaseClient>) {}

  private async initialize(client: DatabaseClient): Promise<void> {
    await initializeProcessResultsSchema(client);
  }

  private async ensureInitialized(client: DatabaseClient): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.initialize(client).catch((error: unknown) => {
        this.initialized = undefined;
        throw error;
      });
    }
    await this.initialized;
  }

  async save(pipeline: AnalysisPipelineResult, durationMs: number): Promise<StoredResultReference> {
    const record = buildStoredProcessResult(pipeline, durationMs);
    const client = await this.getClient();
    await this.ensureInitialized(client);
    await client.query(
      `INSERT INTO process_results (
        id, created_at, duration_ms, final_result, comment, route,
        heuristic_result, heuristic_score, model_selection, provider, model,
        confidence, input_tokens, output_tokens, rag_corpus_version, rag_hit_count, details
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
      )`,
      [
        record.id,
        record.createdAt,
        record.durationMs,
        record.result.result,
        record.result.comment,
        record.route,
        record.heuristic.result,
        record.heuristic.score,
        record.modelSelection,
        record.llm?.provider ?? null,
        record.llm?.model ?? null,
        record.llm?.assessment.confidence ?? null,
        record.llm?.usage.inputTokens ?? null,
        record.llm?.usage.outputTokens ?? null,
        record.rag?.corpusVersion ?? null,
        record.rag?.hitCount ?? null,
        JSON.stringify(record),
      ]
    );

    return { resultId: record.id, storage: "postgresql", table: "process_results" };
  }
}

export const createResultStoreFromEnv = (): ResultStore | undefined => {
  const config = databaseConfigFromEnv();
  if (!config) {
    return undefined;
  }

  let pool: Promise<Pool> | undefined;
  const getPool = (): Promise<Pool> => {
    if (!pool) {
      pool = (async () => {
        const connection = await createDatabasePool(config);
        return connection.pool;
      })().catch((error: unknown) => {
        pool = undefined;
        throw error;
      });
    }
    return pool;
  };

  return new PostgresResultStore(getPool);
};
