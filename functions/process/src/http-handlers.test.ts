import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

import { createProcessPostHandler, errorHandler, methodNotAllowedHandler } from "./index";
import type { ResultStore } from "./result-store";
import { createValidRequest } from "./test-fixtures";
import type { ProcessEmailErrorResponse, ProcessEmailResponse } from "./types";

type CapturedResponse = {
  statusCode: number;
  body: unknown;
  response: Response<ProcessEmailResponse | ProcessEmailErrorResponse>;
};

const createResponse = (): CapturedResponse => {
  const captured = {
    statusCode: 0,
    body: undefined as unknown,
  };
  const response = {
    status(statusCode: number) {
      captured.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as Response<ProcessEmailResponse | ProcessEmailErrorResponse>;

  return {
    get statusCode() {
      return captured.statusCode;
    },
    get body() {
      return captured.body;
    },
    response,
  };
};

test("POST handler returns 503 when the configured model is unavailable", async () => {
  const request = { body: createValidRequest() } as Request<
    Record<string, never>,
    ProcessEmailResponse | ProcessEmailErrorResponse,
    unknown
  >;
  const captured = createResponse();

  const processPostHandler = createProcessPostHandler({
    modelProvider: {
      async assess() {
        throw new Error("Vertex unavailable");
      },
    },
  });
  await processPostHandler(request, captured.response);

  assert.equal(captured.statusCode, 503);
  assert.deepEqual(captured.body, {
    error: "Analysis service temporarily unavailable.",
  });
});

test("POST handler returns 400 for an invalid payload", async () => {
  const request = { body: {} } as Request<
    Record<string, never>,
    ProcessEmailResponse | ProcessEmailErrorResponse,
    unknown
  >;
  const captured = createResponse();

  const processPostHandler = createProcessPostHandler({
    modelProvider: {
      async assess() {
        throw new Error("must not be called");
      },
    },
  });
  await processPostHandler(request, captured.response);

  assert.equal(captured.statusCode, 400);
});

test("POST handler persists a successful processing result before responding", async () => {
  const request = { body: createValidRequest() } as Request<
    Record<string, never>,
    ProcessEmailResponse | ProcessEmailErrorResponse,
    unknown
  >;
  const captured = createResponse();
  let savedResult: string | undefined;
  const resultStore: ResultStore = {
    async save(pipeline) {
      savedResult = pipeline.body.result;
      return { resultId: "id-1", storage: "postgresql", table: "process_results" };
    },
  };
  const handler = createProcessPostHandler({
    modelProvider: {
      async assess() {
        return {
          assessment: { result: "OK", confidence: 1, comment: "Safe.", signals: [] },
          model: "test-model",
          provider: "test",
          usage: {},
        };
      },
    },
  }, resultStore);

  await handler(request, captured.response);

  assert.equal(savedResult, "OK");
  assert.equal(captured.statusCode, 200);
});

test("POST handler returns 503 when result persistence fails", async () => {
  const request = { body: createValidRequest() } as Request<
    Record<string, never>,
    ProcessEmailResponse | ProcessEmailErrorResponse,
    unknown
  >;
  const captured = createResponse();
  const resultStore: ResultStore = {
    async save() {
      throw new Error("Storage unavailable");
    },
  };
  const handler = createProcessPostHandler({
    modelProvider: {
      async assess() {
        return {
          assessment: { result: "OK", confidence: 1, comment: "Safe.", signals: [] },
          model: "test-model",
          provider: "test",
          usage: {},
        };
      },
    },
  }, resultStore);

  await handler(request, captured.response);

  assert.equal(captured.statusCode, 503);
  assert.deepEqual(captured.body, { error: "Analysis service temporarily unavailable." });
});

test("method handler returns 405", () => {
  const captured = createResponse();

  methodNotAllowedHandler({} as Request, captured.response);

  assert.equal(captured.statusCode, 405);
  assert.deepEqual(captured.body, {
    error: "Method not allowed. Use POST.",
  });
});

test("JSON syntax errors return 400", () => {
  const captured = createResponse();

  errorHandler(
    new SyntaxError("invalid JSON"),
    {} as Request,
    captured.response,
    (() => undefined) as NextFunction
  );

  assert.equal(captured.statusCode, 400);
  assert.deepEqual(captured.body, {
    error: "Request body must be valid JSON.",
  });
});
