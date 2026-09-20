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
  twinPairs: 5,
  twinFailures: 0,
  benignCases: 5,
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
  delete broken.stable.minimumTwinPairs.rationale;
  assert.throws(() => validateStatusCriteria(broken));
});

test('every stable threshold carries a non-empty rationale', () => {
  const s = statusCriteria.stable;
  const thresholds = [s.minimumTwinPairs, s.twinFailures, s.benign.minimumCases, s.benign.falseAlarms,
    s.metamorphic.criticalFailures, s.mutation.unresolvedCritical, s.differential.unresolvedContractDisagreements];
  for (const t of thresholds) assert.ok(t.rationale.trim().length > 0);
  assert.ok(s.positiveContract.rationale.trim().length > 0);
  assert.ok(statusCriteria.provisional.rationale.trim().length > 0);
  assert.ok(statusCriteria.pending.rationale.trim().length > 0);
  assert.ok(statusCriteria.unsupported.rationale.trim().length > 0);
});

test('a family meeting every stable floor is stable with no reasons', () => {
  const result = classifyFamilySupport(baseEvidence());
  assert.deepEqual(result, { family: 'example:token', status: 'stable', reasons: [] });
});

test('tier alone does not grant stable: a T1 contract with no twins is provisional, not stable', () => {
  const evidence = { ...baseEvidence(), twinPairs: 0 };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => r.startsWith('minimumTwinPairs:')));
});

test('a family failing reports which criterion it failed, one entry per breach', () => {
  const evidence = { ...baseEvidence(), twinFailures: 1, benignFalseAlarms: 2 };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => r.startsWith('twinFailures:')));
  assert.ok(result.reasons.some(r => r.startsWith('benign.falseAlarms:')));
  assert.equal(result.reasons.length, 2);
});

test('T2 tool-corroborated evidence cannot be stable even with perfect method results', () => {
  const evidence = { ...baseEvidence(), positiveContractTier: 'T2', hasProviderSource: false };
  const result = classifyFamilySupport(evidence);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => r.startsWith('positiveContract:')));
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
  assert.deepEqual(result, { family: 'example:token', status: 'unsupported', reasons: [withReason.unsupportedReason] });
});

test('changing a threshold is a reviewable diff that visibly moves statuses', () => {
  const evidence = { ...baseEvidence(), twinPairs: 3 };
  const before = classifyFamilySupport(evidence);
  assert.equal(before.status, 'provisional');
  const loosened = JSON.parse(JSON.stringify(statusCriteria));
  loosened.stable.minimumTwinPairs.value = 3;
  const after = classifyFamilySupport(evidence, loosened);
  assert.equal(after.status, 'stable');
});
