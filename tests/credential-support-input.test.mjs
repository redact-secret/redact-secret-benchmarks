import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateCredentialSupportInputs } from '../benchmarks/lib/current-credential-support.mjs';
const input = JSON.parse(readFileSync(new URL('../benchmarks/inputs/credential/support-bindings.json', import.meta.url)));
const expected = JSON.parse(readFileSync(new URL('../benchmarks/inputs/credential/support-bindings-index.json', import.meta.url)));
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
test('the current published legacy support binding validates with its separately reviewed index', () => {
  const records = validateCredentialSupportInputs(input, expected);
  assert.equal(records.length, 1);
  assert.equal(records[0].mode, 'published');
  assert.equal(records[0].data.publishedPackage.version, input.scope.publishedVersion);
});
test('recomputed self-hash cannot substitute a different result or product identity', () => {
  for (const mutate of [
    value => { value.records[0].data.distribution.stable += 1; },
    value => { value.records[0].data.publishedPackage.version = 'other'; value.scope.publishedVersion = 'other'; },
    value => { value.records[0].source.sha256 = 'a'.repeat(64); },
  ]) {
    const value = structuredClone(input); mutate(value);
    value.records[0].dataSha256 = sha(value.records[0].data);
    assert.throws(() => validateCredentialSupportInputs(value, expected), /reviewed source or registry binding mismatch/);
  }
});
test('even a review-shaped index does not license raw historical payload fields', () => {
  const value = structuredClone(input); value.records[0].data.families[0].rawText = 'synthetic';
  value.records[0].dataSha256 = sha(value.records[0].data);
  const syntheticIndex = { ...expected, registryCommitment: sha(value) };
  assert.throws(() => validateCredentialSupportInputs(value, syntheticIndex), /schema mismatch/);
});
