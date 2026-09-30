// Unit tests for the /comparison resolvers (#557). Synthetic data only: no credentials,
// no filesystem reads by the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHub, resolveFeaturePage, resolveRuntimePanels, milliseconds, megabytesPerSecond, kibibytes, activeFamilies,
  analysisOf, domainOf, viewOf, featureFilterOf, featureFilterString, stabilityNote,
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

const claims = {
  schemaVersion: 1, readOn: '2026-01-02',
  libraries: [{ id: 'a', name: 'A', version: '1' }, { id: 'b', name: 'B', version: '2' }],
  groups: [{ label: 'Where', rows: [
    { id: 'r1', label: 'Node', cells: { a: { mark: 'yes', tested: true }, b: { mark: 'yes' } } },
    { id: 'r2', label: 'Browser', cells: { a: { mark: 'yes' }, b: { mark: 'no' } } },
    { id: 'r3', label: 'Unlisted', cells: { a: { mark: 'yes' } } },
  ] }],
  sources: [{ name: 'A', detail: 'its README' }],
};

test('feature claims: validated, "same" is derived from recorded marks, absence is stated', () => {
  assert.equal(featureClaimsProblem(claims), null);
  assert.match(featureClaimsProblem({ ...claims, libraries: [] }), /libraries/);
  assert.match(featureClaimsProblem({ ...claims, groups: [{ label: 'g', rows: [{ id: 'x', label: 'x', cells: { zz: { mark: 'yes' } } }] }] }), /unknown library/);
  assert.match(featureClaimsProblem({ ...claims, groups: [{ label: 'g', rows: [{ id: 'x', label: 'x', cells: { a: { mark: 'great' } } }] }] }), /mark/);
  const page = resolveFeaturePage({ state: 'recorded', claims });
  assert.equal(page.state, 'recorded');
  assert.deepEqual(page.view.groups[0].rows.map(r => r.same), [true, false, false], 'a library with no cell is a difference, never "same"');
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
  assert.equal(later.questions[1].fact, '3 features');
  assert.equal(later.questions[1].factNote, '1 checked by us');
});

test('comparison query contract: unknown values fall back to the defaults', () => {
  assert.deepEqual([analysisOf('x'), domainOf(null), viewOf('nope')], ['external', 'pii', 'all']);
  assert.deepEqual([analysisOf('internal'), domainOf('credentials'), viewOf('speed')], ['internal', 'credentials', 'speed']);
  assert.equal(featureFilterOf(new URLSearchParams('rows=differences')), 'differences');
  assert.equal(featureFilterString('all'), '');
});

// ---- #562 / #563: recorded outcomes and per-setting runs ---------------------------------------------------

const cmpWorkload = (id, domain, lines) => ({ id, domain, question: `Question ${id}?`, description: `About ${id}.`, lines });
const piiLines = [
  { label: 'Email', values: [{ kind: 'email', family: 'pii:global:email' }] },
  { label: 'US SSN', values: [{ kind: 'us-ssn', family: 'pii:us:ssn' }] },
  { label: 'Email and phone', values: [{ kind: 'email', family: 'pii:global:email' }, { kind: 'phone', family: 'pii:global:phone' }] },
];
const credLines = [{ label: 'Token', values: [{ kind: 'github-token' }] }, { label: 'Hash', values: [{ kind: 'checksum' }] }];
const cmpWorkloads = [cmpWorkload('pii-a', 'pii', piiLines), cmpWorkload('cred-a', 'credentials', credLines)];
const o = (changed, valuesHidden, replacement = '') => ({ changed, valuesHidden, replacement });
const cmpObs = (tool, workload, medianMs) => ({ tool, workload, workloadBytes: 131072, medianMs, p95Ms: medianMs, medianBytesPerSecond: 131072 / (medianMs / 1000) });
function cmpRun(families, rsPii, rsCred, ms = 10) {
  return {
    state: 'measured', generatedAt: '2026-09-30T12:00:00Z', runner: { platform: 'linux', arch: 'x64', node: 'v22', cpuModel: 'Test CPU', cpuLimit: 4 },
    tools: [{ id: 'redact-secret', version: '9.9.9', buildKind: 'local-source-build' }, { id: 'flare-redact', version: '1.0.0', buildKind: 'published-npm-package' }, { id: 'openredaction', version: '2.0.0', buildKind: 'published-npm-package' }],
    families, activation: `credentials=full;selectors=x;families=${families.join(',')};vocabulary=v`, methodologyNotes: ['a note'],
    observations: ['redact-secret', 'flare-redact', 'openredaction'].flatMap((tool, i) => ['pii-a', 'cred-a'].map(w => cmpObs(tool, w, ms * (i + 1)))),
    outcomes: {
      'redact-secret/pii-a': rsPii, 'redact-secret/cred-a': rsCred,
      'flare-redact/pii-a': [o(true, 1, '***@***'), o(false, 0), o(true, 1, '***@***')], 'flare-redact/cred-a': [o(true, 1, '***'), o(false, 0)],
      'openredaction/pii-a': [o(true, 1, '[EMAIL_1]'), o(false, 0), o(true, 2, '[X] [Y]')], 'openredaction/cred-a': [o(false, 0), o(false, 0)],
    },
    samplesPerCell: 12, commitment: 'c', path: 'evidence/562/x.json',
  };
}
const setting = (id, label, sub, selectors, run) => ({ id, label, sub, selectors, run });
const comparison = {
  planId: 'runtime-comparison-v2', lineCount: 4096, workloads: cmpWorkloads,
  settings: [
    setting('default', 'Default', 'no PII', [], cmpRun([], [o(false, 0), o(false, 0), o(false, 0)], [o(true, 1, '<S_1>'), o(false, 0)], 8)),
    setting('pii-global', 'PII', 'pii:global', ['pii:global'], cmpRun(['pii:global:email', 'pii:global:phone'], [o(true, 1, '<S_1>'), o(false, 0), o(true, 1, '<S_1> phone')], [o(true, 1, '<S_1>'), o(false, 0)], 12)),
    setting('pii-global-us', 'PII + US', 'adds pii:us', ['pii:global', 'pii:us'], cmpRun(['pii:global:email', 'pii:global:phone', 'pii:us:ssn'], [o(true, 1, '<S_1>'), o(true, 1, '<S_1>'), o(true, 2, '<S_1> <S_2>')], [o(true, 1, '<S_1>'), o(false, 0)], 14)),
  ],
};
const withComparison = { ...runtime, comparison };
const panelsWith = resolveRuntimePanels(withComparison);
const panelOf = key => panelsWith.find(p => p.key === key);

test('with recorded outcomes every measured combination has one panel per view, keyed analysis-domain-view', () => {
  assert.deepEqual(panelsWith.map(p => p.key), [
    'external-pii-all', 'external-pii-speed', 'external-pii-accuracy', 'internal-pii-all', 'internal-pii-speed', 'internal-pii-accuracy',
    'internal-credentials-all', 'internal-credentials-speed', 'internal-credentials-accuracy', 'external-credentials-all', 'external-credentials-speed', 'external-credentials-accuracy',
  ]);
  assert.ok(panelsWith.every(p => p.props.toolbar.legend.length === 4));
  assert.equal(panelOf('internal-pii-accuracy').props.toolbar.currentHref, '/comparison/runtime/?analysis=internal&domain=pii&view=accuracy');
  const ids = panelsWith.flatMap(p => p.props.questions.map(q => q.id));
  assert.equal(new Set(ids).size, ids.length, 'question ids are unique across the pre-rendered panels');
});

test('external PII: rows are the plan lines, outcomes are the recorded ones, "Switch off" only for an unchanged line whose family is off', () => {
  const q = panelOf('external-pii-all').props.questions[0];
  assert.equal(q.outcomesRecorded, true);
  assert.deepEqual(q.rows.map(r => r.label), ['Email', 'US SSN', 'Email and phone']);
  const [email, ssn, both] = q.rows;
  assert.deepEqual(email.cells['redact-secret'], { outcome: 'replaced', word: 'Hidden', how: 'shown as <S_1>' });
  assert.deepEqual(ssn.cells['redact-secret'], { outcome: 'not-applicable', word: 'Switch off' }, 'pii:us:ssn is not in the pii:global families');
  assert.equal(ssn.cells['flare-redact'].outcome, 'unchanged', 'a library has no such switch: an unchanged line is "Left as is"');
  assert.equal(both.cells['redact-secret'].outcome, 'partial', 'one of two values hidden');
  assert.equal(both.cells.openredaction.outcome, 'replaced');
  assert.deepEqual(q.hidden['redact-secret'], { percent: '50%', count: '2 of 4' });
  assert.deepEqual(q.hidden.openredaction, { percent: '75%', count: '3 of 4' });
  assert.equal(q.timing['redact-secret'].medianMs, '12.0');
  assert.equal(q.size, '128.0 KiB');
  assert.equal(q.workload, 'pii-a');
});

test('internal PII: one column per setting, each read from its own run', () => {
  const panel = panelOf('internal-pii-all');
  assert.deepEqual(panel.props.columns.map(c => c.id), ['default', 'pii-global', 'pii-global-us']);
  const q = panel.props.questions[0];
  assert.deepEqual(q.rows[1].cells.default, { outcome: 'not-applicable', word: 'Switch off' });
  assert.equal(q.rows[1].cells['pii-global-us'].outcome, 'replaced');
  assert.deepEqual(q.hidden.default, { percent: '0%', count: '0 of 4' });
  assert.deepEqual(q.hidden['pii-global-us'], { percent: '100%', count: '4 of 4' });
  assert.deepEqual([q.timing.default.medianMs, q.timing['pii-global'].medianMs, q.timing['pii-global-us'].medianMs], ['8.0', '12.0', '14.0']);
  assert.equal(panel.props.facts.find(f => f.label === 'Turns on').cells.default.text, 'no PII family');
  assert.equal(panel.props.facts.find(f => f.label === 'Turns on').cells['pii-global-us'].text, 'email, phone, ssn');
});

test('credentials: the questions are the credential workloads; libraries are timed at Default, a credential line is never "Switch off"', () => {
  const external = panelOf('external-credentials-all');
  assert.equal(external.props.questions[0].workload, 'cred-a');
  assert.equal(external.props.columns[0].sub, 'no PII');
  assert.equal(external.props.questions[0].timing['redact-secret'].medianMs, '8.0');
  assert.equal(external.props.questions[0].rows[1].cells['redact-secret'].outcome, 'unchanged');
  assert.equal(external.props.questions[0].rows[0].cells.openredaction.outcome, 'unchanged');
  const internal = panelOf('internal-credentials-all');
  assert.equal(internal.props.questions[0].rows[0].cells.default.outcome, 'replaced');
});

test('a setting with no run keeps its cells "not measured" and says why; a panel with no run at all is one unswitchable panel', () => {
  const partial = { ...comparison, settings: comparison.settings.map(s => (s.id === 'pii-global-us' ? { ...s, run: { state: 'not-published', reason: 'us run absent.' } } : s)) };
  const panels = resolveRuntimePanels({ ...runtime, comparison: partial });
  const q = panels.find(p => p.key === 'internal-pii-all').props.questions[0];
  assert.equal(q.rows[0].cells['pii-global-us'], null);
  assert.equal(q.hidden['pii-global-us'], null);
  assert.equal(q.timing['pii-global-us'], null);
  const none = { ...comparison, settings: comparison.settings.map((s, i) => (i === 0 ? s : { ...s, run: { state: 'invalid', reason: 'stale summary.' } })) };
  const onlyDefault = resolveRuntimePanels({ ...runtime, comparison: none });
  const ext = onlyDefault.find(p => p.key === 'external-pii');
  assert.equal(ext.view, null);
  assert.ok(ext.props.questions.every(qq => qq.notMeasured === 'stale summary.'));
  assert.equal(ext.props.toolbar, undefined);
});

test('the machine variation is recorded from the unchanged libraries, and stated only with two runs', () => {
  assert.match(stabilityNote(comparison), /3 runs the same flare-redact and OpenRedaction calls on the same text moved by up to 75%/);
  const one = { ...comparison, settings: comparison.settings.map((s, i) => (i ? { ...s, run: { state: 'not-published', reason: 'r' } } : s)) };
  assert.equal(stabilityNote(one), undefined);
});

test('the hub reads the newest run and counts the test texts measured', () => {
  const hub = resolveHub({ runtime: withComparison, features: { state: 'not-recorded', reason: 'x' }, run: { state: 'not-published', reason: 'r' } });
  assert.equal(hub.questions[0].fact, '2 test texts');
  assert.equal(hub.questions[0].factNote, 'personal data and credentials, made up');
  assert.match(hub.runs[0].detail, /^2026-09-30 · redact-secret 9\.9\.9/);
});
