export type BenchmarkSummary = {
  generatedAt: unknown;
  githubRun?: {
    attempt?: string;
    ref?: string;
    repository?: string;
    runId?: string;
    sha?: string;
  };
  modelEligibleOnly: unknown;
  note: unknown;
  ragCorpusVersion: unknown;
  records: unknown;
  schemaVersion: 1;
  selectedVariants: unknown;
  variants: Record<string, Record<string, unknown>>;
};

const aggregateFields = [
  "accuracy",
  "decisiveAccuracy",
  "precision",
  "recall",
  "f1",
  "warningRate",
  "decisiveCoverage",
  "confusionMatrix",
  "modelCalls",
  "modelAttempts",
  "modelFailures",
  "modelFailureRate",
  "abortedAfterConsecutiveFailures",
  "heuristicBypasses",
  "inputTokens",
  "outputTokens",
  "reasoningCharacters",
  "latencyMs",
  "emailProcessingTimeMs",
] as const;

export const createBenchmarkSummary = (
  report: Record<string, unknown>,
  environment: NodeJS.ProcessEnv = process.env
): BenchmarkSummary => {
  const reportVariants = report.variants as Record<string, Record<string, unknown>>;
  const variants = Object.fromEntries(
    Object.entries(reportVariants).map(([id, variant]) => {
      const aggregate = Object.fromEntries(aggregateFields.map((field) => [field, variant[field]]));
      return [
        id,
        {
          ...aggregate,
          misclassificationCount: Array.isArray(variant.misclassifications)
            ? variant.misclassifications.length
            : 0,
          modelErrorCount: Array.isArray(variant.modelErrors) ? variant.modelErrors.length : 0,
        },
      ];
    })
  );
  const githubRun = {
    attempt: environment.GITHUB_RUN_ATTEMPT,
    ref: environment.GITHUB_REF,
    repository: environment.GITHUB_REPOSITORY,
    runId: environment.GITHUB_RUN_ID,
    sha: environment.GITHUB_SHA,
  };

  return {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    modelEligibleOnly: report.modelEligibleOnly,
    records: report.records,
    ragCorpusVersion: report.ragCorpusVersion,
    selectedVariants: report.selectedVariants,
    note: report.note,
    ...(Object.values(githubRun).some(Boolean) ? { githubRun } : {}),
    variants,
  };
};
