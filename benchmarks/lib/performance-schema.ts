/**
 * A pinned copy of redact-secret's cross-language assessment result contract
 * (`assessment/schema.ts` and `assessment/complete.ts` in the core repo),
 * scoped to the fields this repository's acceptance evaluation reads.
 *
 * Per redact-secret#603 (DS11) / #136, core keeps the runners, the generator,
 * and this schema's canonical definition; this repository owns evaluating a
 * run against it and detecting drift, the same way `support/taxonomy.ts`
 * pins a copy of the provider/family taxonomy. `schemas/performance-assessment-v1.json`
 * is the same contract as a JSON Schema document, checked in CI the same way
 * `schemas/support-matrix-v1.json` is (`npm run performance:check`).
 */

export type AssessmentSurface = 'rust-core' | 'python' | 'node' | 'browser-wasm' | 'cli';

export const PINNED_ASSESSMENT_SURFACES: readonly AssessmentSurface[] = ['rust-core', 'python', 'node', 'browser-wasm', 'cli'];

/** Pinned against core's `COMPLETE_ASSESSMENT_SCHEMA_VERSION`. A version bump there is drift here. */
export const PINNED_COMPLETE_ASSESSMENT_SCHEMA_VERSION = '1';

export interface AssessmentDistribution {
  readonly unit: 'milliseconds' | 'bytes-per-second';
  readonly samples: readonly number[];
  readonly minimum: number;
  readonly median: number;
  readonly p95: number;
  readonly maximum: number;
  readonly mean: number;
  readonly standardDeviation: number;
}

export interface AssessmentMemorySample {
  readonly baselineBytes: number;
  readonly maximumObservedBytes: number;
}

export interface AssessmentMemoryMetric {
  readonly unit: 'bytes';
  readonly samples: readonly AssessmentMemorySample[];
  readonly unavailableReason?: string;
  readonly samplingLimit: string;
}

export type MemoryCategory =
  | 'nodeHeap' | 'nodeRss' | 'nodeExternal' | 'browserJsHeap'
  | 'wasmLinearMemory' | 'pythonHeap' | 'processRss' | 'streamingBuffer';

export type AssessmentMemoryMetrics = Record<MemoryCategory, AssessmentMemoryMetric>;

export interface AssessmentAccuracyMetrics {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly policyMismatches: number;
}

export interface AssessmentPerformanceMetrics {
  readonly initialization: AssessmentDistribution;
  readonly processing: AssessmentDistribution;
  readonly throughput: AssessmentDistribution;
  readonly memory: AssessmentMemoryMetrics;
}

export interface AssessmentProvenance {
  readonly commit: string;
  readonly artifactIdentity: string;
  readonly corpusVersion: string;
  readonly corpusHash: string;
  readonly os: string;
  readonly cpu: string;
  readonly runtime: string;
  readonly command: string;
  readonly buildProfile?: 'debug' | 'release';
}

export interface AssessmentResult {
  readonly schemaVersion: string;
  readonly surface: AssessmentSurface;
  readonly profileId: string;
  readonly accuracy?: AssessmentAccuracyMetrics;
  readonly performance?: AssessmentPerformanceMetrics;
  readonly provenance: AssessmentProvenance;
}

export type AssessmentRunKind = 'accuracy' | 'performance';
export type AssessmentRunStatus = 'complete' | 'failed' | 'missing' | 'invalid';

export interface CompleteAssessmentProfile {
  readonly id: string;
  readonly chunkProfile: string;
}

export interface CompleteAssessmentRun {
  readonly surface: AssessmentSurface;
  readonly kind: AssessmentRunKind;
  readonly profileId: string;
  readonly resultPath: string;
  readonly markdownPath: string;
  readonly mismatchesPath?: string;
  readonly result?: AssessmentResult;
  readonly failureCode?: 'runner-failed' | 'result-missing' | 'invalid-result';
  readonly path: 'whole-input' | 'incremental' | 'standard-input';
  readonly status: AssessmentRunStatus;
}

export interface CompleteAssessment {
  readonly schemaVersion: string;
  readonly status: 'complete' | 'incomplete';
  readonly sourceCommit?: string;
  readonly accuracyCorpus?: { readonly version: string; readonly hash: string };
  readonly workloadProfiles?: { readonly version: string; readonly hash: string };
  readonly repetitions: number;
  readonly performanceProfiles: readonly CompleteAssessmentProfile[];
  readonly requiredSurfaces: readonly AssessmentSurface[];
  readonly runs: readonly CompleteAssessmentRun[];
  readonly validationFailures: readonly string[];
}

/**
 * Cheap structural + pin check, run before evaluation. Returns a diagnostic
 * string on the first problem found, or `null` when the summary matches the
 * pinned contract closely enough to evaluate. This is the "drift" half of
 * "pin a copy of core's result schema and check drift": a summary produced
 * by a core whose schema shape moved incompatibly fails here instead of
 * silently mis-evaluating.
 */
export function completeAssessmentProblem(value: unknown): string | null {
  try {
    const summary = value as CompleteAssessment;
    if (summary.schemaVersion !== PINNED_COMPLETE_ASSESSMENT_SCHEMA_VERSION) {
      return `Unsupported complete-assessment schemaVersion: ${String(summary.schemaVersion)} (pinned ${PINNED_COMPLETE_ASSESSMENT_SCHEMA_VERSION}) -- core's assessment/complete.ts schema drifted`;
    }
    if (summary.status !== 'complete' && summary.status !== 'incomplete') return 'Invalid complete-assessment status';
    if (!Array.isArray(summary.runs)) return 'complete-assessment.runs is not an array';
    if (!Array.isArray(summary.requiredSurfaces) || summary.requiredSurfaces.some(s => !PINNED_ASSESSMENT_SURFACES.includes(s))) {
      return 'complete-assessment.requiredSurfaces carries a surface this pinned schema does not recognize';
    }
    for (const run of summary.runs) {
      if (!PINNED_ASSESSMENT_SURFACES.includes(run.surface)) return `complete-assessment run carries unrecognized surface: ${String(run.surface)}`;
      if (run.kind !== 'accuracy' && run.kind !== 'performance') return `complete-assessment run carries unrecognized kind: ${String(run.kind)}`;
      if (run.result === undefined) continue;
      if (typeof run.result.schemaVersion !== 'string') return `${run.surface}:${run.kind}:${run.profileId} result is missing schemaVersion`;
      if (run.result.provenance === undefined) return `${run.surface}:${run.kind}:${run.profileId} result is missing provenance`;
      if (run.kind === 'performance' && run.result.performance !== undefined) {
        const performance = run.result.performance;
        for (const key of ['initialization', 'processing', 'throughput'] as const) {
          const distribution = performance[key];
          if (typeof distribution?.p95 !== 'number' || typeof distribution?.minimum !== 'number' || typeof distribution?.maximum !== 'number') {
            return `${run.surface}:${run.kind}:${run.profileId} performance.${key} is missing a required distribution field -- pinned AssessmentDistribution shape drifted`;
          }
        }
        if (typeof performance.memory !== 'object' || performance.memory === null) {
          return `${run.surface}:${run.kind}:${run.profileId} performance.memory is missing -- pinned AssessmentMemoryMetrics shape drifted`;
        }
      }
    }
    return null;
  } catch {
    return 'Missing or invalid complete-assessment summary';
  }
}
