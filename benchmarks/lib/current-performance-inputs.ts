import input from '../inputs/performance/current.json';
import type { CompleteAssessment, CompleteAssessmentRun, AssessmentAccuracyMetrics, AssessmentProvenance, MemoryCategory } from './performance-schema.ts';

export type CurrentPerformanceSummary = Pick<CompleteAssessment, 'status' | 'sourceCommit' | 'repetitions' | 'accuracyCorpus' | 'workloadProfiles'> & {
  runs: Array<Pick<CompleteAssessmentRun, 'surface' | 'kind' | 'profileId' | 'path' | 'status'> & {
    result?: {
      accuracy?: AssessmentAccuracyMetrics;
      provenance: Pick<AssessmentProvenance, 'buildProfile'>;
      performance?: {
        initialization: { p95: number };
        processing: { p95: number };
        throughput: { minimum: number };
        memory: Record<MemoryCategory, { samples: Array<{ maximumObservedBytes: number }> }>;
      };
    };
  }>;
};
export type CurrentMeasuredSummary = Pick<CompleteAssessment, 'status' | 'sourceCommit' | 'repetitions'> & {
  runs: Array<Pick<CompleteAssessmentRun, 'surface' | 'kind' | 'profileId' | 'path' | 'status'> & {
    result?: {
      provenance: Pick<AssessmentProvenance, 'artifactIdentity' | 'runtime' | 'resolvedArtifact'>;
      performance?: {
        processing: { median: number; p95: number; minimum: number; maximum: number; samples: number[] };
        throughput: { median: number };
      };
    };
  }>;
};
import { validateCurrentPerformanceInputs as validate, currentPerformanceInputs as current } from './current-performance-inputs.mjs';
export function validateCurrentPerformanceInputs(value: unknown): typeof input { return validate(value) as typeof input; }
export function currentPerformanceInputs() {
  const checked = current();
  return { ...checked, baseline: checked.baseline as CurrentPerformanceSummary, accepted: checked.accepted as CurrentMeasuredSummary };
}
