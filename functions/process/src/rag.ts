import { FieldValue, Firestore } from "@google-cloud/firestore";
import { GoogleAuth } from "google-auth-library";

import type { ProcessConfig } from "./config";
import type { ProcessEmailRequest, RagDocument, RagRetrievalResult } from "./types";

export interface RagRetriever {
  retrieve(request: ProcessEmailRequest): Promise<RagRetrievalResult>;
}

type EmbeddingResponse = {
  predictions?: Array<{
    embeddings?: { values?: number[] };
  }>;
};

export class VertexEmbeddingClient {
  private readonly auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  constructor(private readonly config: ProcessConfig) {}

  async embed(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
    const endpoint = this.config.vertexLocation === "global"
      ? "https://aiplatform.googleapis.com"
      : `https://${this.config.vertexLocation}-aiplatform.googleapis.com`;
    const url = `${endpoint}/v1/projects/${this.config.projectId}/locations/${this.config.vertexLocation}/publishers/google/models/${this.config.embeddingModelId}:predict`;
    const client = await this.auth.getClient();
    const response = await client.request<EmbeddingResponse>({
      url,
      method: "POST",
      timeout: this.config.llmTimeoutMs,
      data: {
        instances: [{ content: text, task_type: taskType }],
        parameters: {
          autoTruncate: true,
          outputDimensionality: this.config.embeddingDimension,
        },
      },
    });
    const values = response.data.predictions?.[0]?.embeddings?.values;
    if (!values || values.length !== this.config.embeddingDimension) {
      throw new Error("Vertex AI returned an invalid embedding.");
    }
    return values;
  }
}

const queryText = (request: ProcessEmailRequest): string => [
  request.headers.subject ?? "",
  request.body,
  `SPF=${request.securityVerdicts.spf ?? "unknown"}`,
  `DKIM=${request.securityVerdicts.dkim ?? "unknown"}`,
  `DMARC=${request.securityVerdicts.dmarc ?? "unknown"}`,
].join("\n");

export class FirestoreRagRetriever implements RagRetriever {
  private readonly firestore: Firestore;
  private readonly embeddings: VertexEmbeddingClient;

  constructor(private readonly config: ProcessConfig) {
    this.firestore = new Firestore({ projectId: config.projectId, databaseId: "(default)" });
    this.embeddings = new VertexEmbeddingClient(config);
  }

  async retrieve(request: ProcessEmailRequest): Promise<RagRetrievalResult> {
    const embedding = await this.embeddings.embed(queryText(request), "RETRIEVAL_QUERY");
    const query = this.firestore
      .collection(this.config.ragCollection)
      .where("corpusVersion", "==", this.config.ragCorpusVersion)
      .findNearest("embedding", FieldValue.vector(embedding), {
        limit: this.config.ragTopK,
        distanceMeasure: "COSINE",
      });
    const snapshot = await query.get();
    const documents: RagDocument[] = snapshot.docs.flatMap((document) => {
      const data = document.data();
      if (
        typeof data.text !== "string" ||
        typeof data.source !== "string" ||
        (data.label !== "safe" && data.label !== "phishing")
      ) {
        return [];
      }
      return [{ id: document.id, label: data.label, text: data.text, source: data.source }];
    });

    return { documents, corpusVersion: this.config.ragCorpusVersion };
  }
}

export const createRagRetriever = (config: ProcessConfig): RagRetriever | undefined =>
  config.ragEnabled ? new FirestoreRagRetriever(config) : undefined;
