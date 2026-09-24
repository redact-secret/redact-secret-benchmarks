import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { checkLexicalSeparability, validateLexicalExemptions } from '../benchmarks/lib/lexical-separability.ts';

// A minimal contract with a frozen pattern, independent of the real registry,
// so these tests exercise the checker's own rules rather than today's corpus.
const testContracts = { 'test-family': { tier: 'T1', pattern: '^tf_[a-z0-9]{8}$' } };
const positive = (overrides = {}) => ({
  id: 'test-family-positive', path: 'x', content: 'value="tf_abcd1234"\n', expected: [{ start: 7, end: 18, role: 'secret' }],
  group: 'g', assessment: { kind: 'must-redact', tier: 'T1', reason: 'r', sources: [], contract: 'test-family' }, ...overrides,
});
const negative = (content, overrides = {}) => ({
  id: 'test-family-negative', path: 'x', content, expected: [],
  group: 'g', assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family' }, ...overrides,
});

test('a deliberately introduced inseparable pair fails the check', () => {
  const violations = checkLexicalSeparability([positive(), negative('value="tf_abcd1234"\n')], testContracts);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].negativeId, 'test-family-negative');
  assert.equal(violations[0].examplePositiveId, 'test-family-positive');
});

test('a twin mutated outside the pattern is separable', () => {
  const violations = checkLexicalSeparability([positive(), negative('value="tf_abcd123"\n', { twinOf: 'test-family-positive', mutation: 'length: 7 vs contracted 8', mutationKind: 'length' })], testContracts);
  assert.equal(violations.length, 0);
});

test('a pattern match the contract\'s validate rejects (e.g. a failed checksum) is separable; one it accepts still collides', () => {
  const checksummed = { 'test-family': { ...testContracts['test-family'], validate: v => v.endsWith('4') } };
  assert.equal(checkLexicalSeparability([positive(), negative('value="tf_abcd1235"\n')], checksummed).length, 0);
  assert.equal(checkLexicalSeparability([positive(), negative('value="tf_abcd1235" value="tf_abcd1234"\n')], checksummed).length, 1);
});

test('a policy-kind positive never conflicts with a same-contract negative', () => {
  const p = positive({ assessment: { kind: 'policy', tier: 'T3', reason: 'r', sources: [], contract: 'test-family' } });
  const violations = checkLexicalSeparability([p, negative('value="tf_abcd1234"\n')], testContracts);
  assert.equal(violations.length, 0);
});

test('a negative scoped to a different contract never conflicts', () => {
  const n = negative('value="tf_abcd1234"\n', { assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'other-family' } });
  const violations = checkLexicalSeparability([positive(), n], testContracts);
  assert.equal(violations.length, 0);
});

test('a fully-formed token glued into a longer identifier is not flagged, unlike an isolated occurrence', () => {
  const embedded = checkLexicalSeparability([positive(), negative('legacy_tf_abcd1234_backup\n')], testContracts);
  assert.equal(embedded.length, 0);
  const isolated = checkLexicalSeparability([positive(), negative('(tf_abcd1234)\n')], testContracts);
  assert.equal(isolated.length, 1);
});

test('an exemption with a citation resolves the pair', () => {
  const n = negative('value="tf_abcd1234"\n', { assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family', lexicalExemption: { reason: 'Documented example vocabulary.', citation: 'https://example.invalid/docs' } } });
  assert.equal(checkLexicalSeparability([positive(), n], testContracts).length, 0);
  assert.doesNotThrow(() => validateLexicalExemptions([positive(), n], testContracts));
});

test('an exemption without a reason or citation fails validation', () => {
  const missingCitation = negative('value="tf_abcd1234"\n', { assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family', lexicalExemption: { reason: 'Documented.', citation: '' } } });
  assert.throws(() => validateLexicalExemptions([missingCitation], testContracts), /without a reason or citation/);
  const missingReason = negative('value="tf_abcd1234"\n', { assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family', lexicalExemption: { reason: '', citation: 'https://example.invalid' } } });
  assert.throws(() => validateLexicalExemptions([missingReason], testContracts), /without a reason or citation/);
});

test('a stale exemption on a fixture that no longer collides fails validation', () => {
  const n = negative('value="tf_zzzz"\n', { assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family', lexicalExemption: { reason: 'Documented.', citation: 'https://example.invalid' } } });
  assert.throws(() => validateLexicalExemptions([n], testContracts), /Unused lexical exemption/);
});

test('an exemption on a must-redact fixture fails validation', () => {
  const p = positive({ assessment: { kind: 'must-redact', tier: 'T1', reason: 'r', sources: [], contract: 'test-family', lexicalExemption: { reason: 'r', citation: 'https://example.invalid' } } });
  assert.throws(() => validateLexicalExemptions([p], testContracts), /non-control fixture/);
});

test('today\'s full generated corpus has zero unexplained lexically inseparable pairs', () => {
  const generated = buildCorpora();
  const fixtures = Object.values(generated).flatMap(c => c.fixtures);
  assert.doesNotThrow(() => validateLexicalExemptions(fixtures, contracts));
  assert.deepEqual(checkLexicalSeparability(fixtures, contracts), []);
});
