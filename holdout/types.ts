import type { Fixture } from '../benchmarks/types.ts';

export interface HoldoutCorpus { schemaVersion: 2; seed: string; fixtures: Fixture[] }
export interface HoldoutManifest {
  schemaVersion: 1; id: string; revision: number;
  purpose: 'public-conformance' | 'protected';
  review: 'conformance-only' | 'reviewed';
  corpusHash: string; seedHash: string; dataDirectory: string; maxRuns: number;
  publicSeed?: string;
}
export interface Candidate {
  sourceHash: string; lockHash: string; candidateArtifactHash: string;
}
export interface Counts { pass: number; fail: number; 'review-required': number }
export interface HoldoutReport {
  schemaVersion: 1; reportType: 'holdout'; runId: string; planHash: string;
  startedAt: string; finishedAt: string; status: 'complete' | 'incomplete';
  methodology: 'frozen-candidate-canonical-cases-aggregate-only';
  independence: 'public-control' | 'custodian-declared';
  corpus: { id: string; revision: number; purpose: HoldoutManifest['purpose']; corpusHash: string; seedHash: string; lifecycle: 'sealed-at-execution' };
  candidate: Candidate; caseCount: number; variantCount: number; generationErrors: number;
  scanners: { id: string; version: string | null; configurationHash: string; configuration: Record<string, unknown>; status: 'complete' | 'unsupported' | 'unavailable' | 'error'; assertions: Counts; byStratum: Record<string, Counts> }[];
}
