import Ajv from 'ajv';
import reportSchema from '../../../../schemas/pii-accounting-report-v1.json';
import { assertCompatibleIdentities, proportion, type AccountingArtifactIdentity, type MechanicalPublished } from '../../../accounting/shared/primitives.ts';
import { piiIdentity } from './identity.ts';
import { piiContextEvidence } from './context-evidence.ts';
import { hash } from '../../substrate/hash.ts';
import { isPiiJurisdiction } from './jurisdictions.ts';
import { validatePiiOutcome } from './outcome-validation.ts';
import type { PiiAuthority, PiiOutcome, PiiScope, PiiSensitivityExpectation } from './types.ts';
import { validatePiiAuthority } from './contract-model.ts';
import { PII_METRIC_IDS, PII_METRIC_LABELS, piiV1Profile, validatePiiQualificationProfile, type PiiMetricId, type PiiQualificationProfile } from './profile.ts';
import { PII_BENIGN_ACCOUNTING_CLASSES, PII_BENIGN_COLLISION_EVIDENCE_CLASSES, PII_EVIDENCE_ACCOUNTING_CLASSES,
  type PiiBenignCollisionEvidenceClass } from './benign-collision-classes.ts';

export const PII_ACCOUNTING_IDENTITY = Object.freeze({ domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1' });
export const PII_CONTROL_CLASSES = PII_BENIGN_ACCOUNTING_CLASSES;
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
  const family = (value: unknown) => typeof value === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  if (!row || !exact(row, ['source', 'caseId', 'method', 'family', 'scope', 'variant', 'strategy', 'scanner', 'qualificationProfile', 'authority', 'expectation', 'methodEvidence', 'outcome']) ||
      !validateSource(row.source) || !slug(row.caseId) || !slug(row.method) || !family(row.family) || !slug(row.variant) || !['authored', 'derived', 'review-required'].includes(row.strategy) ||
      !/^[a-z][a-z0-9.-]+$/.test(row.scanner) || row.scanner !== row.source.scanner.id || row.qualificationProfile?.id !== 'pii-v1' || row.qualificationProfile.version !== 1 ||
      !exact(row.qualificationProfile, ['id', 'version']) || !exact(row.expectation, ['type', 'sensitivity', 'contextObligation', 'contextClass', 'language', 'validatorApplicable', 'referenceApplicable']) ||
      !['valid', 'invalid'].includes(row.expectation?.type) || !['sensitive', 'non-sensitive', 'not-established'].includes(row.expectation?.sensitivity) ||
      !['none', 'reinforcing', 'required-for-sensitive-classification'].includes(row.expectation?.contextObligation) || !['sensitive', 'neutral', 'non-sensitive'].includes(row.expectation?.contextClass) ||
      !/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/.test(row.expectation?.language) ||
      typeof row.expectation?.validatorApplicable !== 'boolean' || typeof row.expectation?.referenceApplicable !== 'boolean' || !Array.isArray(row.authority) || row.authority.length === 0)
    throw new Error('Invalid PII accounting row');
  for (const authority of row.authority) validatePiiAuthority(authority);
  const jurisdiction = row.scope === 'global' ? null : /^jurisdiction:([A-Z]{2})$/.exec(row.scope)?.[1] ?? null;
  const familyScope = row.family.split(':')[1];
  if ((row.scope === 'global' && familyScope !== 'global') || (row.scope !== 'global' &&
      (!jurisdiction || !isPiiJurisdiction(jurisdiction) || familyScope !== jurisdiction.toLowerCase()))) throw new Error('Invalid PII accounting row');
  validatePiiOutcome(row.outcome, { scanner: row.scanner, scannerStatus: row.source.scanner.status, variant: row.variant,
    expectation: { type: row.expectation.type, sensitivity: row.expectation.sensitivity } });
  const states = [row.methodEvidence.validatorState, row.methodEvidence.referenceState];
  const collision = row.methodEvidence.collision;
  if (!exact(row.methodEvidence, ['evidenceClass', 'controlClass', 'validatorEvidence', 'validatorState', 'collision', 'referenceState']) ||
      states.some(state => state !== null && !['valid', 'invalid', 'unavailable'].includes(state)) || ![null, ...PII_CONTROL_CLASSES].includes(row.methodEvidence.controlClass) ||
      ![null, ...PII_BENIGN_COLLISION_EVIDENCE_CLASSES].includes(row.methodEvidence.evidenceClass) ||
      !Array.isArray(row.methodEvidence.validatorEvidence) || new Set(row.methodEvidence.validatorEvidence.map(item => `${item.family}/${item.id}@${item.version}`)).size !== row.methodEvidence.validatorEvidence.length ||
      row.methodEvidence.validatorEvidence.some(item => !exact(item, ['family', 'id', 'version', 'expected', 'observed']) || !family(item.family) || !slug(item.id) ||
        !Number.isInteger(item.version) || item.version < 1 || !['valid', 'invalid', 'unavailable'].includes(item.expected) || !['valid', 'invalid', 'unavailable'].includes(item.observed)) ||
      (collision !== null && (!exact(collision, ['targetFamily', 'competingFamilies']) || collision.targetFamily !== row.family ||
        !Array.isArray(collision.competingFamilies) || !collision.competingFamilies.length || new Set(collision.competingFamilies).size !== collision.competingFamilies.length ||
        collision.competingFamilies.some(candidate => !family(candidate) || candidate === collision.targetFamily))) ||
      (row.method === 'jurisdiction-collision') !== (collision !== null) ||
      (row.method === 'pii-benign' && (row.strategy !== 'authored' || row.methodEvidence.controlClass === null)) ||
      (row.methodEvidence.evidenceClass !== null && (row.methodEvidence.controlClass === null ?
        PII_EVIDENCE_ACCOUNTING_CLASSES[row.methodEvidence.evidenceClass].length !== 0 :
        !(PII_EVIDENCE_ACCOUNTING_CLASSES[row.methodEvidence.evidenceClass] as readonly PiiControlClass[]).includes(row.methodEvidence.controlClass))) ||
      (row.methodEvidence.evidenceClass !== null && row.expectation.validatorApplicable && row.methodEvidence.validatorEvidence.length === 0))
    throw new Error('Invalid PII accounting row');
  return row;
}

function metricBuckets(buckets: Bucket[], direction: 'upper' | 'lower', population: string, numerator: string, denominator: string,
  profile: PiiQualificationProfile, denominatorKind: 'measured' | 'eligible' = 'measured'): PiiMetric {
  const counts = { eligible: buckets.filter(value => value !== 'notApplicable').length, measured: buckets.filter(value => value === 'numerator' || value === 'other').length,
    numerator: buckets.filter(value => value === 'numerator').length, unresolved: buckets.filter(value => value === 'unresolved').length,
    notMeasured: buckets.filter(value => value === 'notMeasured').length, notApplicable: buckets.filter(value => value === 'notApplicable').length, total: buckets.length };
  const status = counts.eligible === 0 ? 'not-applicable' : counts.measured === 0 ? (counts.unresolved ? 'unresolved' : 'not-measured')
    : counts.unresolved || counts.notMeasured ? 'partial' : 'measured';
  const effectiveN = denominatorKind === 'eligible' ? counts.eligible : counts.measured;
  return { population, numerator, denominator, direction, status, counts, effectiveN,
    rate: proportion(counts.numerator, effectiveN, direction, profile.mechanics) };
}
const metricLabels = PII_METRIC_LABELS;

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
  for (const group of groups.values()) {
    const expected = piiContextEvidence.groups.find(candidate => candidate.id === group[0].caseId);
    const actualIds = group.map(row => row.variant).sort(), expectedIds = expected?.frames.map(frame => frame.id).sort();
    if (!expected || canonical(actualIds) !== canonical(expectedIds) || new Set(actualIds).size !== actualIds.length ||
        group.some(row => { const frame = expected.frames.find(candidate => candidate.id === row.variant); return !frame ||
          row.expectation.language !== expected.language || row.expectation.contextClass !== frame.contextClass || row.expectation.sensitivity !== frame.sensitivity; }))
      throw new Error('Incomplete or mismatched PII context evidence roster');
  }
  return [...groups.values()];
}

function buildAccounting(input: PiiAccountingRow[], profile: PiiQualificationProfile): PiiAccountingReport {
  const rows = input.map(row => validateRow(structuredClone(row))).map(row => {
    row.outcome.typeIdentity.reason = `${row.outcome.typeIdentity.axis}:${row.outcome.typeIdentity.status}:${row.outcome.typeIdentity.state}`;
    row.outcome.sensitivityContext.reason = `${row.outcome.sensitivityContext.axis}:${row.outcome.sensitivityContext.status}:${row.outcome.sensitivityContext.state}`;
    return row;
  }).sort((a, b) =>
    `${a.scanner}/${a.caseId}/${a.method}/${a.variant}`.localeCompare(`${b.scanner}/${b.caseId}/${b.method}/${b.variant}`));
  assertSingleSource(rows); const contexts = contextGroups(rows), groups = unique(rows, row => `${row.source.runId}/${row.scanner}/${row.caseId}/${row.method}`)
    .map(representative => rows.filter(row => row.source.runId === representative.source.runId && row.scanner === representative.scanner &&
      row.caseId === representative.caseId && row.method === representative.method));
  const groupBucket = (group: PiiAccountingRow[], axis: 'typeIdentity' | 'sensitivityContext', event: (row: PiiAccountingRow) => boolean): Bucket =>
    group.some(row => row.outcome[axis].status === 'review-required') ? 'unresolved' : group.some(row => row.outcome[axis].status === 'not-measured')
      ? 'notMeasured' : group.some(event) ? 'numerator' : 'other';
  const contextBuckets: Bucket[] = contexts.map(group => { const endpoints = group.filter(row => row.expectation.contextClass !== 'neutral');
    if (endpoints.some(row => row.outcome.sensitivityContext.status === 'review-required')) return 'unresolved';
    if (endpoints.some(row => row.outcome.sensitivityContext.status === 'not-measured')) return 'notMeasured';
    return endpoints.every(row => row.outcome.sensitivityContext.status === 'pass') ? 'numerator' : 'other'; });
  const metrics = {
    'type-miss-rate': metricBuckets(groups.map(group => group[0].expectation.type !== 'valid' ? 'notApplicable' : groupBucket(group, 'typeIdentity', row => row.outcome.typeIdentity.state === 'miss')), profile.metrics['type-miss-rate'].direction, 'scanner-source × authored valid-type occurrence', 'type state is miss', 'resolved type assertions for authored valid types', profile),
    'wrong-family-rate': metricBuckets(groups.map(group => group[0].expectation.type !== 'valid' ? 'notApplicable' : groupBucket(group, 'typeIdentity', row => row.outcome.typeIdentity.state === 'wrong-family')), profile.metrics['wrong-family-rate'].direction, 'scanner-source × authored valid-type occurrence', 'type state is wrong-family', 'resolved type assertions for authored valid types', profile),
    'wrong-jurisdiction-rate': metricBuckets(groups.map(group => group[0].expectation.type !== 'valid' || !group[0].scope.startsWith('jurisdiction:') ? 'notApplicable' : groupBucket(group, 'typeIdentity', row => row.outcome.typeIdentity.state === 'wrong-jurisdiction')), profile.metrics['wrong-jurisdiction-rate'].direction, 'scanner-source × authored jurisdictional valid-type occurrence', 'type state is wrong-jurisdiction', 'resolved jurisdictional type assertions', profile),
    'sensitive-miss-rate': metricBuckets(groups.map(group => { const eligible = group.filter(row => row.expectation.sensitivity === 'sensitive'); return eligible.length ? groupBucket(eligible, 'sensitivityContext', row => row.outcome.sensitivityContext.state === 'miss') : 'notApplicable'; }), profile.metrics['sensitive-miss-rate'].direction, 'scanner-source × authored sensitive occurrence', 'sensitivity state is miss', 'resolved sensitivity assertions for authored sensitive occurrences', profile),
    'non-sensitive-flag-rate': metricBuckets(groups.map(group => { const eligible = group.filter(row => row.expectation.sensitivity === 'non-sensitive'); return eligible.length ? groupBucket(eligible, 'sensitivityContext', row => row.outcome.sensitivityContext.state === 'false-positive') : 'notApplicable'; }), profile.metrics['non-sensitive-flag-rate'].direction, 'scanner-source × authored non-sensitive occurrence', 'sensitivity state is false-positive', 'resolved sensitivity assertions for authored non-sensitive occurrences', profile),
    'context-discrimination-rate': metricBuckets(contextBuckets, profile.metrics['context-discrimination-rate'].direction, 'complete scanner-source × authored context trios',
      'both sensitive and non-sensitive endpoints pass', 'resolved complete context trios', profile),
    'benign-suppression-rate': metricBuckets(groups.map(group => group[0].method !== 'pii-benign' ? 'notApplicable' :
      groupBucket(group, 'sensitivityContext', row => row.outcome.sensitivityContext.status === 'pass')), profile.metrics['benign-suppression-rate'].direction,
      'scanner-source × distinct authored benign case', 'non-sensitive assertion passes', 'resolved authored benign cases', profile),
    'jurisdiction-collision-rate': metricBuckets(groups.map(group => group[0].method !== 'jurisdiction-collision' ? 'notApplicable' :
      groupBucket(group, 'typeIdentity', row => row.outcome.typeIdentity.status === 'pass')), profile.metrics['jurisdiction-collision-rate'].direction,
      'scanner-source × authored jurisdiction collision case', 'target family and jurisdiction assertion passes', 'resolved collision type assertions', profile),
    'range-collateral-rate': metricBuckets(groups.map(group => group[0].expectation.type !== 'valid' || group.every(row => row.outcome.range === 'miss')
      ? 'notApplicable' : group.some(row => row.outcome.range === 'not-applicable') ? 'notMeasured' :
        group.some(row => ['overbroad', 'partial'].includes(row.outcome.range)) ? 'numerator' : 'other'), profile.metrics['range-collateral-rate'].direction,
      'scanner-source × reported span for authored valid type', 'range is overbroad or partial', 'exact, overbroad, or partial reported spans', profile),
    'measurable-share': (() => { const buckets = groups.flatMap(group => [
      groupBucket(group, 'typeIdentity', () => true), group.some(row => row.expectation.sensitivity === 'not-established') ? 'unresolved' :
        groupBucket(group, 'sensitivityContext', () => true)]) as Bucket[];
      return metricBuckets(buckets, 'lower', 'all scanner-source × authored axis assertions', 'resolved pass or fail assertions',
        'all eligible authored axes including unresolved axes', profile, 'eligible'); })(),
  } satisfies Record<PiiMetricId, PiiMetric>;
  const benignByControlClass = Object.fromEntries(PII_CONTROL_CLASSES.map(controlClass => [controlClass,
    metricBuckets(groups.map(group => group[0].method !== 'pii-benign' || group[0].methodEvidence.controlClass !== controlClass ? 'notApplicable' :
      groupBucket(group, 'sensitivityContext', row => row.outcome.sensitivityContext.status === 'pass')), profile.metrics['benign-suppression-rate'].direction,
    `scanner-source × distinct authored ${controlClass} benign case`, 'non-sensitive assertion passes', `resolved authored ${controlClass} benign cases`, profile)])) as Record<PiiControlClass, PiiMetric>;
  const evidenceByClass = Object.fromEntries(PII_BENIGN_COLLISION_EVIDENCE_CLASSES.map(evidenceClass => [evidenceClass, {
    cases: groups.filter(group => group[0].methodEvidence.evidenceClass === evidenceClass).length,
    accountingClasses: [...PII_EVIDENCE_ACCOUNTING_CLASSES[evidenceClass]],
  }])) as PiiAccountingReport['evidenceByClass'];
  const contextRows = rows.filter(row => row.method === 'context-discrimination');
  const statuses = ['pass', 'fail', 'review-required', 'not-measured'] as const;
  const contextByLanguage = Object.fromEntries([...new Set(contextRows.map(row => row.expectation.language))].sort().map(language => [language,
    Object.fromEntries((['sensitive', 'neutral', 'non-sensitive'] as const).map(contextClass => [contextClass,
      Object.fromEntries(statuses.map(status => [status, contextRows.filter(row => row.expectation.language === language &&
        row.expectation.contextClass === contextClass && row.outcome.sensitivityContext.status === status).length]))]))])) as PiiContextLanguageStrata;
  const contextRoster: PiiContextRoster = contexts.map(group => ({ groupId: group[0].caseId, language: group[0].expectation.language,
    frames: group.map(row => ({ id: row.variant, contextClass: row.expectation.contextClass, status: row.outcome.sensitivityContext.status }))
      .sort((a, b) => a.id.localeCompare(b.id)) })).sort((a, b) => a.groupId.localeCompare(b.groupId));
  const occurrences = unique(rows, row => `${row.caseId}/${row.variant}`), benign = occurrences.filter(row => row.method === 'pii-benign');
  if (new Set(benign.map(row => row.caseId)).size !== benign.length) throw new Error('PII benign controls must be distinct authored cases');
  const requiredSupport = (row: PiiAccountingRow): PiiAuthority['supports'][number] => row.expectation.sensitivity !== 'not-established' ||
    row.expectation.contextObligation === 'required-for-sensitive-classification' ? 'sensitivity' : row.scope.startsWith('jurisdiction:') ? 'allocation' : 'lexical';
  const contextObligations = new Set(occurrences.filter(row => row.expectation.contextObligation === 'required-for-sensitive-classification').map(row => `${row.family}/${row.expectation.contextObligation}`));
  const contextEvaluated = new Set(contexts.map(group => `${group[0].family}/${group[0].expectation.contextObligation}`));
  const jurisdictionGroups = new Set(occurrences.filter(row => row.scope.startsWith('jurisdiction:')).map(row => `${row.family}/${row.scope}`));
  const jurisdictionEvaluated = new Set(occurrences.filter(row => row.methodEvidence.collision !== null).map(row => `${row.family}/${row.scope}`));
  const evidence = { methods: [...new Set(rows.map(row => row.method))].sort(), authority: { total: occurrences.length,
    qualified: occurrences.filter(row => row.authority.some(authority => authority.supports.includes(requiredSupport(row)))).length,
    sources: new Set(occurrences.flatMap(row => row.authority.map(authority => authority.sourceId))).size },
    validators: { applicable: occurrences.filter(row => row.expectation.validatorApplicable).length, evaluated: occurrences.filter(row => row.expectation.validatorApplicable && row.methodEvidence.validatorState !== null && row.methodEvidence.validatorState !== 'unavailable').length },
    benign: { cases: new Set(benign.map(row => row.caseId)).size, axes: [...new Set(benign.map(row => row.methodEvidence.controlClass).filter((value): value is PiiControlClass => value !== null))].sort() },
    semanticControls: benign.length, context: { applicable: contextObligations.size, evaluated: [...contextObligations].filter(group => contextEvaluated.has(group)).length },
    jurisdiction: { applicable: jurisdictionGroups.size, evaluated: [...jurisdictionGroups].filter(group => jurisdictionEvaluated.has(group)).length },
    reference: { applicable: occurrences.filter(row => row.expectation.referenceApplicable).length,
      evaluated: occurrences.filter(row => row.expectation.referenceApplicable && row.methodEvidence.referenceState !== null && row.methodEvidence.referenceState !== 'unavailable').length,
      unavailable: occurrences.filter(row => row.expectation.referenceApplicable && row.methodEvidence.referenceState === 'unavailable').length } };
  return { schemaVersion: 1, reportType: 'pii-accounting', ...PII_ACCOUNTING_IDENTITY, profile: { id: profile.id, version: profile.version }, rowCount: rows.length,
    sourceCaseCount: groups.length, inputCommitment: hash(rows), commitmentTrust: 'unresolved',
    sources: unique(rows.map(row => row.source), source => `${source.runId}/${source.scanner.id}`).sort((a, b) => a.scanner.id.localeCompare(b.scanner.id)),
    metrics, benignByControlClass, evidenceByClass, contextByLanguage, contextRoster, evidence };
}

export function accountPiiRows(input: PiiAccountingRow[], profile: PiiQualificationProfile = piiV1Profile): PiiAccountingReport {
  validatePiiQualificationProfile(profile); return validatePiiAccountingReport(buildAccounting(input, profile));
}
export function validatePiiAccountingReport(value: unknown): PiiAccountingReport {
  if (!validateSchema(value)) throw new Error('Invalid PII accounting report schema');
  const report = value as unknown as PiiAccountingReport; assertPiiAccountingIdentities([report]);
  for (const id of PII_METRIC_IDS) { const metric = report.metrics[id], counts = metric.counts, effectiveN = id === 'measurable-share' ? counts.eligible : counts.measured;
    const expectedTotal = id === 'measurable-share' ? report.sourceCaseCount * 2 : report.sourceCaseCount;
    const expectedStatus = counts.eligible === 0 ? 'not-applicable' : counts.measured === 0 ? (counts.unresolved ? 'unresolved' : 'not-measured') :
      counts.unresolved || counts.notMeasured ? 'partial' : 'measured';
    if (counts.eligible + counts.notApplicable !== counts.total || counts.measured + counts.unresolved + counts.notMeasured !== counts.eligible ||
        counts.numerator > counts.measured || metric.effectiveN !== effectiveN || metric.direction !== piiV1Profile.metrics[id].direction ||
        metric.status !== expectedStatus || (id === 'context-discrimination-rate' ? counts.total > report.sourceCaseCount : counts.total !== expectedTotal) ||
        canonical([metric.population, metric.numerator, metric.denominator]) !== canonical(metricLabels[id]) ||
        JSON.stringify(metric.rate) !== JSON.stringify(proportion(counts.numerator, effectiveN, metric.direction, piiV1Profile.mechanics)))
      throw new Error('Inconsistent PII accounting metric'); }
  for (const controlClass of PII_CONTROL_CLASSES) { const metric = report.benignByControlClass[controlClass], counts = metric.counts;
    const expectedStatus = counts.eligible === 0 ? 'not-applicable' : counts.measured === 0 ? (counts.unresolved ? 'unresolved' : 'not-measured') :
      counts.unresolved || counts.notMeasured ? 'partial' : 'measured';
    if (canonical([metric.population, metric.numerator, metric.denominator]) !== canonical([
      `scanner-source × distinct authored ${controlClass} benign case`, 'non-sensitive assertion passes', `resolved authored ${controlClass} benign cases`]) ||
      counts.eligible + counts.notApplicable !== counts.total || counts.measured + counts.unresolved + counts.notMeasured !== counts.eligible ||
      counts.numerator > counts.measured || counts.total !== report.sourceCaseCount || metric.effectiveN !== counts.measured ||
      metric.direction !== piiV1Profile.metrics['benign-suppression-rate'].direction || metric.status !== expectedStatus ||
      JSON.stringify(metric.rate) !== JSON.stringify(proportion(counts.numerator, counts.measured, metric.direction, piiV1Profile.mechanics)))
      throw new Error('Inconsistent PII benign accounting metric'); }
  if (Object.keys(report.evidenceByClass).sort().join(',') !== [...PII_BENIGN_COLLISION_EVIDENCE_CLASSES].sort().join(',') ||
      PII_BENIGN_COLLISION_EVIDENCE_CLASSES.some(evidenceClass => {
        const stratum = report.evidenceByClass[evidenceClass];
        return !stratum || !Number.isInteger(stratum.cases) || stratum.cases < 0 || stratum.cases > report.sourceCaseCount ||
          canonical(stratum.accountingClasses) !== canonical(PII_EVIDENCE_ACCOUNTING_CLASSES[evidenceClass]);
      }) || Object.values(report.evidenceByClass).reduce((sum, row) => sum + row.cases, 0) > report.sourceCaseCount)
    throw new Error('Inconsistent PII evidence-class strata');
  const languageClasses = ['sensitive', 'neutral', 'non-sensitive'] as const, statuses = ['pass', 'fail', 'review-required', 'not-measured'] as const;
  const rosterGroups = new Set<string>();
  for (const group of report.contextRoster) {
    if (rosterGroups.has(group.groupId)) throw new Error('Inconsistent PII context roster');
    rosterGroups.add(group.groupId);
    const expected = piiContextEvidence.groups.find(candidate => candidate.id === group.groupId);
    if (!expected || group.language !== expected.language || canonical(group.frames.map(frame => frame.id).sort()) !== canonical(expected.frames.map(frame => frame.id).sort()) ||
        new Set(group.frames.map(frame => frame.id)).size !== group.frames.length || group.frames.some(frame => {
          const expectedFrame = expected.frames.find(candidate => candidate.id === frame.id);
          return !expectedFrame || frame.contextClass !== expectedFrame.contextClass;
        })) throw new Error('Inconsistent PII context roster');
  }
  const rosterRows = report.contextRoster.flatMap(group => group.frames.map(frame => ({ ...frame, language: group.language })));
  const projectedContextByLanguage = Object.fromEntries([...new Set(report.contextRoster.map(group => group.language))].sort().map(language => [language,
    Object.fromEntries(languageClasses.map(contextClass => [contextClass, Object.fromEntries(statuses.map(status => [status,
      rosterRows.filter(frame => frame.language === language && frame.contextClass === contextClass && frame.status === status).length]))]))]));
  if (canonical(projectedContextByLanguage) !== canonical(report.contextByLanguage)) throw new Error('Inconsistent PII context language strata');
  for (const [language, classes] of Object.entries(report.contextByLanguage)) {
    if (!/^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/.test(language) || !exact(classes, [...languageClasses])) throw new Error('Inconsistent PII context language strata');
    for (const contextClass of languageClasses) if (!exact(classes[contextClass], [...statuses]) ||
        Object.values(classes[contextClass]).some(value => !Number.isInteger(value) || value < 0) ||
        Object.values(classes[contextClass]).reduce((sum, value) => sum + value, 0) === 0) throw new Error('Inconsistent PII context language strata');
  }
  const contextClassTotals = Object.fromEntries(languageClasses.map(contextClass => [contextClass,
    Object.values(report.contextByLanguage).reduce((sum, classes) => sum + Object.values(classes[contextClass]).reduce((a, b) => a + b, 0), 0)]));
  if (Object.values(contextClassTotals).some(total => total < Object.keys(report.contextByLanguage).length) ||
      contextClassTotals.sensitive + contextClassTotals.neutral + contextClassTotals['non-sensitive'] > report.rowCount)
    throw new Error('Inconsistent PII context language strata');
  const evidence = report.evidence;
  if ((report.rowCount === 0 ? report.sources.length !== 0 : report.sources.length !== 1) || report.commitmentTrust !== 'unresolved' ||
      report.sourceCaseCount > report.rowCount || evidence.authority.qualified > evidence.authority.total || evidence.authority.total > report.rowCount ||
      (evidence.authority.total > 0 && evidence.authority.sources === 0) || evidence.validators.evaluated > evidence.validators.applicable ||
      evidence.benign.cases !== evidence.semanticControls || evidence.benign.cases > report.sourceCaseCount ||
      evidence.context.evaluated > evidence.context.applicable || evidence.context.applicable > report.sourceCaseCount ||
      evidence.jurisdiction.evaluated > evidence.jurisdiction.applicable || evidence.jurisdiction.applicable > report.sourceCaseCount ||
      evidence.reference.evaluated + evidence.reference.unavailable > evidence.reference.applicable || evidence.reference.applicable > report.rowCount)
    throw new Error('Inconsistent PII accounting evidence');
  if (Object.hasOwn(report, 'overallScore') || Object.hasOwn(report, 'rows')) throw new Error('Inconsistent PII accounting report');
  return report;
}

export function piiAccountingRowsFromEvaluation(artifact: unknown, scannerId?: string): PiiAccountingRow[] {
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
  if (sources.size === 0) throw new Error('PII evaluation contains no scanner source');
  if (sources.size > 1 && scannerId === undefined) throw new Error('PII accounting requires an explicit scanner selector');
  if (scannerId !== undefined && !sources.has(scannerId)) throw new Error('Unknown PII accounting scanner selector');
  const selected = scannerId ?? [...sources.keys()][0];
  const rows = value.results.flatMap((raw: any) => {
    if (!raw || !Array.isArray(raw.variants) || !Array.isArray(raw.outcomes)) throw new Error('Invalid PII evaluation artifact for accounting');
    const expected = raw.variants.map((variant: any) => `${selected}/${variant.id}`);
    const actual = raw.outcomes.filter((outcome: any) => outcome?.scanner === selected).map((outcome: any) => `${outcome?.scanner}/${outcome?.variant}`);
    if (actual.length !== expected.length || new Set(actual).size !== actual.length || expected.some((key: string) => !actual.includes(key)))
      throw new Error('Incomplete PII scanner × variant outcome matrix');
    return raw.outcomes.filter((outcome: PiiOutcome) => outcome.scanner === selected).map((outcome: PiiOutcome) => {
      const matches = raw.variants.filter((candidate: any) => candidate.id === outcome.variant), source = sources.get(outcome.scanner);
      if (matches.length !== 1 || !matches[0]?.expectation || !source) throw new Error('Missing PII accounting expectation or scanner');
      const variant = matches[0], evidence = raw.evidence ?? {};
      const validatorEvidence = evidence.collision?.validators?.map((item: any) => ({ family: item.family, id: item.validator,
        version: item.version, expected: item.expected, observed: item.observed })) ?? (evidence.validation?.evidenceId === undefined ?
        (evidence.control?.validator ? [{ family: raw.family, id: evidence.control.validator.id, version: evidence.control.validator.version,
          expected: evidence.control.validator.expected, observed: evidence.control.validator.observed }] : []) :
        [{ family: raw.family, id: evidence.validation.validator, version: evidence.validation.validatorVersion,
          expected: evidence.validation.expected, observed: evidence.validation.state }]);
      return validateRow({ source, caseId: raw.id, method: raw.method, family: raw.family, scope: raw.scope, variant: outcome.variant,
        strategy: variant.strategy, scanner: outcome.scanner, qualificationProfile: raw.qualificationProfile, authority: raw.authority, expectation: variant.expectation,
        methodEvidence: { evidenceClass: evidence.control?.evidenceClass ?? evidence.validation?.evidenceClass ?? evidence.collision?.evidenceClass ?? null,
          controlClass: evidence.control?.controlClass ?? null, validatorEvidence,
          validatorState: evidence.validation?.state ?? evidence.control?.validator?.observed ??
            evidence.collision?.validators?.find((row: any) => row.family === raw.family)?.observed ?? null,
          collision: evidence.collision?.kind === 'jurisdiction-collision' ? { targetFamily: evidence.collision.targetFamily,
            competingFamilies: evidence.collision.competingFamilies } : null, referenceState: evidence.reference?.reference?.state ?? null }, outcome });
    });
  });
  assertSingleSource(rows); contextGroups(rows); return rows;
}
