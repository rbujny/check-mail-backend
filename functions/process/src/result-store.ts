import { randomUUID } from "node:crypto";

import { GoogleAuth } from "google-auth-library";

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
  bucket: string;
  object: string;
  resultId: string;
};

export interface ResultStore {
  save(pipeline: AnalysisPipelineResult, durationMs: number): Promise<StoredResultReference>;
}

export class CloudStorageJsonWriter {
  private readonly auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
  });

  constructor(private readonly bucket: string) {}

  async write(object: string, value: unknown): Promise<void> {
    const client = await this.auth.getClient();
    await client.request({
      url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o`,
      method: "POST",
      params: {
        ifGenerationMatch: 0,
        name: object,
        uploadType: "media",
      },
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      data: JSON.stringify(value),
    });
  }
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
  ...(pipeline.llm ? {
    llm: {
      assessment: pipeline.llm.assessment,
      model: pipeline.llm.model,
      provider: pipeline.llm.provider,
      usage: pipeline.llm.usage,
    },
  } : {}),
  ...(pipeline.rag ? {
    rag: {
      corpusVersion: pipeline.rag.corpusVersion,
      documentIds: pipeline.rag.documents.map((document) => document.id),
      hitCount: pipeline.rag.documents.length,
    },
  } : {}),
});

const objectNameFor = (record: StoredProcessResult): string => {
  const [date] = record.createdAt.split("T", 1);
  const [year, month, day] = date.split("-");
  return `results/${year}/${month}/${day}/${record.createdAt}-${record.id}.json`;
};

export class CloudStorageResultStore implements ResultStore {
  private readonly writer: CloudStorageJsonWriter;

  constructor(private readonly bucket: string) {
    this.writer = new CloudStorageJsonWriter(bucket);
  }

  async save(
    pipeline: AnalysisPipelineResult,
    durationMs: number
  ): Promise<StoredResultReference> {
    const record = buildStoredProcessResult(pipeline, durationMs);
    const object = objectNameFor(record);
    await this.writer.write(object, record);

    return { bucket: this.bucket, object, resultId: record.id };
  }
}

export const createResultStoreFromEnv = (): ResultStore | undefined => {
  const bucket = process.env.PROCESS_RESULTS_BUCKET;
  return bucket ? new CloudStorageResultStore(bucket) : undefined;
};
