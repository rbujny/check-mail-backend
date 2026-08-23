export type ProcessConfig = {
  projectId: string;
  vertexLocation: string;
  llmProvider: "gemini" | "claude" | "openai-compatible";
  llmModelId: string;
  llmEndpoint?: string;
  llmTimeoutMs: number;
  ragEnabled: boolean;
  ragCollection: string;
  ragCorpusVersion: string;
  ragTopK: number;
  embeddingModelId: string;
  embeddingDimension: number;
};

const integerFromEnv = (name: string, defaultValue: number): number => {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : defaultValue;
};

export const getProcessConfig = (): ProcessConfig => ({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? "",
  vertexLocation: process.env.VERTEX_LOCATION ?? "global",
  llmProvider: (process.env.LLM_PROVIDER ?? "gemini") as ProcessConfig["llmProvider"],
  llmModelId: process.env.LLM_MODEL_ID ?? "gemini-3.5-flash-lite",
  llmEndpoint: process.env.LLM_ENDPOINT,
  llmTimeoutMs: integerFromEnv("LLM_TIMEOUT_MS", 10_000),
  ragEnabled: (process.env.RAG_ENABLED ?? "true").toLowerCase() === "true",
  ragCollection: process.env.RAG_COLLECTION ?? "checkmail_rag_documents",
  ragCorpusVersion: process.env.RAG_CORPUS_VERSION ?? "v1",
  ragTopK: integerFromEnv("RAG_TOP_K", 5),
  embeddingModelId: process.env.EMBEDDING_MODEL_ID ?? "gemini-embedding-001",
  embeddingDimension: integerFromEnv("EMBEDDING_DIMENSION", 768),
});
