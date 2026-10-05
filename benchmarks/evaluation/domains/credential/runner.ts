import { executeEvaluation, type EvaluationOptions } from './execution.ts';
export type { EvaluationOptions } from './execution.ts';

/** Development entry point: protected cases cannot reach row-level reports. */
export async function runEvaluation(options: EvaluationOptions) {
  if (options.cases.some(c => c.visibility === 'holdout' || c.method === 'holdout'))
    throw new Error('Holdout requires the isolated lifecycle entry point');
  return executeEvaluation(options);
}

export function exitCode(report: Pick<Awaited<ReturnType<typeof runEvaluation>>, 'scanners' | 'failures'> & { generationErrors?: unknown[] }, { strict = false, failOnAssertions = false } = {}) {
  return Boolean(report.generationErrors?.length) || report.scanners.some(s => s.status === 'error' || (strict && s.status !== 'complete')) ||
    (failOnAssertions && report.failures.length > 0) ? 1 : 0;
}
