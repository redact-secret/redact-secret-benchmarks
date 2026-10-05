/**
 * #287/#449: one durable index binding the credential and PII evaluation
 * domains to a single release source commit, without recomputing or merging
 * either domain's metrics. See docs/decisions/2026-09-27-bind-the-beta10-cross-domain-release-record.md.
 *
 * Schema 1 (`beta10-release-record`) binds PII through the v1 trusted product
 * binding and is kept unchanged. Schema 2 (`release-record`) names the release
 * version and binds PII through either the v1 trusted product binding or the
 * reviewed v2 protected-support route (#428), plus a reviewed source
 * equivalence when the PII evidence commit differs from the release commit.
 */
import { hash } from './substrate/hash.ts';
import { validateEvidence, type QualificationSuite } from './evidence.ts';
import { credentialAccountingIdentity } from './domains/credential/accounting.ts';
import { validatePiiQualificationReport, type PiiQualificationReport } from './domains/pii/qualification.ts';
import { validatePiiProductBinding, type PiiTrustedProductBinding } from './domains/pii/product-binding.ts';
import type { AccountingArtifactIdentity } from '../accounting/shared/primitives.ts';
import { PII_PROTECTED_ROUTE, piiProtectedRouteProblem, piiReviewedProtectedRoute, type PiiProtectedRoute } from './domains/pii/support-semantics.ts';
import { piiSupportRegistry } from './domains/pii/support-v2.ts';
import { b11Commitment } from './domains/pii/beta11-qualification.ts';
import equivalenceLedger from './release-source-equivalences-v1.json';
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
export function validateReleaseRecord(value: unknown, registryFamilies: readonly string[], suite?: QualificationSuite): ReleaseRecord;
export function validateReleaseRecord(value: unknown, registryFamilies: readonly string[], suite?: QualificationSuite): ReleaseRecord | ReleaseRecordV2;
export function validateReleaseRecord(value: unknown, registryFamilies: readonly string[], suite?: QualificationSuite): ReleaseRecord | ReleaseRecordV2 {
  const typed = value as Record<string, unknown> | null;
  if (typed && typeof typed === 'object' && typed.schemaVersion === RELEASE_RECORD_V2_SCHEMA_VERSION && typed.reportType === RELEASE_RECORD_V2_REPORT_TYPE)
    return validateReleaseRecordV2(value, registryFamilies, suite);
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

// ---------------------------------------------------------------------------------------------------------------
// Schema 2 (#449): version-neutral, with a PII route and a reviewed source equivalence.
// ---------------------------------------------------------------------------------------------------------------

export const RELEASE_RECORD_V2_SCHEMA_VERSION = 2;
export const RELEASE_RECORD_V2_REPORT_TYPE = 'release-record';
export const PII_TRUSTED_PRODUCT_ROUTE = 'trusted-product-binding' as const;

/**
 * A reviewed statement that two product commits build the same detection behaviour, so evidence measured at one
 * binds the other. Entries live in `release-source-equivalences-v1.json`; a record may carry only an entry that is
 * byte-for-byte a reviewed one. `verifyReleaseRecordEvidence` re-derives the credential parity from the two committed
 * candidate runs.
 */
export interface ReleaseSourceEquivalence {
  id: string; fromCommit: string; toCommit: string; record: string;
  productDiff: { changedFiles: number; changedBuildInputs: string[]; note: string };
  credentialParity: { benchmarkRevision: string; fixtures: number; differingFixtures: 0;
    from: { evidence: string; candidateEvidenceCommitment: string }; to: { evidence: string; candidateEvidenceCommitment: string } };
}

export interface PiiTrustedReleaseSection {
  route: typeof PII_TRUSTED_PRODUCT_ROUTE; evidenceSourceCommit: string;
  accountingIdentity: AccountingArtifactIdentity; qualification: PiiQualificationReport; binding: PiiTrustedProductBinding; reportCommitment: string;
}
export interface PiiProtectedReleaseSection {
  route: typeof PII_PROTECTED_ROUTE; evidenceSourceCommit: string;
  accountingIdentity: AccountingArtifactIdentity; binding: PiiProtectedRoute;
  /** The committed `pii-beta11-protected-disposition` the route's `artifactCommitment` names. */
  protectedDisposition: any; reportCommitment: string;
}
export type PiiReleaseSectionV2 = PiiTrustedReleaseSection | PiiProtectedReleaseSection;

export interface ReleaseRecordV2 {
  schemaVersion: 2; reportType: 'release-record'; supportClaims: false;
  release: { version: string; sourceCommit: string };
  identity: ReleaseRecordIdentity;
  performanceBudget: BudgetReport;
  credential: CredentialReleaseSection;
  pii: PiiReleaseSectionV2;
  sourceEquivalence: ReleaseSourceEquivalence | null;
  artifactCommitment: string;
}

export type AssembleReleaseRecordV2Input = {
  releaseVersion: string; sourceCommit: string; benchmarkRevision: string; performanceBudget: BudgetReport;
  credentialProfile: 'measurement-v4' | 'evaluation-v1'; credentialCandidateEvidence: unknown; credentialQualification: unknown;
  sourceEquivalenceId?: string | null;
  /** Suite snapshot a frozen record was produced with; omitted for new records, which use the live suite. */
  suite?: QualificationSuite;
} & ({ piiRoute: typeof PII_TRUSTED_PRODUCT_ROUTE; piiQualification: PiiQualificationReport; piiBinding: PiiTrustedProductBinding; registryFamilies: readonly string[] } |
  { piiRoute: typeof PII_PROTECTED_ROUTE; piiProtectedBinding: PiiProtectedRoute; piiProtectedDisposition: unknown });

const PII_V1_IDENTITY = { domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1' } as const;
const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function reviewedReleaseSourceEquivalence(id: unknown): ReleaseSourceEquivalence | null {
  return (equivalenceLedger.equivalences as unknown as ReleaseSourceEquivalence[]).find(entry => entry.id === id) ?? null;
}

/** Checks the embedded protected disposition against its reviewed route entry without reading any file. */
function checkProtectedSection(binding: PiiProtectedRoute, disposition: any) {
  const reviewed = piiReviewedProtectedRoute(binding?.id);
  if (!reviewed || JSON.stringify(canonical(reviewed)) !== JSON.stringify(canonical(binding))) throw new Error('PII protected route is not a reviewed binding');
  const problem = piiProtectedRouteProblem(binding, piiSupportRegistry.families as any);
  if (problem) throw new Error(`PII protected route is malformed: ${problem}`);
  if (!disposition || disposition.reportType !== 'pii-beta11-protected-disposition' || disposition.schemaVersion !== 1 || disposition.supportClaims !== false ||
      disposition.route !== binding.route || disposition.candidate?.sourceCommit !== binding.coreCommit ||
      disposition.artifactCommitment !== b11Commitment({ ...disposition, artifactCommitment: undefined }) ||
      disposition.artifactCommitment !== binding.artifactCommitment)
    throw new Error('PII protected disposition does not match its reviewed route');
  if (disposition.families?.some((row: any) => row.status === 'stable') || disposition.distribution?.stable !== 0)
    throw new Error('PII protected route never projects stable');
  for (const row of binding.families) {
    const bound = disposition.families.find((item: any) => item.family === row.family);
    if (!bound || bound.status !== row.status) throw new Error('PII protected disposition family status differs from its reviewed route');
  }
}

export function assembleReleaseRecordV2(input: AssembleReleaseRecordV2Input): ReleaseRecordV2 {
  const credentialCandidateEvidence = validateEvidence(input.credentialCandidateEvidence, 'candidate', input.suite) as unknown as CredentialCandidateEvidence;
  const credentialQualification = validateEvidence(input.credentialQualification, 'qualification', input.suite) as unknown as CredentialQualificationEvidence;
  if (!RELEASE_VERSION.test(input.releaseVersion)) throw new Error('Invalid release version');
  if (!digest(input.sourceCommit, 40)) throw new Error('Invalid release source commit');
  if (!digest(input.benchmarkRevision, 40)) throw new Error('Invalid benchmark revision');
  if (credentialCandidateEvidence.status !== 'complete') throw new Error('Release record requires complete credential candidate evidence');
  const candidate = credentialCandidateEvidence as any;
  if (candidate.selection?.scope !== 'full-suite' || candidate.benchmark?.dirty !== false || candidate.candidate.sourceState !== 'clean')
    throw new Error('Release record requires a clean full-suite credential candidate run');
  if (candidate.candidate.sourceCommit !== input.sourceCommit) throw new Error('Credential candidate evidence does not name the release source commit');
  if (candidate.candidate.declaredVersion !== input.releaseVersion) throw new Error('Credential candidate evidence does not declare the release version');
  if (input.performanceBudget.candidate.sourceCommit !== input.sourceCommit)
    throw new Error('Performance budget report does not bind the same release-candidate commit');
  if (credentialQualification.provenance.dirty !== false) throw new Error('Credential qualification ran on a dirty benchmark tree');

  let pii: PiiReleaseSectionV2, piiCorpus: string, piiHoldout: 'complete' | 'incomplete';
  if (input.piiRoute === PII_TRUSTED_PRODUCT_ROUTE) {
    const qualification = validatePiiQualificationReport(input.piiQualification);
    const validated = validatePiiProductBinding(input.piiBinding, input.registryFamilies);
    if (qualification.domain !== 'pii' || qualification.evaluationProfile !== 'pii-v1' || qualification.domainAccountingVersion !== 'pii-v1')
      throw new Error('Unsupported PII qualification identity');
    pii = { route: PII_TRUSTED_PRODUCT_ROUTE, evidenceSourceCommit: validated.sourceCommit, accountingIdentity: { ...PII_V1_IDENTITY },
      qualification, binding: input.piiBinding,
      reportCommitment: hash(JSON.stringify(canonical({ qualification, binding: input.piiBinding }))) };
    piiCorpus = qualification.accounting.inputCommitment;
    piiHoldout = qualification.evidence.protected?.status ?? qualification.evidence.independent?.status ?? 'incomplete';
  } else if (input.piiRoute === PII_PROTECTED_ROUTE) {
    checkProtectedSection(input.piiProtectedBinding, input.piiProtectedDisposition);
    const disposition = input.piiProtectedDisposition as any;
    pii = { route: PII_PROTECTED_ROUTE, evidenceSourceCommit: input.piiProtectedBinding.coreCommit, accountingIdentity: { ...PII_V1_IDENTITY },
      binding: input.piiProtectedBinding, protectedDisposition: disposition,
      reportCommitment: hash(JSON.stringify(canonical({ binding: input.piiProtectedBinding, protectedDisposition: disposition }))) };
    piiCorpus = input.piiProtectedBinding.freezeCommitment;
    piiHoldout = disposition.families.every((row: any) => row.protected?.runs === '1/1' && row.protected?.sealed === true) ? 'complete' : 'incomplete';
  } else throw new Error('Unsupported PII release route');

  let sourceEquivalence: ReleaseSourceEquivalence | null = null;
  if (pii.evidenceSourceCommit !== input.sourceCommit) {
    const entry = reviewedReleaseSourceEquivalence(input.sourceEquivalenceId);
    if (!entry) throw new Error('PII evidence names a different commit and no reviewed source equivalence was given');
    if (entry.fromCommit !== pii.evidenceSourceCommit || entry.toCommit !== input.sourceCommit)
      throw new Error('Source equivalence does not connect the PII evidence commit to the release commit');
    if (entry.credentialParity.to.candidateEvidenceCommitment !== hash(JSON.stringify(credentialCandidateEvidence)))
      throw new Error('Source equivalence parity does not name this credential candidate run');
    sourceEquivalence = structuredClone(entry);
  } else if (input.sourceEquivalenceId) throw new Error('A source equivalence is only allowed when the PII evidence commit differs');

  const record: ReleaseRecordV2 = {
    schemaVersion: RELEASE_RECORD_V2_SCHEMA_VERSION, reportType: RELEASE_RECORD_V2_REPORT_TYPE, supportClaims: false,
    release: { version: input.releaseVersion, sourceCommit: input.sourceCommit },
    identity: {
      productSourceCommit: input.sourceCommit, benchmarkRevision: input.benchmarkRevision, performanceBudgetVersion: input.performanceBudget.budgetsId,
      corpusCommitments: { credential: credentialQualification.provenance.candidateArtifactHash, pii: piiCorpus },
      profileVersions: { credential: input.credentialProfile, pii: 'pii-v1' },
      holdoutState: { credential: credentialQualification.holdout.status, pii: piiHoldout },
    },
    performanceBudget: input.performanceBudget,
    credential: {
      accountingIdentity: credentialAccountingIdentity(input.credentialProfile),
      candidateEvidence: credentialCandidateEvidence, qualification: credentialQualification,
      reportCommitment: hash(JSON.stringify(canonical({ candidateEvidence: credentialCandidateEvidence, qualification: credentialQualification }))),
    },
    pii, sourceEquivalence, artifactCommitment: '',
  };
  record.artifactCommitment = commitment(record);
  assertNoCrossDomainAggregate(record);
  return record;
}

/** Re-assembles a schema 2 record from its own embedded artifacts and requires a byte-identical result. Reads no file. */
export function validateReleaseRecordV2(value: unknown, registryFamilies: readonly string[], suite?: QualificationSuite): ReleaseRecordV2 {
  if (!exact(value, ['schemaVersion', 'reportType', 'supportClaims', 'release', 'identity', 'performanceBudget', 'credential', 'pii', 'sourceEquivalence', 'artifactCommitment']))
    throw new Error('Invalid release record shape');
  const record = value as ReleaseRecordV2;
  if (record.schemaVersion !== RELEASE_RECORD_V2_SCHEMA_VERSION || record.reportType !== RELEASE_RECORD_V2_REPORT_TYPE || record.supportClaims !== false)
    throw new Error('Unsupported release record identity');
  if (!exact(record.release, ['version', 'sourceCommit'])) throw new Error('Invalid release record release shape');
  if (!exact(record.identity, ['productSourceCommit', 'benchmarkRevision', 'performanceBudgetVersion', 'corpusCommitments', 'profileVersions', 'holdoutState']))
    throw new Error('Invalid release record identity shape');
  const piiKeys = record.pii?.route === PII_PROTECTED_ROUTE ?
    ['route', 'evidenceSourceCommit', 'accountingIdentity', 'binding', 'protectedDisposition', 'reportCommitment'] :
    ['route', 'evidenceSourceCommit', 'accountingIdentity', 'qualification', 'binding', 'reportCommitment'];
  if (!exact(record.credential, ['accountingIdentity', 'candidateEvidence', 'qualification', 'reportCommitment']) || !exact(record.pii, piiKeys))
    throw new Error('Invalid release record domain section shape');
  const common = {
    releaseVersion: record.release.version, sourceCommit: record.release.sourceCommit, benchmarkRevision: record.identity.benchmarkRevision,
    performanceBudget: record.performanceBudget, credentialProfile: record.identity.profileVersions.credential,
    credentialCandidateEvidence: record.credential.candidateEvidence, credentialQualification: record.credential.qualification,
    sourceEquivalenceId: record.sourceEquivalence?.id ?? null, suite,
  };
  const pii = record.pii as any;
  const expected = assembleReleaseRecordV2(pii.route === PII_PROTECTED_ROUTE ?
    { ...common, piiRoute: PII_PROTECTED_ROUTE, piiProtectedBinding: pii.binding, piiProtectedDisposition: pii.protectedDisposition } :
    { ...common, piiRoute: PII_TRUSTED_PRODUCT_ROUTE, piiQualification: pii.qualification, piiBinding: pii.binding, registryFamilies });
  if (JSON.stringify(canonical(record)) !== JSON.stringify(canonical(expected))) throw new Error('Release record does not reproduce from its own embedded artifacts');
  if (record.artifactCommitment !== commitment(record)) throw new Error('Release record artifact commitment mismatch');
  assertNoCrossDomainAggregate(record);
  return record;
}
