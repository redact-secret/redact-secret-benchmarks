/** Versioned browser evidence; independent of measurement-v4. No fixture content. */
// `not-measured` and `unstable` are engine v1.1 accounting: an absent or unrepeatable observation stays in the denominator.
export type AssertionStatus = 'pass' | 'fail' | 'review-required' | 'not-measured';
export type ScannerStatus = 'complete' | 'unavailable' | 'error' | 'unsupported' | 'unstable';
export type Counts = Record<AssertionStatus, number>;
/** Holdout stays counts-only over resolved states; it publishes no intervals. */
export type HoldoutCounts = Record<Exclude<AssertionStatus, 'not-measured'>, number>;
export interface EvaluationVariant {
  id: string; kind: string; tier: string; strategy: string;
  operator: string; property: string; relation: string; expectationEffect: string;
  contractMatch: boolean | null;
}
export interface EvaluationAssertion {
  scanner: string; type: string; status: AssertionStatus;
  variant: string; baseline: string; candidate: string;
}
export interface EvaluationCase {
  id: string; method: string; targets: string[]; taxonomy: string; sourceSlug: string;
  variants: EvaluationVariant[]; assertions: EvaluationAssertion[];
  findings: { scanner: string; variant: string; count: number; flagged: boolean | null }[];
  generation: { operator: string; status: 'generated' | 'unsupported' | 'error' }[];
  comparisons: { peer: string; variant: string; status: string; disagreement: string; classification: string }[];
}
export interface EvaluationReview {
  id: string; caseId: string; variant: string; peer: string; disagreement: string;
}
export interface EvaluationReport {
  schemaVersion: 2; accountingVersion: '1.1'; reportType: 'evaluation-public'; supportClaims: false;
  runId: string; startedAt: string; finishedAt: string;
  provenance: { revision: string; dirty: boolean | null; casesHash: string; lockHash: string; methods: { id: string; version: number }[]; operators: { id: string; version: number }[] };
  corpusHashes: Record<string, string>;
  scanners: { id: string; version: string | null; status: ScannerStatus; mode: string; configurationHash: string }[];
  cases: EvaluationCase[]; reviews: EvaluationReview[];
  review: { open: number; resolved: number; unknown: number; oldestOpenRun: string | null };
  byOperator: Record<string, { generated: number; unsupported: number; error: number; assertions: Record<string, Counts> }>;
  qualification: QualificationEvidence | null;
}
export interface EvidenceRow {
  caseId: string; method: string; detector: string; scanner: string; tier: string; kind: string;
  type: string; operator: string; status: string; variant: string; baseline: string;
  sourceSlug: string; taxonomy: string; property: string; effect: string; contract: string;
  overlap: boolean; peer: string; disagreement: string;
}

/** Aggregate qualification contract is schema-validated before publication. */
export interface QualificationEvidence {
  reportType: 'qualification'; supportClaims: false; status: string; scope: string; runId: string; finishedAt: string;
  milestone: { status: string; checkedAt: string; openPrerequisites: number[] };
  /** Engine v1.1: why a run is not yet qualified, and the review queue read against the checked-in ledger. */
  accounting?: { reasons: ('execution-incomplete' | 'unresolved-assertions' | 'unreviewed-queue')[]; unresolvedGroups: string[]; review: { open: number; resolved: number; unknown: number; oldestOpenRun: string | null } };
  methods?: { method: string; cases: number; variants: number; generationErrors: number; scanners: { id: string; status: ScannerStatus; assertions: Counts }[] }[];
  holdout: {
    caseCount: number; variantCount: number; generationErrors: number; methodology: string; independence: string; status: string;
    candidate: { sourceHash: string; lockHash: string; candidateArtifactHash: string };
    corpus: { id: string; revision: number; purpose: string; corpusHash: string; seedHash: string; lifecycle: string };
    planHash: string;
    scanners: { id: string; version: string | null; status: ScannerStatus; assertions: HoldoutCounts; byStratum: Record<string,HoldoutCounts> }[];
  };
}
