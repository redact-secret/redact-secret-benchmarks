import { validateCurrentPerformanceInputs, type CurrentMeasuredSummary } from '../../benchmarks/lib/current-performance-inputs';
/**
 * redact-secret's own throughput, read the way the existing Performance page reads it
 * (`src/pages/performance.ts`): the summary of the run the acceptance criteria name as the
 * latest accepted one (`benchmarks/performance-criteria.json` `baseline.verificationPath`,
 * today `evidence/1046/da69ebf-verified/summary.json`), validated with the pinned schema check
 * `completeAssessmentProblem` and turned into rows by `measuredRows`.
 *
 * These times come from a different run, machine and protocol than the peer comparison
 * (`services/runtime.ts`), so a resolver never sets one beside the other as a pair. Nothing is
 * derived here beyond picking the Node surface.
 */
import { measuredRows } from '../../benchmarks/lib/measured-performance';
import { once, readJson, readJsonIfPresent } from './repo';

export interface OwnRow {
  surface: string;
  profileId: string;
  /** "One-shot scan", "Chunked incremental (4 KiB)". */
  dispatch: string;
  dispatchDetail: string;
  processingMedianMs: number;
  processingP95Ms: number;
  processingMinMs: number;
  processingMaxMs: number;
  throughputMedianBytesPerSecond: number;
  /** The repetitions behind the row. */
  samples: number;
  /** "node-addon", "wasm", or null when the run did not record it. */
  resolvedArtifact: string | null;
  runtime: string;
}

export interface OwnRun {
  state: 'measured';
  sourceCommit: string;
  repetitions: number;
  summaryPath: string;
  runner: { cpuModel: string; logicalCpus: number; image: string } | null;
  rows: OwnRow[];
}

export type OwnPerformance = OwnRun | { state: 'not-published'; reason: string } | { state: 'invalid'; reason: string };

interface Criteria { baseline: { verifiedCommit: string; verificationPath: string } }
interface Runner { cpuModel?: string; logicalCpus?: number; image?: string }

export function loadOwnPerformance(): Promise<OwnPerformance> {
  return once('own-performance', async () => {
    const criteria = await readJson<Criteria>('benchmarks/performance-criteria.json');
    const dir = criteria.baseline.verificationPath.replace(/\/[^/]*$/, '');
    const summaryPath = `${dir}/summary.json`;
    const found = await readJsonIfPresent<unknown>('benchmarks/inputs/performance/current.json');
    if (!found) return { state: 'not-published', reason: `${summaryPath} is absent: the accepted run's summary has not been committed.` };
    let current;
    try { current = validateCurrentPerformanceInputs(found); }
    catch (error) { return { state: 'invalid', reason: `${summaryPath} did not validate: ${(error as Error).message}.` }; }
    const summary = current.records.accepted.data as CurrentMeasuredSummary;
    if (current.records.accepted.source.path !== summaryPath) return { state: 'invalid', reason: 'Accepted performance source locator differs from criteria.' };
    if (summary.status !== 'complete' || summary.sourceCommit !== criteria.baseline.verifiedCommit)
      return { state: 'invalid', reason: `${summaryPath} is not the complete run of ${criteria.baseline.verifiedCommit}.` };
    const runner = current.records.runner.data as Runner;
    const distribution = new Map<string, { minimum: number; maximum: number; samples: readonly number[] }>(summary.runs.flatMap(run => {
      const processing = run.kind === 'performance' ? run.result?.performance?.processing : undefined;
      return processing ? [[`${run.surface}/${run.profileId}`, processing] as const] : [];
    }));
    const rows: OwnRow[] = measuredRows(summary).map(r => {
      const d = distribution.get(`${r.surface}/${r.profileId}`)!;
      return {
        surface: r.surface, profileId: r.profileId, dispatch: r.dispatch.label, dispatchDetail: r.dispatch.detail,
        processingMedianMs: r.processingMedianMs, processingP95Ms: r.processingP95Ms, processingMinMs: d.minimum, processingMaxMs: d.maximum,
        throughputMedianBytesPerSecond: r.throughputMedianBytesPerSecond, samples: d.samples.length, resolvedArtifact: r.resolvedArtifact, runtime: r.runtime,
      };
    });
    return {
      state: 'measured', sourceCommit: summary.sourceCommit, repetitions: summary.repetitions, summaryPath,
      runner: runner?.cpuModel ? { cpuModel: runner.cpuModel, logicalCpus: runner.logicalCpus ?? 0, image: runner.image ?? '' } : null,
      rows,
    };
  });
}
