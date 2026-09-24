import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { statusCriteria, validateStatusCriteria, classifyFamilySupport } from '../benchmarks/support/status.ts';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const schema = await read('schemas/support-status-criteria-v1.json');

const ajv = new Ajv({ strict: true });
const validate = ajv.compile(schema);

const baseEvidence = () => ({
  family: 'example:token',
  detectors: ['example-token'],
  positiveContractTier: 'T1',
  hasProviderSource: true,
  evidenceBasis: 'provider-documented',
  observationCount: 0,
  observationSubjects: 0,
  observationIssuanceDates: 0,
  corroborationClasses: [],
  observationContradictions: 0,
  uncertainty: null,
  supportedContexts: [],
  empiricalMode: null,
  supportsBareValues: true,
  positiveCases: 6,
  positiveAxes: 4,
  controlAxes: 4,
  totalFixtures: 24,
  contextTwinPairs: 0,
  confusionAxes: 4,
  twinPairs: 5,
  twinFailures: 0,
  benignCases: 8,
  benignAxes: 4,
  benignAxisIds: ['near-miss', 'placeholder', 'reference', 'identifier'],
  benignFalseAlarms: 0,
  metamorphicCriticalFailures: 0,
  mutationUnresolvedCritical: 0,
  differentialUnresolvedContractDisagreements: 0,
});

test('status-criteria.json satisfies its schema', () => {
  const valid = validate(statusCriteria);
  assert.ok(valid, JSON.stringify(validate.errors));
});

test('validateStatusCriteria accepts the checked-in criteria and rejects a mutilated copy', () => {
  assert.deepEqual(validateStatusCriteria(statusCriteria), statusCriteria);
  const broken = JSON.parse(JSON.stringify(statusCriteria));
  delete broken.stable.documented.minimumTwinPairs.rationale;
  assert.throws(() => validateStatusCriteria(broken));
});

test('every stable threshold carries a non-empty rationale', () => {
  const s = statusCriteria.stable;
  const thresholds = [s.documented.minimumTwinPairs, s.documented.minimumPositiveCases, s.documented.minimumPositiveAxes,
    s.empirical.minimumObservations, s.empirical.minimumTwinPairs, s.empirical.contextConstrained.minimumFixtures,
    s.twinFailures, s.benign.minimumCases, s.benign.minimumAxes, s.benign.falseAlarms,
    s.metamorphic.criticalFailures, s.mutation.unresolvedCritical, s.differential.unresolvedContractDisagreements];
  for (const t of thresholds) assert.ok(t.rationale.trim().length > 0);
  assert.ok(s.documented.rationale.trim().length > 0);
  assert.ok(s.empirical.rationale.trim().length > 0);
  assert.ok(statusCriteria.provisional.rationale.trim().length > 0);
  assert.ok(statusCriteria.pending.rationale.trim().length > 0);
  assert.ok(statusCriteria.unsupported.rationale.trim().length > 0);
});

test('a family meeting every stable floor is stable with no reasons', () => {
  const result = classifyFamilySupport(baseEvidence());
  assert.deepEqual(result, { family: 'example:token', status: 'stable', reasons: [], qualificationProfile: 'documented' });
});

test('tier alone does not grant stable: a T1 contract with no twins is provisional, not stable', () => {
  const evidence = { ...baseEvidence(), twinPairs: 0 };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => r.startsWith('documented.minimumTwinPairs:')));
});

test('a family under the axis floor is provisional, and the reason names the axes present (#92)', () => {
  const stricter = JSON.parse(JSON.stringify(statusCriteria));
  stricter.stable.benign.minimumAxes.value = 3;
  const evidence = { ...baseEvidence(), benignCases: 5, benignAxes: 1, benignAxisIds: ['near-miss'] };
  const result = classifyFamilySupport(evidence, stricter);
  assert.equal(result.status, 'provisional');
  const reason = result.reasons.find(r => r.startsWith('benign.minimumAxes:'));
  assert.ok(reason, JSON.stringify(result.reasons));
  assert.ok(reason.includes('near-miss'), reason);
});

test('a family with no benign axes at all names "none" rather than an empty list', () => {
  const stricter = JSON.parse(JSON.stringify(statusCriteria));
  stricter.stable.benign.minimumAxes.value = 3;
  const evidence = { ...baseEvidence(), benignCases: 0, benignAxes: 0, benignAxisIds: [] };
  const result = classifyFamilySupport(evidence, stricter);
  const reason = result.reasons.find(r => r.startsWith('benign.minimumAxes:'));
  assert.ok(reason, JSON.stringify(result.reasons));
  assert.ok(reason.includes('none'), reason);
});

test('a family meeting the axis floor exactly is not penalized for minimumAxes', () => {
  const stricter = JSON.parse(JSON.stringify(statusCriteria));
  stricter.stable.benign.minimumAxes.value = 3;
  const evidence = { ...baseEvidence(), benignCases: 5, benignAxes: 3, benignAxisIds: ['near-miss', 'placeholder', 'reference'] };
  const result = classifyFamilySupport(evidence, stricter);
  assert.ok(!result.reasons.some(r => r.startsWith('benign.minimumAxes:')), JSON.stringify(result.reasons));
});

test('a family failing reports which criterion it failed, one entry per breach', () => {
  const evidence = { ...baseEvidence(), twinFailures: 1, benignFalseAlarms: 2 };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => r.startsWith('twinFailures:')));
  assert.ok(result.reasons.some(r => r.startsWith('benign.falseAlarms:')));
  assert.equal(result.reasons.length, 2);
});

test('T2 can become stable through the empirical profile and never masquerades as T1', () => {
  const evidence = {
    ...baseEvidence(), positiveContractTier: 'T2', hasProviderSource: false, evidenceBasis: 'empirically-observed',
    observationCount: 5, observationSubjects: 2, observationIssuanceDates: 2,
    corroborationClasses: ['peer-scanner', 'independent-implementation'], uncertainty: 'Observed sample may not cover future formats.',
    supportedContexts: ['assignment', 'header'], empiricalMode: 'shape', positiveCases: 10, positiveAxes: 6,
    benignCases: 14, benignAxes: 5, controlAxes: 5, twinPairs: 8, totalFixtures: 40,
  };
  const result = classifyFamilySupport(evidence);
  assert.deepEqual(result, { family: 'example:token', status: 'stable', reasons: [], qualificationProfile: 'empirical' });
  assert.equal(evidence.positiveContractTier, 'T2');
  assert.equal(evidence.evidenceBasis, 'empirically-observed');
});

test('contradictory observations block empirical qualification', () => {
  const evidence = {
    ...baseEvidence(), positiveContractTier: 'T2', hasProviderSource: false, evidenceBasis: 'empirically-observed',
    observationCount: 5, observationSubjects: 2, observationIssuanceDates: 2, observationContradictions: 1,
    corroborationClasses: ['peer-scanner', 'independent-implementation'], uncertainty: 'Sample is bounded.', supportedContexts: ['assignment'],
    empiricalMode: 'shape', positiveCases: 10, positiveAxes: 6, benignCases: 14, benignAxes: 5, controlAxes: 5, twinPairs: 8,
  };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(reason => reason.startsWith('empirical.contradictions:')));
});

test('opaque empirical values require the 48-fixture context-constrained profile and no bare-value claim', () => {
  const evidence = {
    ...baseEvidence(), positiveContractTier: 'T2', hasProviderSource: false, evidenceBasis: 'empirically-observed',
    observationCount: 5, observationSubjects: 2, observationIssuanceDates: 2,
    corroborationClasses: ['peer-scanner', 'independent-implementation'], uncertainty: 'Opaque value; context is part of the contract.',
    supportedContexts: ['authorization-header'], empiricalMode: 'context-constrained', supportsBareValues: false,
    positiveCases: 10, positiveAxes: 6, benignCases: 14, benignAxes: 6, controlAxes: 6, twinPairs: 10,
    contextTwinPairs: 10, confusionAxes: 6, totalFixtures: 48,
  };
  assert.equal(classifyFamilySupport(evidence).status, 'stable');
  const bare = classifyFamilySupport({ ...evidence, supportsBareValues: true });
  assert.equal(bare.status, 'provisional');
  assert.ok(bare.reasons.some(reason => reason.startsWith('empirical.contextConstrained.supportsBareValues:')));
});

test('T3 project-policy families cannot become empirical-stable by adding generated fixtures', () => {
  const evidence = {
    ...baseEvidence(), positiveContractTier: 'T3', hasProviderSource: false, evidenceBasis: 'project-policy',
    observationCount: 99, observationSubjects: 9, observationIssuanceDates: 9,
    corroborationClasses: ['peer-scanner', 'independent-implementation'], uncertainty: 'Policy only.', supportedContexts: ['all'],
    empiricalMode: 'shape', positiveCases: 100, positiveAxes: 20, benignCases: 100, benignAxes: 20, controlAxes: 20, twinPairs: 50,
  };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.equal(result.qualificationProfile, null);
  assert.ok(result.reasons.some(reason => reason.includes('tier T3')));
});

test('T0 positive contract is pending, regardless of method evidence', () => {
  const evidence = { ...baseEvidence(), positiveContractTier: 'T0', hasProviderSource: false };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'pending');
});

test('a family with no detector and no reason reports pending, never unsupported', () => {
  const evidence = { ...baseEvidence(), detectors: [], positiveContractTier: null, hasProviderSource: false };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'pending');
});

test('unsupported requires a recorded reason', () => {
  const withReason = { ...baseEvidence(), detectors: [], positiveContractTier: null, hasProviderSource: false, unsupportedReason: 'No representable credential exists for this shape (#503).' };
  const result = classifyFamilySupport(withReason);
  assert.deepEqual(result, { family: 'example:token', status: 'unsupported', reasons: [withReason.unsupportedReason], qualificationProfile: null });
});

test('changing a threshold is a reviewable diff that visibly moves statuses', () => {
  const evidence = { ...baseEvidence(), twinPairs: 3 };
  const before = classifyFamilySupport(evidence);
  assert.equal(before.status, 'provisional');
  const loosened = JSON.parse(JSON.stringify(statusCriteria));
  loosened.stable.documented.minimumTwinPairs.value = 3;
  const after = classifyFamilySupport(evidence, loosened);
  assert.equal(after.status, 'stable');
});
