// Unit tests for the performance pair resolver (web/resolvers/performance.ts, #569).
// Synthetic runs only: no credentials, no filesystem reads by the code under test.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { axisFor, nearText, noisiest, peerOf, positionOn, resolvePerformancePanels, runToRunSpread, settingOf, SETTING_IDS, ticksFor, timeText } from '../../resolvers/performance.ts';

const obs = (tool, workload, median, min, max) => ({ tool, workload, workloadBytes: 131072, medianMs: median, p95Ms: max, medianBytesPerSecond: 131072 / (median / 1000), minMs: min, maxMs: max, samples: 12 });
const workloads = [
  { id: 'w1', domain: 'pii', question: 'Q1?', description: 'd1', lines: [{ label: 'l', values: [{ kind: 'email', family: 'pii:global:email' }, { kind: 'ip', family: 'pii:global:network-address' }] }] },
  { id: 'c1', domain: 'credentials', question: 'Q2?', description: 'd2', lines: [{ label: 'l', values: [{ kind: 'token' }] }] },
];
const outcomes = (hidden, changed = true) => ({ w1: [{ changed, valuesHidden: hidden, replacement: '' }], c1: [{ changed, valuesHidden: 1, replacement: '' }] });
function run(generatedAt, families, us, fr, or) {
  const all = [...us, ...fr, ...or];
  const outs = {};
  for (const tool of ['redact-secret', 'flare-redact', 'openredaction']) for (const w of ['w1', 'c1']) outs[`${tool}/${w}`] = outcomes(tool === 'redact-secret' && !families.length ? 0 : 2, tool !== 'redact-secret' || families.length > 0)[w];
  return {
    state: 'measured', generatedAt, runner: { platform: 'linux', arch: 'x64', node: 'v22.0.0', cpuModel: 'Test CPU', cpuLimit: 4 },
    tools: [], families, activation: 'x', methodologyNotes: ['A note.'], observations: all, outcomes: outs, samplesPerCell: 12, commitment: 'c', path: 'p',
  };
}
const tools = [
  { id: 'redact-secret', package: '@redact-secret/core', call: 'scanAndRedact', async: false, piiSelectors: [], version: '0.1.0', buildKind: 'local-source-build' },
  { id: 'flare-redact', package: 'flare-redact', call: 'redact', async: false, piiSelectors: [], version: '1.6.1', buildKind: 'published-npm-package' },
  { id: 'openredaction', package: '@openredaction/core', call: 'detect', async: true, piiSelectors: [], version: '1.1.5', buildKind: 'published-npm-package' },
];
const fr = (a, b) => [obs('flare-redact', 'w1', a, a - 0.2, a + 0.5), obs('flare-redact', 'c1', b, b - 0.2, b + 0.5)];
const or = (a, b) => [obs('openredaction', 'w1', a, a - 5, a + 5), obs('openredaction', 'c1', b, b - 5, b + 5)];
const us = (a, b) => [obs('redact-secret', 'w1', a, a - 0.1, a + 0.1), obs('redact-secret', 'c1', b, b - 0.1, b + 0.1)];
function runtime(settings) {
  return { tools, workloads: [], warmupSamples: 2, measurement: { state: 'not-published', reason: 'r' }, comparison: { planId: 'p', lineCount: 512, workloads, settings } };
}
const setting = (id, label, r) => ({ id, label, sub: '', selectors: [], run: r });
const full = runtime([
  setting('default', 'Default', run('2026-09-30T10:00:00Z', [], us(7, 800), fr(8, 14), or(700, 1700))),
  setting('pii-global', 'PII', run('2026-09-30T10:01:00Z', ['pii:global:email'], us(300, 800), fr(8.4, 14.1), or(710, 1710))),
  setting('pii-global-us', 'PII + US', run('2026-09-30T10:02:00Z', ['pii:global:email', 'pii:global:network-address'], us(9, 801), fr(8.2, 14), or(705, 1720))),
]);
const ownMissing = { state: 'not-published', reason: 'absent' };

test('the URL picks a pair and a setting, and anything else falls back to the defaults', () => {
  assert.equal(peerOf('openredaction'), 'openredaction');
  assert.equal(peerOf('gitleaks'), 'flare-redact');
  assert.equal(peerOf(null), 'flare-redact');
  assert.equal(settingOf('default'), 'default');
  assert.equal(settingOf('nope'), 'pii-global-us');
  assert.deepEqual([...SETTING_IDS], ['default', 'pii-global', 'pii-global-us']);
});

test('one panel per pair and setting, each from its own run (the same-run rule)', () => {
  const panels = resolvePerformancePanels(full, ownMissing);
  assert.deepEqual(panels.map(p => p.key), ['flare-redact-default', 'flare-redact-pii-global', 'flare-redact-pii-global-us', 'openredaction-default', 'openredaction-pii-global', 'openredaction-pii-global-us']);
  const time = (panel, caseId, side) => panel.props.measured.groups.flatMap(g => g.cases).find(c => c.id === caseId)[side].time;
  assert.equal(time(panels[0], 'w1', 'a'), '7.0 ms');
  assert.equal(time(panels[0], 'w1', 'b'), '8.0 ms');
  assert.equal(time(panels[1], 'w1', 'a'), '300 ms');
  assert.equal(time(panels[1], 'w1', 'b'), '8.4 ms', 'the peer time is the one from the same run, not another setting');
  assert.equal(time(panels[5], 'c1', 'b'), '1,720 ms');
});

test('sides are drawn alike: same fields, same number of lines, a before b', () => {
  const p = resolvePerformancePanels(full, ownMissing)[0].props;
  assert.equal(p.sides.length, 2);
  assert.deepEqual(Object.keys(p.sides[0]).sort().filter(k => k !== 'chip'), Object.keys(p.sides[1]).sort().filter(k => k !== 'chip'));
  assert.equal(p.sides[0].lines.length, p.sides[1].lines.length);
  assert.equal(p.sides[0].chip, 'local build · unreleased');
});

test('no ratio, no ordering by time and no verdict words appear in the resolved text', () => {
  const text = JSON.stringify(resolvePerformancePanels(full, ownMissing).map(p => p.props));
  assert.doesNotMatch(text, /fastest|slowest|faster|slower|\bbest\b|worst|winner|better|\bcaught\b|\bmissed\b|\bshould\b|\bcorrect\b|\d\s?×/i);
  for (const p of resolvePerformancePanels(full, ownMissing)) {
    const ids = p.props.measured.groups.flatMap(g => g.cases.map(c => c.id));
    assert.deepEqual(ids, ['w1', 'c1'], 'plan order, nothing dropped');
  }
});

test('the axis holds every recorded time and positions are log fractions', () => {
  const runs = full.comparison.settings.map(s => s.run);
  const axis = axisFor(runs);
  assert.deepEqual(axis, { lo: 0, hi: 4 });
  assert.equal(positionOn(axis, 1), 0);
  assert.equal(positionOn(axis, 100), 0.5);
  assert.equal(positionOn(axis, 10000), 1);
  assert.deepEqual(ticksFor(axis).map(t => t.label), ['1 ms', '10 ms', '100 ms', '1 s', '10 s']);
  assert.equal(timeText(1775.4), '1,775 ms');
  assert.equal(timeText(3.84), '3.8 ms');
});

test('noise is the recorded movement of the same peer call between runs', () => {
  assert.ok(Math.abs(runToRunSpread(full.comparison, 'flare-redact', 'w1') - (8.4 - 8) / 8) < 1e-9);
  assert.equal(noisiest(full.comparison, 'flare-redact').workload, 'w1');
  const one = runtime([setting('default', 'Default', run('2026-09-30T10:00:00Z', [], us(7, 800), fr(8, 14), or(700, 1700)))]);
  assert.equal(runToRunSpread(one.comparison, 'flare-redact', 'w1'), undefined);
  const p = resolvePerformancePanels(one, ownMissing)[0].props;
  assert.match(p.first.items.join(' '), /Only one run is committed/);
});

test('two times whose ranges overlap, or that sit inside the noise, are not read as different', () => {
  const cmp = runtime([
    setting('default', 'Default', run('t', [], [obs('redact-secret', 'w1', 10, 9, 12), obs('redact-secret', 'c1', 100, 99, 101)], [obs('flare-redact', 'w1', 11, 10, 13), obs('flare-redact', 'c1', 104, 103, 105)], [])),
    setting('pii-global', 'PII', run('t', [], [], [obs('flare-redact', 'w1', 11, 10, 13), obs('flare-redact', 'c1', 120, 119, 121)], [])),
  ]).comparison;
  const r = cmp.settings[0].run;
  assert.match(nearText(cmp, r, 'flare-redact', 'w1'), /ranges overlap/);
  assert.match(nearText(cmp, r, 'flare-redact', 'c1'), /closer than flare-redact moved between runs/);
  const far = run('t', [], [obs('redact-secret', 'w1', 10, 9, 11)], [obs('flare-redact', 'w1', 50, 49, 51)], []);
  assert.equal(nearText(cmp, far, 'flare-redact', 'w1'), undefined);
});

test('a value the setting does not switch on says so next to the count', () => {
  const p = resolvePerformancePanels(full, ownMissing)[0].props;
  const c = p.measured.groups[0].cases[0];
  assert.match(c.a.did, /Hid 0 of 2 values: this setting has none of them switched on/);
  assert.equal(c.b.did, 'Hid 2 of 2 values');
});

test('a pair with no shared measurement is a stated "Not measured yet", and the rest of the page stays', () => {
  const noOr = runtime([setting('default', 'Default', run('t', [], us(7, 800), fr(8, 14), []))]);
  const panels = resolvePerformancePanels(noOr, ownMissing);
  const or = panels.find(p => p.key === 'openredaction-default').props;
  assert.equal(or.measured, undefined);
  assert.equal(or.empty.title, 'Not measured yet');
  assert.match(or.empty.text, /no shared measurement/);
  assert.ok(or.gaps.groups.length > 0 && or.method.items.length > 0);
  const missing = panels.find(p => p.key === 'flare-redact-pii-global').props;
  assert.match(missing.empty.text, /^.* /);
  assert.equal(resolvePerformancePanels({ ...full, comparison: undefined }, ownMissing)[0].props.empty.title, 'Not measured yet');
});

test('redact-secret on its own is node rows only, never drawn on the pair axis, without a peer field', () => {
  const own = {
    state: 'measured', sourceCommit: 'abcdef0123456789', repetitions: 5, summaryPath: 'p', runner: { cpuModel: 'X', logicalCpus: 4, image: 'i' },
    rows: [
      { surface: 'node', profileId: 'scale-logs-small-whole', dispatch: 'One-shot scan', dispatchDetail: '', processingMedianMs: 2.22, processingP95Ms: 2.3, processingMinMs: 2.1, processingMaxMs: 2.3, throughputMedianBytesPerSecond: 29.5e6, samples: 5, resolvedArtifact: 'node-addon', runtime: 'node-22' },
      { surface: 'cli', profileId: 'scale-logs-small-whole', dispatch: 'Per-line', dispatchDetail: '', processingMedianMs: 4.9, processingP95Ms: 5, processingMinMs: 4.8, processingMaxMs: 5, throughputMedianBytesPerSecond: 13e6, samples: 5, resolvedArtifact: null, runtime: 'rustc' },
    ],
  };
  const p = resolvePerformancePanels(full, own)[0].props.own;
  assert.deepEqual(p.rows.map(r => r.id), ['node-scale-logs-small-whole']);
  assert.equal(p.rows[0].median, '2.2 ms');
  assert.equal(p.rows[0].speed, '29.5 MB/s');
  assert.equal('other' in p, false);
  const gaps = resolvePerformancePanels(full, own)[0].props.gaps.groups;
  assert.ok(gaps.find(g => g.id === 'pieces').links.some(l => l.href.endsWith('/benchmarks/inputs/performance/current.json')));
  assert.ok(gaps.find(g => g.id === 'shape').links.some(l => l.href.endsWith('runtime-comparison-default.json')));
  assert.doesNotMatch(gaps.find(g => g.id === 'hard').reason, /product times/);
  assert.ok(gaps.every(g => g.links.some(l => l.href.endsWith('/credential-eval/issues/68'))));
  assert.equal(resolvePerformancePanels(full, ownMissing)[0].props.gaps.groups.find(g => g.id === 'pieces').links.some(l => l.href.endsWith('/benchmarks/inputs/performance/current.json')), false);
  assert.match(p.apart, /not set beside those times/);
  assert.match(p.source, /abcdef012345/);
  assert.match(resolvePerformancePanels(full, ownMissing)[0].props.own.empty, /absent/);
});
