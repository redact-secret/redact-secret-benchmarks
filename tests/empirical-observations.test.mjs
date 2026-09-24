import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { empiricalObservations, empiricalEvidence, validateEmpiricalObservations } from '../benchmarks/support/empirical.ts';
import { captureObservation, readHiddenCredential, runObservationCapture } from '../benchmarks/support/observation-capture.ts';

const schema = JSON.parse(await readFile(new URL('../schemas/empirical-observations-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);

const observation = (subjectId, issuedAt) => ({
  provider: 'example', credentialFamily: 'example-token', observedAt: '2026-09-24', issuedAt, issuanceRoute: 'dashboard', subjectKind: 'account', subjectId,
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

test('family mismatches fail with a fixed diagnostic', () => {
  const mismatched = structuredClone(file);
  mismatched.families[0].observations[0].credentialFamily = 'other-token';
  assert.throws(() => validateEmpiricalObservations(mismatched), { message: 'Empirical observation family mismatch' });
});

const captureMetadata = {
  provider: 'example', credentialFamily: 'example-token', observedAt: '2026-09-24', issuedAt: '2026-09-23',
  issuanceRoute: 'dashboard', subjectKind: 'project', subjectId: 'subject-project-a', prefix: 'ex_',
  checksumBehavior: 'unknown', revokedAfterObservation: true,
};

test('local capture derives only schema-approved structural metadata', () => {
  const result = captureObservation('ex_Abc123-xy9', captureMetadata);
  assert.deepEqual(result.structure, {
    totalLength: 13, prefix: 'ex_', segmentLengths: [2, 6, 3], alphabetClasses: ['lower', 'upper', 'digit'],
    separators: ['underscore', 'dash'], checksumBehavior: 'unknown',
  });
  assert.equal(result.credentialFamily, 'example-token');
  assert.equal(result.evidenceBasis, 'empirically-observed');
  assert.equal(result.independenceClass, 'provider-issuance');
  assert.equal(result.rawValueRetained, false);
  assert.equal(JSON.stringify(result).includes('Abc123-xy9'), false);
});

test('capture errors and debug output never include credential material', async () => {
  const raw = 'ex_UNIQUE-CREDENTIAL-BYTES-9347';
  const stdout = [], stderr = [];
  const exitCode = await runObservationCapture([
    '--provider=example', '--family=example-token', '--observed-at=2026-09-24', '--issued-at=2026-09-23',
    '--issuance-route=dashboard', '--subject-kind=account', '--subject-id=subject-account-a', '--prefix=wrong_',
    '--checksum-behavior=unknown', '--revoked-after-observation=true', '--debug',
  ], { readSecret: async () => raw, stdout: { write: value => stdout.push(String(value)) }, stderr: { write: value => stderr.push(String(value)) } });
  assert.equal(exitCode, 1);
  assert.equal(stdout.join(''), '');
  assert.equal(stderr.join(''), 'Observation capture: awaiting hidden input.\nObservation capture failed: prefix-mismatch.\n');
  assert.equal(stderr.join('').includes(raw), false);
  assert.equal(stderr.join('').includes('UNIQUE-CREDENTIAL-BYTES-9347'), false);
});

test('capture refuses credential input in arguments', async () => {
  let reads = 0;
  const stderr = [];
  const exitCode = await runObservationCapture(['--raw-value=must-not-be-accepted'], {
    readSecret: async () => { reads += 1; return 'unused'; },
    stdout: { write: () => true }, stderr: { write: value => stderr.push(String(value)) },
  });
  assert.equal(exitCode, 1);
  assert.equal(reads, 0);
  assert.equal(stderr.join(''), 'Observation capture failed: invalid-arguments.\n');
  assert.equal(stderr.join('').includes('must-not-be-accepted'), false);
});

test('hidden credential input refuses non-interactive streams', async () => {
  await assert.rejects(readHiddenCredential({ isTTY: false }), { message: 'interactive-terminal-required' });
});
