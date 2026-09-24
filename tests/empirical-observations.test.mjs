import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { empiricalObservations, empiricalEvidence, validateEmpiricalObservations } from '../benchmarks/support/empirical.ts';

const schema = JSON.parse(await readFile(new URL('../schemas/empirical-observations-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);

const observation = (subjectId, issuedAt) => ({
  provider: 'example', observedAt: '2026-09-24', issuedAt, issuanceRoute: 'dashboard', subjectKind: 'account', subjectId,
  evidenceBasis: 'empirically-observed', independenceClass: 'provider-issuance',
  structure: { totalLength: 32, prefix: 'ex_', segmentLengths: [3, 29], alphabetClasses: ['lower', 'digit'], separators: ['underscore'], checksumBehavior: 'unknown' },
  revokedAfterObservation: true, rawValueRetained: false,
});

const file = {
  schemaVersion: 1,
  families: [{
    family: 'example-token', mode: 'shape', supportsBareValues: true,
    uncertainty: 'Five observations do not establish future format stability.', supportedContexts: ['assignment', 'header'],
    observations: [observation('subject-a', '2026-09-20'), observation('subject-a', '2026-09-21'), observation('subject-b', '2026-09-20'), observation('subject-b', '2026-09-21'), observation('subject-b', '2026-09-22')],
    corroboration: [{ class: 'peer-scanner', reference: 'scanner-a' }, { class: 'independent-implementation', reference: 'implementation-b' }],
    contradictions: [],
  }],
};

test('checked-in observation metadata is schema-valid and contains no credential values', () => {
  assert.ok(validate(empiricalObservations), JSON.stringify(validate.errors));
  assert.deepEqual(empiricalObservations.families, []);
});

test('safe observation metadata deterministically yields empirical qualification counts', () => {
  assert.deepEqual(validateEmpiricalObservations(file), file);
  assert.deepEqual(empiricalEvidence('example-token', file), {
    evidenceBasis: 'empirically-observed', observationCount: 5, observationSubjects: 2, observationIssuanceDates: 3,
    corroborationClasses: ['independent-implementation', 'peer-scanner'], observationContradictions: 0,
    uncertainty: file.families[0].uncertainty, supportedContexts: ['assignment', 'header'], empiricalMode: 'shape', supportsBareValues: true,
  });
});

test('validation diagnostics cannot disclose rejected input bytes', () => {
  const forbidden = 'credential-material-must-not-escape';
  const unsafe = structuredClone(file);
  unsafe.families[0].observations[0].rawValue = forbidden;
  assert.throws(() => validateEmpiricalObservations(unsafe), error => {
    assert.equal(error.message, 'Invalid empirical observation metadata');
    assert.ok(!error.message.includes(forbidden));
    return true;
  });
});
