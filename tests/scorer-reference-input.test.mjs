import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateScorerReference, piiScorerReference } from '../benchmarks/evaluation/domains/pii/scorer-reference.mjs';
const input = JSON.parse(readFileSync(new URL('../benchmarks/inputs/pii/scorer-reference.json', import.meta.url)));

test('scorer projection carries each reviewed population and metric once with only consumed scalar inputs', () => {
  assert.ok(piiScorerReference.families.length > 0);
  for (const family of piiScorerReference.families) {
    assert.deepEqual(Object.keys(family).sort(), ['family', 'views']);
    const views = family.views.reviewed;
    assert.equal(new Set(views.map(row => row.view)).size, views.length);
    for (const view of views) {
      assert.equal(new Set(view.metrics.map(row => row.id)).size, view.metrics.length);
      assert.deepEqual(Object.keys(view.notEstablished).sort(), ['cases', 'falseAlarm']);
    }
  }
});

test('projection rejects changed counts, removed families, forged original source and self-rehashed edits', () => {
  for (const mutate of [
    value => value.data.families.pop(),
    value => value.data.families[0].views.reviewed[0].scoredCases++,
    value => value.source.sha256 = '0'.repeat(64),
    value => value.source.revision = '0'.repeat(40),
    value => value.source.path = 'evidence/unrelated.json',
    value => value.dataSha256 = '0'.repeat(64),
  ]) {
    const changed = structuredClone(input); mutate(changed);
    assert.throws(() => validateScorerReference(changed), /binding mismatch/);
  }
});
