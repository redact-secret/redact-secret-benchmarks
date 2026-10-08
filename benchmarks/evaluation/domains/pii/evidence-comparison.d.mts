export interface EvidenceMetric {
  metric: { id: string; version: number };
  counts: { eligible: number; measured: number; notApplicable: number; notMeasured: number; numerator: number; total: number; unresolved: number };
  effectiveN: number;
  status: string;
  value: { state: 'withheld'; reason: string } | { state: 'measured'; point: { mantissa: number; scale: number }; bound: { mantissa: number; scale: number } };
}
export interface EvidenceOutcome {
  caseId: string; variantId: string; occurrenceId: string; method: string; scannerId: string;
  action: { state: string; verification?: string }; range: string; sensitivityContext: string; typeIdentity: string;
}
export interface EvidenceProduct {
  sourceCommit: string; version: string; provenance: string; packageTreeSha256: string; addonTreeSha256: string; wasmTreeSha256: string;
  manifestDigest: string; artifactDigest: string; artifactSha256: string;
  [key: string]: unknown;
}
export interface PiiEvidenceComparisonRecorded {
  state: 'recorded'; mode: 'official' | 'exploratory'; publicOnly: true; supportClaims: false; qualified: false;
  evidence: { snapshot: { id: string; contentDigest: string; manifestSha256: string; sourceManifestDigest: string }; release: { repository: string; tag: string; commit: string } };
  population: { id: string; version: number; digest: string; bindingDigest: string };
  counts: Record<string, number>; losses: Record<string, number>; mappedFamilies: Record<string, { cases: number; variants: number }>;
  protocol: { id: string; revision: number; artifactSchema: string };
  scanner: { adapter: { id: string; version: string; normalizationVersion: number }; configurationDigest: string; activationDigest: string; activation: string[] };
  engine: { commit: string; binarySha256: string; shimSha256: string; platform: string; canonical: boolean };
  importer: { binarySha256: string; buildReceipt: Record<string, unknown> | null };
  baseline: EvidenceProduct; candidate: EvidenceProduct;
  metrics: Array<{ metric: { id: string; version: number }; baseline: EvidenceMetric; candidate: EvidenceMetric; delta: number | null }>;
  outcomes: Array<{ caseId: string; variantId: string; family: string; baseline: EvidenceOutcome; candidate: EvidenceOutcome; changed: boolean }>;
  changes: { total: number; byFamily: Record<string, number> };
  provenance: { workflow: Record<string, unknown>; actionsArtifact: Record<string, unknown>; receipt: Record<string, unknown> } | { mode: 'exploratory'; canonical: false };
  familyMetrics: { state: 'unavailable'; reason: 'unprojected-schema-1.4' };
  historical: { state: 'descriptive-only'; version: string; platform: string; source: string; verdict: string;
    record: string; artifactDigest: string; artifactSha256: string; engineBinarySha256: string; populationDigest: string;
    platformMatches: boolean; engineBinaryMatches: boolean; populationMatches: boolean };
}
export type PiiEvidenceComparison = PiiEvidenceComparisonRecorded | { state: 'absent' | 'invalid'; reason: string; publicOnly: true; supportClaims: false; qualified: false };
export function loadPiiEvidenceComparison(input?: {
  plan?: unknown; receipt?: unknown; receiptText?: string; artifacts?: Array<{ side: 'baseline' | 'candidate'; text: string }>;
  record?: unknown; populationIndex?: unknown; allowUnrecordedOfficial?: boolean;
}): PiiEvidenceComparison;
export function validateEvidenceComparisonReceipt(receipt: unknown, plan: unknown): any;
export function validateEvidenceComparisonRecord(record: unknown, context: any): any;
export function validateEvidencePopulationIndex(index: unknown, options?: { plan?: unknown }): any;
export function deriveEvidencePopulationIndex(snapshot: unknown, binding: unknown, plan?: unknown): any;
export const SIDES: readonly ['baseline', 'candidate'];
export const POPULATION_INDEX_DIGEST: string;
