import Ajv from 'ajv';
import reportSchema from '../../../../schemas/pii-accounting-report-v1.json';
import { assertCompatibleIdentities, proportion, type AccountingArtifactIdentity, type MechanicalPublished } from '../../../accounting/shared/primitives.ts';
import type { PiiAuthority, PiiOutcome, PiiScope, PiiSensitivityExpectation } from './types.ts';
import { PII_METRIC_IDS, piiV1Profile, validatePiiQualificationProfile, type PiiMetricId, type PiiQualificationProfile } from './profile.ts';

export const PII_ACCOUNTING_IDENTITY = Object.freeze({ domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1' });
type Bucket = 'numerator' | 'other' | 'unresolved' | 'notMeasured' | 'notApplicable';
export interface PiiAccountingRow {
  caseId: string; method: string; family: string; scope: PiiScope; variant: string; scanner: string;
  qualificationProfile: { id: 'pii-v1'; version: 1 };
  authority: PiiAuthority;
  expectation: { type: 'valid' | 'invalid'; sensitivity: PiiSensitivityExpectation; contextObligation: 'required' | 'optional' | 'forbidden';
    contextClass: 'sensitive' | 'neutral' | 'non-sensitive'; validatorApplicable: boolean; referenceApplicable: boolean };
  methodEvidence: { controlClass: 'reserved' | 'documentation' | 'test-value' | 'public-operational' | 'placeholder' | 'context-negative' | null;
    validatorState: 'valid' | 'invalid' | 'unavailable' | null; collisionEvaluated: boolean; referenceState: 'valid' | 'invalid' | 'unavailable' | null };
  outcome: PiiOutcome;
}
export interface PiiMetric {
  population: string; numerator: string; denominator: string; direction: 'upper' | 'lower';
  status: 'measured' | 'partial' | 'unresolved' | 'not-measured' | 'not-applicable';
  counts: { eligible: number; measured: number; numerator: number; unresolved: number; notMeasured: number; notApplicable: number; total: number };
  rate: MechanicalPublished;
}
export interface PiiAccountingReport extends AccountingArtifactIdentity {
  schemaVersion: 1; reportType: 'pii-accounting'; profile: { id: 'pii-v1'; version: 1 }; rowCount: number;
  metrics: Record<PiiMetricId, PiiMetric>;
  evidence: {
    methods: string[]; authority: { total: number; qualified: number }; validators: { applicable: number; evaluated: number };
    benign: { cases: number; axes: PiiAccountingRow['methodEvidence']['controlClass'][] }; semanticControls: number;
    context: { applicable: number; evaluated: number }; jurisdiction: { applicable: number; evaluated: number };
    reference: { applicable: number; evaluated: number; unavailable: number };
  };
}

const validateSchema = new Ajv({ strict: true }).compile(reportSchema);
const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const unique = <T>(rows: T[], key: (row: T) => string) => [...new Map(rows.map(row => [key(row), row])).values()];

export function assertPiiAccountingIdentities(identities: AccountingArtifactIdentity[]) {
  const identity = assertCompatibleIdentities(identities);
  if (identity.domain !== PII_ACCOUNTING_IDENTITY.domain || identity.evaluationProfile !== PII_ACCOUNTING_IDENTITY.evaluationProfile ||
      identity.domainAccountingVersion !== PII_ACCOUNTING_IDENTITY.domainAccountingVersion) throw new Error('Unsupported PII accounting identity');
  return identity;
}

function validateRow(row: PiiAccountingRow) {
  const authorityKinds = ['standard', 'public-authority', 'official-test-source'], claims = ['format', 'allocation', 'context', 'test-vector'];
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const locator = (value: unknown) => typeof value === 'string' && (/^https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9._~!$&'()*+,;=:@\/-]+$/.test(value) ||
    /^(?:urn|benchmark):[a-zA-Z0-9][a-zA-Z0-9._:-]{1,199}$/.test(value));
  const typeStates = ['correct', 'miss', 'invalid-correct', 'invalid-accepted', 'wrong-family', 'wrong-jurisdiction', 'not-measured'];
  const sensitivityStates = ['correct', 'miss', 'false-positive', 'unresolved', 'not-measured'];
  if (!row || !exact(row, ['caseId', 'method', 'family', 'scope', 'variant', 'scanner', 'qualificationProfile', 'authority', 'expectation', 'methodEvidence', 'outcome']) ||
      !slug(row.caseId) || !slug(row.method) || !slug(row.family) || !slug(row.variant) || !/^[a-z][a-z0-9.-]+$/.test(row.scanner) ||
      row.qualificationProfile?.id !== 'pii-v1' || row.qualificationProfile.version !== 1 ||
      !exact(row.qualificationProfile, ['id', 'version']) || !exact(row.expectation, ['type', 'sensitivity', 'contextObligation', 'contextClass', 'validatorApplicable', 'referenceApplicable']) ||
      !['valid', 'invalid'].includes(row.expectation?.type) || !['sensitive', 'non-sensitive', 'unresolved'].includes(row.expectation?.sensitivity) ||
      !['required', 'optional', 'forbidden'].includes(row.expectation?.contextObligation) ||
      !['sensitive', 'neutral', 'non-sensitive'].includes(row.expectation?.contextClass) ||
      typeof row.expectation?.validatorApplicable !== 'boolean' || typeof row.expectation?.referenceApplicable !== 'boolean' || !row.authority ||
      !exact(row.authority, ['kind', 'locator', 'version', 'claim', 'observedAt']) || !authorityKinds.includes(row.authority.kind) || !locator(row.authority.locator) ||
      typeof row.authority.version !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(row.authority.version) || !claims.includes(row.authority.claim) ||
      !date(row.authority.observedAt) ||
      !row.outcome || !exact(row.outcome, ['scanner', 'variant', 'typeIdentity', 'sensitivityContext', 'range', 'observed']) ||
      row.outcome.variant !== row.variant || row.outcome.scanner !== row.scanner ||
      !exact(row.outcome.typeIdentity, ['axis', 'status', 'state', 'reason']) || row.outcome.typeIdentity.axis !== 'type-identity' ||
      !['pass', 'fail', 'review-required', 'not-measured'].includes(row.outcome.typeIdentity.status) || !typeStates.includes(row.outcome.typeIdentity.state) ||
      !exact(row.outcome.sensitivityContext, ['axis', 'status', 'state', 'reason']) || row.outcome.sensitivityContext.axis !== 'sensitivity-context' ||
      !['pass', 'fail', 'review-required', 'not-measured'].includes(row.outcome.sensitivityContext.status) || !sensitivityStates.includes(row.outcome.sensitivityContext.state) ||
      !['exact', 'overbroad', 'partial', 'miss', 'not-applicable'].includes(row.outcome.range) ||
      !exact(row.outcome.observed, ['findingCount', 'families', 'jurisdictions']) || !Number.isInteger(row.outcome.observed.findingCount) || row.outcome.observed.findingCount < 0 ||
      !Array.isArray(row.outcome.observed.families) || !Array.isArray(row.outcome.observed.jurisdictions) ||
      [...row.outcome.observed.families, ...row.outcome.observed.jurisdictions].some(value => !slug(value))) throw new Error('Invalid PII accounting row');
  if (!row.scope || !exact(row.scope, row.scope.kind === 'global' ? ['kind'] : ['kind', 'jurisdiction']) ||
      (row.scope.kind !== 'global' && (row.scope.kind !== 'jurisdictional' || !slug(row.scope.jurisdiction)))) throw new Error('Invalid PII accounting row');
  const typeStatus = row.outcome.typeIdentity.state === 'not-measured' ? 'not-measured' :
    ['correct', 'invalid-correct'].includes(row.outcome.typeIdentity.state) ? 'pass' : 'fail';
  const sensitivityStatus = row.outcome.sensitivityContext.state === 'not-measured' ? 'not-measured' :
    row.outcome.sensitivityContext.state === 'unresolved' ? 'review-required' : row.outcome.sensitivityContext.state === 'correct' ? 'pass' : 'fail';
  const validTypeStates = row.expectation.type === 'valid' ? ['correct', 'miss', 'wrong-family', 'wrong-jurisdiction', 'not-measured']
    : ['invalid-correct', 'invalid-accepted', 'not-measured'];
  const validSensitivityStates = row.expectation.sensitivity === 'unresolved' ? ['unresolved', 'not-measured'] :
    row.expectation.sensitivity === 'sensitive' ? ['correct', 'miss', 'not-measured'] : ['correct', 'false-positive', 'not-measured'];
  if (row.outcome.typeIdentity.status !== typeStatus || row.outcome.sensitivityContext.status !== sensitivityStatus ||
      !validTypeStates.includes(row.outcome.typeIdentity.state) || !validSensitivityStates.includes(row.outcome.sensitivityContext.state))
    throw new Error('PII accounting outcome contradicts its authored expectation');
  const states = [row.methodEvidence.validatorState, row.methodEvidence.referenceState];
  if (!exact(row.methodEvidence, ['controlClass', 'validatorState', 'collisionEvaluated', 'referenceState']) ||
      states.some(state => state !== null && !['valid', 'invalid', 'unavailable'].includes(state)) ||
      ![null, 'reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative'].includes(row.methodEvidence.controlClass) ||
      typeof row.methodEvidence.collisionEvaluated !== 'boolean') throw new Error('Invalid PII accounting row');
  return row;
}

function metric(rows: PiiAccountingRow[], profile: PiiQualificationProfile, id: PiiMetricId, population: string, numerator: string,
  denominator: string, classify: (row: PiiAccountingRow) => Bucket): PiiMetric {
  const buckets = rows.map(classify), counts = {
    eligible: buckets.filter(value => value !== 'notApplicable').length,
    measured: buckets.filter(value => value === 'numerator' || value === 'other').length,
    numerator: buckets.filter(value => value === 'numerator').length,
    unresolved: buckets.filter(value => value === 'unresolved').length,
    notMeasured: buckets.filter(value => value === 'notMeasured').length,
    notApplicable: buckets.filter(value => value === 'notApplicable').length, total: rows.length,
  };
  const status = counts.eligible === 0 ? 'not-applicable' : counts.measured === 0
    ? (counts.unresolved ? 'unresolved' : 'not-measured') : counts.unresolved || counts.notMeasured ? 'partial' : 'measured';
  const direction = profile.metrics[id].direction;
  return { population, numerator, denominator, direction, status,
    counts, rate: proportion(counts.numerator, counts.measured, direction, profile.mechanics) };
}

const axisBucket = (status: string, event: boolean): Bucket => status === 'review-required' ? 'unresolved' : status === 'not-measured'
  ? 'notMeasured' : event ? 'numerator' : 'other';

export function accountPiiRows(input: PiiAccountingRow[], profile: PiiQualificationProfile = piiV1Profile): PiiAccountingReport {
  validatePiiQualificationProfile(profile);
  const rows = input.map(row => validateRow(structuredClone(row)));
  const metrics = {
    'type-miss-rate': metric(rows, profile, 'type-miss-rate', 'scanner × valid-type occurrence', 'type state is miss',
      'resolved type assertions for authored valid types', row => row.expectation.type !== 'valid' ? 'notApplicable' :
        axisBucket(row.outcome.typeIdentity.status, row.outcome.typeIdentity.state === 'miss')),
    'wrong-identity-rate': metric(rows, profile, 'wrong-identity-rate', 'scanner × valid-type occurrence', 'wrong family or jurisdiction',
      'resolved type assertions for authored valid types', row => row.expectation.type !== 'valid' ? 'notApplicable' :
        axisBucket(row.outcome.typeIdentity.status, ['wrong-family', 'wrong-jurisdiction'].includes(row.outcome.typeIdentity.state))),
    'sensitive-miss-rate': metric(rows, profile, 'sensitive-miss-rate', 'scanner × authored sensitive occurrence', 'sensitivity state is miss',
      'resolved sensitivity assertions for authored sensitive occurrences', row => row.expectation.sensitivity !== 'sensitive' ? 'notApplicable' :
        axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.state === 'miss')),
    'non-sensitive-flag-rate': metric(rows, profile, 'non-sensitive-flag-rate', 'scanner × authored non-sensitive occurrence', 'sensitivity state is false-positive',
      'resolved sensitivity assertions for authored non-sensitive occurrences', row => row.expectation.sensitivity !== 'non-sensitive' ? 'notApplicable' :
        axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.state === 'false-positive')),
    'context-discrimination-rate': metric(rows, profile, 'context-discrimination-rate', 'context-discrimination sensitive and non-sensitive endpoints',
      'sensitivity assertion passes', 'resolved endpoint sensitivity assertions', row => row.method !== 'context-discrimination' || row.expectation.sensitivity === 'unresolved'
        ? 'notApplicable' : axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.status === 'pass')),
    'benign-suppression-rate': metric(rows, profile, 'benign-suppression-rate', 'authored semantic benign controls', 'non-sensitive assertion passes',
      'resolved benign sensitivity assertions', row => row.method !== 'pii-benign' ? 'notApplicable' :
        axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.status === 'pass')),
    'jurisdiction-collision-rate': metric(rows, profile, 'jurisdiction-collision-rate', 'authored cross-jurisdiction collision controls',
      'target family and jurisdiction assertion passes', 'resolved collision type assertions', row => row.method !== 'jurisdiction-collision' ? 'notApplicable' :
        axisBucket(row.outcome.typeIdentity.status, row.outcome.typeIdentity.status === 'pass')),
    'range-collateral-rate': metric(rows, profile, 'range-collateral-rate', 'reported spans for authored valid types', 'range is overbroad or partial',
      'exact, overbroad, or partial reported spans', row => row.expectation.type !== 'valid' || row.outcome.range === 'miss' ? 'notApplicable'
        : row.outcome.range === 'not-applicable' ? 'notMeasured' : ['overbroad', 'partial'].includes(row.outcome.range) ? 'numerator' : 'other'),
    'measurable-share': (() => {
      const statuses = rows.flatMap(row => [row.outcome.typeIdentity.status, row.outcome.sensitivityContext.status]);
      const counts = { eligible: statuses.length, measured: statuses.filter(value => value === 'pass' || value === 'fail').length,
        numerator: statuses.filter(value => value === 'pass' || value === 'fail').length,
        unresolved: statuses.filter(value => value === 'review-required').length, notMeasured: statuses.filter(value => value === 'not-measured').length,
        notApplicable: 0, total: statuses.length };
      const status = !counts.total ? 'not-applicable' : counts.measured === 0 ? (counts.unresolved ? 'unresolved' : 'not-measured')
        : counts.unresolved || counts.notMeasured ? 'partial' : 'measured';
      return { population: 'all type and sensitivity assertions', numerator: 'resolved pass or fail assertions', denominator: 'all authored assertions',
        direction: 'lower' as const, status, counts, rate: proportion(counts.numerator, counts.total, 'lower', profile.mechanics) };
    })(),
  } satisfies Record<PiiMetricId, PiiMetric>;
  const occurrences = unique(rows, row => `${row.caseId}/${row.variant}`), benign = occurrences.filter(row => row.method === 'pii-benign');
  const contextFamilies = new Set(occurrences.filter(row => row.expectation.contextObligation === 'required').map(row => row.family));
  const evaluatedContextFamilies = new Set(occurrences.filter(row => row.method === 'context-discrimination').map(row => row.family));
  const jurisdictionFamilies = new Set(occurrences.filter(row => row.scope.kind === 'jurisdictional').map(row => row.family));
  const evaluatedJurisdictionFamilies = new Set(occurrences.filter(row => row.methodEvidence.collisionEvaluated).map(row => row.family));
  const evidence = {
    methods: [...new Set(rows.map(row => row.method))].sort(), authority: { total: occurrences.length, qualified: occurrences.length },
    validators: { applicable: occurrences.filter(row => row.expectation.validatorApplicable).length,
      evaluated: occurrences.filter(row => row.expectation.validatorApplicable && row.methodEvidence.validatorState !== null && row.methodEvidence.validatorState !== 'unavailable').length },
    benign: { cases: benign.length, axes: [...new Set(benign.map(row => row.methodEvidence.controlClass).filter(value => value !== null))].sort() },
    semanticControls: benign.length,
    context: { applicable: contextFamilies.size, evaluated: [...contextFamilies].filter(family => evaluatedContextFamilies.has(family)).length },
    jurisdiction: { applicable: jurisdictionFamilies.size,
      evaluated: [...jurisdictionFamilies].filter(family => evaluatedJurisdictionFamilies.has(family)).length },
    reference: { applicable: occurrences.filter(row => row.expectation.referenceApplicable).length,
      evaluated: occurrences.filter(row => row.expectation.referenceApplicable && row.methodEvidence.referenceState !== null && row.methodEvidence.referenceState !== 'unavailable').length,
      unavailable: occurrences.filter(row => row.expectation.referenceApplicable && row.methodEvidence.referenceState === 'unavailable').length },
  };
  return validatePiiAccountingReport({ schemaVersion: 1, reportType: 'pii-accounting', ...PII_ACCOUNTING_IDENTITY,
    profile: { id: profile.id, version: profile.version }, rowCount: rows.length, metrics, evidence });
}

export function validatePiiAccountingReport(value: unknown): PiiAccountingReport {
  if (!validateSchema(value)) throw new Error('Invalid PII accounting report schema');
  const report = value as unknown as PiiAccountingReport;
  assertPiiAccountingIdentities([report]);
  for (const id of PII_METRIC_IDS) {
    const row = report.metrics[id], c = row.counts;
    if (c.eligible + c.notApplicable !== c.total || c.measured + c.unresolved + c.notMeasured !== c.eligible || c.numerator > c.measured ||
        c.total !== report.rowCount * (id === 'measurable-share' ? 2 : 1) || row.direction !== piiV1Profile.metrics[id].direction)
      throw new Error('Inconsistent PII accounting metric');
    const expectedStatus = c.eligible === 0 ? 'not-applicable' : c.measured === 0 ? (c.unresolved ? 'unresolved' : 'not-measured')
      : c.unresolved || c.notMeasured ? 'partial' : 'measured';
    if (row.status !== expectedStatus) throw new Error('Inconsistent PII accounting metric');
    const denominator = id === 'measurable-share' ? c.total : c.measured;
    const expectedRate = proportion(c.numerator, denominator, row.direction, piiV1Profile.mechanics);
    if (JSON.stringify(row.rate) !== JSON.stringify(expectedRate))
      throw new Error('Inconsistent PII accounting rate');
  }
  const evidence = report.evidence;
  if (evidence.authority.qualified > evidence.authority.total || evidence.authority.total > report.rowCount ||
      evidence.validators.evaluated > evidence.validators.applicable || evidence.context.evaluated > report.rowCount ||
      evidence.jurisdiction.evaluated > report.rowCount || evidence.reference.evaluated + evidence.reference.unavailable > evidence.reference.applicable ||
      evidence.benign.axes.length > evidence.benign.cases || evidence.semanticControls !== evidence.benign.cases)
    throw new Error('Inconsistent PII accounting evidence');
  if (Object.hasOwn(report, 'overallScore')) throw new Error('PII overall score is forbidden');
  return report;
}

export function piiAccountingRowsFromEvaluation(artifact: unknown): PiiAccountingRow[] {
  const value = artifact as { domain?: unknown; results?: unknown };
  if (value?.domain !== 'pii' || !Array.isArray(value.results)) throw new Error('Invalid PII evaluation artifact for accounting');
  return value.results.flatMap((raw: any) => {
    if (!raw || !Array.isArray(raw.variants) || !Array.isArray(raw.outcomes)) throw new Error('Invalid PII evaluation artifact for accounting');
    return raw.outcomes.map((outcome: PiiOutcome) => {
      const variant = raw.variants.find((candidate: any) => candidate.id === outcome.variant);
      if (!variant?.expectation) throw new Error('Missing PII accounting expectation');
      const evidence = raw.evidence ?? {};
      return validateRow({ caseId: raw.id, method: raw.method, family: raw.family, scope: raw.scope, variant: outcome.variant,
        scanner: outcome.scanner, qualificationProfile: raw.qualificationProfile, authority: raw.authority, expectation: variant.expectation,
        methodEvidence: { controlClass: evidence.control?.controlClass ?? null, validatorState: evidence.validation?.state ?? null,
          collisionEvaluated: evidence.collision?.kind === 'jurisdiction-collision', referenceState: evidence.reference?.reference?.state ?? null }, outcome });
    });
  });
}
