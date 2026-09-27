import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PII_VALIDATOR_CONSUMERS,
  PII_VALIDATOR_FAMILIES,
  PII_VALIDATOR_PRIMITIVE_CLASSES,
  PII_VALIDATOR_PRODUCT_CONTRACT,
  PII_VALIDATOR_REGISTRATIONS,
  benchmarkReferenceValidator,
  capturePiiValidatorObservations,
  piiValidatorCorpusSummary,
  qualifyPiiValidators,
  validatePiiValidatorConsumerMap,
  validatePiiValidatorObservationArtifact,
  validatePiiValidatorQualificationReport,
  validatePiiValidatorRegistry,
} from '../benchmarks/evaluation/domains/pii/validator-qualification.ts';

const target = (id, digit, observe = benchmarkReferenceValidator) => ({ id, adapterHash: digit.repeat(64), observe });

async function captured() {
  return capturePiiValidatorObservations({ productCommit: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit,
    targets: [target('native', 'a'), target('wasm', 'b')] });
}

test('validator registry pins normative, implementation, vector-class, and empty current-consumer identity once', () => {
  const registry = validatePiiValidatorRegistry();
  assert.deepEqual(registry.map(row => [row.id, row.version, row.maxCandidateBytes]), [['luhn', 1, 19], ['iban-mod97', 1, 34]]);
  assert.deepEqual(PII_VALIDATOR_PRIMITIVE_CLASSES, [
    'luhn', 'mod-97', 'weighted-mod-10', 'weighted-mod-11', 'iso-7064', 'verhoeff', 'bounded-parser-classifier',
  ]);
  assert.ok(registry.every(row => row.normativeSources.some(source => source.claim === 'algorithm')));
  assert.ok(registry.every(row => row.normativeSources.some(source => source.claim === 'lexical-contract')));
  assert.ok(registry.every(row => row.implementation.mergeCommit === '266204c87126a9de2c0ff28e7913bccabebd1d98'));
  assert.deepEqual(piiValidatorCorpusSummary().map(row => row.counts), [
    { positive: 2, 'mechanical-invalid': 1, boundary: 3, 'maximum-length': 3 },
    { positive: 1, 'mechanical-invalid': 1, boundary: 4, 'maximum-length': 3 },
  ]);
  assert.deepEqual(validatePiiValidatorConsumerMap(PII_VALIDATOR_CONSUMERS).mappings.map(row => row.families), [[], []]);
  assert.equal(new Set(PII_VALIDATOR_REGISTRATIONS.map(row => row.vectorSet.id)).size, PII_VALIDATOR_REGISTRATIONS.length);
});

test('absent sanctioned product artifact stays not measured and can never imply family stability', () => {
  const report = qualifyPiiValidators();
  assert.equal(report.productContract.conformanceSurface, 'crate-private-pending');
  assert.equal(report.status, 'not-measured');
  assert.equal(report.evidenceTrust, 'not-measured');
  assert.equal(report.familySupportClaims, false);
  assert.equal(report.familyQualification, 'not-evaluated');
  assert.ok(report.primitives.every(row => row.status === 'not-measured' && row.observations.measured === 0));
  assert.doesNotMatch(JSON.stringify(report), /1230|12344|ZZ50SYNTHETIC|"stable"/);
});

test('bounded replay capture represents native-Wasm parity without trusting or publishing candidate bytes', async () => {
  const calls = [];
  const observe = request => { calls.push(`${request.validator.id}/${request.vector.id}`); return benchmarkReferenceValidator(request); };
  const artifact = await capturePiiValidatorObservations({ productCommit: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit,
    targets: [target('native', 'c', observe), target('wasm', 'd', observe)] });
  assert.equal(calls.length, artifact.observations.length * 2);
  assert.equal(artifact.reportType, 'pii-validator-simulation');
  assert.equal(artifact.producer.kind, 'benchmark-simulation');
  assert.equal(artifact.observations.length, 40);
  const report = qualifyPiiValidators(artifact);
  assert.equal(report.status, 'not-measured');
  assert.equal(report.evidenceTrust, 'untrusted-simulation');
  assert.ok(report.primitives.every(row => row.parity.status === 'simulation' && row.parity.agreement === 'matched'));
  assert.ok(report.primitives.every(row => row.observations.expected === row.observations.measured));
  assert.equal(report.registryContract.observations.measured, 4);
  assert.deepEqual(report.registryContract.simulationMismatches, []);
  const safe = JSON.stringify({ artifact, report });
  assert.doesNotMatch(safe, /1230|12344|ZZ50SYNTHETIC|"candidate":|rawValue/);
});

test('a simulated primitive mismatch identifies the primitive and every mapped consumer without claiming a product regression', async () => {
  const artifact = await captured();
  artifact.observations.find(row => row.target === 'wasm' && row.validator.id === 'luhn' && row.vectorId === 'luhn-even-positive').outcome = 'checksum-mismatch';
  const consumerMap = structuredClone(PII_VALIDATOR_CONSUMERS);
  consumerMap.mappings.find(row => row.validator.id === 'luhn').families = ['pii:global:payment-card'];
  const families = [...structuredClone(PII_VALIDATOR_FAMILIES), { family: 'pii:global:payment-card', validator: { id: 'luhn', version: 1 } }];
  const report = qualifyPiiValidators(artifact, consumerMap, families);
  assert.equal(report.status, 'not-measured');
  const luhn = report.primitives.find(row => row.validator.id === 'luhn');
  assert.equal(luhn.status, 'not-measured');
  assert.equal(luhn.parity.agreement, 'divergent');
  assert.deepEqual(luhn.simulationMismatches, [{ target: 'wasm', vectorId: 'luhn-even-positive', expected: 'valid', observed: 'checksum-mismatch',
    consumers: ['pii:global:payment-card'] }]);
  assert.equal(report.primitives.find(row => row.validator.id === 'iban-mod97').status, 'not-measured');
  assert.equal(Object.hasOwn(consumerMap.mappings[0], 'vectors'), false);
});

test('observation evidence fails closed on hostile identities, matrices, outcomes, extras, and raw candidates', async () => {
  const artifact = await captured();
  const mutations = [
    value => { value.extra = true; },
    value => { value.observations[0].candidate = 'RAW-PII-SENTINEL'; },
    value => { delete value.observations[0].outcome; },
    value => { value.observations[0].validator.id = 'unknown-validator'; },
    value => { value.observations[0].validator.version = 99; },
    value => { value.observations[0].outcome = 'pass'; },
    value => { value.observations.pop(); },
    value => { value.observations[1] = structuredClone(value.observations[0]); },
    value => { value.contractUnderTest.commit = 'f'.repeat(40); },
    value => { value.targets[1].adapterHash = value.targets[0].adapterHash; },
    value => { value.targets[1].id = 'native'; },
  ];
  for (const mutate of mutations) {
    const hostile = structuredClone(artifact); mutate(hostile);
    assert.throws(() => validatePiiValidatorObservationArtifact(hostile), error => {
      assert.match(error.message, /PII validator/);
      assert.doesNotMatch(error.message, /RAW-PII-SENTINEL/);
      return true;
    });
  }
});

test('runner hooks are exact and deterministic, and consumer mappings reject stale families or embedded corpora', async () => {
  let flip = false;
  await assert.rejects(() => capturePiiValidatorObservations({ productCommit: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit,
    targets: [target('native', 'e', request => { flip = !flip; return flip ? benchmarkReferenceValidator(request) : { outcome: 'unavailable' }; }),
      target('wasm', 'f')] }), /Unstable PII validator runner observation/);
  await assert.rejects(() => capturePiiValidatorObservations({ productCommit: PII_VALIDATOR_PRODUCT_CONTRACT.mergeCommit,
    targets: [target('native', 'e', () => ({ outcome: 'valid', raw: 'RAW-PII-SENTINEL' })), target('wasm', 'f')] }), /Invalid PII validator runner observation/);

  const stale = structuredClone(PII_VALIDATOR_CONSUMERS);
  stale.mappings[0].families = ['pii:global:payment-card'];
  assert.throws(() => validatePiiValidatorConsumerMap(stale, PII_VALIDATOR_FAMILIES), /Invalid PII validator consumer map/);
  const missingReverse = [...structuredClone(PII_VALIDATOR_FAMILIES),
    { family: 'pii:global:payment-card', validator: { id: 'luhn', version: 1 } }];
  assert.throws(() => validatePiiValidatorConsumerMap(PII_VALIDATOR_CONSUMERS, missingReverse), /Incomplete PII validator consumer map/);
  const duplicated = structuredClone(PII_VALIDATOR_CONSUMERS);
  duplicated.mappings[0].vectors = ['luhn-even-positive'];
  assert.throws(() => validatePiiValidatorConsumerMap(duplicated, []), /Invalid PII validator consumer map/);
});

test('qualification report rejects forged family conclusions and aggregate inconsistency', () => {
  const report = qualifyPiiValidators();
  assert.throws(() => validatePiiValidatorQualificationReport({ ...structuredClone(report), familyQualification: 'stable' }), /Invalid/);
  const coordinated = structuredClone(report);
  coordinated.evidenceTrust = 'untrusted-simulation';
  coordinated.primitives.forEach(row => { row.parity = { status: 'simulation', agreement: 'matched' }; row.observations.expected = row.observations.measured = 999; });
  assert.throws(() => validatePiiValidatorQualificationReport(coordinated), /Inconsistent/);
  const consumerForgery = structuredClone(report); consumerForgery.primitives[0].consumers = ['pii:global:forged-family'];
  assert.throws(() => validatePiiValidatorQualificationReport(consumerForgery), /Inconsistent/);
  assert.throws(() => validatePiiValidatorQualificationReport({ ...structuredClone(report), extra: true }), /Invalid/);
});
