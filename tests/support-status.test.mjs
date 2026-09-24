import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { statusCriteria, validateStatusCriteria, classifyFamilySupport, empiricalRoute, basisForRoute } from '../benchmarks/support/status.ts';

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
  corroborationReferences: 0,
  corroborationOwners: 0,
  corroborationClasses: [],
  unresolvedContradictions: 0,
  boundedContradictions: 0,
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
    s.empirical.corroborated.minimumReferences, s.empirical.corroborated.minimumOwners, s.empirical.corroborated.minimumClasses,
    s.empirical.corroborated.summaryClasses, s.empirical.corroborated, s.empirical.unresolvedContradictions,
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

/** A T2 family on the corroborated route: every fixture and behavior gate met, three owners in two classes, and no provider-issued observation. */
const corroboratedT2 = (over = {}) => ({
  ...baseEvidence(), positiveContractTier: 'T2', hasProviderSource: false, evidenceBasis: 'independently-corroborated',
  corroborationReferences: 4, corroborationOwners: 3, corroborationClasses: ['independent-research', 'peer-scanner-rule', 'provider-owned-code'],
  boundedContradictions: 1, uncertainty: 'Corroborated shape; no provider documentation states it.',
  supportedContexts: ['assignment', 'header'], empiricalMode: 'shape', positiveCases: 10, positiveAxes: 6,
  benignCases: 14, benignAxes: 5, controlAxes: 5, twinPairs: 8, totalFixtures: 40, ...over,
});

test('T2 with independent corroboration, the fixture profile and zero failures becomes empirical-stable with no observation', () => {
  const evidence = corroboratedT2();
  assert.equal(evidence.observationCount, 0);
  const result = classifyFamilySupport(evidence);
  assert.deepEqual(result, { family: 'example:token', status: 'stable', reasons: [], qualificationProfile: 'empirical' });
  assert.deepEqual(empiricalRoute(evidence), { route: 'corroborated', qualifies: true, observed: empiricalRoute(evidence).observed, corroborated: [] });
  assert.ok(empiricalRoute(evidence).observed.length > 0, 'the observed route is still reported short, never silently met');
});

test('corroborated empirical stable stays T2 and is labelled independently-corroborated, never T1 or observed', () => {
  const evidence = corroboratedT2();
  const result = classifyFamilySupport(evidence);
  assert.equal(result.qualificationProfile, 'empirical');
  assert.equal(evidence.positiveContractTier, 'T2');
  assert.equal(basisForRoute(empiricalRoute(evidence)), 'independently-corroborated');
  const claimsObserved = classifyFamilySupport({ ...evidence, evidenceBasis: 'empirically-observed' });
  assert.equal(claimsObserved.status, 'provisional', 'a basis is derived from the records, never asserted');
  assert.ok(claimsObserved.reasons.some(reason => reason.startsWith('empirical.evidenceBasis: empirically-observed does not match')));
  const asT1 = classifyFamilySupport({ ...evidence, positiveContractTier: 'T1' });
  assert.notEqual(asT1.qualificationProfile, 'empirical');
  assert.ok(asT1.reasons.some(reason => reason.startsWith('documented.providerSource: missing')), 'corroboration never stands in for a T1 provider source');
});

test('T2 can also qualify on the observed route, which then labels the basis empirically-observed', () => {
  const evidence = corroboratedT2({
    evidenceBasis: 'empirically-observed', observationCount: 5, observationSubjects: 2, observationIssuanceDates: 2,
    corroborationReferences: 2, corroborationOwners: 2, corroborationClasses: ['independent-implementation', 'peer-scanner-rule'],
  });
  assert.equal(empiricalRoute(evidence).route, 'observed');
  assert.deepEqual(classifyFamilySupport(evidence), { family: 'example:token', status: 'stable', reasons: [], qualificationProfile: 'empirical' });
});

test('insufficient corroboration blocks: too few references, too few owners, or one class plus research', () => {
  const cases = [
    [{ corroborationReferences: 2 }, 'empirical.corroborated.minimumReferences: 2 < 3'],
    [{ corroborationOwners: 2 }, 'empirical.corroborated.minimumOwners: 2 < 3'],
    [{ corroborationClasses: ['independent-research', 'peer-scanner-rule'] }, 'empirical.corroborated.minimumClasses: 1 < 2'],
    [{ corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [] }, 'empirical.corroborated.minimumReferences: 0 < 3'],
  ];
  for (const [over, reason] of cases) {
    const result = classifyFamilySupport(corroboratedT2(over));
    assert.equal(result.status, 'provisional', reason);
    assert.equal(result.qualificationProfile, null);
    assert.ok(result.reasons.some(item => item.startsWith(reason) && item.endsWith('(corroborated route)')), `${reason}\n${result.reasons.join('\n')}`);
    assert.ok(result.reasons.some(item => item.startsWith('empirical.minimumObservations') && item.endsWith('(observed route, optional)')));
  }
});

test('an unresolved contradiction blocks either route; a bounded or settled one is recorded and does not', () => {
  const blocked = classifyFamilySupport(corroboratedT2({ unresolvedContradictions: 1 }));
  assert.equal(blocked.status, 'provisional');
  assert.ok(blocked.reasons.some(reason => reason.startsWith('empirical.unresolvedContradictions: 1 > 0')));
  const observed = classifyFamilySupport(corroboratedT2({ evidenceBasis: 'empirically-observed', observationCount: 5, observationSubjects: 2, observationIssuanceDates: 2, unresolvedContradictions: 1 }));
  assert.equal(observed.status, 'provisional', 'contradictory observations still block the observed route (#205)');
  assert.equal(classifyFamilySupport(corroboratedT2({ boundedContradictions: 3 })).status, 'stable');
});

test('uncertainty, supported contexts and the fixture profile stay required on the corroborated route', () => {
  const missing = classifyFamilySupport(corroboratedT2({ uncertainty: null, supportedContexts: [], positiveCases: 9, twinPairs: 7 }));
  assert.equal(missing.status, 'provisional');
  for (const id of ['empirical.uncertainty', 'empirical.supportedContexts', 'empirical.minimumPositiveCases', 'empirical.minimumTwinPairs'])
    assert.ok(missing.reasons.some(reason => reason.startsWith(id)), id);
  const failing = classifyFamilySupport(corroboratedT2({ twinFailures: 1, benignFalseAlarms: 1 }));
  assert.equal(failing.status, 'provisional', 'behavior failures are never offset by corroboration');
});

test('opaque empirical values require the 48-fixture context-constrained profile and no bare-value claim', () => {
  const evidence = corroboratedT2({
    uncertainty: 'Opaque value; context is part of the contract.',
    supportedContexts: ['authorization-header'], empiricalMode: 'context-constrained', supportsBareValues: false,
    positiveCases: 10, positiveAxes: 6, benignCases: 14, benignAxes: 6, controlAxes: 6, twinPairs: 10,
    contextTwinPairs: 10, confusionAxes: 6, totalFixtures: 48,
  });
  assert.equal(classifyFamilySupport(evidence).status, 'stable');
  const bare = classifyFamilySupport({ ...evidence, supportsBareValues: true });
  assert.equal(bare.status, 'provisional');
  assert.ok(bare.reasons.some(reason => reason.startsWith('empirical.contextConstrained.supportsBareValues:')));
  const thin = classifyFamilySupport({ ...evidence, contextTwinPairs: 9 });
  assert.ok(thin.reasons.some(reason => reason.startsWith('empirical.contextConstrained.minimumContextTwinPairs: 9 < 10')));
});

test('T3 project-policy and T0 families cannot become stable through corroboration or fixture volume', () => {
  const volume = { observationCount: 99, observationSubjects: 9, observationIssuanceDates: 9, corroborationReferences: 9, corroborationOwners: 9,
    positiveCases: 100, positiveAxes: 20, benignCases: 100, benignAxes: 20, controlAxes: 20, twinPairs: 50, totalFixtures: 400 };
  const t3 = classifyFamilySupport(corroboratedT2({ ...volume, positiveContractTier: 'T3', evidenceBasis: 'project-policy' }));
  assert.equal(t3.status, 'provisional');
  assert.equal(t3.qualificationProfile, null);
  assert.ok(t3.reasons.some(reason => reason.includes('tier T3')));
  const t0 = classifyFamilySupport(corroboratedT2({ ...volume, positiveContractTier: 'T0', evidenceBasis: 'none' }));
  assert.equal(t0.status, 'pending');
  assert.equal(t0.qualificationProfile, null);
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
