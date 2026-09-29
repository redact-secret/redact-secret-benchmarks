import test from 'node:test';
import assert from 'node:assert/strict';
import { splitRows, summarizeActionSplit, compareActionSplit } from '../benchmarks/lib/untargeted-action-split.ts';

const row = (id, actions, group = 'realworld-config') => ({ id, group, kind: 'must-not-flag', flagged: actions !== undefined, findings: actions ? Object.values(actions).reduce((a, b) => a + b, 0) || 1 : 0,
  ...(actions && Object.keys(actions).length ? { actionCounts: actions } : {}), actual: actions ? [{ start: 0, end: 4, family: 'generic-token' }] : [] });

test('a flagged file is gating on any redact/block finding, warn-only otherwise, action-unknown without actions', () => {
  const s = splitRows([row('clean'), row('w', { warn: 2 }), row('r', { warn: 1, redact: 1 }), row('b', { block: 1 }), row('peer', {})]);
  assert.deepEqual({ controls: s.controls, clean: s.clean, flagged: s.flagged, gating: s.gating, warnOnly: s.warnOnly, actionUnknown: s.actionUnknown },
    { controls: 5, clean: 1, flagged: 4, gating: 2, warnOnly: 1, actionUnknown: 1 });
  assert.deepEqual(s.findingsByAction, { warn: 3, redact: 1, block: 1 });
  assert.deepEqual(s.flaggedFixtures.map(f => f.id), ['w', 'r', 'b', 'peer']);
  assert.ok(!JSON.stringify(s).includes('content'));
});

test('subsets split on the frozen manifest, and movement is classified by action class', () => {
  const frozen = { id: 'f', digest: 'd', fixtures: [{ id: 'one' }, { id: 'two' }] };
  const report = rows => ({ scanners: [{ id: 'redact-secret', rows }] });
  const before = summarizeActionSplit(report([row('one'), row('two', { warn: 1 }), row('three', { redact: 1 })]), frozen);
  const after = summarizeActionSplit({ ...report([row('one', { redact: 1 }), row('two'), row('three', { redact: 1 })]), candidate: { sourceCommit: 'c'.repeat(40) } }, frozen);
  assert.equal(before.mode, 'published');
  assert.equal(after.mode, 'candidate');
  assert.equal(before.scanners[0].subsets.frozen.controls, 2);
  assert.equal(before.scanners[0].subsets.added.controls, 1);
  assert.equal(before.scanners[0].subsets.full.gating, 1);
  const [cmp] = compareActionSplit(before, after);
  assert.deepEqual(cmp.regressions, [{ id: 'one', before: 'clean', after: 'gating' }]);
  assert.deepEqual(cmp.improvements, [{ id: 'two', before: 'warn-only', after: 'clean' }]);
});
