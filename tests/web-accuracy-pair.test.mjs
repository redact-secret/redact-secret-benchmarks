// Unit tests for the pure resolver behind /comparison/accuracy (#570). Synthetic catalog, run and
// runtime data only: no credentials, no filesystem reads by the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  buildPairModel, defaultQuery, differenceColumns, differencesOf, normalise, pairHref, pairQueryOf, pairScript, pairSearch, panelKey, resolveAccuracyPage, share, stateOf, questionOf,
  GROUPS_SHOWN,
} from '../web/resolvers/accuracy.ts';

const fx = (id, kind, tier, familyIds) => ({ slug: `s--${id}`, category: 's', id, group: 'g', kind, tier, familyIds, detectors: [] });
const fixtures = [
  fx('a1', 'must-redact', 'T1', ['x:one']),
  fx('a2', 'must-redact', 'T1', ['x:one']),
  fx('a3', 'must-redact', 'T1', ['y:two']),
  fx('a4', 'must-redact', 'T1', []),
  fx('a5', 'must-redact', 'T1', ['y:two']),
  fx('c1', 'must-not-flag', 'T1', ['x:one']),
  fx('c2', 'must-not-flag', 'T2', ['y:two']),
  fx('b1', 'must-redact', 'T2', ['x:one']),
  fx('p1', 'policy', 'T3', ['x:one']),
  fx('t0', 'must-redact', 'T0', ['y:two']),
  fx('n1', 'must-redact', 'T1', ['y:two']),
];
const catalog = {
  fixtures,
  familyById: new Map([['x:one', { provider: 'px' }], ['y:two', { provider: 'py' }]]),
  providerById: new Map([['px', { name: 'Zeta Cloud' }], ['py', { name: 'Alpha Pay' }]]),
};
const R = outcomes => ({ spanOutcomes: outcomes });
const mine = new Map([
  ['s--a1', R(['EXACT'])], ['s--a2', R(['EXACT', 'COVERED'])], ['s--a3', R(['PARTIAL'])], ['s--a4', R(['MISS'])], ['s--a5', R(['OVERBROAD'])],
  ['s--c1', { flagged: false }], ['s--c2', { flagged: true }], ['s--b1', R(['EXACT'])], ['s--p1', R(['MISS'])], ['s--t0', R(['EXACT'])], ['s--n1', R(['EXACT'])],
]);
const peerRows = new Map([
  ['s--a1', R(['MISS'])], ['s--a2', R(['EXACT'])], ['s--a3', R(['EXACT'])], ['s--a4', R(['MISS'])], ['s--a5', R(['PARTIAL', 'MISS'])],
  ['s--c1', { flagged: true }], ['s--c2', { flagged: false }], ['s--b1', R(['PARTIAL'])], ['s--p1', R(['EXACT'])], ['s--t0', R(['MISS'])],
  // s--n1: the peer recorded nothing for it.
]);
const profile = { id: 'peer', kind: 'repository-scanner', kindLabel: 'Repository scanner', description: 'Built to find secrets.', families: new Set(['x:one']), mappedRules: 1, ruleCount: 5, ruleFileVersion: '1.0.0', reviewedAt: '2026-09-30' };
const scanner = (id, name, rows, extra = {}) => ({ id, name, version: '1.0.0', mode: 'Directory scan · default rules', status: 'complete', observations: [{ source: 'snapshot', observedAt: '2026-09-29T00:00:00Z', sourceRunId: 'x' }], rows, ...extra });
const run = {
  state: 'measured', runId: 'run-1', generatedAt: '2026-09-30T10:00:00.000Z', accountingVersion: '1.1', mode: 'published', productVersion: '0.1.0-test',
  summary: {}, scanners: [scanner('redact-secret', 'redact-secret', mine, { version: '0.1.0-test', mode: 'Published npm package · default detectors', observations: [] }), scanner('peer', 'Peer', peerRows), scanner('down', 'Down', new Map(), { status: 'unavailable' })],
  productRows: mine, excludedSuites: [], staleSuites: [], suiteCount: 1,
};
const profiles = new Map([['peer', profile]]);
const sum = xs => xs.reduce((a, b) => a + b, 0);

test('a file is sorted by what the row recorded: Hidden, Partly readable, Readable; Left alone, Flagged; nothing recorded is null', () => {
  assert.equal(stateOf('r', R(['EXACT', 'COVERED', 'OVERBROAD'])), 'H');
  assert.equal(stateOf('r', R(['EXACT', 'PARTIAL'])), 'P');
  assert.equal(stateOf('r', R(['PARTIAL', 'MISS'])), 'R');
  assert.equal(stateOf('r', undefined), null);
  assert.equal(stateOf('r', { flagged: false }), null, 'a control row is not a secret row');
  assert.equal(stateOf('a', { flagged: false }), 'Q');
  assert.equal(stateOf('a', { flagged: true }), 'F');
  assert.equal(stateOf('a', R(['EXACT'])), null);
  assert.equal(questionOf(fx('x', 'must-redact', 'T0', [])), null, 'pending review is never scored');
  assert.equal(questionOf(fx('x', 'policy', 'T3', [])), 'r');
  assert.equal(questionOf(fx('x', 'must-not-flag', 'T2', [])), 'a');
});

test('a share never rounds up to 100% or down to 0% unless every file, or no file, is in the state', () => {
  assert.equal(share(4827, 4827), '100%');
  assert.equal(share(0, 4827), '0%');
  assert.equal(share(4826, 4827), '99.9%');
  assert.equal(share(1, 4827), '0.1%');
  assert.equal(share(1, 1000000), '0.1%');
  assert.equal(share(965, 1298), '74%');
  assert.equal(share(1, 0), '—');
});

test('each question counts the files both tools recorded, and the states add up to the total', () => {
  const model = buildPairModel(catalog, run, profiles);
  assert.deepEqual(model.peers.map(p => p.id), ['peer', 'down']);
  const peer = model.peers[0];
  const t1 = peer.cells['T1|all'];
  // T1 must-redact: a1..a5 and n1; n1 has no peer row, so it is left out.
  assert.equal(t1.r.total, 5);
  assert.equal(t1.r.notMeasured, 1);
  assert.deepEqual(t1.r.us, [3, 1, 1], 'hidden a1 a2 a5, partly a3, readable a4');
  assert.deepEqual(t1.r.them, [2, 0, 3], 'hidden a2 a3, readable a1 a4 a5');
  assert.equal(sum(t1.r.us), t1.r.total);
  assert.equal(sum(t1.r.them), t1.r.total);
  assert.equal(t1.a.total, 1);
  assert.deepEqual([t1.a.us, t1.a.them], [[1, 0], [0, 1]]);
  assert.equal(peer.cells['T3|all'].r.total, 1, 'policy files are the T3 secrets question');
  assert.equal(peer.cells['T2|all'].a.total, 1);
  for (const level of ['T1', 'T2', 'T3']) for (const scope of ['all', 'listed']) {
    const cell = peer.cells[`${level}|${scope}`];
    for (const q of ['r', 'a']) {
      assert.equal(sum(cell[q].us), cell[q].total);
      assert.equal(sum(cell[q].them), cell[q].total);
    }
  }
});

test('the scope switch keeps only the files whose provider family the peer rules target', () => {
  const peer = buildPairModel(catalog, run, profiles).peers[0];
  const listed = peer.cells['T1|listed'];
  // Only x:one is targeted: a1, a2 (must-redact) and c1 (control). a3, a4, a5, n1 are not.
  assert.equal(listed.r.total, 2);
  assert.equal(listed.a.total, 1);
  assert.equal(listed.r.notMeasured, 0);
  assert.ok(peer.cells['T1|all'].r.total >= listed.r.total);
});

test('a peer that did not complete has no measured file, never a zero pass', () => {
  const down = buildPairModel(catalog, run, profiles).peers[1];
  assert.equal(down.status, 'unavailable');
  assert.equal(down.cells['T1|all'].r.total, 0);
  assert.ok(down.cells['T1|all'].r.notMeasured > 0);
});

test('differences are listed in both directions, grouped by provider, alphabetical, and match the counts', () => {
  const model = buildPairModel(catalog, run, profiles);
  const all = differencesOf(model.diff, 'peer', 'T1', 'all', 'r');
  // Only redact-secret hid: a1, a5. Only the peer hid: a3.
  assert.deepEqual(all.onlyUs.map(g => [g.name, g.files.map(f => f.slug)]), [['Zeta Cloud', ['a1']], ['Alpha Pay', ['a5']]].sort((x, y) => x[0].localeCompare(y[0])));
  assert.deepEqual(all.onlyThem.map(g => [g.name, g.files.map(f => f.slug)]), [['Alpha Pay', ['a3']]]);
  assert.equal(all.total, model.peers[0].cells['T1|all'].r.differing);
  assert.equal(all.onlyUs[0].files[0].href, '/report/fixtures/s/?fixture=a5');
  const listed = differencesOf(model.diff, 'peer', 'T1', 'listed', 'r');
  assert.equal(listed.total, model.peers[0].cells['T1|listed'].r.differing);
  assert.deepEqual(listed.onlyUs.map(g => g.files.map(f => f.slug)), [['a1']]);
  const cols = differenceColumns(all, 'r', 'Peer', [false, false]);
  assert.deepEqual(cols.map(c => c.title), ['Hidden by redact-secret only', 'Hidden by Peer only']);
  assert.deepEqual(cols.map(c => c.total), ['2', '1']);
  const control = differencesOf(model.diff, 'peer', 'T1', 'all', 'a');
  assert.equal(control.onlyUs.length + control.onlyThem.length, 1, 'the control both differ on');
  assert.equal(differenceColumns(control, 'a', 'Peer', [false, false])[0].title, 'Left alone by redact-secret only');
});

test('a long provider list is cut to 40 and shows all on request, per column', () => {
  const lists = { total: 90, onlyThem: [], onlyUs: Array.from({ length: 90 }, (_, i) => ({ name: `P${String(i).padStart(3, '0')}`, files: [{ slug: `f${i}`, href: '#' }] })) };
  const cut = differenceColumns(lists, 'r', 'Peer', [false, false]);
  assert.equal(cut[0].groups.length, GROUPS_SHOWN);
  assert.equal(cut[0].more, 'Show all 90 providers');
  assert.equal(cut[0].total, '90', 'the total counts files, not the cut list');
  assert.equal(cut[1].more, undefined);
  const all = differenceColumns(lists, 'r', 'Peer', [true, false]);
  assert.equal(all[0].groups.length, 90);
  assert.equal(all[0].more, undefined);
});

const options = { credentials: ['gitleaks', 'trufflehog', 'flare-redact'], pii: ['flare-redact', 'openredaction'] };

test('the address keeps defaults out, ignores what the view cannot use and never picks a tool by result', () => {
  const q = params => pairQueryOf(new URLSearchParams(params), options);
  assert.deepEqual(q(''), defaultQuery(options));
  assert.equal(q('with=trufflehog&level=T2&scope=listed').with, 'trufflehog');
  assert.equal(q('with=nope').with, 'gitleaks', 'an unknown tool falls back to the first in run order');
  assert.equal(q('data=pii').with, 'flare-redact');
  assert.equal(q('data=pii&with=gitleaks').with, 'flare-redact', 'a tool the view does not offer falls back');
  assert.equal(q('level=T9').level, 'T1');
  assert.equal(pairSearch(defaultQuery(options), options), '');
  assert.equal(pairSearch({ ...defaultQuery(options), with: 'trufflehog', level: 'T2', scope: 'listed' }, options), '?with=trufflehog&level=T2&scope=listed');
  assert.equal(pairSearch({ domain: 'pii', with: 'flare-redact', level: 'T3', scope: 'listed', peers: true }, options), '?data=pii', 'level, scope and peers do not apply to personal data');
  assert.equal(pairHref({ ...defaultQuery(options), level: 'T3', peers: true }, options), '/comparison/accuracy/?level=T3&peers=1');
  assert.equal(pairSearch({ ...defaultQuery(options), level: 'T1', peers: true }, options), '', 'peers only applies at T3');
  assert.deepEqual(normalise({ ...defaultQuery(options), level: 'T1', peers: true }).peers, false);
});

test('the inline script and the resolver agree on which panel a URL shows', () => {
  const urls = ['', '?with=trufflehog', '?with=flare-redact&level=T3&peers=1', '?level=T3', '?level=T2&scope=listed', '?data=pii', '?data=pii&with=openredaction&level=T3', '?data=pii&with=gitleaks', '?with=nope&scope=x', '?level=T1&peers=1'];
  for (const search of urls) {
    const root = { dataset: {} };
    vm.runInNewContext(pairScript(options), { URLSearchParams, location: { search }, document: { documentElement: root } });
    assert.equal(root.dataset.accKey, panelKey(pairQueryOf(new URLSearchParams(search), options)), search || '(default)');
  }
});

const runtime = {
  settings: [{
    id: 'pii-global-us', label: 'PII + US', sub: 'pii:global, pii:us', selectors: ['pii:global', 'pii:us'],
    run: {
      state: 'measured', generatedAt: '2026-09-30T00:00:00Z', path: 'evidence/x.json', families: [], activation: '',
      tools: [{ id: 'redact-secret', version: '0.0.0', buildKind: 'local-source-build' }, { id: 'lib', version: '2.0.0', buildKind: 'published-npm-package' }],
      outcomes: {
        'redact-secret/w1': [{ changed: true, valuesHidden: 1, replacement: '' }, { changed: true, valuesHidden: 1, replacement: '' }, { changed: false, valuesHidden: 0, replacement: '' }],
        'lib/w1': [{ changed: true, valuesHidden: 1, replacement: '' }, { changed: false, valuesHidden: 0, replacement: '' }, { changed: true, valuesHidden: 1, replacement: '' }],
      },
    },
  }],
  workloads: [{ id: 'w1', domain: 'pii', question: 'Q', description: 'D', lines: [{ label: 'Email', values: [{}] }, { label: 'Phone', values: [{}] }, { label: 'Card', values: [{}] }] }],
};

test('every panel has a unique key, reads the expected answer on its own row and puts the two sides in the same order', () => {
  const page = resolveAccuracyPage({ catalog, run, profiles, runtime });
  assert.deepEqual(page.options.credentials, ['peer', 'down']);
  assert.deepEqual(page.options.pii, ['lib']);
  const keys = page.panels.map(p => p.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(page.panels.filter(p => p.isDefault).length, 1);
  assert.equal(page.panels.find(p => p.isDefault).key, 'credentials.peer.T1.all.0');
  // 2 peers x (T1, T2 x 2 scopes + T3 x 2 scopes x gated/shown) + 1 personal-data panel.
  assert.equal(page.panels.length, 2 * (2 + 2 + 4) + 1);
  for (const p of page.panels) {
    for (const q of p.props.questions ?? []) {
      if (q.results.length) {
        assert.equal(q.results.length, 2);
        assert.equal(q.results[0].name, 'redact-secret', 'redact-secret is always the first side, never ordered by result');
        assert.deepEqual(q.results[0].states.map(s => s.label), q.results[1].states.map(s => s.label), 'the two sides read the same states');
        assert.equal(sum(q.results[0].states.map(s => s.weight)), sum(q.results[1].states.map(s => s.weight)), 'both sides read the same number of files');
      }
    }
  }
  const t1 = page.panels.find(p => p.key === 'credentials.peer.T1.all.0').props;
  assert.equal(t1.questions[0].results[0].figure, '3 of 5', 'fewer than 20 files: counts only');
  assert.equal(t1.questions[0].results[1].figure, '2 of 5');
  assert.equal(t1.questions[1].results[0].figure, '1 of 1');
  assert.equal(t1.questions[1].readout, 'Fewer than 20 files, so counts only.');
  assert.match(t1.questions[0].notes[0], /1 test file left out/);
  assert.match(t1.meta.find(m => m.label === 'Mode').value, /^published · redact-secret 0\.1\.0-test$/, 'the stable counts state their mode');
  assert.equal(page.panels.find(p => p.key === 'credentials.peer.T1.all.0').differences['credentials.peer.T1.all.0.r'].summary, 'Show the 3 files with different results');
});

test('from 20 files the share is a percentage with the count under it', () => {
  const many = Array.from({ length: 40 }, (_, i) => fx(`m${i}`, 'must-redact', 'T1', ['x:one']));
  const rows = (hidden) => new Map(many.map((f, i) => [f.slug, R([i < hidden ? 'EXACT' : 'MISS'])]));
  const big = { ...run, productRows: rows(39), scanners: [scanner('redact-secret', 'redact-secret', rows(39), { version: '0.1.0-test', observations: [] }), scanner('peer', 'Peer', rows(10))] };
  const { panels } = resolveAccuracyPage({ catalog: { ...catalog, fixtures: many }, run: big, profiles, runtime: undefined });
  const q = panels.find(p => p.isDefault).props.questions[0];
  assert.deepEqual(q.results.map(r => [r.figure, r.figureNote]), [['98%', '39 of 40 hidden'], ['25%', '10 of 40 hidden']]);
  assert.equal(q.readout, undefined);
  assert.deepEqual(q.results[1].states.map(s => s.count), ['10', '0', '30']);
});

test('project policy is hidden for another tool until asked, and the gate links to the shown panel', () => {
  const { panels } = resolveAccuracyPage({ catalog, run, profiles, runtime });
  const gated = panels.find(p => p.key === 'credentials.peer.T3.all.0').props;
  assert.ok(gated.gate && !gated.questions);
  assert.equal(gated.gate.show.href, '/comparison/accuracy/?level=T3&peers=1');
  const shown = panels.find(p => p.key === 'credentials.peer.T3.all.1').props;
  assert.ok(!shown.gate && shown.questions.length === 2);
  assert.equal(shown.questions[0].results[0].name, 'redact-secret');
});

test('a pair with no shared data says so, a peer that did not complete is not measured, and no run is stated', () => {
  const { panels } = resolveAccuracyPage({ catalog, run, profiles, runtime });
  const none = panels.find(p => p.key === 'credentials.peer.T3.listed.1').props;
  assert.equal(none.questions[0].results.length, 1 + 1, 'the policy file is in x:one');
  const down = panels.find(p => p.key === 'credentials.down.T1.all.0').props;
  assert.match(down.notMeasured.title, /did not complete/);
  assert.match(down.notMeasured.text, /not measured, not zero/);
  const empty = resolveAccuracyPage({ catalog, run: undefined, profiles, runtime: undefined });
  assert.deepEqual(empty.options, { credentials: [], pii: [] });
  assert.equal(empty.diff, undefined);
  const credentials = empty.panels.filter(p => p.query.domain === 'credentials');
  assert.equal(credentials.length, 1);
  assert.equal(credentials[0].props.notMeasured.command, 'npm run bench');
  assert.equal(credentials[0].isDefault, true);
  const pii = empty.panels.find(p => p.query.domain === 'pii');
  assert.match(pii.props.notMeasured.text, /Nothing is shown rather than a guess/);
});

test('personal data reads the recorded texts by line, with counts and no percentage, and both directions listed', () => {
  const { panels } = resolveAccuracyPage({ catalog, run, profiles, runtime });
  const pii = panels.find(p => p.key === 'pii.lib.-.-.-').props;
  assert.match(pii.preview, /^Preview, not yet a measurement\./);
  const q = pii.questions[0];
  assert.deepEqual(q.results.map(r => [r.name, r.figure]), [['redact-secret', '2 of 3'], ['lib', '2 of 3']]);
  assert.deepEqual(q.differences.columns.map(c => [c.title, c.groups.flatMap(g => g.files.map(f => f.slug))]), [['Hidden by redact-secret only', ['Phone']], ['Hidden by lib only', ['Card']]]);
  assert.equal(pii.pair.ours.name, 'redact-secret');
  assert.match(pii.pair.ours.ran, /local build of main, unreleased/);
  assert.equal(pii.pair.ours.job, undefined);
  assert.equal(pii.pair.theirs.job, undefined, 'both sides or neither carry the sentence');
});

test('the copy never ranks, scores or names a winner', () => {
  const page = resolveAccuracyPage({ catalog, run, profiles, runtime });
  const banned = /\b(fastest|slowest|faster|slower|best|worst|winner|wins?|better|worse|missed|caught|should|correct)\b|\brank(ed|ing)?\b/i;
  const words = [];
  const visit = value => {
    if (typeof value === 'string') words.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  for (const p of page.panels) visit(p.props);
  for (const text of words) assert.doesNotMatch(text.replace('Nothing here is scored or ranked.', ''), banned, text);
});
