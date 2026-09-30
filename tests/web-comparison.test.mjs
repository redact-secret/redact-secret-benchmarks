// Unit tests for the /comparison resolvers (#557). Synthetic data only: no credentials,
// no filesystem reads by the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHub, resolveFeaturePage, resolveRuntimePanels, milliseconds, megabytesPerSecond, kibibytes, activeFamilies,
  analysisOf, domainOf, viewOf, featureFilterOf, featureFilterString,
} from '../web/resolvers/comparison.ts';
import { featureClaimsProblem } from '../web/services/features.ts';

const tools = [
  { id: 'redact-secret', package: '@redact-secret/core', call: 'scanAndRedact', async: false, piiSelectors: ['pii:global'], version: '9.9.9', buildKind: 'local-source-build', piiActivation: 'credentials=full;selectors=pii:global;families=pii:global:email,pii:global:network-address' },
  { id: 'flare-redact', package: 'flare-redact', call: 'redact', async: false, piiSelectors: [], version: '1.0.0', buildKind: 'published-npm-package' },
  { id: 'openredaction', package: '@openredaction/core', call: 'detect', async: true, piiSelectors: [], version: '2.0.0', buildKind: 'published-npm-package' },
];
const workloads = [
  { id: 'validator-heavy', purpose: 'p1', distinctLines: 8, lineCount: 4096 },
  { id: 'brand-new-workload', purpose: 'a purpose', distinctLines: 7, lineCount: 4096 },
];
const obs = (tool, workload, medianMs, bps) => ({ tool, workload, workloadBytes: 94720, medianMs, p95Ms: medianMs, medianBytesPerSecond: bps });
const measured = {
  state: 'measured', generatedAt: '2026-01-02T03:04:05Z', runner: { platform: 'linux', arch: 'x64', node: 'v22' }, methodologyNotes: ['note one'],
  observations: [obs('redact-secret', 'validator-heavy', 45.946, 2061487), obs('flare-redact', 'validator-heavy', 4.04, 22472838), obs('openredaction', 'validator-heavy', 1087.2, 148243)],
  samplesPerCell: 12, commitment: 'x', path: 'p',
};
const runtime = { tools, workloads, warmupSamples: 2, measurement: measured };
const notRun = { state: 'not-published', reason: 'none' };
const EXTERNAL_PII = ['external-pii-all', 'external-pii-speed', 'external-pii-accuracy'];

test('runtime times are formatted in the resolver: one decimal under 100 ms, whole above', () => {
  assert.equal(milliseconds(6.94), '6.9');
  assert.equal(milliseconds(307.4), '307');
  assert.equal(milliseconds(1087.2), '1,087');
  assert.equal(megabytesPerSecond(2061487), '2.1');
  assert.equal(kibibytes(94720), '92.5 KiB');
});

test('runtime panels: one per reachable switch state, times from the snapshot, outcomes stated as not recorded', () => {
  const panels = resolveRuntimePanels(runtime);
  assert.deepEqual(panels.map(p => p.key), [...EXTERNAL_PII, 'internal-pii', 'internal-credentials', 'external-credentials']);
  const q = panels[0].props.questions;
  assert.equal(q[0].timing['redact-secret'].medianMs, '45.9');
  assert.equal(q[0].timing.openredaction.medianMs, '1,087');
  assert.equal(q[0].size, '92.5 KiB');
  assert.equal(q[0].repeat, 'each line repeated 512 times');
  assert.equal(q[0].outcomesRecorded, false);
  assert.deepEqual(q[0].rows, []);
  // A workload with no observation is null (Not measured), never zero; an unknown workload keeps its id and purpose.
  assert.equal(q[1].timing['redact-secret'], null);
  assert.equal(q[1].question, 'brand-new-workload');
  assert.equal(q[1].repeat, '4,096 lines');
  assert.equal(q[1].size, undefined);
  assert.equal(panels[0].props.toolbar.currentHref, '/comparison/runtime/?analysis=external&domain=pii');
  assert.equal(panels[1].props.toolbar.currentHref, '/comparison/runtime/?analysis=external&domain=pii&view=speed');
  assert.equal(panels[0].props.toolbar.legend, undefined, 'no outcomes recorded, nothing to key');
  const run = panels[0].props.run.map(m => m.value).join(' ');
  assert.match(run, /Each time is the middle of 12 runs/);
  assert.match(run, /redact-secret from a local build of main, unreleased/);
  assert.equal(panels[0].props.facts[0].cells['redact-secret'].chip, 'local build · unreleased');
  assert.equal(panels[0].props.facts[2].cells.openredaction.note, 'asynchronous: returns a Promise');
});

test('internal and credential panels say what was not measured; no workload id is invented', () => {
  const panels = resolveRuntimePanels(runtime);
  for (const p of panels.filter(p => !EXTERNAL_PII.includes(p.key))) {
    assert.ok(p.props.questions.every(q => q.notMeasured), p.key);
    assert.equal(p.props.toolbar, undefined);
  }
  const cred = panels.find(p => p.key === 'external-credentials');
  assert.equal(cred.props.questions.length, 3);
  assert.ok(cred.props.questions.every(q => q.workload === undefined && q.size === undefined));
  assert.equal(panels.find(p => p.key === 'internal-pii').props.facts[0].cells.pii.text, 'pii:global: email, network address');
});

test('a missing or invalid snapshot renders every question as not measured, with the reason', () => {
  const none = resolveRuntimePanels({ ...runtime, measurement: notRun });
  assert.match(none[0].props.questions[0].notMeasured, /No runtime comparison has been committed/);
  assert.equal(none[0].props.questions[0].timing['redact-secret'], null);
  assert.equal(none[0].props.run, undefined);
  const bad = resolveRuntimePanels({ ...runtime, measurement: { state: 'invalid', reason: 'stale summary' } });
  assert.equal(bad[0].props.questions[0].notMeasured, 'stale summary');
});

test('activeFamilies reads the recorded activation string and nothing else', () => {
  assert.deepEqual(activeFamilies('a=b;families=pii:global:iban,pii:global:payment-card;v=1'), ['iban', 'payment card']);
  assert.deepEqual(activeFamilies(undefined), []);
});

const source = { kind: 'doc', ref: 'https://example.invalid/readme' };
const facts = {
  runsIn: 'Node.js 20', dependencies: 'None',
  install: { measuredOn: '2026-01-02', method: 'npm pack', note: 'one package', packages: [{ name: 'a', version: '1', packedBytes: 2048, unpackedBytes: 10240 }] },
  sources: ['https://example.invalid/package.json'],
};
const claims = {
  schemaVersion: 1, readOn: '2026-01-02',
  libraries: [{ id: 'a', name: 'A', version: '1', facts }, { id: 'b', name: 'B', version: '2' }],
  groups: [{ label: 'Where', rows: [
    { id: 'r1', label: 'Node', cells: { a: { mark: 'yes', tested: true, test: 'r1.a', source }, b: { mark: 'yes', source } } },
    { id: 'r2', label: 'Browser', cells: { a: { mark: 'yes', source }, b: { mark: 'no', source } } },
    { id: 'r3', label: 'Unlisted', cells: { a: { mark: 'yes', source } } },
    { id: 'r4', label: 'Looks', cells: { a: { mark: 'yes', note: '<X>', literal: true, source }, b: { mark: 'yes', note: '<X>', literal: true, source } } },
  ] }],
  sources: [{ name: 'A', detail: 'its README', links: [{ label: 'README', href: 'https://example.invalid/readme' }] }],
};

test('feature claims: validated, "same" is derived from recorded marks, absence is stated', () => {
  assert.equal(featureClaimsProblem(claims), null);
  assert.match(featureClaimsProblem({ ...claims, libraries: [] }), /libraries/);
  assert.match(featureClaimsProblem({ ...claims, groups: [{ label: 'g', rows: [{ id: 'x', label: 'x', cells: { zz: { mark: 'yes', source } } }] }] }), /unknown library/);
  assert.match(featureClaimsProblem({ ...claims, groups: [{ label: 'g', rows: [{ id: 'x', label: 'x', cells: { a: { mark: 'great', source } } }] }] }), /mark/);
  assert.match(featureClaimsProblem({ ...claims, groups: [{ label: 'g', rows: [{ id: 'x', label: 'x', cells: { a: { mark: 'yes' } } }] }] }), /needs a source/);
  assert.match(featureClaimsProblem({ ...claims, groups: [{ label: 'g', rows: [{ id: 'x', label: 'x', cells: { a: { mark: 'yes', tested: true, source } } }] }] }), /name its test/);
  assert.match(featureClaimsProblem({ ...claims, libraries: [{ id: 'a', name: 'A', version: '1', facts: { ...facts, sources: [] } }, claims.libraries[1]] }), /facts need/);
  const page = resolveFeaturePage({ state: 'recorded', claims });
  assert.equal(page.state, 'recorded');
  assert.deepEqual(page.view.groups[0].rows.map(r => r.same), [true, false, false, false], 'a library with no cell, or a literal value, is a difference, never "same"');
  assert.deepEqual(page.view.groups[0].rows[0].cells.a, { mark: 'yes', tested: true }, 'source and test names stay in the ledger; the block gets display fields only');
  assert.deepEqual(page.view.sources[0].links, [{ label: 'README', href: 'https://example.invalid/readme' }]);
  const empty = resolveFeaturePage({ state: 'not-recorded', reason: 'file absent.' });
  assert.equal(empty.state, 'empty');
  assert.match(empty.notice.text, /file absent\./);
  assert.match(resolveFeaturePage({ state: 'invalid', reason: 'bad' }).notice.title, /did not validate/);
});

test('hub: facts count what pages contain, state not-recorded, and state the accuracy mode', () => {
  const run = { state: 'not-published', reason: 'r' };
  const hub = resolveHub({ runtime, features: { state: 'not-recorded', reason: 'x' }, run });
  assert.equal(hub.questions[0].fact, '2 test texts');
  assert.equal(hub.questions[1].fact, 'Not recorded yet');
  assert.equal(hub.questions[2].fact, '3 evidence levels');
  assert.ok(hub.questions.every(q => q.href.startsWith('/comparison/') || q.href === '/report/'));
  assert.deepEqual(hub.runs.map(r => r.detail), ['2026-01-02 · redact-secret 9.9.9 (local build, unreleased), flare-redact 1.0.0, OpenRedaction 2.0.0', 'not recorded yet', 'no benchmark run for this checkout']);
  const later = resolveHub({ runtime: { ...runtime, measurement: notRun }, features: { state: 'recorded', claims }, run });
  assert.equal(later.questions[0].fact, 'Not measured yet');
  assert.equal(later.questions[1].fact, '4 features');
  assert.equal(later.questions[1].factNote, '1 checked by us');
});

test('runtime facts: package-metadata rows come from the claims file, a library it does not describe reads as a dash', () => {
  const rows = resolveRuntimePanels(runtime, { state: 'recorded', claims })[0].props.facts;
  assert.deepEqual(rows.map(r => r.label), ['Version', 'Package', 'Call timed', 'Runs in', 'Install size', 'Dependencies']);
  const size = rows.find(r => r.label === 'Install size');
  assert.equal(size.cells['redact-secret'], null, 'no library id "redact-secret" in this file');
  const own = resolveRuntimePanels(runtime, { state: 'recorded', claims: { ...claims, libraries: [{ ...claims.libraries[0], id: 'flare-redact' }, claims.libraries[1]] } })[0].props.facts;
  assert.deepEqual(own.find(r => r.label === 'Install size').cells['flare-redact'], { text: '2.0 KiB packed', note: '10.0 KiB unpacked: one package' });
  assert.equal(own.find(r => r.label === 'Runs in').cells['flare-redact'].text, 'Node.js 20');
  assert.deepEqual(resolveRuntimePanels(runtime, { state: 'not-recorded', reason: 'x' })[0].props.facts.map(r => r.label), ['Version', 'Package', 'Call timed']);
  assert.deepEqual(resolveRuntimePanels(runtime)[0].props.facts.map(r => r.label), ['Version', 'Package', 'Call timed']);
});

test('comparison query contract: unknown values fall back to the defaults', () => {
  assert.deepEqual([analysisOf('x'), domainOf(null), viewOf('nope')], ['external', 'pii', 'all']);
  assert.deepEqual([analysisOf('internal'), domainOf('credentials'), viewOf('speed')], ['internal', 'credentials', 'speed']);
  assert.equal(featureFilterOf(new URLSearchParams('rows=differences')), 'differences');
  assert.equal(featureFilterString('all'), '');
});
