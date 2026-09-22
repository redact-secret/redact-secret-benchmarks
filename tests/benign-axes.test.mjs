import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { AXES, REAL_WORLD_AXES } from '../benchmarks/lib/assessment.ts';

const operators = createOperators();
const benign = (await loadCases(operators)).filter(c => c.method === 'benign');

test('every benign case has a single-source, in-vocabulary axis: AXES (#91) or REAL_WORLD_AXES (#95)', () => {
  assert.ok(benign.length > 0);
  for (const c of benign) {
    assert.ok(c.taxonomy, c.id);
    assert.ok(AXES.includes(c.taxonomy) || REAL_WORLD_AXES.includes(c.taxonomy), `${c.id}: ${c.taxonomy}`);
  }
});

test('detector-coverage — the category the pre-#91 bug mislabelled 156 of 274 controls as "documentation" — now spans at least 3 distinct axes', () => {
  const detectorCoverage = benign.filter(c => c.source.category === 'detector-coverage');
  assert.ok(detectorCoverage.length > 0);
  const axes = new Set(detectorCoverage.map(c => c.taxonomy));
  assert.ok(axes.size >= 3, `detector-coverage axes: ${[...axes].join(', ')}`);
  assert.ok(!axes.has('pending'), 'every detector-coverage control is reviewed, none should be pending');
});

test('#125: aws-access-key, github-token and slack-token each carry a third, distinct benign axis, derived by controlAxis from the reference control', () => {
  for (const family of ['aws-access-key', 'github-token', 'slack-token']) {
    const own = benign.filter(c => c.targets.includes(family));
    const axes = new Set(own.map(c => c.taxonomy));
    assert.ok(axes.size >= 3, `${family}: ${[...axes].join(', ')}`);
    const reference = own.find(c => c.source.category === 'detector-coverage' && c.source.fixtureId === `${family}-reference`);
    assert.equal(reference?.taxonomy, 'reference', `${family}-reference should land on the reference axis`);
    assert.ok(axes.has('near-miss') && axes.has('placeholder'), `${family}: the two pre-existing axes stay`);
  }
});
