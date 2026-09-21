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
