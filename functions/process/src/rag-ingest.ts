import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { FieldValue, Firestore } from "@google-cloud/firestore";

import { getProcessConfig } from "./config";
import { VertexEmbeddingClient } from "./rag";

type CorpusRecord = {
  id: string;
  label: "safe" | "phishing";
  text: string;
  source: string;
  sourceRecordId: string;
};

const isCorpusRecord = (value: unknown): value is CorpusRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    (record.label === "safe" || record.label === "phishing") &&
    typeof record.text === "string" &&
    record.text.length > 0 &&
    record.text.length <= 4000 &&
    typeof record.source === "string" &&
    typeof record.sourceRecordId === "string"
  );
};

const loadRecords = async (path: string): Promise<CorpusRecord[]> => {
  const content = await readFile(path, "utf8");
  return content
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      const value: unknown = JSON.parse(line);
      if (!isCorpusRecord(value)) {
        throw new Error(`Invalid corpus record at ${basename(path)}:${index + 1}`);
      }
      return value;
    });
};

const main = async (): Promise<void> => {
  const path = process.argv[2];
  if (!path) {
    throw new Error("Usage: npm run rag:ingest -- <corpus.jsonl>");
  }
  const config = getProcessConfig();
  if (!config.projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT must be set.");
  }
  const records = await loadRecords(path);
  const firestore = new Firestore({ projectId: config.projectId, databaseId: "(default)" });
  const embeddings = new VertexEmbeddingClient(config);

  for (const [index, record] of records.entries()) {
    const embedding = await embeddings.embed(record.text, "RETRIEVAL_DOCUMENT");
    await firestore
      .collection(config.ragCollection)
      .doc(record.id)
      .set({
        corpusVersion: config.ragCorpusVersion,
        label: record.label,
        text: record.text,
        source: record.source,
        sourceRecordId: record.sourceRecordId,
        embedding: FieldValue.vector(embedding),
        updatedAt: FieldValue.serverTimestamp(),
      });
    if ((index + 1) % 50 === 0 || index + 1 === records.length) {
      console.info(
        JSON.stringify({
          event: "rag_ingest_progress",
          completed: index + 1,
          total: records.length,
        })
      );
    }
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
