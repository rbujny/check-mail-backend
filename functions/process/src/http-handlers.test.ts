import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";

import { errorHandler, methodNotAllowedHandler, processPostHandler } from "./index";
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

test("POST handler returns 200 for a valid payload", () => {
  const request = { body: createValidRequest() } as Request<
    Record<string, never>,
    ProcessEmailResponse | ProcessEmailErrorResponse,
    unknown
  >;
  const captured = createResponse();

  processPostHandler(request, captured.response);

  assert.equal(captured.statusCode, 200);
  assert.deepEqual(captured.body, {
    result: "OK",
    comment: "No significant phishing indicators were detected by the current heuristic rules.",
  });
});

test("POST handler returns 400 for an invalid payload", () => {
  const request = { body: {} } as Request<
    Record<string, never>,
    ProcessEmailResponse | ProcessEmailErrorResponse,
    unknown
  >;
  const captured = createResponse();

  processPostHandler(request, captured.response);

  assert.equal(captured.statusCode, 400);
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
