import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportTree, peerObservation, reportHierarchy } from '../src/pages/report-hierarchy.ts';

const taxonomy = {
  schemaVersion: 1, sourceNote: 'test',
  providers: [{ id: 'one', name: 'Provider One' }, { id: 'two', name: 'Provider Two' }],
  families: [
    { id: 'one:alpha', provider: 'one', name: 'Alpha', description: '', detectors: [] },
    { id: 'two:beta', provider: 'two', name: 'Beta', description: '', detectors: [] },
    { id: 'generic:token', provider: null, name: 'Generic token', description: '', detectors: [] },
  ],
};
const fixture = (id, familyIds, extra = {}) => ({
  id, slug: `suite--${id}`, category: 'suite', path: `${id}.txt`, group: 'test', content: id, expected: [], detectors: [],
  assessment: { kind: 'must-redact', tier: 'T1', reason: 'test', sources: [] }, scenarioIds: ['scenario'], familyIds,
  provenance: { categoryId: 'suite' }, ...extra,
});
const fixtures = [
  fixture('single', ['one:alpha']),
  fixture('multi', ['two:beta', 'one:alpha']),
  fixture('global', [], { unscopedReason: 'global benchmark control', assessment: { kind: 'must-not-flag', tier: 'T1', reason: 'test', sources: [] } }),
  fixture('generic', ['generic:token']),
];
const rows = [
  { id: 'single', path: 'single.txt', group: 'test', kind: 'must-redact', tier: 'T1', expected: [], actual: [], spanOutcomes: ['MISS'] },
  { id: 'multi', path: 'multi.txt', group: 'test', kind: 'must-redact', tier: 'T1', expected: [], actual: [], spanOutcomes: ['OVERBROAD', 'PARTIAL'] },
  { id: 'global', path: 'global.txt', group: 'test', kind: 'must-not-flag', tier: 'T1', expected: [], actual: [], flagged: true, findings: 2 },
  { id: 'generic', path: 'generic.txt', group: 'test', kind: 'must-redact', tier: 'T1', expected: [], actual: [], spanOutcomes: ['EXACT'] },
];
const reports = [{ category: 'suite', scanners: [
  { id: 'product', name: 'Product', status: 'complete', rows },
  { id: 'peer', name: 'Peer', status: 'unavailable' },
] }];

test('Report hierarchy assigns every fixture to one deterministic display bucket', () => {
  const tree = buildReportTree(fixtures, reports, taxonomy);
  assert.equal(tree.leaves.length, fixtures.length);
  assert.deepEqual(tree.scanners.map(scanner => scanner.id), ['product', 'peer']);
  const displayed = tree.providers.flatMap(provider => provider.families.flatMap(family => family.leaves.map(leaf => leaf.fixture.slug)));
  assert.deepEqual(displayed.sort(), fixtures.map(entry => entry.slug).sort());
  assert.equal(new Set(displayed).size, displayed.length);
  const special = tree.providers.find(provider => provider.special);
  assert.deepEqual(special.families[0].leaves.map(leaf => leaf.fixture.id), ['multi', 'global']);
  assert.equal(tree.providers.at(-1), special, 'global/multi-family is stable and last');
  assert.equal(tree.providers.find(provider => provider.name === 'Not provider-specific').families[0].leaves[0].fixture.id, 'generic');
  assert.match(tree.leaves.find(leaf => leaf.fixture.id === 'single').search, /provider one/);
  assert.match(tree.leaves.find(leaf => leaf.fixture.id === 'multi').search, /provider one.*provider two|provider two.*provider one/);
  const reversed = buildReportTree([{ ...fixtures[1], familyIds: [...fixtures[1].familyIds].reverse() }], reports, taxonomy);
  assert.equal(reversed.providers[0].key, 'global-multi-family', 'multi-family order never chooses a first family');
});

test('Report hierarchy tallies observational axes per scanner without treating unavailable as zero', () => {
  const tree = buildReportTree(fixtures, reports, taxonomy);
  const byId = new Map(tree.leaves.map(leaf => [leaf.fixture.id, leaf]));
  assert.deepEqual(byId.get('single').axes[0], { readable: 1, overbroad: 0, falseAlarm: 0, notMeasured: 0 });
  assert.deepEqual(byId.get('multi').axes[0], { readable: 1, overbroad: 1, falseAlarm: 0, notMeasured: 0 });
  assert.deepEqual(byId.get('global').axes[0], { readable: 0, overbroad: 0, falseAlarm: 1, notMeasured: 0 });
  assert.ok(tree.leaves.every(leaf => leaf.axes[1].notMeasured === 1));
  assert.equal(tree.leaves.filter(leaf => leaf.signal).length, 3);
  const html = reportHierarchy(fixtures, reports, 'Rows', taxonomy);
  assert.match(html, /Peer<\/b> 0 readable\/missed · 0 too much · 0 false alarms · 2 not measured/, 'special bucket recounts its exact two unavailable peer leaves');
  assert.equal((html.match(/data-report-leaf/g) ?? []).length, fixtures.length);
  assert.match(html, /href="\/fixture\/suite--multi"/);
  assert.match(html, /href="\/coverage\/one:alpha"/);
  assert.match(html, /Families:.*Alpha.*Beta/, 'relationship links use taxonomy order, never source array order');
  assert.match(html, /Flagged ×2/);
});

test('Report hierarchy fails closed on missing, unknown, or duplicate semantic membership', () => {
  assert.throws(() => buildReportTree([{ ...fixtures[0], familyIds: undefined }], reports, taxonomy), /semantic index is missing/);
  assert.throws(() => buildReportTree([{ ...fixtures[0], familyIds: ['missing:family'] }], reports, taxonomy), /unknown family/);
  assert.throws(() => buildReportTree([fixtures[0], fixtures[0]], reports, taxonomy), /duplicate fixture slugs/);
  assert.match(reportHierarchy([{ ...fixtures[0], familyIds: undefined }], reports, 'Rows', taxonomy), /cannot be used/);
});

test('#336 peer provenance distinguishes reused snapshots from fresh observations', () => {
  const snapshot = [{ category: 'suite', scanners: [{ id: 'peer', name: 'Peer', status: 'complete', rows: [], observation: {
    source: 'snapshot', observedAt: '2026-09-25T12:00:00.000Z', sourceRunId: 'source-run-123', snapshotDigest: 'a'.repeat(64), inputDigest: 'b'.repeat(64),
  } }] }];
  const reused = peerObservation('peer', snapshot);
  assert.match(reused, /Reused peer observations/);
  assert.match(reused, /source run source-run-123/);
  assert.match(reused, /snapshot <code>aaaaaaaaaaaa/);
  assert.match(reused, /input <code>bbbbbbbbbbbb/);
  assert.ok(!reused.includes('fresh'));
  const fresh = structuredClone(snapshot); fresh[0].scanners[0].observation = { source: 'fresh', observedAt: '2026-09-26T12:00:00.000Z', sourceRunId: 'current-run' };
  assert.match(peerObservation('peer', fresh), /Observed fresh in run current-ru/);
  assert.equal(peerObservation('peer', reports), '', 'legacy reports never receive an invented freshness claim');
});
