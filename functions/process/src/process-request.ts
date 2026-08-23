import { analyzeEmail } from "./analyzer";
import { getProcessConfig } from "./config";
import { createModelProvider, type ModelProvider } from "./model-provider";
import { createRagRetriever, type RagRetriever } from "./rag";
import type { ProcessEmailRequest, ProcessRequestResult } from "./types";
import { isProcessedEmailRequest } from "./validation";

export type ProcessDependencies = {
  modelProvider: ModelProvider;
  ragRetriever?: RagRetriever;
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withOneRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (firstError) {
    await wait(250);
    try {
      return await operation();
    } catch {
      throw firstError;
    }
  }
};

const defaultDependencies = (): ProcessDependencies => {
  const config = getProcessConfig();
  return {
    modelProvider: createModelProvider(config),
    ragRetriever: createRagRetriever(config),
  };
};

export const processRequest = async (
  body: unknown,
  dependencies: ProcessDependencies = defaultDependencies()
): Promise<ProcessRequestResult> => {
  if (!isProcessedEmailRequest(body)) {
    return {
      status: 400,
      body: {
        error: "Request body does not match the ProcessedEmailData contract.",
      },
    };
  }

  const request: ProcessEmailRequest = body;
  const analysis = analyzeEmail(request);
  if (analysis.result === "PHISHING") {
    return {
      status: 200,
      body: { result: analysis.result, comment: analysis.comment },
      pipeline: {
        body: { result: analysis.result, comment: analysis.comment },
        analysis,
        route: "heuristic",
      },
    };
  }

  try {
    const rag = dependencies.ragRetriever
      ? await withOneRetry(() => dependencies.ragRetriever!.retrieve(request))
      : undefined;
    const llm = await withOneRetry(() => dependencies.modelProvider.assess({
      request,
      heuristic: analysis,
      ragDocuments: rag?.documents ?? [],
    }));
    const response = {
      result: llm.assessment.result,
      comment: llm.assessment.comment,
    };

    return {
      status: 200,
      body: response,
      pipeline: {
        body: response,
        analysis,
        llm,
        rag,
        route: "llm",
      },
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: "email_analysis_unavailable",
      errorType: error instanceof Error ? error.name : "unknown",
    }));
    return {
      status: 503,
      body: { error: "Analysis service temporarily unavailable." },
    };
  }
};
