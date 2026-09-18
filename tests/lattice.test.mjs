import test from 'node:test';
import assert from 'node:assert/strict';
import { spanOutcome, scoreRow, aggregateGroups, bytesOutside, union, encodeOutcome } from '../benchmarks/lib/lattice.ts';
import { score } from '../benchmarks/lib/scoring.ts';

const span = { start: 10, end: 20, role: 'secret' };
const enveloped = { ...span, envelope: { start: 4, end: 26 } };
const f = (start, end) => ({ start, end });

test('interval helpers merge and subtract byte ranges', () => {
  assert.deepEqual(union([f(5, 8), f(1, 3), f(7, 10)]), [f(1, 3), f(5, 10)]);
  assert.equal(bytesOutside([f(0, 10)], [f(2, 4), f(6, 7)]), 7);
  assert.equal(bytesOutside([f(0, 10)], [f(0, 10)]), 0);
  assert.equal(bytesOutside([], [f(0, 10)]), 0);
});

test('every lattice cell: exact, covered, overbroad, partial, miss', () => {
  assert.equal(spanOutcome(span, [f(10, 20)]), 'EXACT');
  assert.equal(spanOutcome(enveloped, [f(10, 20)]), 'EXACT');
  assert.equal(spanOutcome(enveloped, [f(4, 26)]), 'COVERED');
  assert.equal(spanOutcome(enveloped, [f(8, 22)]), 'COVERED');
  assert.equal(spanOutcome(enveloped, [f(0, 30)]), 'OVERBROAD');
  assert.equal(spanOutcome(span, [f(9, 21)]), 'OVERBROAD', 'default envelope is the span itself');
  assert.equal(spanOutcome(span, [f(10, 15)]), 'PARTIAL');
  assert.equal(spanOutcome(span, [f(0, 10)]), 'MISS', 'touching at the boundary does not overlap');
  assert.equal(spanOutcome(span, []), 'MISS');
});

test('the lattice is monotone: exact beats covered beats overbroad regardless of extra findings', () => {
  assert.equal(spanOutcome(enveloped, [f(0, 30), f(10, 20)]), 'EXACT');
  assert.equal(spanOutcome(enveloped, [f(0, 30), f(6, 24)]), 'COVERED');
  assert.equal(spanOutcome(enveloped, [f(0, 30), f(10, 15)]), 'OVERBROAD');
});

test('two findings straddling one secret are PARTIAL and leaked even with zero uncovered bytes', () => {
  const row = scoreRow([span], [f(10, 15), f(15, 20)]);
  assert.deepEqual(row, { spanOutcomes: ['PARTIAL'], leakedBytes: 0, collateralBytes: 0 });
  const gap = scoreRow([span], [f(8, 14), f(16, 22)]);
  assert.deepEqual(gap, { spanOutcomes: ['PARTIAL'], leakedBytes: 2, collateralBytes: 4 });
  assert.equal(aggregateGroups([{ id: 'a', kind: 'must-redact', tier: 'T1', expected: [span], actual: [f(10, 15), f(15, 20)], ...row }])['must-redact/T1'].leakedSpans, 1);
});

test('a whole-file finding covers every secret but its collateral grows with the file', () => {
  const expected = [{ start: 5, end: 10, role: 'secret' }, { start: 20, end: 30, role: 'secret', envelope: { start: 18, end: 32 } }];
  const row = scoreRow(expected, [f(0, 100)]);
  assert.deepEqual(row, { spanOutcomes: ['OVERBROAD', 'OVERBROAD'], leakedBytes: 0, collateralBytes: 100 - 5 - 14 });
  const miss = scoreRow(expected, []);
  assert.deepEqual(miss, { spanOutcomes: ['MISS', 'MISS'], leakedBytes: 15, collateralBytes: 0 });
});

test('companion spans are never scored and their bytes are not collateral', () => {
  const expected = [{ start: 0, end: 4, role: 'companion' }, { start: 10, end: 20, role: 'secret' }];
  assert.deepEqual(scoreRow(expected, [f(0, 4), f(10, 20)]), { spanOutcomes: ['EXACT'], leakedBytes: 0, collateralBytes: 0 });
  assert.deepEqual(scoreRow([{ start: 0, end: 4, role: 'companion' }], [f(0, 4)]), { flagged: true, findings: 1 });
});

test('control rows only count findings; groups compute headline rates and twin discrimination', () => {
  const rows = [
    { id: 'p1', kind: 'must-redact', tier: 'T1', expected: [span], actual: [f(10, 20)], ...scoreRow([span], [f(10, 20)]) },
    { id: 'p2', kind: 'must-redact', tier: 'T1', expected: [enveloped], actual: [f(0, 30)], ...scoreRow([enveloped], [f(0, 30)]) },
    { id: 'p3', kind: 'must-redact', tier: 'T2', expected: [span], actual: [], ...scoreRow([span], []) },
    { id: 't1', kind: 'must-not-flag', tier: 'T2', twinOf: 'p1', expected: [], actual: [], ...scoreRow([], []) },
    { id: 't2', kind: 'must-not-flag', tier: 'T2', twinOf: 'p2', expected: [], actual: [f(0, 3)], ...scoreRow([], [f(0, 3)]) },
    { id: 'c1', kind: 'must-not-flag', tier: 'T3', expected: [], actual: [f(0, 3), f(5, 6)], ...scoreRow([], [f(0, 3), f(5, 6)]) },
    { id: 'z', kind: 'must-redact', tier: 'T0', expected: [span], actual: [f(0, 1)] },
    { id: 'q', kind: 'policy', tier: 'T3', expected: [span], actual: [f(10, 15)], ...scoreRow([span], [f(10, 15)]) },
  ];
  const groups = aggregateGroups(rows);
  assert.deepEqual(Object.keys(groups), ['must-not-flag/T2', 'must-not-flag/T3', 'must-redact/T1', 'must-redact/T2', 'pending/T0', 'policy/T3']);
  const t1 = groups['must-redact/T1'];
  assert.deepEqual([t1.files, t1.spans, t1.secretBytes, t1.leakedSpans, t1.leakedSpanRate, t1.leakedBytes, t1.collateralBytes], [2, 2, 20, 0, 0, 0, 8]);
  assert.equal(t1.collateralRatio, 0.4);
  assert.deepEqual(t1.outcomes, { EXACT: 1, COVERED: 0, OVERBROAD: 1, PARTIAL: 0, MISS: 0 });
  assert.deepEqual(t1.twins, { positives: 2, pairs: 2, discriminated: 1, rate: 0.5 });
  assert.deepEqual(t1.diagnostics, { exact: { tp: 1, fp: 1, fn: 1 }, comparable: false });
  assert.deepEqual(groups['must-redact/T2'].twins, { positives: 1, pairs: 0, discriminated: 0, rate: null });
  assert.equal(groups['must-redact/T2'].leakedSpanRate, 1);
  assert.deepEqual(groups['must-not-flag/T2'], { files: 2, flaggedFiles: 1, falseAlarmRate: 0.5, findings: 1, meanFindingsPerFlagged: 1, diagnostics: { exact: { fp: 1, tn: 1 }, comparable: false } });
  assert.deepEqual(groups['must-not-flag/T3'], { files: 1, flaggedFiles: 1, falseAlarmRate: 1, findings: 2, meanFindingsPerFlagged: 2, diagnostics: { exact: { fp: 2, tn: 0 }, comparable: false } });
  assert.deepEqual(groups['pending/T0'], { files: 1, scored: false });
  assert.equal(groups['policy/T3'].leakedBytes, 5);
  assert.ok(!JSON.stringify(groups).match(/precision|recall|"f1"/));
  assert.deepEqual(rows.map(encodeOutcome), ['EXACT', 'OVERBROAD', 'MISS', 'clean', 'flagged:1', 'flagged:2', 'observed:1', 'PARTIAL']);
});

test('score() deduplicates findings, keeps T0 rows unscored and never exports totals', () => {
  const fixture = { id: 'u', path: 'u.txt', group: 'g', content: '🔑 abc xyz\n', expected: [{ start: 5, end: 8, role: 'secret' }], assessment: { kind: 'must-redact', tier: 'T1' } };
  const hit = { path: 'u.txt', start: 5, end: 8 };
  const { rows, ...rest } = score([fixture], [hit, hit]);
  assert.deepEqual(rest, {});
  assert.deepEqual(rows[0].actual, [{ start: 5, end: 8 }]);
  assert.deepEqual(rows[0].spanOutcomes, ['EXACT']);
  assert.deepEqual(score([{ ...fixture, assessment: { kind: 'must-redact', tier: 'T0' } }], [hit]).rows[0].spanOutcomes, undefined);
  assert.throws(() => score([fixture], [{ path: 'missing', start: 0, end: 1 }]));
  assert.throws(() => score([fixture], [{ path: 'u.txt', start: 1, end: 4 }]), /Invalid normalized finding/);
});
