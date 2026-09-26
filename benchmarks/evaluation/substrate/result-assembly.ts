export interface AssembledResult<TResult, TReview> { result: TResult; reviewEntries: TReview[] }

/**
 * Domain-neutral post-runtime mechanics. Domains own interpretation of evidence;
 * the substrate owns iteration, queue/failure collection and the common run envelope.
 */
export function assembleEvaluationArtifact<
  TGenerated, TObservation, TMetadata, TResult, TReview, TFailure, TGenerationError, TSummary extends object,
  TIdentity extends object, TProvenance extends object, TDecoration extends object,
>(options: {
  generated: TGenerated[]; observations: TObservation[]; caseCount: number; variantCount: number;
  schemaVersion: number; engineVersion: string; runId: string; startedAt: string; finishedAt?: string;
  mode: string; scope: string; provenance: TProvenance; identity: TIdentity;
  observationMetadata(observation: TObservation): TMetadata;
  assembleResult(generated: TGenerated, observations: TObservation[]): AssembledResult<TResult, TReview>;
  failures(results: TResult[]): TFailure[];
  generationErrors(results: TResult[]): TGenerationError[];
  summarize(results: TResult[]): TSummary;
  decorate(summary: TSummary, observations: TObservation[], reviewQueue: TReview[]): TDecoration;
}) {
  const results: TResult[] = [], reviewQueue: TReview[] = [];
  for (const generated of options.generated) {
    const assembled = options.assembleResult(generated, options.observations);
    results.push(assembled.result);
    reviewQueue.push(...assembled.reviewEntries);
  }
  const summary = options.summarize(results);
  return {
    schemaVersion: options.schemaVersion, engineVersion: options.engineVersion, ...options.identity,
    runId: options.runId, startedAt: options.startedAt, finishedAt: options.finishedAt ?? new Date().toISOString(),
    mode: options.mode, scope: options.scope, provenance: options.provenance,
    scanners: options.observations.map(options.observationMetadata),
    caseCount: options.caseCount, variantCount: options.variantCount, ...summary,
    ...options.decorate(summary, options.observations, reviewQueue),
    results, failures: options.failures(results), generationErrors: options.generationErrors(results), reviewQueue,
  };
}
