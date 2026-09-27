import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import {
  piiBenignCollisionCommitment, piiBenignCollisionEvidence, validatePiiBenignCollisionEvidence,
} from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { PII_CONTROL_CLASSES } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { PII_VALIDATOR_CONSUMERS } from '../benchmarks/evaluation/domains/pii/validator-qualification.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

const recommit = corpus => { corpus.contentCommitment = piiBenignCollisionCommitment(corpus); return corpus; };
const generator = seed => ({ kind: 'deterministic-synthetic', sources: [], generator: { id: 'pii-evidence-test-generator', version: 1, seedCommitment: hash(seed) } });
const familyDescriptors = [
  { family: 'pii:global:email', validator: { id: 'luhn', version: 1 } },
  { family: 'pii:us:ssn', validator: { id: 'luhn', version: 1 } },
];
const consumerMap = { schemaVersion: 1, mappings: [
  { validator: { id: 'luhn', version: 1 }, families: ['pii:global:email', 'pii:us:ssn'] },
  PII_VALIDATOR_CONSUMERS.mappings.find(row => row.validator.id === 'iban-mod97'),
] };
const benignValue = 'reserved@example.invalid';
const collisionValue = 'TEST-COLLISION-0000';

function extension() {
  const corpus = structuredClone(piiBenignCollisionEvidence);
  corpus.entries.push({
    id: 'future-context-negative', caseId: 'future-context-negative', evidenceClass: 'context-negative', accountingAxis: 'context-negative',
    family: 'pii:global:email', jurisdiction: null, identityDomain: 'email', language: 'en', candidateCommitment: hash(benignValue),
    typeExpectation: 'valid', sensitivityExpectation: 'non-sensitive', validator: null, contextGroup: 'en-email-core', collision: null,
    provenance: generator('future-context-negative'),
  }, {
    id: 'future-official-test', caseId: 'future-official-test', evidenceClass: 'official-test', accountingAxis: 'test-value',
    family: 'pii:global:email', jurisdiction: null, identityDomain: 'email', language: 'en', candidateCommitment: hash('OFFICIAL-RESERVED-CONTROL'),
    typeExpectation: 'valid', sensitivityExpectation: 'non-sensitive', validator: null, contextGroup: null, collision: null,
    provenance: { kind: 'authoritative', sources: [{ sourceKind: 'standard', sourceId: 'ietf-rfc-2606',
      locator: 'https://www.rfc-editor.org/rfc/rfc2606', revision: 'RFC2606' }] },
  }, {
    id: 'future-near-miss', caseId: 'future-near-miss', evidenceClass: 'near-miss', accountingAxis: null,
    family: 'pii:us:ssn', jurisdiction: 'US', identityDomain: 'national-id', language: 'en', candidateCommitment: hash('TEST-NEAR-MISS'),
    typeExpectation: 'invalid', sensitivityExpectation: 'not-established', validator: { id: 'luhn', version: 1, expected: 'invalid' }, contextGroup: null,
    collision: null, provenance: generator('future-near-miss'),
  }, {
    id: 'future-family-collision', caseId: 'future-family-collision', evidenceClass: 'cross-family-collision', accountingAxis: null,
    family: 'pii:us:ssn', jurisdiction: 'US', identityDomain: 'national-id', language: 'en', candidateCommitment: hash(collisionValue),
    typeExpectation: 'valid', sensitivityExpectation: 'non-sensitive', validator: { id: 'luhn', version: 1, expected: 'valid' }, contextGroup: null,
    collision: {
      target: { family: 'pii:us:ssn', jurisdiction: 'US', validator: { id: 'luhn', version: 1, expected: 'valid' } },
      competitors: [{ family: 'pii:global:email', jurisdiction: null, validator: { id: 'luhn', version: 1, expected: 'invalid' } }],
      expectedOutcomes: { family: 'wrong-family', jurisdiction: 'wrong-jurisdiction', sensitivity: 'non-sensitive' },
    }, provenance: generator('future-family-collision'),
  });
  return recommit(corpus);
}

const validationOptions = { canonical: false, familyDescriptors, consumerMap };

test('canonical evidence contract preserves all eight classes and maps explicitly onto six accounting axes', () => {
  assert.equal(piiBenignCollisionEvidence.entries.length, 0, 'no fake production collision or country rows');
  assert.deepEqual(piiBenignCollisionEvidence.classes.map(row => row.id), [
    'reserved-documentation', 'official-test', 'public-operational', 'ordinary-reference-account', 'near-miss', 'placeholder',
    'context-negative', 'cross-family-collision',
  ]);
  assert.deepEqual([...new Set(piiBenignCollisionEvidence.classes.flatMap(row => row.accountingAxes))], [...PII_CONTROL_CLASSES]);
  assert.deepEqual(piiBenignCollisionEvidence.classes.find(row => row.id === 'near-miss'), {
    id: 'near-miss', kind: 'mechanical-control', accountingAxes: [], qualifies: ['type-identity', 'validator'],
  });
  assert.deepEqual(piiBenignCollisionEvidence.reporting, {
    validatorCorrectness: 'evidence.validators', familyDiscrimination: 'metrics.wrong-family-rate',
    jurisdictionDiscrimination: 'metrics.wrong-jurisdiction-rate',
    sensitivity: ['metrics.sensitive-miss-rate', 'metrics.non-sensitive-flag-rate'],
  });
  assert.equal(piiBenignCollisionEvidence.contentCommitment, piiBenignCollisionCommitment(piiBenignCollisionEvidence));
});

test('future benign and collision rows are data-only and bind validator, context, family, and jurisdiction identities', () => {
  const corpus = validatePiiBenignCollisionEvidence(extension(), validationOptions);
  assert.equal(corpus.entries.length, 4);
  const independent = structuredClone(corpus);
  const collision = independent.entries.find(row => row.evidenceClass === 'cross-family-collision');
  collision.sensitivityExpectation = 'not-established';
  collision.collision.expectedOutcomes = { family: 'correct', jurisdiction: 'wrong-jurisdiction', sensitivity: 'not-established' };
  assert.doesNotThrow(() => validatePiiBenignCollisionEvidence(recommit(independent), validationOptions));
});

test('data-bound methods publish safe evidence identities and use their registered versions', async () => {
  const corpus = validatePiiBenignCollisionEvidence(extension(), validationOptions);
  const authority = [{ sourceKind: 'public-authority', sourceId: 'synthetic-public-authority', locator: 'https://example.invalid/pii-evidence', revision: '1',
    supports: ['lexical', 'validation', 'allocation', 'reserved-control', 'sensitivity'] }];
  const makeCase = (id, method, value, contract, metadata) => ({ id, method, visibility: 'development',
    input: { id, path: `pii/${id}.txt`, content: `value=${value}` }, candidate: { start: 6, end: 6 + Buffer.byteLength(value) },
    contract: { category: 'pii', displayName: 'Synthetic test identifier', identityDomain: 'national-id',
      typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'non-sensitive',
      context: { obligation: 'none', class: 'non-sensitive', language: 'en' }, authority, referenceEvidence: null,
      qualificationProfile: { id: 'pii-v1', version: 1 }, ...contract },
    provenance: { source: 'tests/pii-benign-collision-evidence.test.mjs', sourceHash: hash(id), seed: `${id}/1`,
      rationale: 'Reserved or deterministic synthetic evidence only.', sources: ['benchmark:test'] }, metadata });
  const benign = makeCase('future-context-negative', 'pii-benign', benignValue,
    { family: 'pii:global:email', scope: 'global', identityDomain: 'email', displayName: 'Email address' },
    { benignClass: 'context-negative', evidenceId: 'future-context-negative' });
  const collision = makeCase('future-family-collision', 'jurisdiction-collision', collisionValue,
    { family: 'pii:us:ssn', scope: 'jurisdiction:US' },
    { evidenceId: 'future-family-collision', collision: { targetFamily: 'pii:us:ssn', competingFamilies: ['pii:global:email'] } });
  const methods = piiDomain.createMethods(undefined, undefined, corpus);
  for (const source of [benign, collision]) {
    const method = methods.get(source.method), variants = method.generate(source);
    assert.ok(variants.every(variant => variant.transformation.methodVersion === method.version));
    assert.equal(variants[0].evidence.evidenceId, source.metadata.evidenceId);
    assert.doesNotMatch(JSON.stringify(variants[0].evidence), /reserved@example|TEST-COLLISION/);
  }
});

test('hostile class, raw, near-miss, context, validator, and collision mutations fail closed', () => {
  const committed = extension();
  const changed = structuredClone(committed); changed.classes[0].accountingAxes = ['public-operational'];
  assert.throws(() => validatePiiBenignCollisionEvidence(changed, validationOptions), /commitment/);
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(changed), validationOptions), /class or accounting-axis mapping/);
  const raw = structuredClone(committed); raw.entries[0].candidate = benignValue;
  assert.throws(() => validatePiiBenignCollisionEvidence(raw, validationOptions), /schema/);
  const nearMiss = structuredClone(committed); nearMiss.entries.find(row => row.evidenceClass === 'near-miss').sensitivityExpectation = 'non-sensitive';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(nearMiss), validationOptions), /validator\/type-only/);
  const context = structuredClone(committed); context.entries[0].contextGroup = 'ko-email-core';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(context), validationOptions), /context identity/);
  const validator = structuredClone(committed); validator.entries.find(row => row.evidenceClass === 'near-miss').validator.id = 'unknown-validator';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(validator), validationOptions), /unregistered validator/);
  const country = structuredClone(committed); const collision = country.entries.find(row => row.evidenceClass === 'cross-family-collision');
  collision.collision.competitors[0].family = 'pii:br:synthetic-id';
  collision.collision.competitors[0].jurisdiction = 'BR';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(country), validationOptions), /collision family\/jurisdiction/);
});
