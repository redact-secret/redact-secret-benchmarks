import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkKnownGapsCurrency, knownGapsCurrencyProblems } from '../scripts/check-known-gaps-currency.mjs';

const registry = { scanners: [{ id: 'redact-secret', package: '@redact-secret/core', version: '1.2.3' }] };
const archive = { source: { ciRun: '42' } };
const gaps = (over = {}) => ({ reviewedAt: '2026-01-10', measuredVersion: '1.2.3', issues: [{ history: { observed: { at: '2026-01-02' }, fixed: { at: '2026-01-09' } } }], ...over });

test('the committed ledger header is current', () => {
  assert.deepEqual(checkKnownGapsCurrency(), []);
});

test('a current header has no problem', () => assert.deepEqual(knownGapsCurrencyProblems(gaps(), registry, archive), []));

test('a record advanced after reviewedAt is stale', () => {
  const problems = knownGapsCurrencyProblems(gaps({ issues: [{ history: { fixed: { at: '2026-01-11' } } }] }), registry, archive);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /after reviewedAt/);
});

test('a measuredVersion that is not the accepted run\'s product release is stale', () => {
  const problems = knownGapsCurrencyProblems(gaps({ measuredVersion: '1.2.2' }), registry, archive);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not the release the accepted official run scanned/);
});

test('a reverification must name the accepted product and run and not postdate the review', () => {
  const reverification = { checkedOn: '2026-01-10', run: 'https://example.test/runs/42', product: '@redact-secret/core@1.2.3' };
  assert.deepEqual(knownGapsCurrencyProblems(gaps({ reverification }), registry, archive), []);
  assert.equal(knownGapsCurrencyProblems(gaps({ reverification: { ...reverification, product: '@redact-secret/core@1.2.2' } }), registry, archive).length, 1);
  assert.equal(knownGapsCurrencyProblems(gaps({ reverification: { ...reverification, run: 'https://example.test/runs/41' } }), registry, archive).length, 1);
  assert.equal(knownGapsCurrencyProblems(gaps({ reverification: { ...reverification, checkedOn: '2026-01-11' } }), registry, archive).length, 1);
});

test('a malformed reviewedAt is refused', () => assert.ok(knownGapsCurrencyProblems(gaps({ reviewedAt: 'yesterday' }), registry, archive).length >= 1));
