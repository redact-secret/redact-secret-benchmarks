/**
 * Mechanical threshold derivation from one release-build `CompleteAssessment`
 * run, so recalibration is a pure function of observed numbers rather than a
 * hand-picked value. Reproduces the rounding rule redact-secret's
 * `assessment/README.md` documents for its Linux x86_64 profile ("Timing
 * ceilings are twice the observed p95 ... throughput floors are half the
 * observed minimum ... memory caps are 2.5x the observed maximum"), verified
 * against every number in that profile's `acceptance-criteria-linux-x64.json`
 * before this repository took ownership (see `evidence/603/README.md`).
 *
 * Protocol: docs/specs/performance-acceptance.md.
 */
import type { AcceptanceCriteria, PerformanceCriterion } from './performance-acceptance.ts';
import type { CompleteAssessment, MemoryCategory } from './performance-schema.ts';

const MEBIBYTE = 1024 * 1024;

/** 2x observed p95, rounded up: whole ms below 10, nearest 5 below 100, nearest 50 below 1000, else nearest 100. */
export function deriveProcessingCeilingMs(observedP95: number): number {
  const doubled = 2 * observedP95;
  if (doubled < 10) return Math.ceil(doubled);
  if (doubled < 100) return Math.ceil(doubled / 5) * 5;
  if (doubled < 1000) return Math.ceil(doubled / 50) * 50;
  return Math.ceil(doubled / 100) * 100;
}

/** Same rule as processing, applied to initialization p95. */
export const deriveInitializationCeilingMs = deriveProcessingCeilingMs;

/** Half observed minimum, rounded down: nearest 10,000 below 1,000,000 bytes/s, else nearest 100,000. */
export function deriveThroughputFloorBytesPerSecond(observedMinimum: number): number {
  const halved = observedMinimum / 2;
  if (halved < 1_000_000) return Math.floor(halved / 10_000) * 10_000;
  return Math.floor(halved / 100_000) * 100_000;
}

/** 2.5x observed maximum, rounded up to the nearest mebibyte. */
export function deriveMemoryCapBytes(observedMaximum: number): number {
  return Math.ceil((2.5 * observedMaximum) / MEBIBYTE) * MEBIBYTE;
}

export interface DeriveCriteriaOptions {
  readonly criteriaId: string;
  readonly fixedAt: string;
  readonly summaryPath: string;
  readonly environment: AcceptanceCriteria['environment'];
  /**
   * An ACCEPTED evaluation at a newer core commit against these same
   * thresholds. It is not derived from the summary, so it is carried over
   * rather than recomputed. Omitted, the derivation run verifies itself:
   * `verifiedCommit` is the summary's commit and `verificationPath` its
   * `acceptance.json` beside the summary.
   */
  readonly verification?: { readonly commit: string; readonly path: string };
}

/**
 * Derives a fresh `AcceptanceCriteria` document from one complete,
 * release-build assessment run. Every performance profile present in the
 * summary becomes one `PerformanceCriterion`; every memory category with at
 * least one sample gets a cap. Throws if the summary is not `complete`, ran
 * fewer than 5 repetitions, or the rust-core surface was not a release build
 * (a debug-build Rust timing cannot license a threshold anyone else is held
 * to, per redact-secret's own "release-build-required" acceptance check).
 */
export function deriveCriteria(summary: CompleteAssessment, options: DeriveCriteriaOptions): AcceptanceCriteria {
  if (summary.status !== 'complete') throw new Error('performance-derivation:summary-incomplete');
  if (summary.repetitions < 5) throw new Error('performance-derivation:insufficient-repetitions');
  if (summary.accuracyCorpus === undefined || summary.workloadProfiles === undefined) {
    throw new Error('performance-derivation:missing-corpus-identity');
  }

  const accuracyBySurface = new Map(
    summary.runs
      .filter(run => run.kind === 'accuracy' && run.status === 'complete' && run.result?.accuracy)
      .map(run => [run.surface, run.result!.accuracy!]),
  );
  const firstAccuracy = accuracyBySurface.values().next().value;
  if (firstAccuracy === undefined) throw new Error('performance-derivation:no-accuracy-result');
  const accuracyKey = (accuracy: typeof firstAccuracy) =>
    JSON.stringify(accuracy, ['truePositives', 'falsePositives', 'falseNegatives', 'policyMismatches']);
  for (const [surface, accuracy] of accuracyBySurface) {
    if (accuracyKey(accuracy) !== accuracyKey(firstAccuracy)) {
      throw new Error(`performance-derivation:accuracy-disagreement:${surface}`);
    }
  }

  const performance: PerformanceCriterion[] = [];
  for (const run of summary.runs) {
    if (run.kind !== 'performance' || run.status !== 'complete' || run.result?.performance === undefined) continue;
    const result = run.result;
    const metrics = result.performance!;
    if (run.surface === 'rust-core' && result.provenance.buildProfile !== 'release') {
      throw new Error(`performance-derivation:release-build-required:${run.surface}:${run.profileId}`);
    }

    const memoryCapsBytes: Partial<Record<MemoryCategory, number>> = {};
    for (const [category, metric] of Object.entries(metrics.memory) as [MemoryCategory, typeof metrics.memory[MemoryCategory]][]) {
      if (metric.samples.length === 0) continue;
      const observedMaximum = Math.max(...metric.samples.map(sample => sample.maximumObservedBytes));
      memoryCapsBytes[category] = deriveMemoryCapBytes(observedMaximum);
    }

    performance.push({
      surface: run.surface,
      profileId: run.profileId,
      maxInitializationP95Ms: deriveInitializationCeilingMs(metrics.initialization.p95),
      maxProcessingP95Ms: deriveProcessingCeilingMs(metrics.processing.p95),
      minThroughputBytesPerSecond: deriveThroughputFloorBytesPerSecond(metrics.throughput.minimum),
      memoryCapsBytes,
    });
  }
  if (performance.length === 0) throw new Error('performance-derivation:no-performance-results');
  performance.sort((a, b) => a.surface.localeCompare(b.surface) || a.profileId.localeCompare(b.profileId));

  return {
    schemaVersion: '1',
    criteriaId: options.criteriaId,
    fixedAt: options.fixedAt,
    derivation: {
      repetitions: summary.repetitions,
      percentile: 'p95',
      margin: '2x observed p95 for timing ceilings (rounded up: whole ms below 10ms, nearest 5ms below 100ms, nearest 50ms below 1000ms, else nearest 100ms); half observed minimum for throughput floors (rounded down: nearest 10,000 bytes/s below 1,000,000, else nearest 100,000); 2.5x observed maximum for memory caps (rounded up to the nearest mebibyte)',
    },
    baseline: {
      summaryPath: options.summaryPath,
      sourceCommit: summary.sourceCommit!,
      verifiedCommit: options.verification?.commit ?? summary.sourceCommit!,
      verificationPath: options.verification?.path ?? options.summaryPath.replace(/[^/]+$/, 'acceptance.json'),
      accuracyCorpusVersion: summary.accuracyCorpus.version,
      accuracyCorpusHash: summary.accuracyCorpus.hash,
      workloadProfilesVersion: summary.workloadProfiles.version,
      workloadProfilesHash: summary.workloadProfiles.hash,
    },
    minimumRepetitions: 5,
    environment: options.environment,
    accuracy: firstAccuracy,
    performance,
  };
}
