import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePiiPeerReadiness } from '../benchmarks/evaluation/domains/pii/peer-readiness.mjs';

const inventory = JSON.parse(readFileSync(new URL('../benchmarks/pii-peer-readiness-v1.json', import.meta.url), 'utf8'));

test('the reviewed peer inventory records missing accuracy and keeps each authored population separate', () => {
  const accepted = validatePiiPeerReadiness(inventory);
  assert.equal(accepted.measurementState, 'not-measured');
  assert.equal(accepted.supportClaims, false);
  assert.equal(new Set(accepted.populations.map(row => row.populationId)).size, accepted.populations.length);
  assert.ok(accepted.peers.every(row => row.adapterState === 'unavailable' && row.accuracyState === 'not-measured'));
  assert.notEqual(accepted, inventory);
});

test('runtime counts, support promotion, missing expectations and invented adapters cannot enter a readiness record', () => {
  for (const mutate of [
    value => { value.supportClaims = true; },
    value => { value.measurementState = 'measured'; },
    value => { value.peers[0].accuracyState = 'measured'; },
    value => { value.peers[0].adapterState = 'ready'; },
    value => { value.peers[0].counts = { hidden: 5 }; },
    value => { value.peers[0].required.pop(); },
    value => { value.expectationRules.pop(); },
    value => { value.populations[0].populationDigest = 'unknown'; },
    value => { value.populations[1] = value.populations[0]; },
    value => { value.reviewedEvaluator.raw = 'scanner-output'; },
  ]) {
    const bad = structuredClone(inventory); mutate(bad);
    assert.throws(() => validatePiiPeerReadiness(bad), /Invalid PII peer readiness/);
  }
});
