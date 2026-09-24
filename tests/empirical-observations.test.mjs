import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { empiricalObservations, empiricalEvidence, validateEmpiricalObservations, isPinnedReference } from '../benchmarks/support/empirical.ts';
import { empiricalRoute } from '../benchmarks/support/status.ts';
import { contracts, registryContractIds } from '../benchmarks/lib/assessment.ts';
import { captureObservation, readHiddenCredential, runObservationCapture } from '../benchmarks/support/observation-capture.ts';

const schema = JSON.parse(await readFile(new URL('../schemas/empirical-observations-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);

const observation = (subjectId, issuedAt) => ({
  provider: 'example', credentialFamily: 'example-token', observedAt: '2026-09-24', issuedAt, issuanceRoute: 'dashboard', subjectKind: 'account', subjectId,
  evidenceBasis: 'empirically-observed', independenceClass: 'provider-issuance',
  structure: { totalLength: 32, prefix: 'ex_', segmentLengths: [3, 29], alphabetClasses: ['lower', 'digit'], separators: ['underscore'], checksumBehavior: 'unknown' },
  revokedAfterObservation: true, rawValueRetained: false,
});

const reference = (cls, owner, path) => ({ class: cls, owner, reference: `https://github.com/${owner}/rules/blob/v1.2.3/${path}`, observedAt: '2026-09-24', supports: 'prefix and body length' });

const file = {
  schemaVersion: 1,
  families: [{
    family: 'example-token', mode: 'shape', supportsBareValues: true,
    uncertainty: 'Five observations do not establish future format stability.', supportedContexts: ['assignment', 'header'],
    observations: [observation('subject-a', '2026-09-20'), observation('subject-a', '2026-09-21'), observation('subject-b', '2026-09-20'), observation('subject-b', '2026-09-21'), observation('subject-b', '2026-09-22')],
    corroboration: [reference('peer-scanner-rule', 'scanner-a', 'a.toml'), reference('independent-implementation', 'implementation-b', 'b.go')],
    contradictions: [],
  }],
};

/** No provider-issued observation, three owners in two classes plus research. */
const corroborated = () => ({
  schemaVersion: 1,
  families: [{
    family: 'example-token', mode: 'shape', supportsBareValues: true,
    uncertainty: 'Corroborated shape; never provider-issued here.', supportedContexts: ['assignment'],
    observations: [],
    corroboration: [
      reference('peer-scanner-rule', 'scanner-a', 'a.toml'),
      { class: 'provider-example', owner: 'example', reference: 'https://docs.example.com/keys', observedAt: '2026-09-24', supports: 'prefix by example' },
      { class: 'independent-research', owner: 'redact-secret', reference: 'https://github.com/redact-secret/redact-secret/issues/1', observedAt: '2026-09-24', supports: 'dated research pass' },
    ],
    contradictions: [
      { statement: 'A blog says the body is 31 characters.', status: 'settled', bound: 'The provider example shows 32.', settledBy: 'https://docs.example.com/keys' },
      { statement: 'A tool admits uppercase.', status: 'bounded', bound: 'The contract is lowercase only and no fixture asserts either way.' },
    ],
  }],
});

test('checked-in records are schema-valid, carry no observation or credential value, and cover the registry T2 families only', () => {
  assert.ok(validate(empiricalObservations), JSON.stringify(validate.errors));
  const t2 = registryContractIds.filter(id => contracts[id].tier === 'T2').sort();
  assert.deepEqual(empiricalObservations.families.map(record => record.family).sort(), t2, 'one corroboration record per registry T2 family');
  for (const record of empiricalObservations.families) {
    assert.deepEqual(record.observations, [], `${record.family}: no provider-issued observation has been captured`);
    const pattern = contracts[record.family].pattern;
    const text = JSON.stringify(record);
    // The contract pattern, unanchored: any substring of the record that would satisfy it is credential-shaped.
    const unanchored = pattern && pattern.slice(pattern.startsWith('^') ? 1 : 0, pattern.endsWith('$') ? -1 : undefined);
    if (unanchored) assert.doesNotMatch(text, new RegExp(unanchored), `${record.family}: a value matching the contract appears in its record`);
    for (const item of record.corroboration) assert.ok(item.class !== 'peer-scanner-rule' || isPinnedReference(item.reference), `${record.family}: ${item.reference}`);
  }
});

test('safe observation metadata deterministically yields empirical qualification counts', () => {
  assert.deepEqual(validateEmpiricalObservations(file), file);
  assert.deepEqual(empiricalEvidence('example-token', file), {
    observationCount: 5, observationSubjects: 2, observationIssuanceDates: 3,
    corroborationReferences: 2, corroborationOwners: 2, corroborationClasses: ['independent-implementation', 'peer-scanner-rule'],
    unresolvedContradictions: 0, boundedContradictions: 0,
    uncertainty: file.families[0].uncertainty, supportedContexts: ['assignment', 'header'], empiricalMode: 'shape', supportsBareValues: true,
  });
  assert.equal(empiricalRoute(empiricalEvidence('example-token', file)).route, 'observed');
});

test('a corroboration-only record qualifies the corroborated route with zero observations', () => {
  const record = corroborated();
  assert.deepEqual(validateEmpiricalObservations(record), record);
  const evidence = empiricalEvidence('example-token', record);
  assert.equal(evidence.observationCount, 0);
  assert.deepEqual([evidence.corroborationReferences, evidence.corroborationOwners, evidence.unresolvedContradictions, evidence.boundedContradictions], [3, 3, 0, 2]);
  assert.equal(empiricalRoute(evidence).route, 'corroborated');
  const partial = corroborated();
  partial.families[0].observations = [observation('subject-a', '2026-09-20')];
  assert.equal(empiricalRoute(empiricalEvidence('example-token', validateEmpiricalObservations(partial))).route, 'corroborated', 'a partial observation set strengthens nothing and blocks nothing');
});

test('observations present on the corroborated route are still validated exactly as #205 defines', () => {
  const leaky = corroborated();
  leaky.families[0].observations = [{ ...observation('subject-a', '2026-09-20'), rawValueRetained: true }];
  assert.throws(() => validateEmpiricalObservations(leaky), { message: 'Invalid empirical observation metadata' });
  const foreign = corroborated();
  foreign.families[0].observations = [{ ...observation('subject-a', '2026-09-20'), credentialFamily: 'other-token' }];
  assert.throws(() => validateEmpiricalObservations(foreign), { message: 'Empirical observation family mismatch' });
  const unnamed = corroborated();
  unnamed.families[0].observations = [{ ...observation('subject-a', '2026-09-20'), subjectId: 'acme-prod' }];
  assert.throws(() => validateEmpiricalObservations(unnamed), { message: 'Invalid empirical observation metadata' }, 'subjects stay pseudonymous');
});

test('corroboration references must be pinned, distinct and well-formed; a contradiction can be settled only by a provider source', () => {
  const unpinned = corroborated();
  unpinned.families[0].corroboration[0].reference = 'https://github.com/scanner-a/rules/blob/main/a.toml';
  assert.throws(() => validateEmpiricalObservations(unpinned), { message: 'Unpinned corroboration reference' });
  assert.equal(isPinnedReference('https://github.com/o/r/blob/0123456789abcdef0123456789abcdef01234567/x.go'), true);
  assert.equal(isPinnedReference('https://github.com/o/r/tree/master/x'), false);
  assert.equal(isPinnedReference('https://github.com/o/r/issues/1'), false, 'an issue is not a code reference');
  const duplicate = corroborated();
  duplicate.families[0].corroboration.push({ ...duplicate.families[0].corroboration[0], owner: 'someone-else' });
  assert.throws(() => validateEmpiricalObservations(duplicate), { message: 'Duplicate corroboration reference' });
  const byTool = corroborated();
  byTool.families[0].contradictions[0].settledBy = byTool.families[0].corroboration[0].reference;
  assert.throws(() => validateEmpiricalObservations(byTool), { message: 'Contradiction settled by a non-provider source' });
  const unbounded = corroborated();
  delete unbounded.families[0].contradictions[1].bound;
  assert.throws(() => validateEmpiricalObservations(unbounded), { message: 'Contradiction status and its bound or settling source disagree' });
  const unresolved = corroborated();
  unresolved.families[0].contradictions.push({ statement: 'Two tools disagree on the width and fixtures take a side.', status: 'unresolved' });
  assert.equal(empiricalEvidence('example-token', validateEmpiricalObservations(unresolved)).unresolvedContradictions, 1);
  const noClass = corroborated();
  noClass.families[0].corroboration[0].class = 'blog';
  assert.throws(() => validateEmpiricalObservations(noClass), { message: 'Invalid empirical observation metadata' });
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
