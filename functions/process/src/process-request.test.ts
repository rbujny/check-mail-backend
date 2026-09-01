import assert from "node:assert/strict";
import test from "node:test";

import type { ModelProvider } from "./model-provider";
import { processRequest, type ProcessDependencies } from "./process-request";
import type { RagRetriever } from "./rag";
import { createValidRequest } from "./test-fixtures";

const modelProvider = (result: "OK" | "WARNING" | "PHISHING" = "OK"): ModelProvider => ({
  async assess() {
    return {
      assessment: {
        result,
        confidence: 0.9,
        comment: `Model classified the message as ${result}.`,
        signals: [],
      },
      model: "test-model",
      provider: "test",
      usage: { inputTokens: 100, outputTokens: 20 },
    };
  },
});

const dependencies = (overrides: Partial<ProcessDependencies> = {}): ProcessDependencies => ({
  modelProvider: modelProvider(),
  ...overrides,
});

test("returns the LLM assessment for a heuristic OK request", async () => {
  const response = await processRequest(createValidRequest(), dependencies());

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    result: "OK",
    comment: "Model classified the message as OK.",
  });
  assert.equal(response.status === 200 && response.pipeline.route, "llm");
  assert.equal(response.status === 200 && response.pipeline.modelSelection, "default");
});

test("does not call the LLM for an obvious heuristic phishing request", async () => {
  let modelCalls = 0;
  const response = await processRequest(
    createValidRequest({
      securityVerdicts: { spf: "fail", dkim: "pass", dmarc: "fail" },
      model: "gemini-3.7-flash",
    }),
    dependencies({
      modelProvider: {
        async assess() {
          modelCalls += 1;
          return modelProvider().assess({} as never);
        },
      },
      modelProviderForRuntimeModel() {
        modelCalls += 1;
        return modelProvider();
      },
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.result, "PHISHING");
  assert.equal(response.status === 200 && response.pipeline.route, "heuristic");
  assert.equal(modelCalls, 0);
});

test("passes retrieved documents to the model", async () => {
  let receivedDocuments = 0;
  const retriever: RagRetriever = {
    async retrieve() {
      return {
        corpusVersion: "test-v1",
        documents: [{ id: "doc-1", label: "phishing", text: "Credential theft", source: "test" }],
      };
    },
  };
  const provider: ModelProvider = {
    async assess(input) {
      receivedDocuments = input.ragDocuments.length;
      return modelProvider("WARNING").assess(input);
    },
  };

  const response = await processRequest(createValidRequest(), {
    modelProvider: provider,
    ragRetriever: retriever,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.result, "WARNING");
  assert.equal(receivedDocuments, 1);
});

test("selects an allowlisted runtime model through the provider resolver", async () => {
  let selectedModel: string | undefined;
  const response = await processRequest(
    createValidRequest({ model: "gemini-3.7-flash" }),
    dependencies({
      modelProviderForRuntimeModel(model) {
        selectedModel = model;
        return modelProvider("WARNING");
      },
    })
  );

  assert.equal(response.status, 200);
  assert.equal(selectedModel, "gemini-3.7-flash");
  assert.equal(response.status === 200 && response.pipeline.modelSelection, "gemini-3.7-flash");
  assert.equal(response.body.result, "WARNING");
});

test("returns 503 after two failed model attempts", async () => {
  let calls = 0;
  const response = await processRequest(createValidRequest(), dependencies({
    modelProvider: {
      async assess() {
        calls += 1;
        throw new Error("Vertex unavailable");
      },
    },
  }));

  assert.equal(calls, 2);
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Analysis service temporarily unavailable." });
});

test("returns 400 for a request missing a required field", async () => {
  const request = createValidRequest() as unknown as Record<string, unknown>;
  delete request.links;

  const response = await processRequest(request, dependencies());

  assert.equal(response.status, 400);
});

test("returns 400 for unsupported fields and oversized input", async () => {
  assert.equal(
    (await processRequest({ ...createValidRequest(), rawEmail: "not accepted" }, dependencies())).status,
    400
  );
  assert.equal(
    (await processRequest(createValidRequest({ body: "x".repeat(1001) }), dependencies())).status,
    400
  );
  assert.equal(
    (await processRequest({ ...createValidRequest(), model: "arbitrary-model" }, dependencies())).status,
    400
  );
});
