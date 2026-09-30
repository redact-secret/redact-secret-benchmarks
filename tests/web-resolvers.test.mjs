// Unit tests for the pure resolvers in web/resolvers (#556). Synthetic catalog, run and
// ledger data only: no credentials, no filesystem reads by the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveFamilyList, resolveFamily, familySlug } from '../web/resolvers/families.ts';
import { filterFamilies, filterProviders, listQueryOf, listQueryString, pageOf } from '../web/resolvers/filters.ts';
import { resolveAnswers, resolveFindings, resolvePeers, resolveHubTiles, modeText, runEyebrow, LEVELS } from '../web/resolvers/report.ts';
import { resolveRunState } from '../web/resolvers/run.ts';
import { axisMaxFor, onAxis, percent, isoDate } from '../web/resolvers/format.ts';

const fx = (slug, kind, tier, familyIds) => ({ slug, category: 'c', id: slug, group: 'g', kind, tier, familyIds });
const fixtures = [
  fx('a1', 'must-redact', 'T1', ['x:one']),
  fx('a2', 'must-redact', 'T1', ['x:one', 'y:two']),
  fx('a3', 'must-not-flag', 'T2', ['x:one']),
  fx('a4', 'must-redact', 'T1', ['x:one']),
  fx('b1', 'must-redact', 'T2', ['y:two']),
  fx('g1', 'must-not-flag', 'T1', []),
];
const taxonomy = {
  providers: [{ id: 'x', name: 'Xco' }, { id: 'y', name: 'Yco' }, { id: 'z', name: 'Zco' }],
  families: [
    { id: 'x:one', provider: 'x', name: 'One', description: 'd1', detectors: ['det-one'], sources: ['https://docs.example.com/a'] },
    { id: 'y:two', provider: 'y', name: 'Two', description: 'd2', detectors: [] },
    { id: 'z:three', provider: 'z', name: 'Three', description: 'd3', detectors: [] },
    { id: 'generic:jwt', provider: null, name: 'JWT', description: 'd4', detectors: [] },
  ],
};
const byFamily = new Map();
for (const f of fixtures) for (const id of f.familyIds) byFamily.set(id, [...(byFamily.get(id) ?? []), f]);
const catalog = {
  fixtures, bySlug: new Map(fixtures.map(f => [f.slug, f])), taxonomy,
  providerById: new Map(taxonomy.providers.map(p => [p.id, p])), familyById: new Map(taxonomy.families.map(f => [f.id, f])),
  fixturesByFamily: byFamily, detectorCount: 0,
};
const rows = new Map([
  ['a1', { spanOutcomes: ['EXACT'] }],
  ['a2', { spanOutcomes: ['MISS', 'EXACT'] }],
  ['a3', { flagged: true }],
  // a4 has no row: not measured
  ['b1', { spanOutcomes: ['OVERBROAD'] }],
  ['g1', { flagged: false }],
]);

test('family counts follow the counting rules and never turn "no fixtures" into zeros', () => {
  const list = resolveFamilyList(catalog, rows);
  const one = list.families.find(f => f.row.id === 'x:one');
  assert.equal(one.row.fixtures, '4');
  assert.deepEqual(one.row.counts, { leftReadable: '1', tooMuch: '0', falseAlarms: '1', notMeasured: '1' });
  assert.equal(list.families.find(f => f.row.id === 'y:two').row.counts.tooMuch, '1');
  assert.equal(list.families.find(f => f.row.id === 'z:three').row.counts, null);
  assert.equal(list.families.find(f => f.row.id === 'z:three').entry.fixturesLabel, '0 fixtures');
  assert.equal(list.families.find(f => f.row.id === 'generic:jwt').row.provider, 'Not provider-specific');
  assert.deepEqual(list.families.map(f => f.row.id), taxonomy.families.map(f => f.id), 'taxonomy order');
});

test('a fixture in two families counts once for its provider, and a global fixture is in no row', () => {
  const list = resolveFamilyList(catalog, rows);
  const x = list.providers.find(p => p.group.id === 'x');
  assert.equal(x.group.fixturesLabel, '4 fixtures');
  assert.equal(list.providers.at(-1).group.id, 'not-provider-specific');
  assert.equal(list.providers.find(p => p.group.id === 'z').group.counts, null);
  assert.equal(list.totals.fixtures, 5);
  assert.equal(list.totals.global, 1);
  assert.equal(list.totals.providers, 3);
  assert.equal(list.totals.providersWithFixtures, 2);
});

test('with no run every fixture is not measured and counts are dashes, not zeros', () => {
  const list = resolveFamilyList(catalog, undefined);
  assert.deepEqual(list.families[0].row.counts, { leftReadable: '—', tooMuch: '—', falseAlarms: '—', notMeasured: '4' });
  assert.equal(list.families[2].row.counts, null);
});

test('family detail lists rows that need a look first and labels outcomes with words', () => {
  const d = resolveFamily(catalog, 'x:one', rows);
  assert.deepEqual(d.rows.map(r => r.slug), ['a2', 'a3', 'a1', 'a4']);
  assert.deepEqual(d.rows.map(r => r.outcome.label), ['Left readable', 'Flagged', 'Redacted', 'Not measured']);
  assert.equal(d.rows[0].alsoIn, 'also in 1 other family');
  assert.equal(d.needsLookCount, 2);
  assert.deepEqual(d.about.sources, [{ href: 'https://docs.example.com/a', host: 'docs.example.com' }]);
  assert.equal(resolveFamily(catalog, 'nope:none', rows), undefined);
  const empty = resolveFamily(catalog, 'z:three', rows);
  assert.equal(empty.facts, undefined);
  assert.deepEqual(empty.rows, []);
});

test('a policy row is information, never a failure', () => {
  const c = { ...catalog, fixturesByFamily: new Map([['x:one', [fx('p1', 'policy', 'T3', ['x:one'])]]]) };
  const d = resolveFamily(c, 'x:one', new Map([['p1', { spanOutcomes: ['MISS'] }]]));
  assert.equal(d.rows[0].outcome.status, 'info');
});

test('every real family has a unique colon-free URL slug', () => {
  const t = JSON.parse(readFileSync('benchmarks/support/taxonomy.json', 'utf8'));
  const slugs = t.families.map(f => familySlug(f.id));
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
});

test('list filters: search, needs a look, no fixtures, and the URL contract', () => {
  const list = resolveFamilyList(catalog, rows);
  assert.equal(filterFamilies(list.families, { q: 'xco', show: 'all' }).items.length, 1);
  assert.equal(filterFamilies(list.families, { q: '', show: 'empty' }).items.length, 2);
  assert.equal(filterFamilies(list.families, { q: '', show: 'signal' }).resultText, '2 families');
  const p = filterProviders(list.providers, { q: 'yco', show: 'all' });
  assert.equal(p.resultText, '1 provider · 1 family');
  assert.equal(p.items[0].group.families.length, 1);
  assert.equal(filterProviders(list.providers, { q: 'zzz', show: 'all' }).items.length, 0);
  assert.deepEqual(listQueryOf(new URLSearchParams('q=%20a%20&show=signal')), { q: 'a', show: 'signal', level: 'all' });
  assert.deepEqual(listQueryOf(new URLSearchParams('show=bogus&level=T2')), { q: '', show: 'all', level: 'T2' });
  assert.deepEqual(listQueryOf(new URLSearchParams('level=T9')), { q: '', show: 'all', level: 'all' });
  assert.equal(listQueryString({ q: '', show: 'all', level: 'all' }), '');
  assert.equal(listQueryString({ q: 'aws', show: 'empty', level: 'T3' }), '?q=aws&show=empty&level=T3');
  assert.equal(pageOf('9', 3), 3);
  assert.equal(pageOf('x', 3), 1);
});

const rate = (point, bound, n, direction) => ({ point, bound, n, direction });
const run = {
  state: 'measured', runId: 'r', generatedAt: '2026-09-30T10:00:00.000Z', accountingVersion: '1.1', mode: 'published', productVersion: '0.1.0-test',
  summary: {
    accounting: { intervalZ: 1.96 },
    scanners: [{ id: 'redact-secret' }, { id: 'peer' }],
    overall: {
      'redact-secret': {
        'must-redact/T1': { files: 100, spans: 110, leakedSpans: 3, leakedSpanRate: rate(0.0273, 0.0724, 110, 'upper'), twins: { positives: 100, pairs: 50, discriminated: 45, rate: rate(0.9, 0.79, 50, 'lower') } },
        'must-not-flag/T1': { files: 10, flaggedFiles: 0, falseAlarmRate: rate(0, 0.2775, 10, 'upper') },
        'must-redact/T2': { files: 3, spans: 3, leakedSpans: 0, leakedSpanRate: 'insufficient-evidence', twins: { positives: 3, pairs: 0, discriminated: 0, rate: null } },
      },
      peer: {
        'must-redact/T1': { files: 100, spans: 110, leakedSpans: 40, leakedSpanRate: rate(0.36, 0.45, 110, 'upper'), twins: { positives: 100, pairs: 0, discriminated: 0, rate: null } },
        'must-not-flag/T1': { files: 10, flaggedFiles: 2, falseAlarmRate: rate(0.2, 0.5, 10, 'upper') },
      },
    },
  },
  scanners: [
    { id: 'redact-secret', name: 'redact-secret', version: '0.1.0-test', mode: 'm', status: 'complete', observations: [] },
    { id: 'peer', name: 'Peer', version: '1.0.0', mode: 'Directory scan', status: 'complete', observations: [{ source: 'snapshot', observedAt: '2026-09-29T00:00:00Z', sourceRunId: 'x' }] },
  ],
  productRows: rows, excludedSuites: [], staleSuites: [], suiteCount: 1,
};

test('answers display the summary bound with its direction and place it on a round axis', () => {
  const t1 = resolveAnswers(run, 'T1');
  const [miss, flag, twins] = t1.answers;
  assert.equal(miss.value, '7.2%');
  assert.equal(miss.qualifier, 'at most');
  assert.equal(miss.observation.strong, '3 of 110');
  assert.equal(miss.interval.axisMax, '10%');
  assert.deepEqual(miss.interval.range, [0.2730, 0.7240].map(n => Math.round(n * 1e4) / 1e4));
  assert.equal(flag.status.label, 'Few samples');
  assert.equal(twins.qualifier, 'at least');
  assert.equal(twins.interval.axisMax, '100%');
  assert.deepEqual(twins.interval.range, [0.79, 0.9]);
  assert.match(miss.interval.ariaLabel, /Published bound: at most 7\.2%/);
  assert.equal(t1.href, '/report/');
  assert.equal(resolveAnswers(run, 'T2').href, '/report/?level=T2');
});

test('a withheld or absent figure is stated, never drawn as a value', () => {
  const t2 = resolveAnswers(run, 'T2');
  assert.equal(t2.answers[0].value, '—');
  assert.equal(t2.answers[0].status.label, 'Withheld');
  assert.equal(t2.answers[1].status.label, 'Not measured');
  assert.equal(t2.answers[1].observation.strong, 'No fixtures');
  assert.equal(t2.answers[2].status.label, 'Not measured');
  assert.equal(resolveAnswers(run, 'T3').answers.every(a => a.value === '—'), true);
});

test('every stable count states its mode', () => {
  assert.equal(modeText(run), 'published · redact-secret 0.1.0-test');
  const candidate = { ...run, mode: 'candidate', candidate: { sourceCommit: 'abcdef0123456789', declaredVersion: '9' } };
  assert.equal(modeText(candidate), 'candidate · redact-secret main abcdef0 · unreleased');
  assert.equal(runEyebrow(candidate), 'REDACT-SECRET CANDIDATE ABCDEF0 · UNRELEASED');
});

const gaps = {
  reviewedAt: '2026-09-25', milestoneUrl: 'https://example.com/m',
  issues: [
    { number: 1, title: 'old', url: 'https://example.com/1', kind: 'false-positive', status: 'fixed', fixtures: ['a'], history: { observed: { at: '2026-09-01' }, fixed: { at: '2026-09-02' } } },
    { number: 2, title: 'new', url: 'https://example.com/2', kind: 'false-negative', status: 'policy-decision', fixtures: ['a', 'b'], history: { observed: { at: '2026-09-20' } } },
  ],
};

test('findings are newest first with the ledger status word', () => {
  const f = resolveFindings(gaps);
  assert.deepEqual(f.findings.map(x => x.id), ['2', '1']);
  assert.equal(f.findings[0].status.label, 'Policy');
  assert.equal(f.findings[0].detail, 'Left a secret readable · 2 fixtures');
  assert.equal(f.allLabel, 'All 2 findings');
  assert.match(f.description, /not live issue status/);
});

test('peers show what the ledger holds, hide the columns it does not, and gate T3', () => {
  const p = resolvePeers(run, gaps, 'T1');
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].targeted, null);
  assert.equal(p.rows[0].allInputs.count, '40');
  assert.equal(p.rows[0].safeFlagged.note, 'Too few controls to tell apart');
  assert.equal(p.hiddenByDefault, false);
  assert.equal(resolvePeers(run, gaps, 'T3').hiddenByDefault, true);
  assert.match(p.notes.source, /2026-09-29/);
  assert.match(p.notes.caveats[1].text, /^1 of 2 findings/);
});

test('hub tiles link only to pages this app has', () => {
  const tiles = resolveHubTiles(resolveFamilyList(catalog, rows), gaps);
  for (const t of tiles) assert.match(t.href, /^(\/report\/|#)/);
  assert.equal(tiles[0].figure, '3');
});

test('run state names what is missing and the command', () => {
  assert.equal(resolveRunState(run).kind, 'measured');
  const none = resolveRunState({ state: 'not-published', reason: 'absent.' });
  assert.equal(none.kind, 'not-published');
  assert.equal(none.command, 'npm run bench');
  const notes = resolveRunState({ ...run, excludedSuites: [{ id: 's', problem: 'Stale report' }], staleSuites: ['t'] }).notes;
  assert.equal(notes.length, 2);
});

test('format helpers', () => {
  assert.equal(percent(0.0364), '3.6%');
  assert.equal(axisMaxFor(0.036), 0.05);
  assert.equal(axisMaxFor(0.2775), 0.5);
  assert.equal(onAxis(0.025, 0.05), 0.5);
  assert.equal(isoDate('2026-09-30T01:02:03Z'), '2026-09-30');
  assert.equal(isoDate(undefined), '');
  assert.equal(LEVELS.length, 3);
});

// The layering rule (docs/decisions/2026-09-30-...): pages -> resolvers -> services; blocks import neither.
const walk = dir => readdirSync(dir, { withFileTypes: true, recursive: true }).filter(e => e.isFile()).map(e => path.join(e.parentPath, e.name));
const importsOf = file => [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(m => ({ type: !!m[1], from: m[2] }));

test('dependency direction: blocks import no service or resolver; only resolvers/pages.ts and its siblings import services', () => {
  for (const file of walk('web/components').filter(f => /\.tsx?$/.test(f) && !/\.stories\./.test(f))) {
    for (const { from } of importsOf(file)) assert.doesNotMatch(from, /(^|\/)(services|resolvers)(\/|$)/, `${file} imports ${from}`);
  }
  for (const file of walk('web/app').filter(f => /\.tsx?$/.test(f))) {
    for (const { from } of importsOf(file)) assert.doesNotMatch(from, /(^|\/)services(\/|$)/, `${file} imports a service directly`);
  }
  for (const file of walk('web/resolvers').filter(f => f.endsWith('.ts') && !f.endsWith('pages.ts'))) {
    for (const { type, from } of importsOf(file)) if (/services/.test(from)) assert.ok(type, `${file} imports ${from} at runtime; only pages.ts may`);
  }
  for (const file of walk('web/services').filter(f => f.endsWith('.ts'))) {
    for (const { from } of importsOf(file)) assert.doesNotMatch(from, /(^|\/)(resolvers|app|components)(\/|$)/, `${file} imports ${from}`);
  }
});
