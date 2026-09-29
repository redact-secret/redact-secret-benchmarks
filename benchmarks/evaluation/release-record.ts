/**
 * #287: one durable index binding the credential and PII evaluation domains
 * to a single release candidate, without recomputing or merging either
 * domain's metrics. See docs/decisions/2026-09-27-bind-the-beta10-cross-domain-release-record.md.
 */
import { hash } from './substrate/hash.ts';
import { validateEvidence } from './domains/credential/evidence.ts';
import { credentialAccountingIdentity } from './domains/credential/accounting.ts';
import { validatePiiQualificationReport, type PiiQualificationReport } from './domains/pii/qualification.ts';
import { validatePiiProductBinding, type PiiTrustedProductBinding } from './domains/pii/product-binding.ts';
import type { AccountingArtifactIdentity } from '../accounting/shared/primitives.ts';
import type { BudgetReport } from '../lib/regression-budgets.ts';

export const RELEASE_RECORD_SCHEMA_VERSION = 1;
export const RELEASE_RECORD_REPORT_TYPE = 'beta10-release-record';

/**
 * A field name that would only make sense as a cross-domain merge. The exact()
 * key lists below already reject anything unlisted; this denylist is the
 * explicit, greppable statement of the guardrail from #287, kept as an
 * independent check rather than relying on the key lists alone.
 */
const FORBIDDEN_CROSS_DOMAIN_KEYS = [
  'overallScore', 'combinedAccuracy', 'overallAccuracy', 'combinedFalsePositiveRate', 'combinedRate', 'f1', 'precision', 'recall',
];

export function assertNoCrossDomainAggregate(value: unknown, path = '$'): void {
  if (Array.isArray(value)) { value.forEach((item, index) => assertNoCrossDomainAggregate(item, `${path}[${index}]`)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CROSS_DOMAIN_KEYS.includes(key)) throw new Error(`Release record carries a forbidden cross-domain aggregate key: ${path}.${key}`);
    assertNoCrossDomainAggregate(child, `${path}.${key}`);
  }
}

const digest = (value: unknown, size = 64) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const commitment = (value: unknown) => {
  const { artifactCommitment: _artifactCommitment, ...projection } = value as Record<string, unknown>;
  return hash(JSON.stringify(canonical(projection)));
};

/** The two credential evidence shapes bound here (`benchmarks/evaluation/domains/credential/evidence.ts`); narrowed to what identity binding needs. */
export interface CredentialCandidateEvidence {
  schemaVersion: 1; reportType: 'candidate'; status: 'complete' | 'incomplete';
  candidate: { sourceCommit: string; sourceState: string; artifactSha256: string; expectedArtifactSha256: string | null };
  [key: string]: unknown;
}
export interface CredentialQualificationEvidence {
  schemaVersion: 2; reportType: 'qualification'; status: string;
  provenance: { sourceHash: string; lockHash: string; candidateArtifactHash: string; revision: string; dirty: boolean };
  holdout: { status: 'complete' | 'incomplete' };
  milestone: { status: string };
  [key: string]: unknown;
}

export interface ReleaseRecordIdentity {
  /** The one `redact-secret/redact-secret` commit every embedded artifact must name. */
  productSourceCommit: string;
  /** This repository's own commit that produced the record. */
  benchmarkRevision: string;
  /** `BudgetReport.budgetsId` (#143's reviewed regression-budget process). */
  performanceBudgetVersion: string;
  corpusCommitments: { credential: string; pii: string };
  profileVersions: { credential: 'measurement-v4' | 'evaluation-v1'; pii: 'pii-v1' };
  holdoutState: { credential: 'complete' | 'incomplete'; pii: 'complete' | 'incomplete' };
}

export interface CredentialReleaseSection {
  accountingIdentity: AccountingArtifactIdentity;
  candidateEvidence: CredentialCandidateEvidence;
  qualification: CredentialQualificationEvidence;
  reportCommitment: string;
}

export interface PiiReleaseSection {
  accountingIdentity: AccountingArtifactIdentity;
  qualification: PiiQualificationReport;
  /** The raw, unvalidated-at-rest binding; every read re-runs `validatePiiProductBinding` rather than trusting a stored derivation. */
  binding: PiiTrustedProductBinding;
  reportCommitment: string;
}

export interface ReleaseRecord {
  schemaVersion: 1; reportType: 'beta10-release-record'; supportClaims: false;
  identity: ReleaseRecordIdentity;
  performanceBudget: BudgetReport;
  credential: CredentialReleaseSection;
  pii: PiiReleaseSection;
  artifactCommitment: string;
}

export interface AssembleReleaseRecordInput {
  benchmarkRevision: string;
  performanceBudget: BudgetReport;
  credentialProfile: 'measurement-v4' | 'evaluation-v1';
  credentialCandidateEvidence: unknown;
  credentialQualification: unknown;
  piiQualification: PiiQualificationReport;
  piiBinding: PiiTrustedProductBinding;
  registryFamilies: readonly string[];
}

/**
 * Binds already-validated, unmodified domain artifacts to one release
 * candidate. Computes nothing about detection quality: every check here
 * reconciles identity fields that already exist inside each artifact.
 */
export function assembleReleaseRecord(input: AssembleReleaseRecordInput): ReleaseRecord {
  const credentialCandidateEvidence = validateEvidence(input.credentialCandidateEvidence, 'candidate') as unknown as CredentialCandidateEvidence;
  const credentialQualification = validateEvidence(input.credentialQualification, 'qualification') as unknown as CredentialQualificationEvidence;
  const piiQualification = validatePiiQualificationReport(input.piiQualification);
  const validatedBinding = validatePiiProductBinding(input.piiBinding, input.registryFamilies);

  if (!digest(input.benchmarkRevision, 40)) throw new Error('Invalid benchmark revision');
  if (credentialCandidateEvidence.status !== 'complete') throw new Error('Release record requires complete credential candidate evidence');
  if (validatedBinding.sourceCommit !== credentialCandidateEvidence.candidate.sourceCommit)
    throw new Error('Credential and PII candidate bindings name different release-candidate commits');
  if (input.performanceBudget.candidate.sourceCommit !== credentialCandidateEvidence.candidate.sourceCommit)
    throw new Error('Performance budget report does not bind the same release-candidate commit');
  if (piiQualification.domain !== 'pii' || piiQualification.evaluationProfile !== 'pii-v1' || piiQualification.domainAccountingVersion !== 'pii-v1')
    throw new Error('Unsupported PII qualification identity');

  const identity: ReleaseRecordIdentity = {
    productSourceCommit: credentialCandidateEvidence.candidate.sourceCommit,
    benchmarkRevision: input.benchmarkRevision,
    performanceBudgetVersion: input.performanceBudget.budgetsId,
    corpusCommitments: { credential: credentialQualification.provenance.candidateArtifactHash, pii: piiQualification.accounting.inputCommitment },
    profileVersions: { credential: input.credentialProfile, pii: 'pii-v1' },
    holdoutState: { credential: credentialQualification.holdout.status,
      pii: piiQualification.evidence.protected?.status ?? piiQualification.evidence.independent?.status ?? 'incomplete' },
  };

  const credential: CredentialReleaseSection = {
    accountingIdentity: credentialAccountingIdentity(input.credentialProfile),
    candidateEvidence: credentialCandidateEvidence, qualification: credentialQualification,
    reportCommitment: hash(JSON.stringify(canonical({ candidateEvidence: credentialCandidateEvidence, qualification: credentialQualification }))),
  };
  const pii: PiiReleaseSection = {
    accountingIdentity: { domain: piiQualification.domain, evaluationProfile: piiQualification.evaluationProfile, domainAccountingVersion: piiQualification.domainAccountingVersion },
    qualification: piiQualification, binding: input.piiBinding,
    reportCommitment: hash(JSON.stringify(canonical({ qualification: piiQualification, binding: input.piiBinding }))),
  };

  const record: ReleaseRecord = {
    schemaVersion: RELEASE_RECORD_SCHEMA_VERSION, reportType: RELEASE_RECORD_REPORT_TYPE, supportClaims: false,
    identity, performanceBudget: input.performanceBudget, credential, pii,
    artifactCommitment: '',
  };
  record.artifactCommitment = commitment(record);
  assertNoCrossDomainAggregate(record);
  return record;
}

/**
 * Re-validates both embedded domain artifacts through their own domain
 * validators, recomputes the record from them, and deep-compares the result
 * against the stored value — the same assemble-then-compare idiom used by
 * `validatePiiQualificationReport` and `validatePiiAccountingReport`.
 */
export function validateReleaseRecord(value: unknown, registryFamilies: readonly string[]): ReleaseRecord {
  if (!exact(value, ['schemaVersion', 'reportType', 'supportClaims', 'identity', 'performanceBudget', 'credential', 'pii', 'artifactCommitment']))
    throw new Error('Invalid release record shape');
  const record = value as ReleaseRecord;
  if (record.schemaVersion !== RELEASE_RECORD_SCHEMA_VERSION || record.reportType !== RELEASE_RECORD_REPORT_TYPE || record.supportClaims !== false)
    throw new Error('Unsupported release record identity');
  if (!exact(record.identity, ['productSourceCommit', 'benchmarkRevision', 'performanceBudgetVersion', 'corpusCommitments', 'profileVersions', 'holdoutState']))
    throw new Error('Invalid release record identity shape');
  if (!exact(record.credential, ['accountingIdentity', 'candidateEvidence', 'qualification', 'reportCommitment']) ||
      !exact(record.pii, ['accountingIdentity', 'qualification', 'binding', 'reportCommitment']))
    throw new Error('Invalid release record domain section shape');

  const expected = assembleReleaseRecord({
    benchmarkRevision: record.identity.benchmarkRevision,
    performanceBudget: record.performanceBudget,
    credentialProfile: record.identity.profileVersions.credential,
    credentialCandidateEvidence: record.credential.candidateEvidence,
    credentialQualification: record.credential.qualification,
    piiQualification: record.pii.qualification,
    piiBinding: record.pii.binding,
    registryFamilies,
  });

  if (JSON.stringify(canonical(record)) !== JSON.stringify(canonical(expected))) throw new Error('Release record does not reproduce from its own embedded artifacts');
  if (record.artifactCommitment !== commitment(record)) throw new Error('Release record artifact commitment mismatch');
  assertNoCrossDomainAggregate(record);
  return record;
}
