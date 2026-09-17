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
  signals?: string[];
  explanation?: string;
};

const isCorpusRecord = (value: unknown, corpusVersion: string): value is CorpusRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const baseRecordIsValid =
    typeof record.id === "string" &&
    (record.label === "safe" || record.label === "phishing") &&
    typeof record.text === "string" &&
    record.text.length > 0 &&
    record.text.length <= 4000 &&
    typeof record.source === "string" &&
    typeof record.sourceRecordId === "string";
  if (!baseRecordIsValid) {
    return false;
  }
  if (!/^v2(?:$|[-_])/u.test(corpusVersion)) {
    return true;
  }
  return (
    Array.isArray(record.signals) &&
    record.signals.length >= 1 &&
    record.signals.length <= 8 &&
    record.signals.every(
      (signal) => typeof signal === "string" && signal.trim().length > 0 && signal.length <= 80
    ) &&
    typeof record.explanation === "string" &&
    record.explanation.trim().length > 0 &&
    record.explanation.length <= 600
  );
};

const loadRecords = async (path: string, corpusVersion: string): Promise<CorpusRecord[]> => {
  const content = await readFile(path, "utf8");
  return content
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      const value: unknown = JSON.parse(line);
      if (!isCorpusRecord(value, corpusVersion)) {
        throw new Error(`Invalid corpus record at ${basename(path)}:${index + 1}`);
      }
      return value;
    });
};

export const buildCorpusDocument = (
  record: CorpusRecord,
  corpusVersion: string
): { contextText: string; documentId: string; embeddingText: string } => {
  if (!/^v2(?:$|[-_])/u.test(corpusVersion)) {
    return {
      contextText: record.text,
      documentId: record.id,
      embeddingText: record.text,
    };
  }
  if (!record.signals || !record.explanation) {
    throw new Error("RAG v2 records require signals and explanation.");
  }
  const signals = record.signals.join("; ");
  return {
    documentId: `${corpusVersion}-${record.id}`,
    embeddingText: `${record.text}\nObserved security signals: ${signals}`,
    contextText: [
      record.text,
      `Reviewed security signals: ${signals}`,
      `Reviewed explanation: ${record.explanation}`,
    ].join("\n"),
  };
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
  if (!/^[A-Za-z0-9_-]+$/u.test(config.ragCorpusVersion)) {
    throw new Error("RAG_CORPUS_VERSION may contain only letters, numbers, '_' and '-'.");
  }
  const records = await loadRecords(path, config.ragCorpusVersion);
  const firestore = new Firestore({ projectId: config.projectId, databaseId: "(default)" });
  const embeddings = new VertexEmbeddingClient(config);

  for (const [index, record] of records.entries()) {
    const document = buildCorpusDocument(record, config.ragCorpusVersion);
    const embedding = await embeddings.embed(document.embeddingText, "RETRIEVAL_DOCUMENT");
    await firestore
      .collection(config.ragCollection)
      .doc(document.documentId)
      .set({
        corpusVersion: config.ragCorpusVersion,
        label: record.label,
        text: document.contextText,
        source: record.source,
        sourceRecordId: record.sourceRecordId,
        retrievalSchemaVersion: /^v2(?:$|[-_])/u.test(config.ragCorpusVersion)
          ? "rag-v2-retrieval-v2"
          : "rag-v1-retrieval-v1",
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

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
