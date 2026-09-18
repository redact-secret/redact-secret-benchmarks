/** Versioned browser evidence; independent of measurement-v4. No fixture content. */
export type AssertionStatus = 'pass' | 'fail' | 'review-required';
export type ScannerStatus = 'complete' | 'unavailable' | 'error' | 'unsupported';
export type Counts = Record<AssertionStatus, number>;
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
  schemaVersion: 1; reportType: 'evaluation-public'; supportClaims: false;
  runId: string; startedAt: string; finishedAt: string;
  provenance: { revision: string; dirty: boolean | null; casesHash: string; lockHash: string; methods: { id: string; version: number }[]; operators: { id: string; version: number }[] };
  corpusHashes: Record<string, string>;
  scanners: { id: string; version: string | null; status: ScannerStatus; mode: string; configurationHash: string }[];
  cases: EvaluationCase[]; reviews: EvaluationReview[];
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
  holdout: {
    caseCount: number; variantCount: number; generationErrors: number; methodology: string; independence: string; status: string;
    candidate: { sourceHash: string; lockHash: string; candidateArtifactHash: string };
    corpus: { id: string; revision: number; purpose: string; corpusHash: string; seedHash: string; lifecycle: string };
    planHash: string;
    scanners: { id: string; version: string | null; status: ScannerStatus; assertions: Counts; byStratum: Record<string,Counts> }[];
  };
}
