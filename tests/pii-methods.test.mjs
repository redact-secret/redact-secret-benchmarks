import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

function piiCase(id, method, value, overrides = {}) {
  const prefix = 'value=';
  const base = {
    id, method, visibility: 'development', input: { id, path: `pii/${id}.txt`, content: `${prefix}${value}` },
    candidate: { start: Buffer.byteLength(prefix), end: Buffer.byteLength(prefix + value) },
    contract: { category: 'pii', family: 'pii:global:synthetic-id', displayName: 'Synthetic identifier', identityDomain: 'national-id', scope: 'global',
      typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'sensitive',
      context: { obligation: 'required-for-sensitive-classification', class: 'sensitive', language: 'en' },
      authority: [{ sourceKind: 'standard', sourceId: 'benchmark-pii-contract', locator: 'section:synthetic-method-tests', revision: '1',
        supports: ['lexical', 'validation', 'allocation', 'sensitivity'] }],
      referenceEvidence: null, qualificationProfile: { id: 'pii-v1', version: 1 } },
    provenance: { source: 'tests/pii-methods.test.mjs', sourceHash: hash({ id, value }), seed: `${id}/1`,
      rationale: 'Synthetic PII method test.', sources: ['benchmark:pii-methods'] }, metadata: {},
  };
  return { ...base, ...overrides, input: { ...base.input, ...overrides.input }, contract: { ...base.contract, ...overrides.contract,
    typeExpectation: { ...base.contract.typeExpectation, ...overrides.contract?.typeExpectation },
    context: { ...base.contract.context, ...overrides.contract?.context } },
    provenance: { ...base.provenance, ...overrides.provenance }, metadata: { ...base.metadata, ...overrides.metadata } };
}

const scanner = {
  id: 'pii-method-scanner', mode: 'candidate', configuration: { synthetic: true }, capabilities: { ranges: true, classification: true },
  async version() { return '1.0.0'; },
  async scan(_directory, inputs) {
    return inputs.flatMap(input => {
      if (input.path.includes('checksum-invalid') || input.path.includes('-mutated')) return [];
      const marker = input.content.includes('value=') ? 'value=' : 'value=';
      const start = Buffer.byteLength(input.content.slice(0, input.content.indexOf(marker) + marker.length));
      if (input.path.includes('collision')) return [{ path: input.path, start, end: Buffer.byteLength(input.content), family: 'pii:br:ordinary-numeric-id', jurisdiction: 'BR', sensitive: true }];
      return [{ path: input.path, start, end: Buffer.byteLength(input.content), family: 'pii:global:synthetic-id',
        sensitive: !input.path.includes('non-sensitive') && !input.path.includes('benign') }];
    });
  },
};

test('PII method registry is complete and context trio preserves type while changing sensitivity', () => {
  const methods = piiDomain.createMethods();
  assert.deepEqual(methods.values().map(method => method.id).sort(), [
    'context-discrimination', 'jurisdiction-collision', 'mutation', 'pii-benign', 'reference-differential', 'schema-only', 'type-validation',
  ]);
  const source = piiCase('context-source', 'context-discrimination', 'SYNTHETIC-0000');
  const variants = methods.get('context-discrimination').generate(source);
  assert.deepEqual(variants.map(v => v.contract.sensitivityExpectation), ['sensitive', 'not-established', 'non-sensitive']);
  assert.ok(variants.every(v => v.contract.typeExpectation.state === 'valid'));
  assert.equal(new Set(variants.map(v => Buffer.from(v.fixture.content).subarray(v.candidate.start, v.candidate.end).toString())).size, 1);
  assert.ok(variants.every(v => v.transformation.expectationEffect.type === 'preserve'));
});

test('validator invalid negatives remain distinct from benign semantic controls', async () => {
  const valid = piiCase('checksum-valid', 'type-validation', 'SYNTHETIC-0000',
    { contract: { typeExpectation: { validator: 'synthetic-mod10' } } });
  const invalid = piiCase('checksum-invalid', 'type-validation', 'SYNTHETIC-0001',
    { contract: { typeExpectation: { state: 'invalid', validator: 'synthetic-mod10' } } });
  const benign = piiCase('benign-documentation', 'pii-benign', 'SYNTHETIC-0000',
    { contract: { sensitivityExpectation: 'non-sensitive', context: { class: 'non-sensitive' } }, metadata: { benignClass: 'documentation' } });
  const artifact = await piiDomain.execute({ cases: [valid, invalid, benign], methods: piiDomain.createMethods(), scanners: [scanner] });
  const evidence = Object.fromEntries(artifact.results.map(result => [result.id, result.evidence]));
  assert.equal(evidence['checksum-valid'].validation.kind, 'validator');
  assert.equal(evidence['checksum-valid'].validation.state, 'valid');
  assert.deepEqual(Object.keys(evidence['checksum-valid'].validation).sort(), ['kind', 'state', 'validator', 'validatorVersion']);
  assert.equal(evidence['checksum-invalid'].validation.state, 'invalid');
  assert.equal(evidence['benign-documentation'].control.kind, 'semantic-control');
  assert.equal(evidence['benign-documentation'].control.controlClass, 'documentation');
  assert.equal(artifact.results.find(result => result.id === 'checksum-invalid').outcomes[0].typeIdentity.state, 'invalid-correct');
  assert.doesNotMatch(JSON.stringify(artifact), /SYNTHETIC-000[01]|"content"|fixtureHash|contentHash|"candidate":/);
});

test('context, collision, and mutation methods produce domain-owned non-vacuous evidence', async () => {
  const context = piiCase('context-run', 'context-discrimination', 'SYNTHETIC-0000');
  const collision = piiCase('collision-run', 'jurisdiction-collision', '123456789', {
    contract: { family: 'pii:us:tax-id', displayName: 'Synthetic US tax identifier', scope: 'jurisdiction:US' },
    metadata: { collision: { targetFamily: 'pii:us:tax-id', competingFamilies: ['pii:br:ordinary-numeric-id', 'pii:tr:tax-id'] } },
  });
  const mutation = piiCase('mutation-run', 'mutation', 'SYNTHETIC-0000',
    { contract: { typeExpectation: { validator: 'synthetic-mod10' } }, metadata: { operator: 'invalidate-final-digit' } });
  const artifact = await piiDomain.execute({ cases: [context, collision, mutation], methods: piiDomain.createMethods(), scanners: [scanner] });
  const contextResult = artifact.results.find(result => result.id === 'context-run');
  assert.equal(contextResult.outcomes.length, 3);
  assert.deepEqual(contextResult.outcomes.map(outcome => outcome.sensitivityContext.state), ['correct', 'unresolved', 'correct']);
  const collisionResult = artifact.results.find(result => result.id === 'collision-run');
  assert.deepEqual(collisionResult.evidence.collision, { kind: 'jurisdiction-collision', targetFamily: 'pii:us:tax-id',
    competingFamilies: ['pii:br:ordinary-numeric-id', 'pii:tr:tax-id'] });
  assert.equal(collisionResult.outcomes[0].typeIdentity.state, 'wrong-jurisdiction');
  const mutationResult = artifact.results.find(result => result.id === 'mutation-run');
  assert.equal(mutationResult.evidence.mutation.expectation.type, 'invalid');
  assert.deepEqual(Object.keys(mutationResult.evidence.mutation).sort(), ['expectation', 'kind', 'operator', 'operatorVersion']);
  assert.equal(mutationResult.variants[0].transformation.expectationEffect.type, 'invalidate');
  assert.equal(mutationResult.outcomes[0].typeIdentity.state, 'invalid-correct');
});

test('unavailable validator and reference evidence cannot become a vacuous pass', async () => {
  const unavailable = { id: 'unavailable-reference', version: 1, validate() { return { state: 'unavailable' }; } };
  const validators = piiDomain.createValidators([unavailable]);
  const typeCase = piiCase('validator-unavailable', 'type-validation', 'SYNTHETIC-0000',
    { contract: { typeExpectation: { validator: 'unavailable-reference' } } });
  const referenceCase = piiCase('reference-unavailable', 'reference-differential', 'SYNTHETIC-0000',
    { contract: { referenceEvidence: { id: 'unavailable-reference', version: 1 } } });
  const artifact = await piiDomain.execute({ cases: [typeCase, referenceCase], methods: piiDomain.createMethods(validators), scanners: [scanner] });
  assert.equal(artifact.typeIdentity.pass, 0);
  assert.equal(artifact.typeIdentity['not-measured'], 2);
  assert.ok(artifact.reviewQueue.some(row => row.reason.includes('validator was unavailable')));
  assert.ok(artifact.reviewQueue.some(row => row.reason.includes('Reference validator unavailable')));
  assert.equal(artifact.results.find(result => result.id === 'reference-unavailable').evidence.reference.role, 'observation-not-truth');
});

test('replay stability includes normalized PII sensitivity and jurisdiction fields', async () => {
  let replay = 0;
  const unstable = { ...scanner, id: 'unstable-pii-extras', async scan(_directory, inputs) {
    replay++;
    return inputs.map(input => ({ path: input.path, start: 6, end: Buffer.byteLength(input.content), family: 'pii:global:synthetic-id',
      jurisdiction: replay % 2 ? 'US' : 'BR', sensitive: replay % 2 === 1 }));
  } };
  const c = piiCase('replay-extras', 'pii-benign', 'SYNTHETIC-0000',
    { contract: { sensitivityExpectation: 'non-sensitive', context: { class: 'non-sensitive' } }, metadata: { benignClass: 'documentation' } });
  const artifact = await piiDomain.execute({ cases: [c], methods: piiDomain.createMethods(), scanners: [unstable] });
  assert.equal(artifact.scanners[0].status, 'unstable');
  assert.equal(artifact.typeIdentity['not-measured'], 1);
  assert.equal(artifact.sensitivityContext['not-measured'], 1);
});

test('hostile validator hooks cannot inject fields or out-of-enum states', async () => {
  const hostile = [
    { id: 'extra-validator', version: 1, validate() { return { state: 'valid', rawValue: 'RAW-VALIDATOR-SENTINEL' }; }, method: 'type-validation' },
    { id: 'enum-validator', version: 1, validate() { return { state: 'maybe-sensitive' }; }, method: 'reference-differential' },
    { id: 'boxed-validator', version: 1, validate() { return { state: new String('valid') }; }, method: 'type-validation' },
    { id: 'object-validator', version: 1, validate() { return { state: { toString: () => 'valid' } }; }, method: 'type-validation' },
  ];
  for (const entry of hostile) {
    const validators = piiDomain.createValidators([entry]);
    const c = piiCase(`${entry.id}-case`, entry.method, 'SYNTHETIC-0000', entry.method === 'type-validation'
      ? { contract: { typeExpectation: { validator: entry.id } } }
      : { contract: { referenceEvidence: { id: entry.id, version: 1 } } });
    await assert.rejects(() => piiDomain.execute({ cases: [c], methods: piiDomain.createMethods(validators), scanners: [scanner] }), error => {
      assert.match(error.message, /Invalid PII validator observation/);
      assert.doesNotMatch(error.message, /RAW-VALIDATOR-SENTINEL|maybe-sensitive/);
      return true;
    });
  }
});

test('hostile operator hooks cannot inject raw fields or invalid domain expectations', async () => {
  const hostile = [
    { id: 'extra-operator', version: 1, apply(c) { return { input: { ...c.input, rawValue: 'RAW-OPERATOR-SENTINEL' },
      candidate: { ...c.candidate }, expectation: { type: 'invalid', sensitivity: 'sensitive' } }; } },
    { id: 'enum-operator', version: 1, apply(c) { return { input: { ...c.input }, candidate: { ...c.candidate },
      expectation: { type: 'invalid', sensitivity: 'credential-secret' } }; } },
  ];
  for (const entry of hostile) {
    const operators = piiDomain.createOperators([entry]);
    const c = piiCase(`${entry.id}-case`, 'mutation', 'SYNTHETIC-0000', { metadata: { operator: entry.id } });
    await assert.rejects(() => piiDomain.execute({ cases: [c], methods: piiDomain.createMethods(undefined, operators), scanners: [scanner] }), error => {
      assert.match(error.message, /Invalid PII operator result/);
      assert.doesNotMatch(error.message, /RAW-OPERATOR-SENTINEL|credential-secret/);
      return true;
    });
  }
});
