import type { PiiEvalMeasurement } from './support-v2';
export interface PiiComparisonProduct {
  sourceCommit: string; version: string; packageTreeSha256: string; addonTreeSha256: string; wasmTreeSha256: string; provenance: unknown;
}
export interface PiiComparisonMetric {
  metric: { id: string }; status: string; effectiveN: number;
  counts: { numerator: number; measured: number; eligible: number; unresolved: number; notMeasured: number };
  value: { state: 'withheld'; reason: string } | { state: 'measured'; point: { mantissa: number; scale: number }; bound: { mantissa: number; scale: number } };
}
export interface PiiComparisonActivation {
  state: 'available'; scope: 'installed-product-configuration-only'; supportClaims: false;
  surfaces: Array<{ surface: 'node-addon' | 'node-forced-wasm'; checks: Array<{ requestedSelectors: string[]; artifact: 'addon' | 'wasm'; activationIdentity: string }> }>;
}
export type PiiCandidateComparison = {
  publicOnly: true; supportClaims: false; qualified: false;
} & ({ state: 'absent' | 'invalid'; reason: string } | {
  state: 'recorded'; mode: 'exploratory' | 'official'; engine: { binarySha256: string };
  baseline: PiiComparisonProduct; candidate: PiiComparisonProduct;
  activation: { baseline: PiiComparisonActivation; candidate: PiiComparisonActivation };
  validator: { state: 'not-measured'; reason: string };
  populations: Array<{ view: string; memberships: number; population: { populationId: string; populationDigest: string };
    baseline: PiiEvalMeasurement['populations'][number]; candidate: PiiEvalMeasurement['populations'][number];
    metrics: Array<{ key: string; family: string; stratum: string; metricId: string; baseline: PiiComparisonMetric; candidate: PiiComparisonMetric; delta: number | null }> }>;
});
export const SIDES: string[];
export function comparisonDigest(value: unknown): string;
export function loadPiiCandidateComparison(input?: { plan?: unknown; receipt?: unknown; artifacts?: Array<{ side: 'baseline' | 'candidate'; view: string; text: string }> }): PiiCandidateComparison;
