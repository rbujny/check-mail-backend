import assert from "node:assert/strict";
import test from "node:test";

import { configForRuntimeModel, type ProcessConfig } from "./config";

const baseConfig: ProcessConfig = {
  projectId: "test-project",
  vertexLocation: "global",
  llmProvider: "gemini",
  llmModelId: "deployment-default",
  llmEndpoint: "http://local.invalid",
  llmTimeoutMs: 10_000,
  ragEnabled: true,
  ragCollection: "rag",
  ragCorpusVersion: "v1",
  ragTopK: 5,
  embeddingModelId: "embedding",
  embeddingDimension: 768,
};

test("maps runtime model IDs to controlled provider configurations", () => {
  assert.deepEqual(
    configForRuntimeModel(baseConfig, "gemini-3.7-flash"),
    {
      ...baseConfig,
      llmEndpoint: undefined,
      llmModelId: "gemini-3.7-flash",
      llmProvider: "gemini",
      vertexLocation: "global",
    }
  );
});
