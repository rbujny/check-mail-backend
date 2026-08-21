import { analyzeEmail } from "./analyzer";
import type { ProcessRequestResult } from "./types";
import { isProcessedEmailRequest } from "./validation";

export const processRequest = (body: unknown): ProcessRequestResult => {
  if (!isProcessedEmailRequest(body)) {
    return {
      status: 400,
      body: {
        error: "Request body does not match the ProcessedEmailData contract.",
      },
    };
  }

  const analysis = analyzeEmail(body);

  return {
    status: 200,
    body: {
      result: analysis.result,
      comment: analysis.comment,
    },
    analysis,
  };
};
