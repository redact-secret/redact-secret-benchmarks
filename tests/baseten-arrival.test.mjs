import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBasetenArrival, validateBasetenArrival, BASETEN_CONTRACT } from '../fixtures/generated/baseten-arrival.mjs';
import { scoreBasetenArrival, parseBasetenInputs } from '../benchmarks/baseten-arrival.ts';

test('independent provider grammar yields 6 positives, 14 structural twins and 8 benign siblings', () => {
  const rows = validateBasetenArrival(buildBasetenArrival());
  assert.equal(rows.filter(row => row.expected.length).length, 6);
  assert.equal(rows.filter(row => row.twinOf).length, 14);
  assert.equal(rows.filter(row => !row.expected.length && !row.twinOf).length, 8);
  assert.deepEqual(buildBasetenArrival(), rows);
  assert.match(BASETEN_CONTRACT.scope, /Earlier keys.*false negative/);
  assert.throws(() => validateBasetenArrival(rows.slice(1)), /invalid-baseten-corpus/);
});

test('shared scoring reports misses and false alarms instead of asserting candidate output', () => {
  const rows = buildBasetenArrival();
  const missed = scoreBasetenArrival(rows, []);
  assert.equal(missed.rows.filter(row => row.outcome === 'MISS').length, 6);
  const control = rows.find(row => row.id === 'id-only');
  const flagged = scoreBasetenArrival(rows, [{ path: control.path, start: 0, end: 8 }]);
  assert.equal(flagged.rows.find(row => row.fixtureId === control.id).outcome, 'flagged:1');
  assert.throws(() => scoreBasetenArrival(rows, [{ path: control.path, start: -1, end: 8 }]));
});

test('candidate preflight refuses missing or ambiguous identity inputs', () => {
  assert.throws(() => parseBasetenInputs([]), /invalid-baseten-inputs/);
  assert.throws(() => parseBasetenInputs(['--source-commit', 'main']), /invalid-baseten-inputs/);
});
