import Ajv from 'ajv';
import reportSchema from '../../../../schemas/pii-accounting-report-v1.json';
import { assertCompatibleIdentities, proportion, type AccountingArtifactIdentity, type MechanicalPublished } from '../../../accounting/shared/primitives.ts';
import { piiIdentity } from './identity.ts';
import type { PiiAuthority, PiiOutcome, PiiScope, PiiSensitivityExpectation } from './types.ts';
import { PII_METRIC_IDS, piiV1Profile, validatePiiQualificationProfile, type PiiMetricId, type PiiQualificationProfile } from './profile.ts';

export const PII_ACCOUNTING_IDENTITY = Object.freeze({ domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1' });
export const PII_CONTROL_CLASSES = Object.freeze(['reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative'] as const);
export type PiiControlClass = typeof PII_CONTROL_CLASSES[number];
type Bucket = 'numerator' | 'other' | 'unresolved' | 'notMeasured' | 'notApplicable';

export interface PiiAccountingSource {
  schemaVersion: 1; engineVersion: string; domain: 'pii'; reportProfile: { id: 'pii-evaluation'; version: 1 };
  evaluationProfile: 'pii-schema-v1'; domainAccountingVersion: 'pii-observation-v1'; runId: string; startedAt: string; finishedAt: string;
  provenance: { sourceRevision: string | null; candidateArtifactHash: string | null; planHash: string | null };
  scanner: { id: string; version: string | null; mode: string; configurationHash: string; status: 'complete' | 'unsupported' | 'unavailable' | 'error' | 'unstable' };
}
export interface PiiAccountingRow {
  source: PiiAccountingSource; caseId: string; method: string; family: string; scope: PiiScope; variant: string;
  strategy: 'authored' | 'derived' | 'review-required'; scanner: string; qualificationProfile: { id: 'pii-v1'; version: 1 }; authority: PiiAuthority;
  expectation: { type: 'valid' | 'invalid'; sensitivity: PiiSensitivityExpectation; contextObligation: 'required' | 'optional' | 'forbidden';
    contextClass: 'sensitive' | 'neutral' | 'non-sensitive'; validatorApplicable: boolean; referenceApplicable: boolean };
  methodEvidence: { controlClass: PiiControlClass | null; validatorState: 'valid' | 'invalid' | 'unavailable' | null;
    collision: { targetFamily: string; competingFamilies: string[] } | null; referenceState: 'valid' | 'invalid' | 'unavailable' | null };
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
  sources: PiiAccountingSource[]; rows: PiiAccountingRow[]; metrics: Record<PiiMetricId, PiiMetric>;
  benignByControlClass: Record<PiiControlClass, PiiMetric>;
  evidence: { methods: string[]; authority: { total: number; qualified: number; sources: number };
    validators: { applicable: number; evaluated: number }; benign: { cases: number; axes: PiiControlClass[] }; semanticControls: number;
    context: { applicable: number; evaluated: number }; jurisdiction: { applicable: number; evaluated: number };
    reference: { applicable: number; evaluated: number; unavailable: number } };
}

const validateSchema = new Ajv({ strict: true }).compile(reportSchema);
const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const canonical = (value: unknown) => JSON.stringify(value);
const unique = <T>(rows: T[], key: (row: T) => string) => [...new Map(rows.map(row => [key(row), row])).values()];
const dateTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function assertPiiAccountingIdentities(identities: AccountingArtifactIdentity[]) {
  const identity = assertCompatibleIdentities(identities);
  if (identity.domain !== PII_ACCOUNTING_IDENTITY.domain || identity.evaluationProfile !== PII_ACCOUNTING_IDENTITY.evaluationProfile ||
      identity.domainAccountingVersion !== PII_ACCOUNTING_IDENTITY.domainAccountingVersion) throw new Error('Unsupported PII accounting identity');
  return identity;
}

function validateSource(source: PiiAccountingSource) {
  const nullableDigest = (value: unknown) => value === null || digest(value);
  if (!source || !exact(source, ['schemaVersion', 'engineVersion', 'domain', 'reportProfile', 'evaluationProfile', 'domainAccountingVersion', 'runId',
      'startedAt', 'finishedAt', 'provenance', 'scanner']) || source.schemaVersion !== 1 || source.domain !== piiIdentity.domain ||
      source.reportProfile?.id !== piiIdentity.reportProfile.id || source.reportProfile.version !== piiIdentity.reportProfile.version ||
      !exact(source.reportProfile, ['id', 'version']) || source.evaluationProfile !== piiIdentity.evaluationProfile ||
      source.domainAccountingVersion !== piiIdentity.domainAccountingVersion || !/^\d+\.\d+\.\d+$/.test(source.engineVersion) ||
      !/^[a-f0-9-]{36}$/.test(source.runId) || !dateTime(source.startedAt) || !dateTime(source.finishedAt) || Date.parse(source.finishedAt) < Date.parse(source.startedAt) ||
      !exact(source.provenance, ['sourceRevision', 'candidateArtifactHash', 'planHash']) ||
      ![source.provenance.sourceRevision, source.provenance.candidateArtifactHash, source.provenance.planHash].every(nullableDigest) ||
      !exact(source.scanner, ['id', 'version', 'mode', 'configurationHash', 'status']) || !/^[a-z][a-z0-9.-]+$/.test(source.scanner.id) ||
      (source.scanner.version !== null && (typeof source.scanner.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(source.scanner.version))) ||
      !['candidate', 'published', 'holdout', 'test', 'unspecified'].includes(source.scanner.mode) || !digest(source.scanner.configurationHash) ||
      !['complete', 'unsupported', 'unavailable', 'error', 'unstable'].includes(source.scanner.status))
    throw new Error('Invalid PII accounting source');
  return source;
}

function validateRow(row: PiiAccountingRow) {
  const authorityKinds = ['standard', 'public-authority', 'official-test-source'], claims = ['format', 'allocation', 'context', 'test-vector'];
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const locator = (value: unknown) => typeof value === 'string' && (/^https:\/\/[a-z0-9.-]+\/[a-zA-Z0-9._~!$&'()*+,;=:@\/-]+$/.test(value) ||
    /^(?:urn|benchmark):[a-zA-Z0-9][a-zA-Z0-9._:-]{1,199}$/.test(value));
  const typeStates = ['correct', 'miss', 'invalid-correct', 'invalid-accepted', 'wrong-family', 'wrong-jurisdiction', 'not-measured'];
  const sensitivityStates = ['correct', 'miss', 'false-positive', 'unresolved', 'not-measured'];
  if (!row || !exact(row, ['source', 'caseId', 'method', 'family', 'scope', 'variant', 'strategy', 'scanner', 'qualificationProfile', 'authority', 'expectation', 'methodEvidence', 'outcome']) ||
      !validateSource(row.source) || !slug(row.caseId) || !slug(row.method) || !slug(row.family) || !slug(row.variant) || !['authored', 'derived', 'review-required'].includes(row.strategy) ||
      !/^[a-z][a-z0-9.-]+$/.test(row.scanner) || row.scanner !== row.source.scanner.id || row.qualificationProfile?.id !== 'pii-v1' || row.qualificationProfile.version !== 1 ||
      !exact(row.qualificationProfile, ['id', 'version']) || !exact(row.expectation, ['type', 'sensitivity', 'contextObligation', 'contextClass', 'validatorApplicable', 'referenceApplicable']) ||
      !['valid', 'invalid'].includes(row.expectation?.type) || !['sensitive', 'non-sensitive', 'unresolved'].includes(row.expectation?.sensitivity) ||
      !['required', 'optional', 'forbidden'].includes(row.expectation?.contextObligation) || !['sensitive', 'neutral', 'non-sensitive'].includes(row.expectation?.contextClass) ||
      typeof row.expectation?.validatorApplicable !== 'boolean' || typeof row.expectation?.referenceApplicable !== 'boolean' || !row.authority ||
      !exact(row.authority, ['kind', 'locator', 'version', 'claim', 'observedAt']) || !authorityKinds.includes(row.authority.kind) || !locator(row.authority.locator) ||
      typeof row.authority.version !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(row.authority.version) || !claims.includes(row.authority.claim) || !date(row.authority.observedAt) ||
      !row.outcome || !exact(row.outcome, ['scanner', 'variant', 'typeIdentity', 'sensitivityContext', 'range', 'observed']) || row.outcome.variant !== row.variant || row.outcome.scanner !== row.scanner ||
      !exact(row.outcome.typeIdentity, ['axis', 'status', 'state', 'reason']) || row.outcome.typeIdentity.axis !== 'type-identity' ||
      !['pass', 'fail', 'review-required', 'not-measured'].includes(row.outcome.typeIdentity.status) || !typeStates.includes(row.outcome.typeIdentity.state) ||
      !exact(row.outcome.sensitivityContext, ['axis', 'status', 'state', 'reason']) || row.outcome.sensitivityContext.axis !== 'sensitivity-context' ||
      !['pass', 'fail', 'review-required', 'not-measured'].includes(row.outcome.sensitivityContext.status) || !sensitivityStates.includes(row.outcome.sensitivityContext.state) ||
      !['exact', 'overbroad', 'partial', 'miss', 'not-applicable'].includes(row.outcome.range) || !exact(row.outcome.observed, ['findingCount', 'families', 'jurisdictions']) ||
      !Number.isInteger(row.outcome.observed.findingCount) || row.outcome.observed.findingCount < 0 || !Array.isArray(row.outcome.observed.families) ||
      !Array.isArray(row.outcome.observed.jurisdictions) || [...row.outcome.observed.families, ...row.outcome.observed.jurisdictions].some(value => !slug(value)))
    throw new Error('Invalid PII accounting row');
  if (!row.scope || !exact(row.scope, row.scope.kind === 'global' ? ['kind'] : ['kind', 'jurisdiction']) ||
      (row.scope.kind !== 'global' && (row.scope.kind !== 'jurisdictional' || !slug(row.scope.jurisdiction)))) throw new Error('Invalid PII accounting row');
  const typeStatus = row.outcome.typeIdentity.state === 'not-measured' ? 'not-measured' : ['correct', 'invalid-correct'].includes(row.outcome.typeIdentity.state) ? 'pass' : 'fail';
  const sensitivityStatus = row.outcome.sensitivityContext.state === 'not-measured' ? 'not-measured' : row.outcome.sensitivityContext.state === 'unresolved'
    ? 'review-required' : row.outcome.sensitivityContext.state === 'correct' ? 'pass' : 'fail';
  const validTypeStates = row.expectation.type === 'valid' ? ['correct', 'miss', 'wrong-family', 'wrong-jurisdiction', 'not-measured'] : ['invalid-correct', 'invalid-accepted', 'not-measured'];
  const validSensitivityStates = row.expectation.sensitivity === 'unresolved' ? ['unresolved', 'not-measured'] : row.expectation.sensitivity === 'sensitive'
    ? ['correct', 'miss', 'not-measured'] : ['correct', 'false-positive', 'not-measured'];
  if (row.outcome.typeIdentity.status !== typeStatus || row.outcome.sensitivityContext.status !== sensitivityStatus || !validTypeStates.includes(row.outcome.typeIdentity.state) ||
      !validSensitivityStates.includes(row.outcome.sensitivityContext.state)) throw new Error('PII accounting outcome contradicts its authored expectation');
  const states = [row.methodEvidence.validatorState, row.methodEvidence.referenceState];
  const collision = row.methodEvidence.collision;
  if (!exact(row.methodEvidence, ['controlClass', 'validatorState', 'collision', 'referenceState']) ||
      states.some(state => state !== null && !['valid', 'invalid', 'unavailable'].includes(state)) || ![null, ...PII_CONTROL_CLASSES].includes(row.methodEvidence.controlClass) ||
      (collision !== null && (!exact(collision, ['targetFamily', 'competingFamilies']) || collision.targetFamily !== row.family ||
        !Array.isArray(collision.competingFamilies) || !collision.competingFamilies.length || new Set(collision.competingFamilies).size !== collision.competingFamilies.length ||
        collision.competingFamilies.some(family => !slug(family) || family === collision.targetFamily))) ||
      (row.method === 'jurisdiction-collision') !== (collision !== null) ||
      (row.method === 'pii-benign' && (row.strategy !== 'authored' || row.methodEvidence.controlClass === null)))
    throw new Error('Invalid PII accounting row');
  return row;
}

function metricBuckets(buckets: Bucket[], direction: 'upper' | 'lower', population: string, numerator: string, denominator: string, profile: PiiQualificationProfile): PiiMetric {
  const counts = { eligible: buckets.filter(value => value !== 'notApplicable').length, measured: buckets.filter(value => value === 'numerator' || value === 'other').length,
    numerator: buckets.filter(value => value === 'numerator').length, unresolved: buckets.filter(value => value === 'unresolved').length,
    notMeasured: buckets.filter(value => value === 'notMeasured').length, notApplicable: buckets.filter(value => value === 'notApplicable').length, total: buckets.length };
  const status = counts.eligible === 0 ? 'not-applicable' : counts.measured === 0 ? (counts.unresolved ? 'unresolved' : 'not-measured')
    : counts.unresolved || counts.notMeasured ? 'partial' : 'measured';
  return { population, numerator, denominator, direction, status, counts, rate: proportion(counts.numerator, counts.measured, direction, profile.mechanics) };
}
function metric(rows: PiiAccountingRow[], profile: PiiQualificationProfile, id: PiiMetricId, population: string, numerator: string,
  denominator: string, classify: (row: PiiAccountingRow) => Bucket) {
  return metricBuckets(rows.map(classify), profile.metrics[id].direction, population, numerator, denominator, profile);
}
const axisBucket = (status: string, event: boolean): Bucket => status === 'review-required' ? 'unresolved' : status === 'not-measured' ? 'notMeasured' : event ? 'numerator' : 'other';

function assertSingleSource(rows: PiiAccountingRow[]) {
  if (!rows.length) return;
  const { scanner: _scanner, ...firstRun } = rows[0].source;
  for (const row of rows) { const { scanner: _candidate, ...run } = row.source; if (canonical(run) !== canonical(firstRun)) throw new Error('Mixed PII accounting source envelope'); }
  const keys = rows.map(row => `${row.source.runId}/${row.scanner}/${row.caseId}/${row.variant}`);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate PII accounting sample');
  const scanners = new Map<string, string>();
  for (const row of rows) { const encoded = canonical(row.source.scanner), prior = scanners.get(row.scanner); if (prior !== undefined && prior !== encoded) throw new Error('Mixed PII scanner identity'); scanners.set(row.scanner, encoded); }
  if (scanners.size > 1) throw new Error('Mixed PII scanner population');
}
function contextGroups(rows: PiiAccountingRow[]) {
  const groups = new Map<string, PiiAccountingRow[]>();
  for (const row of rows.filter(candidate => candidate.method === 'context-discrimination')) {
    const key = `${row.source.runId}/${row.scanner}/${row.caseId}`; groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) if (group.length !== 3 || canonical(group.map(row => row.expectation.contextClass).sort()) !== canonical(['neutral', 'non-sensitive', 'sensitive']))
    throw new Error('Incomplete PII context discrimination group');
  return [...groups.values()];
}

function buildAccounting(input: PiiAccountingRow[], profile: PiiQualificationProfile): PiiAccountingReport {
  const rows = input.map(row => validateRow(structuredClone(row))).map(row => {
    row.outcome.typeIdentity.reason = `${row.outcome.typeIdentity.axis}:${row.outcome.typeIdentity.status}:${row.outcome.typeIdentity.state}`;
    row.outcome.sensitivityContext.reason = `${row.outcome.sensitivityContext.axis}:${row.outcome.sensitivityContext.status}:${row.outcome.sensitivityContext.state}`;
    return row;
  }).sort((a, b) =>
    `${a.scanner}/${a.caseId}/${a.method}/${a.variant}`.localeCompare(`${b.scanner}/${b.caseId}/${b.method}/${b.variant}`));
  assertSingleSource(rows); const contexts = contextGroups(rows);
  const contextBuckets: Bucket[] = contexts.map(group => { const endpoints = group.filter(row => row.expectation.contextClass !== 'neutral');
    if (endpoints.some(row => row.outcome.sensitivityContext.status === 'review-required')) return 'unresolved';
    if (endpoints.some(row => row.outcome.sensitivityContext.status === 'not-measured')) return 'notMeasured';
    return endpoints.every(row => row.outcome.sensitivityContext.status === 'pass') ? 'numerator' : 'other'; });
  const metrics = {
    'type-miss-rate': metric(rows, profile, 'type-miss-rate', 'scanner-source × authored valid-type occurrence', 'type state is miss', 'resolved type assertions for authored valid types',
      row => row.expectation.type !== 'valid' ? 'notApplicable' : axisBucket(row.outcome.typeIdentity.status, row.outcome.typeIdentity.state === 'miss')),
    'wrong-family-rate': metric(rows, profile, 'wrong-family-rate', 'scanner-source × authored valid-type occurrence', 'type state is wrong-family', 'resolved type assertions for authored valid types',
      row => row.expectation.type !== 'valid' ? 'notApplicable' : axisBucket(row.outcome.typeIdentity.status, row.outcome.typeIdentity.state === 'wrong-family')),
    'wrong-jurisdiction-rate': metric(rows, profile, 'wrong-jurisdiction-rate', 'scanner-source × authored jurisdictional valid-type occurrence', 'type state is wrong-jurisdiction',
      'resolved jurisdictional type assertions', row => row.expectation.type !== 'valid' || row.scope.kind !== 'jurisdictional' ? 'notApplicable' :
        axisBucket(row.outcome.typeIdentity.status, row.outcome.typeIdentity.state === 'wrong-jurisdiction')),
    'sensitive-miss-rate': metric(rows, profile, 'sensitive-miss-rate', 'scanner-source × authored sensitive occurrence', 'sensitivity state is miss', 'resolved sensitivity assertions for authored sensitive occurrences',
      row => row.expectation.sensitivity !== 'sensitive' ? 'notApplicable' : axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.state === 'miss')),
    'non-sensitive-flag-rate': metric(rows, profile, 'non-sensitive-flag-rate', 'scanner-source × authored non-sensitive occurrence', 'sensitivity state is false-positive', 'resolved sensitivity assertions for authored non-sensitive occurrences',
      row => row.expectation.sensitivity !== 'non-sensitive' ? 'notApplicable' : axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.state === 'false-positive')),
    'context-discrimination-rate': metricBuckets(contextBuckets, profile.metrics['context-discrimination-rate'].direction, 'complete scanner-source × authored context trios',
      'both sensitive and non-sensitive endpoints pass', 'resolved complete context trios', profile),
    'benign-suppression-rate': metric(rows, profile, 'benign-suppression-rate', 'scanner-source × distinct authored benign case', 'non-sensitive assertion passes', 'resolved authored benign cases',
      row => row.method !== 'pii-benign' ? 'notApplicable' : axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.status === 'pass')),
    'jurisdiction-collision-rate': metric(rows, profile, 'jurisdiction-collision-rate', 'scanner-source × authored jurisdiction collision case', 'target family and jurisdiction assertion passes',
      'resolved collision type assertions', row => row.method !== 'jurisdiction-collision' ? 'notApplicable' : axisBucket(row.outcome.typeIdentity.status, row.outcome.typeIdentity.status === 'pass')),
    'range-collateral-rate': metric(rows, profile, 'range-collateral-rate', 'scanner-source × reported span for authored valid type', 'range is overbroad or partial',
      'exact, overbroad, or partial reported spans', row => row.expectation.type !== 'valid' || row.outcome.range === 'miss' ? 'notApplicable' :
        row.outcome.range === 'not-applicable' ? 'notMeasured' : ['overbroad', 'partial'].includes(row.outcome.range) ? 'numerator' : 'other'),
    'measurable-share': (() => { const statuses = rows.flatMap(row => [row.outcome.typeIdentity.status,
      row.expectation.sensitivity === 'unresolved' ? 'not-applicable' : row.outcome.sensitivityContext.status]);
      return metricBuckets(statuses.map(status => status === 'not-applicable' ? 'notApplicable' : status === 'review-required' ? 'unresolved' :
        status === 'not-measured' ? 'notMeasured' : 'numerator') as Bucket[],
        'lower', 'all scanner-source × authored axis assertions', 'resolved pass or fail assertions', 'all authored axis assertions', profile); })(),
  } satisfies Record<PiiMetricId, PiiMetric>;
  const benignByControlClass = Object.fromEntries(PII_CONTROL_CLASSES.map(controlClass => [controlClass,
    metric(rows, profile, 'benign-suppression-rate', `scanner-source × distinct authored ${controlClass} benign case`, 'non-sensitive assertion passes',
      `resolved authored ${controlClass} benign cases`, row => row.method !== 'pii-benign' || row.methodEvidence.controlClass !== controlClass ? 'notApplicable' :
        axisBucket(row.outcome.sensitivityContext.status, row.outcome.sensitivityContext.status === 'pass'))])) as Record<PiiControlClass, PiiMetric>;
  const occurrences = unique(rows, row => `${row.caseId}/${row.variant}`), benign = occurrences.filter(row => row.method === 'pii-benign');
  if (new Set(benign.map(row => row.caseId)).size !== benign.length) throw new Error('PII benign controls must be distinct authored cases');
  const requiredClaim = (row: PiiAccountingRow): PiiAuthority['claim'] => row.method === 'context-discrimination' || row.expectation.contextObligation === 'required'
    ? 'context' : row.scope.kind === 'jurisdictional' ? 'allocation' : 'format';
  const contextObligations = new Set(occurrences.filter(row => row.expectation.contextObligation === 'required').map(row => `${row.family}/${row.expectation.contextObligation}`));
  const contextEvaluated = new Set(contexts.map(group => `${group[0].family}/${group[0].expectation.contextObligation}`));
  const jurisdictionGroups = new Set(occurrences.filter(row => row.scope.kind === 'jurisdictional').map(row => `${row.family}/${row.scope.kind === 'jurisdictional' ? row.scope.jurisdiction : ''}`));
  const jurisdictionEvaluated = new Set(occurrences.filter(row => row.methodEvidence.collision !== null).map(row => `${row.family}/${row.scope.kind === 'jurisdictional' ? row.scope.jurisdiction : ''}`));
  const evidence = { methods: [...new Set(rows.map(row => row.method))].sort(), authority: { total: occurrences.length,
    qualified: occurrences.filter(row => row.authority.claim === requiredClaim(row)).length, sources: unique(occurrences, row => canonical(row.authority)).length },
    validators: { applicable: occurrences.filter(row => row.expectation.validatorApplicable).length, evaluated: occurrences.filter(row => row.expectation.validatorApplicable && row.methodEvidence.validatorState !== null && row.methodEvidence.validatorState !== 'unavailable').length },
    benign: { cases: new Set(benign.map(row => row.caseId)).size, axes: [...new Set(benign.map(row => row.methodEvidence.controlClass).filter((value): value is PiiControlClass => value !== null))].sort() },
    semanticControls: benign.length, context: { applicable: contextObligations.size, evaluated: [...contextObligations].filter(group => contextEvaluated.has(group)).length },
    jurisdiction: { applicable: jurisdictionGroups.size, evaluated: [...jurisdictionGroups].filter(group => jurisdictionEvaluated.has(group)).length },
    reference: { applicable: occurrences.filter(row => row.expectation.referenceApplicable).length,
      evaluated: occurrences.filter(row => row.expectation.referenceApplicable && row.methodEvidence.referenceState !== null && row.methodEvidence.referenceState !== 'unavailable').length,
      unavailable: occurrences.filter(row => row.expectation.referenceApplicable && row.methodEvidence.referenceState === 'unavailable').length } };
  return { schemaVersion: 1, reportType: 'pii-accounting', ...PII_ACCOUNTING_IDENTITY, profile: { id: profile.id, version: profile.version }, rowCount: rows.length,
    sources: unique(rows.map(row => row.source), source => `${source.runId}/${source.scanner.id}`).sort((a, b) => a.scanner.id.localeCompare(b.scanner.id)),
    rows, metrics, benignByControlClass, evidence };
}

export function accountPiiRows(input: PiiAccountingRow[], profile: PiiQualificationProfile = piiV1Profile): PiiAccountingReport {
  validatePiiQualificationProfile(profile); return validatePiiAccountingReport(buildAccounting(input, profile));
}
export function validatePiiAccountingReport(value: unknown): PiiAccountingReport {
  if (!validateSchema(value)) throw new Error('Invalid PII accounting report schema');
  const report = value as unknown as PiiAccountingReport; assertPiiAccountingIdentities([report]);
  if (canonical(report) !== canonical(buildAccounting(report.rows, piiV1Profile)) || Object.hasOwn(report, 'overallScore')) throw new Error('Inconsistent PII accounting report');
  return report;
}

export function piiAccountingRowsFromEvaluation(artifact: unknown): PiiAccountingRow[] {
  const value = artifact as any;
  if (!value || value.schemaVersion !== 1 || value.domain !== piiIdentity.domain || value.reportProfile?.id !== piiIdentity.reportProfile.id ||
      value.reportProfile?.version !== piiIdentity.reportProfile.version || value.evaluationProfile !== piiIdentity.evaluationProfile ||
      value.domainAccountingVersion !== piiIdentity.domainAccountingVersion || !/^\d+\.\d+\.\d+$/.test(value.engineVersion) || !/^[a-f0-9-]{36}$/.test(value.runId) ||
      !dateTime(value.startedAt) || !dateTime(value.finishedAt) || !Array.isArray(value.scanners) || !Array.isArray(value.results) ||
      !Number.isInteger(value.caseCount) || value.caseCount !== value.results.length || !Number.isInteger(value.variantCount) ||
      value.variantCount !== value.results.reduce((sum: number, result: any) => sum + (Array.isArray(result?.variants) ? result.variants.length : 0), 0) ||
      !Array.isArray(value.generationErrors) || value.generationErrors.length > 0 || new Set(value.results.map((result: any) => result?.id)).size !== value.results.length)
    throw new Error('Invalid PII evaluation artifact for accounting');
  const provenance = { sourceRevision: value.provenance?.sourceRevision ?? null, candidateArtifactHash: value.provenance?.candidateArtifactHash ?? null, planHash: value.provenance?.planHash ?? null };
  if (![provenance.sourceRevision, provenance.candidateArtifactHash, provenance.planHash].every(item => item === null || digest(item))) throw new Error('Invalid PII evaluation provenance for accounting');
  const sources = new Map<string, PiiAccountingSource>();
  for (const raw of value.scanners) {
    const source: PiiAccountingSource = { schemaVersion: 1, engineVersion: value.engineVersion, domain: 'pii', reportProfile: { id: 'pii-evaluation', version: 1 },
      evaluationProfile: 'pii-schema-v1', domainAccountingVersion: 'pii-observation-v1', runId: value.runId, startedAt: value.startedAt, finishedAt: value.finishedAt,
      provenance, scanner: { id: raw?.id, version: raw?.version ?? null, mode: raw?.mode, configurationHash: raw?.configurationHash, status: raw?.status } };
    validateSource(source); if (sources.has(source.scanner.id)) throw new Error('Duplicate PII scanner envelope'); sources.set(source.scanner.id, source);
  }
  const rows = value.results.flatMap((raw: any) => {
    if (!raw || !Array.isArray(raw.variants) || !Array.isArray(raw.outcomes)) throw new Error('Invalid PII evaluation artifact for accounting');
    const expected = raw.variants.flatMap((variant: any) => [...sources.keys()].map(scanner => `${scanner}/${variant.id}`));
    const actual = raw.outcomes.map((outcome: any) => `${outcome?.scanner}/${outcome?.variant}`);
    if (actual.length !== expected.length || new Set(actual).size !== actual.length || expected.some((key: string) => !actual.includes(key)))
      throw new Error('Incomplete PII scanner × variant outcome matrix');
    return raw.outcomes.map((outcome: PiiOutcome) => {
      const matches = raw.variants.filter((candidate: any) => candidate.id === outcome.variant), source = sources.get(outcome.scanner);
      if (matches.length !== 1 || !matches[0]?.expectation || !source) throw new Error('Missing PII accounting expectation or scanner');
      const variant = matches[0], evidence = raw.evidence ?? {};
      return validateRow({ source, caseId: raw.id, method: raw.method, family: raw.family, scope: raw.scope, variant: outcome.variant,
        strategy: variant.strategy, scanner: outcome.scanner, qualificationProfile: raw.qualificationProfile, authority: raw.authority, expectation: variant.expectation,
        methodEvidence: { controlClass: evidence.control?.controlClass ?? null, validatorState: evidence.validation?.state ?? null,
          collision: evidence.collision?.kind === 'jurisdiction-collision' ? { targetFamily: evidence.collision.targetFamily,
            competingFamilies: evidence.collision.competingFamilies } : null, referenceState: evidence.reference?.reference?.state ?? null }, outcome });
    });
  });
  assertSingleSource(rows); contextGroups(rows); return rows;
}
