import type { AccountingArtifactIdentity, MechanicalPublished } from '../../../shared/statistical-primitives.ts';
import type { PiiAuthority, PiiOutcome, PiiScope, PiiSensitivityExpectation } from './types.ts';
import type { PiiMetricId } from './profile.ts';
import type { PiiBenignCollisionEvidenceClass } from './benign-collision-classes.ts';
import type { PII_BENIGN_ACCOUNTING_CLASSES } from './benign-collision-classes.ts';
export type PiiControlClass = typeof PII_BENIGN_ACCOUNTING_CLASSES[number];

export interface PiiAccountingSource {
  schemaVersion: 1; engineVersion: string; domain: 'pii'; reportProfile: { id: 'pii-evaluation'; version: 1 };
  evaluationProfile: 'pii-schema-v1'; domainAccountingVersion: 'pii-observation-v1'; runId: string; startedAt: string; finishedAt: string;
  provenance: { sourceRevision: string | null; candidateArtifactHash: string | null; planHash: string | null };
  scanner: { id: string; version: string | null; mode: string; configurationHash: string; status: 'complete' | 'unsupported' | 'unavailable' | 'error' | 'unstable' };
}
export interface PiiAccountingRow {
  source: PiiAccountingSource; caseId: string; method: string; family: string; scope: PiiScope; variant: string;
  strategy: 'authored' | 'derived' | 'review-required'; scanner: string; qualificationProfile: { id: 'pii-v1'; version: 1 }; authority: PiiAuthority[];
  expectation: { type: 'valid' | 'invalid'; sensitivity: PiiSensitivityExpectation; contextObligation: 'none' | 'reinforcing' | 'required-for-sensitive-classification';
    contextClass: 'sensitive' | 'neutral' | 'non-sensitive'; language: string; validatorApplicable: boolean; referenceApplicable: boolean };
  methodEvidence: { evidenceClass: PiiBenignCollisionEvidenceClass | null; controlClass: PiiControlClass | null;
    validatorEvidence: { family: string; id: string; version: number; expected: 'valid' | 'invalid' | 'unavailable'; observed: 'valid' | 'invalid' | 'unavailable' }[];
    validatorState: 'valid' | 'invalid' | 'unavailable' | null;
    collision: { targetFamily: string; competingFamilies: string[] } | null; referenceState: 'valid' | 'invalid' | 'unavailable' | null };
  outcome: PiiOutcome;
}
export interface PiiMetric {
  population: string; numerator: string; denominator: string; direction: 'upper' | 'lower';
  status: 'measured' | 'partial' | 'unresolved' | 'not-measured' | 'not-applicable';
  counts: { eligible: number; measured: number; numerator: number; unresolved: number; notMeasured: number; notApplicable: number; total: number };
  effectiveN: number;
  rate: MechanicalPublished;
}
export type PiiContextStatusCounts = { pass: number; fail: number; 'review-required': number; 'not-measured': number };
export type PiiContextLanguageStrata = Record<string, Record<'sensitive' | 'neutral' | 'non-sensitive', PiiContextStatusCounts>>;
export type PiiContextRoster = { groupId: string; language: string; frames: { id: string; contextClass: 'sensitive' | 'neutral' | 'non-sensitive';
  status: 'pass' | 'fail' | 'review-required' | 'not-measured' }[] }[];
export interface PiiAccountingReport extends AccountingArtifactIdentity {
  schemaVersion: 1; reportType: 'pii-accounting'; profile: { id: 'pii-v1'; version: 1 }; rowCount: number; sourceCaseCount: number;
  inputCommitment: string; commitmentTrust: 'unresolved' | 'trusted';
  sources: PiiAccountingSource[]; metrics: Record<PiiMetricId, PiiMetric>;
  benignByControlClass: Record<PiiControlClass, PiiMetric>;
  evidenceByClass: Record<PiiBenignCollisionEvidenceClass, { cases: number; accountingClasses: PiiControlClass[] }>;
  contextByLanguage: PiiContextLanguageStrata;
  contextRoster: PiiContextRoster;
  evidence: { methods: string[]; authority: { total: number; qualified: number; sources: number };
    validators: { applicable: number; evaluated: number }; benign: { cases: number; axes: PiiControlClass[] }; semanticControls: number;
    context: { applicable: number; evaluated: number }; jurisdiction: { applicable: number; evaluated: number };
    reference: { applicable: number; evaluated: number; unavailable: number } };
}

