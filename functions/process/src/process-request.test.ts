import assert from "node:assert/strict";
import test from "node:test";

import { processRequest } from "./process-request";
import { createValidRequest } from "./test-fixtures";

test("returns a contract-compatible response for a valid request", () => {
  const response = processRequest(createValidRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    result: "OK",
    comment: "No significant phishing indicators were detected by the current heuristic rules.",
  });
});

test("returns 400 for a request missing a required field", () => {
  const request = createValidRequest() as unknown as Record<string, unknown>;
  delete request.links;

  const response = processRequest(request);

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "Request body does not match the ProcessedEmailData contract.",
  });
});

test("returns 400 for unsupported fields", () => {
  const response = processRequest({
    ...createValidRequest(),
    rawEmail: "not accepted",
  });

  assert.equal(response.status, 400);
});

test("returns 400 when body or links exceed contract limits", () => {
  assert.equal(processRequest(createValidRequest({ body: "x".repeat(1001) })).status, 400);
  assert.equal(
    processRequest(
      createValidRequest({ links: Array.from({ length: 51 }, () => "https://a.test") })
    ).status,
    400
  );
});
