import type { CurrentMeasuredSummary } from './current-performance-inputs.ts';
/**
 * Measured per-surface throughput for the performance page (#405) and the dispatch model each row was measured
 * under (#450). Pure functions over a core `CompleteAssessment` summary: the page reads the summary this repository
 * pinned at the accepted commit (`benchmarks/performance-criteria.json` `baseline.verificationPath`), so nothing
 * here is typed in by hand and no acceptance threshold is touched.
 */
import type { CompleteAssessment } from './performance-schema.ts';

export type DispatchModel = 'one-shot' | 'chunked-incremental' | 'per-line-incremental';

export interface DispatchDescription {
  readonly model: DispatchModel;
  readonly label: string;
  /** Why this row is (not) comparable with a row of another model. */
  readonly detail: string;
}

const DESCRIPTIONS: Record<DispatchModel, Omit<DispatchDescription, 'model'>> = {
  'one-shot': { label: 'One-shot scan', detail: 'the whole input goes to one detect call' },
  'chunked-incremental': { label: 'Chunked incremental (4 KiB)', detail: 'an incremental session is fed fixed 4 KiB chunks' },
  'per-line-incremental': { label: 'Per-line incremental', detail: 'the CLI dispatches each input line separately (about 983 detect calls per 64 KiB, redact-secret#883)' },
};

/**
 * The dispatch model of one surface x profile row. The summary's own `path` records how input reached the runner
 * (`whole-input`, `incremental`, `standard-input`); it does not say the CLI splits standard input into lines, so
 * the CLI is classified by surface (redact-secret#883, issue #450) and every other surface by `path`.
 */
export function dispatchModel(surface: string, path: string): DispatchDescription {
  const model: DispatchModel = surface === 'cli' ? 'per-line-incremental' : path === 'whole-input' ? 'one-shot' : 'chunked-incremental';
  return { model, ...DESCRIPTIONS[model] };
}

/** Two rows may be ratioed or budgeted against each other only when they share a dispatch model. */
export function comparableRows(a: { surface: string; path: string }, b: { surface: string; path: string }): boolean {
  return dispatchModel(a.surface, a.path).model === dispatchModel(b.surface, b.path).model;
}

export interface MeasuredRow {
  readonly surface: string;
  readonly profileId: string;
  readonly path: string;
  readonly dispatch: DispatchDescription;
  readonly processingMedianMs: number;
  readonly processingP95Ms: number;
  readonly throughputMedianBytesPerSecond: number;
  readonly artifactIdentity: string;
  readonly runtime: string;
  readonly resolvedArtifact: string | null;
}

export function measuredRows(summary: CurrentMeasuredSummary): MeasuredRow[] {
  const rows: MeasuredRow[] = [];
  for (const run of summary.runs) {
    const performance = run.result?.performance;
    if (run.kind !== 'performance' || run.status !== 'complete' || run.result === undefined || performance === undefined) continue;
    const provenance = run.result.provenance;
    rows.push({
      surface: run.surface, profileId: run.profileId, path: run.path, dispatch: dispatchModel(run.surface, run.path),
      processingMedianMs: performance.processing.median, processingP95Ms: performance.processing.p95,
      throughputMedianBytesPerSecond: performance.throughput.median,
      artifactIdentity: provenance.artifactIdentity, runtime: provenance.runtime, resolvedArtifact: provenance.resolvedArtifact ?? null,
    });
  }
  return rows;
}

export interface WorkloadGuidance {
  readonly slowestBytesPerSecond: number;
  readonly fastestBytesPerSecond: number;
  /** Milliseconds to scan a 9 KiB (single-digit-kilobyte) payload at the slowest and fastest measured median. */
  readonly smallPayloadMsSlowest: number;
  readonly smallPayloadMsFastest: number;
  /** Cores needed to sustain 100 MB/s at the fastest and slowest measured median. */
  readonly coresFor100MbpsFastest: number;
  readonly coresFor100MbpsSlowest: number;
}

const SMALL_PAYLOAD_BYTES = 9 * 1024;
const STREAM_BYTES_PER_SECOND = 100 * 1000 * 1000;

/** Guidance figures derived only from the measured medians of the one-shot rows, the shape a per-request scan has. */
export function workloadGuidance(rows: readonly MeasuredRow[]): WorkloadGuidance {
  const rates = rows.filter(r => r.dispatch.model === 'one-shot').map(r => r.throughputMedianBytesPerSecond);
  if (rates.length === 0) throw new Error('measured-performance:no-one-shot-rows');
  const slowest = Math.min(...rates), fastest = Math.max(...rates);
  return {
    slowestBytesPerSecond: slowest, fastestBytesPerSecond: fastest,
    smallPayloadMsSlowest: (SMALL_PAYLOAD_BYTES / slowest) * 1000, smallPayloadMsFastest: (SMALL_PAYLOAD_BYTES / fastest) * 1000,
    coresFor100MbpsFastest: STREAM_BYTES_PER_SECOND / fastest, coresFor100MbpsSlowest: STREAM_BYTES_PER_SECOND / slowest,
  };
}
