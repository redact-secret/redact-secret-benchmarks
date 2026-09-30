// Unit tests for the pure resolvers behind the peer columns, the rows, fixture, detector and
// findings pages (#558, #559). Synthetic catalog, run and ledger data only: no credentials, no
// filesystem reads by the code under test, and fixture bytes that are obviously fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { agreesWithSummary, inputsAt, sliceInputs } from '../web/resolvers/peers.ts';
import { resolvePeers, resolveAnswers, resolveHubTiles } from '../web/resolvers/report.ts';
import { resolveFamilyList } from '../web/resolvers/families.ts';
import { FLAG, expandRows, fixtureHref, resolveRowsData, rowFacts, rowsSource } from '../web/resolvers/rows.ts';
import { isRowsData } from '../web/resolvers/rowdata.ts';
import { BUILD_DATA_PATH, recordsDataPath, rowsDataPath } from '../web/lib/data-paths.ts';
import { PAGE_SIZE, filterRows, rowsQueryOf, rowsQueryString } from '../web/resolvers/filters.ts';
import { boundText, resolveDetector, resolveDetectorList } from '../web/resolvers/detectors.ts';
import { milestoneLabel, resolveFindingsInventory, resolveSuiteRows } from '../web/resolvers/inventory.ts';
import { buildSuiteRecords, byteLines, packRow, resolveFixtureDetail, resolveFixtureRecord, segment, unpackRow, verdictsOf } from '../web/resolvers/fixtures.ts';

const fx = (slug, kind, tier, familyIds, extra = {}) => ({ slug: `s--${slug}`, category: 's', id: slug, group: 'g', kind, tier, familyIds, detectors: [], ...extra });
const fixtures = [
  fx('a1', 'must-redact', 'T1', ['x:one']),
  fx('a2', 'must-redact', 'T1', ['x:one', 'y:two']),
  fx('a3', 'must-redact', 'T1', ['y:two']),
  fx('c1', 'must-not-flag', 'T1', ['x:one'], { twinOf: 's--a1' }),
  fx('b1', 'must-redact', 'T2', ['x:one']),
  fx('p1', 'policy', 'T3', []),
  fx('t0', 'must-redact', 'T0', ['y:two']),
];
const key = f => f.slug;
const mine = new Map([
  ['s--a1', { spanOutcomes: ['EXACT'] }],
  ['s--a2', { spanOutcomes: ['MISS', 'EXACT'] }],
  ['s--a3', { spanOutcomes: ['EXACT'] }],
  ['s--c1', { flagged: true }],
  ['s--b1', { spanOutcomes: ['OVERBROAD'] }],
  ['s--p1', { spanOutcomes: ['PARTIAL'] }],
  ['s--t0', { spanOutcomes: ['EXACT'] }],
]);
const peerRows = new Map([
  ['s--a1', { spanOutcomes: ['EXACT'] }],
  ['s--a2', { spanOutcomes: ['MISS', 'PARTIAL'] }],
  ['s--a3', { spanOutcomes: ['MISS'] }],
  ['s--c1', { flagged: false }],
  ['s--b1', { spanOutcomes: ['EXACT'] }],
  ['s--p1', { spanOutcomes: ['MISS'] }],
  ['s--t0', { spanOutcomes: ['MISS'] }],
]);

test('inputs are the fixtures whose expectation is a secret span at the level, and the slices add up to the summary', () => {
  assert.deepEqual(inputsAt(fixtures, 'T1').map(key), ['s--a1', 's--a2', 's--a3']);
  assert.deepEqual(inputsAt(fixtures, 'T2').map(key), ['s--b1']);
  assert.deepEqual(inputsAt(fixtures, 'T3').map(key), ['s--p1'], 'T3 is the policy group');
  const slices = sliceInputs(inputsAt(fixtures, 'T1'), peerRows, new Set(['x:one']));
  // a1 and a2 relate to x:one (a2 to two families: targeted if any is); a3 does not.
  assert.deepEqual(slices.targeted, { inputs: 2, spans: 3, leaked: 2 });
  assert.deepEqual(slices.elsewhere, { inputs: 1, spans: 1, leaked: 1 });
  assert.ok(agreesWithSummary(slices, { files: 3, spans: 4, leakedSpans: 3 }));
  assert.ok(!agreesWithSummary(slices, { files: 3, spans: 4, leakedSpans: 2 }), 'a summary that disagrees is never shown');
  assert.equal(sliceInputs(inputsAt(fixtures, 'T1'), new Map([['s--a1', { spanOutcomes: ['EXACT'] }]]), new Set()), null, 'an input with no row is not measured');
  assert.equal(sliceInputs(inputsAt(fixtures, 'T1'), undefined, new Set()), null);
});

const rate = (point, bound, n) => ({ point, bound, n, direction: 'upper' });
const group = (files, spans, leaked) => ({ files, spans, leakedSpans: leaked, leakedSpanRate: rate(0.1, 0.2, spans), twins: { positives: files, pairs: 0, discriminated: 0, rate: null } });
const run = {
  state: 'measured', runId: 'r', generatedAt: '2026-09-30T10:00:00.000Z', accountingVersion: '1.1', mode: 'published', productVersion: '0.1.0-test',
  summary: {
    accounting: { intervalZ: 1.96 },
    scanners: [{ id: 'redact-secret' }, { id: 'peer' }],
    overall: {
      'redact-secret': { 'must-redact/T1': group(3, 4, 1), 'must-not-flag/T1': { files: 1, flaggedFiles: 1, falseAlarmRate: rate(1, 1, 1) } },
      peer: { 'must-redact/T1': group(3, 4, 3), 'must-not-flag/T1': { files: 1, flaggedFiles: 0, falseAlarmRate: rate(0, 0.5, 1) } },
    },
    byDetector: {},
  },
  scanners: [
    { id: 'redact-secret', name: 'redact-secret', version: '0.1.0-test', mode: 'm', status: 'complete', observations: [], rows: mine },
    { id: 'peer', name: 'Peer', version: '1.0.0', mode: 'Directory scan · default rules', status: 'complete', observations: [{ source: 'snapshot', observedAt: '2026-09-29T00:00:00Z', sourceRunId: 'x' }], rows: peerRows },
  ],
  productRows: mine, excludedSuites: [], staleSuites: [], suiteCount: 1,
};
const gaps = { reviewedAt: '2026-09-25', milestoneUrl: 'https://example.com/m', milestone: 'v0.1.0-beta.3', measuredVersion: '0.1.0-beta.3', issues: [
  { number: 1, title: 'old', url: 'https://example.com/1', kind: 'false-positive', status: 'fixed', fixtures: ['s--c1', 's--gone'], history: { observed: { at: '2026-09-01' }, fixed: { at: '2026-09-02' } } },
  { number: 2, title: 'new', url: 'https://example.com/2', kind: 'false-negative', status: 'policy-decision', fixtures: ['s--a2'], history: { observed: { at: '2026-09-20' } } },
] };
const profiles = new Map([['peer', { id: 'peer', kind: 'repository-scanner', kindLabel: 'Repository scanner', description: 'Built to find secrets.', families: new Set(['x:one']), mappedRules: 5, ruleCount: 20, ruleFileVersion: '1.0.0', reviewedAt: '2026-09-30' }]]);

test('the peer row states what its own rules target, from the reviewed map and the recorded rows', () => {
  const p = resolvePeers(run, gaps, 'T1', { fixtures, profiles });
  const row = p.rows[0];
  assert.equal(row.role, 'Repository scanner · Directory scan');
  assert.equal(row.blurb, 'Built to find secrets.');
  assert.deepEqual(row.targeted, { count: '2', of: '3', note: '5 of its 20 rules target a credential family' });
  assert.deepEqual(row.leftReadable, { count: '2', of: '3', unit: 'spans', note: 'redact-secret, same inputs: 1 of 3' });
  assert.deepEqual(row.elsewhere, { count: '1', of: '1', unit: 'spans', note: 'No rule of its own targets these' });
  assert.match(p.notes.quoteDo, /^“On 2 provider-documented inputs that match Peer 1\.0\.0’s default rules, in a corpus written and used for tuning by the redact-secret team, Peer left 2 of 3 secret spans readable\.”$/);
  assert.match(p.notes.source, /pinned rule file \(reviewed 2026-09-30\)/);
  for (const copy of [row.role, row.blurb, row.targeted.note, row.leftReadable.note, row.elsewhere.note, p.notes.quoteDo]) assert.doesNotMatch(copy, /\b(better|worse|best|worst|superior|inferior)\b/i, `“${copy}” ranks a scanner`);
});

test('without a map, or when the run cannot confirm the slices, the targeted columns stay unmeasured', () => {
  const bare = resolvePeers(run, gaps, 'T1');
  assert.equal(bare.rows[0].targeted, null);
  assert.equal(bare.rows[0].allInputs.count, '3');
  assert.match(bare.notes.quoteDo, /left 3 of 4 secret spans readable/);
  const disagrees = { ...run, summary: { ...run.summary, overall: { ...run.summary.overall, peer: { ...run.summary.overall.peer, 'must-redact/T1': group(3, 4, 2) } } } };
  assert.equal(resolvePeers(disagrees, gaps, 'T1', { fixtures, profiles }).rows[0].targeted, null);
  const noRows = { ...run, scanners: [run.scanners[0], { ...run.scanners[1], rows: new Map() }] };
  assert.equal(resolvePeers(noRows, gaps, 'T1', { fixtures, profiles }).rows[0].leftReadable, null);
});

test('figures link to the rows behind them at their level, and the hub tiles stay inside the app', () => {
  const t1 = resolveAnswers(run, 'T1');
  assert.deepEqual(t1.answers.map(a => a.href), ['/report/rows/T1/?show=leaked', '/report/rows/T1/?show=flagged', undefined]);
  assert.equal(resolveAnswers(run, 'T2').answers.every(a => a.href === undefined), true, 'a level with no fixtures links nothing');
  const tiles = resolveHubTiles(resolveFamilyList({ fixtures, bySlug: new Map(), taxonomy: { providers: [{ id: 'x', name: 'X' }], families: [{ id: 'x:one', provider: 'x', name: 'One', description: '', detectors: [] }] }, providerById: new Map([['x', { id: 'x', name: 'X' }]]), familyById: new Map([['x:one', { id: 'x:one', provider: 'x', name: 'One' }]]), fixturesByFamily: new Map([['x:one', fixtures.slice(0, 2)]]), detectorCount: 0 }, mine), gaps, { count: 110, fixtures: 4000 });
  assert.deepEqual(tiles.map(t => t.label), ['Providers', 'Families', 'Detectors', 'News']);
  for (const t of tiles) assert.match(t.href, /^\/report\//, `${t.label} stays inside the app`);
});

test('rows are ordered by what needs a look, carry per-scanner outcomes, and expand back to block props', () => {
  const data = resolveRowsData(fixtures, [{ id: 'redact-secret', name: 'redact-secret', rows: mine }, { id: 'peer', name: 'Peer', rows: peerRows }]);
  const rows = expandRows(data, data.items);
  // redact-secret problems first (a2 left readable, c1 flagged, b1 too much, p1 partly exposed policy), then peer-only problems, then the rest.
  assert.deepEqual(rows.map(r => r.slug), ['a2', 'c1', 'b1', 'p1', 'a3', 't0', 'a1']);
  assert.deepEqual(rows[0].outcomes.map(o => o.label), ['Left readable', 'Left readable']);
  assert.equal(rows[0].outcome.label, 'Left readable', 'the product column is redact-secret');
  assert.equal(rows[0].href, '/report/fixtures/s/?fixture=a2');
  assert.equal(rows.find(r => r.slug === 'p1').outcomes[0].status, 'info', 'a policy row is information, never a failure');
  assert.equal(rows.find(r => r.slug === 'a2').alsoIn, 'also in 1 other family');
  assert.equal(rows.find(r => r.slug === 't0').kind, 'Pending review');
  assert.ok(data.items.find(i => i.i === 'c1').f & FLAG.twin, 'a near-twin negative is flagged as one');
  assert.ok(data.items.find(i => i.i === 'a1').f & FLAG.twin, 'and the positive it was mutated from');
  assert.ok(data.statuses.length < data.items.length * 2, 'statuses and text are shared, not repeated per row');
  const noRun = expandRows(resolveRowsData(fixtures.slice(0, 1), [{ id: 'redact-secret', name: 'redact-secret', rows: undefined }]), resolveRowsData(fixtures.slice(0, 1), [{ id: 'redact-secret', name: 'redact-secret', rows: undefined }]).items);
  assert.equal(noRun[0].outcome.label, 'Not measured', 'with no run every row is not measured, never a pass');
});

test('row filters narrow by search, show and level, and the query lives in the URL', () => {
  const data = resolveRowsData(fixtures, [{ id: 'redact-secret', name: 'redact-secret', rows: mine }, { id: 'peer', name: 'Peer', rows: peerRows }]);
  const slugs = q => filterRows(data, q).items.map(i => i.i);
  assert.deepEqual(slugs({ q: '', show: 'leaked', level: 'all' }), ['a2', 'p1'], 'a policy span left readable is a leaked row too; its status word is information');
  assert.deepEqual(slugs({ q: '', show: 'flagged', level: 'all' }), ['c1']);
  assert.deepEqual(slugs({ q: '', show: 'twins', level: 'all' }).sort(), ['a1', 'c1']);
  assert.deepEqual(slugs({ q: '', show: 'all', level: 'T2' }), ['b1']);
  assert.deepEqual(slugs({ q: 'policy', show: 'all', level: 'all' }), ['p1']);
  assert.equal(filterRows(data, { q: 'zzz', show: 'all', level: 'all' }).resultText, '0 of 7 rows');
  assert.deepEqual(rowsQueryOf(new URLSearchParams('q=%20a%20&show=leaked&level=T1&scanners=all'), 'product'), { q: 'a', show: 'leaked', level: 'T1', scanners: 'all' });
  assert.deepEqual(rowsQueryOf(new URLSearchParams('show=bogus&scanners=zzz'), 'product'), { q: '', show: 'all', level: 'all', scanners: 'product' });
  assert.equal(rowsQueryString({ q: '', show: 'all', level: 'all', scanners: 'all' }, 'all'), '');
  assert.equal(rowsQueryString({ q: 'x', show: 'leaked', level: 'T2', scanners: 'all' }, 'product'), '?q=x&show=leaked&level=T2&scanners=all');
  assert.deepEqual(rowFacts(fixtures.slice(0, 4), mine, 'Rows').map(f => f.value), ['4', '1', '0', '1']);
});

// ---- The fixture page ----------------------------------------------------------------------------

const content = 'k=synth-01\n é value ';
const bytes = new TextEncoder().encode(content);
const built = (over = {}) => ({
  id: 'demo', slug: 's--demo', category: 's', group: 'g', path: 'cases/demo.txt', content,
  expected: [{ start: 2, end: 10, role: 'secret', envelope: { start: 0, end: 10, reason: 'the name may go with the value.' }, note: 'synthetic' }],
  detectors: ['det'], assessment: { kind: 'must-redact', tier: 'T1', contract: 'det', reason: 'Because.', sources: ['https://docs.example.com/x'] }, ...over,
});
const lane = (rows) => ({ id: 'p', name: 'Peer', version: '1.0.0', mode: 'Directory scan', status: 'complete', rows: new Map(rows) });
const suite = { id: 's', title: 'Suite S', description: '', reviewStatus: 'Reviewed 2026-09-30' };

test('bytes are cut at range boundaries in UTF-8 offsets, never in the middle of a character', () => {
  assert.deepEqual(byteLines(bytes).map(l => [l.start, l.end]), [[0, 11], [11, bytes.length]]);
  const pieces = segment(bytes, 11, bytes.length, [{ start: 12, end: 14 }]);
  assert.deepEqual(pieces.map(p => p.text), [' ', 'é', ' value '], 'a two-byte character stays whole');
});

test('the fixture page draws each scanner’s outcome as a shape under the bytes and lists what was reported', () => {
  const detail = resolveFixtureDetail({
    fixture: built(), entry: fx('demo', 'must-redact', 'T1', ['x:one']), suite,
    scanners: [
      lane([['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }]]),
      { id: 'q', name: 'Quiet', version: '2', mode: 'm', status: 'complete', rows: new Map([['s--demo', { spanOutcomes: ['PARTIAL'], actual: [{ start: 2, end: 6 }], leakedBytes: 4, collateralBytes: 0 }]]) },
      { id: 'm', name: 'Misser', version: '3', mode: 'm', status: 'complete', rows: new Map([['s--demo', { spanOutcomes: ['MISS'], actual: [] }]]) },
      { id: 'n', name: 'NoRow', version: '4', mode: 'm', status: 'complete', rows: new Map() },
    ],
    detectors: [{ id: 'det', title: 'Det' }], families: [{ id: 'x:one', name: 'One' }], twins: [], followUps: [{ number: 7, url: 'https://example.com/7', milestone: 'Beta.3' }],
  });
  assert.deepEqual(detail.scanners.map(s => s.name), ['Peer', 'Quiet', 'Misser'], 'a scanner with no row gets no lane');
  const first = detail.lines[0];
  assert.deepEqual(first.segments.map(s => [s.text, !!s.role, !!s.envelope]), [['k=', false, true], ['synth-01', true, true]].concat([['\n', false, false]]));
  assert.deepEqual(first.lanes.map(l => l.pieces.map(p => p.shape ?? '-')), [['-', 'fill', '-'], ['-', 'hatch', '-'], ['-', 'outline', '-']]);
  assert.equal(detail.lines[1].lanes.length, 0, 'a line nothing touches carries no lanes');
  assert.deepEqual(detail.reported.map(r => r.outcome[0].label), ['Redacted'.replace('Redacted', 'Exact'), 'Partly exposed', 'Missed', 'Not measured']);
  assert.equal(detail.reported[1].bytes, 'leaked 4 · outside envelope 0');
  assert.equal(detail.reported[3].ranges, '—');
  assert.match(detail.caption, /Secret bytes 2–10\. Envelope 0–10: the name may go with the value\. All values are synthetic test data\./);
  assert.deepEqual(detail.expected, [{ range: '[2, 10)', role: 'secret', value: 'synth-01', envelope: { range: '[0, 10)', reason: 'the name may go with the value.' }, note: 'synthetic' }]);
  assert.deepEqual(detail.facts.find(f => f.term === 'Issues').links, [{ label: 'Beta.3 #7', href: 'https://example.com/7' }]);
  assert.equal(detail.escaped, JSON.stringify(content));
  assert.equal(detail.detectors[0].href, '/report/detectors/det/');
  assert.equal(detail.families[0].href, '/report/families/x--one/');
});

test('a control has no secret spans and its verdicts are Quiet or Flagged; a policy row is information', () => {
  assert.deepEqual(verdictsOf('must-not-flag', { flagged: false }).map(v => v.label), ['Quiet']);
  assert.deepEqual(verdictsOf('must-not-flag', { flagged: true, findings: 3 }).map(v => v.label), ['Flagged ×3']);
  assert.equal(verdictsOf('policy', { spanOutcomes: ['MISS'] })[0].status, 'info');
  assert.equal(verdictsOf('must-redact', undefined, 'unstable')[0].label, 'Unstable');
  const control = resolveFixtureDetail({ fixture: built({ expected: [], assessment: { kind: 'must-not-flag', tier: 'T1' } }), entry: fx('demo', 'must-not-flag', 'T1', []), suite, scanners: [], detectors: [], families: [], twins: [], followUps: [], runProblem: 'No run.' });
  assert.match(control.caption, /^No authored secret spans\. Any finding on this file is a false alarm\./);
  assert.equal(control.runProblem, 'No run.');
  assert.deepEqual(control.expected, []);
  assert.equal(control.lines.filter(l => l.lanes.length).length, 0);
});

test('a row packs into a short string and back without loss', () => {
  for (const row of [
    { spanOutcomes: ['EXACT', 'MISS', 'PARTIAL', 'OVERBROAD', 'COVERED'], actual: [{ start: 0, end: 4 }, { start: 9, end: 12 }], leakedBytes: 3, collateralBytes: 0 },
    { flagged: true, findings: 2, actual: [{ start: 1, end: 5 }] },
    { flagged: false, actual: [] },
    { spanOutcomes: [], actual: [] },
  ]) assert.deepEqual(unpackRow(packRow(row)), { actual: [], ...row });
});

test('a table that fits a page ships whole; a larger one ships its first page and the path of the file with every row', () => {
  const many = Array.from({ length: 120 }, (_, i) => fx(`r${i}`, 'must-redact', 'T1', ['x:one']));
  const rows = new Map(many.map((f, i) => [f.slug, { spanOutcomes: [i < 60 ? 'MISS' : 'EXACT'] }]));
  const scanners = [{ id: 'redact-secret', name: 'redact-secret', rows }];
  const full = resolveRowsData(many, scanners);
  const big = rowsSource(full, rowsDataPath('suite', 's'));
  assert.equal(big.total, 120);
  assert.equal(big.src, 'rows/suite/s/rows.json');
  assert.equal(big.head.items.length, PAGE_SIZE);
  assert.deepEqual(expandRows(big.head, big.head.items), expandRows(full, full.items.slice(0, PAGE_SIZE)), 'the first page is the file\'s first page, row for row');
  assert.deepEqual(big.head.statuses.map(s => s.label), ['Left readable'], 'the head holds only the outcome words its rows use');
  assert.deepEqual(full.statuses.map(s => s.label).sort(), ['Left readable', 'Redacted']);
  assert.ok(big.head.dictionary.length <= full.dictionary.length);
  const small = rowsSource(resolveRowsData(many.slice(0, PAGE_SIZE), scanners), 'rows/suite/s/rows.json');
  assert.equal(small.src, undefined, 'a table that fits one page needs no file');
  assert.equal(small.head.items.length, PAGE_SIZE);
  assert.ok(isRowsData(JSON.parse(JSON.stringify(full))), 'the file round-trips as JSON');
  assert.ok(!isRowsData({ items: [] }) && !isRowsData(null), 'a file of another shape is refused');
});

test('the browser may request only the build-emitted rows and records files', () => {
  assert.ok(BUILD_DATA_PATH.test(rowsDataPath('level', 'T1')));
  assert.ok(BUILD_DATA_PATH.test(rowsDataPath('family', 'aws--iam-user-secret-access-key')));
  assert.ok(BUILD_DATA_PATH.test(rowsDataPath('detector', 'confluent-cloud-api-secret-legacy')));
  assert.ok(BUILD_DATA_PATH.test(recordsDataPath('detector-coverage')));
  for (const bad of ['https://example.com/x.json', '//example.com/rows/level/T1/rows.json', '/rows/level/T1/rows.json', 'rows/level/../x/rows.json', 'rows/level/T1/rows.json?x=1', 'rows/other/T1/rows.json', 'rows/level/T1/rows.txt', 'results/summary.json', 'fixtures/a/b/records.json', 'rows/level/T1/rows.json/']) {
    assert.ok(!BUILD_DATA_PATH.test(bad), bad);
  }
});

test('a suite page ships compact records and rebuilds the same fixture page in the browser', () => {
  const entry = fx('demo', 'must-redact', 'T1', ['x:one'], { detectors: ['det'] });
  const twin = fx('demo-twin', 'must-not-flag', 'T1', [], { twinOf: 's--demo', detectors: ['det'] });
  const bytesBySlug = new Map([['s--demo', built()], ['s--demo-twin', built({ id: 'demo-twin', slug: 's--demo-twin', twinOf: 'demo', expected: [], assessment: { kind: 'must-not-flag', tier: 'T1', reason: 'Because.', sources: ['https://docs.example.com/x'] } })]]);
  const scanners = [lane([['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }]])];
  const { records, shared } = buildSuiteRecords({
    suite, fixtures: [entry, twin], bytes: bytesBySlug, scanners, findings: [{ number: 7, url: 'https://example.com/7', milestone: 'Beta.3', fixtures: ['s--demo'] }],
    detectorTitles: new Map([['det', 'Det']]), familyNames: new Map([['x:one', 'One']]),
  });
  assert.equal(shared.assessments.length, 1, 'one reason and one source list are held once');
  assert.deepEqual(records.map(r => r.twins), [['demo-twin'], []]);
  assert.deepEqual(records[0].followUps, [0]);
  assert.equal(records[1].rows[0], null, 'a fixture the scanner holds no row for is null, not a pass');
  const direct = resolveFixtureDetail({ fixture: bytesBySlug.get('s--demo'), entry, suite, scanners, detectors: [{ id: 'det', title: 'Det' }], families: [{ id: 'x:one', name: 'One' }], twins: [twin], followUps: [{ number: 7, url: 'https://example.com/7', milestone: 'Beta.3' }] });
  const rebuilt = resolveFixtureRecord(records[0], shared);
  for (const k of ['lines', 'expected', 'reported', 'caption', 'scanners', 'detectors', 'families', 'escaped', 'size', 'path']) assert.deepEqual(rebuilt[k], direct[k], k);
  assert.deepEqual(rebuilt.facts.find(f => f.term === 'Negative twins').links, [{ label: 'demo-twin', href: '/report/fixtures/s/?fixture=demo-twin' }]);
});

// ---- Detectors, findings, suites --------------------------------------------------------------------

const detCatalog = {
  detectors: [{ id: 'big', title: 'Big' }, { id: 'edge', title: 'Edge' }, { id: 'thin', title: 'Thin' }, { id: 'none', title: 'None' }],
  fixturesByDetector: new Map([['big', Array.from({ length: 9 }, (_, i) => fx(`f${i}`, 'must-redact', 'T1', []))], ['edge', Array.from({ length: 5 }, (_, i) => fx(`e${i}`, 'must-redact', 'T1', []))], ['thin', [fx('t', 'must-redact', 'T1', [])]], ['none', []]]),
  suites: [{ id: 's', title: 'Suite S' }],
};

test('the detector list is largest first with the minimum sample size marked, and never sums overlapping counts', () => {
  const list = resolveDetectorList(detCatalog, 5);
  assert.deepEqual(list.map(d => [d.id, d.fixtures, d.flag?.label]), [['big', '9', undefined], ['edge', '5', 'At minimum'], ['thin', '1', 'Below minimum'], ['none', '0', 'Below minimum']]);
  assert.equal(list[0].max, 9);
  assert.equal(list[0].href, '/report/detectors/big/');
});

test('a detector page shows the run’s own figures per group with the other scanners’ figure for the same cell', () => {
  const summary = {
    ...run.summary,
    byDetector: { big: {
      'redact-secret': {
        'must-redact/T1': { ...group(9, 10, 1), outcomes: { EXACT: 8, COVERED: 1, OVERBROAD: 1, PARTIAL: 0, MISS: 0 }, twins: { pairs: 4, discriminated: 4, rate: { point: 1, bound: 0.5, n: 4, direction: 'lower' } } },
        'must-not-flag/T1': { files: 5, flaggedFiles: 1, falseAlarmRate: 'insufficient-evidence' },
        'pending/T0': { files: 2, scored: false },
      },
      peer: { 'must-redact/T1': { ...group(9, 10, 6), outcomes: { EXACT: 3, COVERED: 0, OVERBROAD: 0, PARTIAL: 3, MISS: 3 }, twins: { pairs: 0, discriminated: 0, rate: null } } },
    } },
  };
  const d = resolveDetector(detCatalog, 'big', { ...run, summary }, { tier: 'T1', sources: [{ href: 'https://docs.example.com', label: 'Provider documentation' }] }, 5);
  assert.deepEqual(d.groups.map(g => g.group), ['Must not flag · Provider-documented', 'Must redact · Provider-documented', 'Pending review']);
  const redact = d.groups[1];
  assert.deepEqual(redact.headline, { label: 'Secret spans left readable', value: 'at most 20.0%', note: '1 of 10 spans' });
  assert.deepEqual(redact.secondary, { label: 'Near-twins told apart', value: 'at least 50.0%', note: '4 of 4 pairs' });
  assert.deepEqual(redact.others, [{ scanner: 'Peer', value: 'at most 20.0%' }]);
  assert.equal(redact.outcomes.text, '9 redacted · 1 too much · 0 partly exposed · 0 missed');
  assert.equal(d.groups[0].headline.value, 'insufficient-evidence', 'a withheld rate shows its reason verbatim');
  assert.equal(d.groups[0].others[0].value, 'Not measured', 'a scanner with no figure for the cell is not measured');
  assert.equal(d.groups[2].headline.value, 'Not scored');
  assert.equal(d.tier, 'T1');
  assert.equal(d.suites.length, 1);
  assert.deepEqual(resolveDetector(detCatalog, 'none', undefined, undefined, 5).groups, [], 'no run, no groups');
  assert.equal(resolveDetector(detCatalog, 'nope', undefined, undefined, 5), undefined);
  assert.equal(boundText(rate(0.1, 0.2, 5)), 'at most 20.0%');
  assert.equal(boundText(null), 'Not measured');
});

test('the findings inventory links a fixture the corpus holds and leaves one it does not as text', () => {
  const inventory = resolveFindingsInventory(gaps, { bySlug: new Map([['s--c1', fixtures[3]], ['s--a2', fixtures[1]]]) });
  assert.deepEqual(inventory.rows.map(r => r.number), ['#2', '#1'], 'newest first');
  assert.deepEqual(inventory.rows[1].fixtures, [{ label: 'c1', href: '/report/fixtures/s/?fixture=c1' }, { label: 'gone' }]);
  assert.equal(inventory.rows[0].status.label, 'Policy');
  assert.equal(inventory.milestone.href, 'https://example.com/m');
  assert.match(inventory.description, /not live issue status/);
  assert.equal(milestoneLabel('v0.1.0-beta.4'), 'Beta.4');
});

test('suites resolve to counts, and a suite with no fixtures is not zeros', () => {
  const rows = resolveSuiteRows({ suites: [{ id: 's', title: 'S', description: 'd' }, { id: 'e', title: 'E', description: 'd' }], fixturesBySuite: new Map([['s', fixtures], ['e', []]]) }, mine);
  assert.equal(rows[0].fixtures, '7');
  assert.equal(rows[0].href, '/report/fixtures/s/');
  assert.equal(rows[1].counts, null);
  assert.equal(fixtureHref({ category: 'a', id: 'b c' }), '/report/fixtures/a/?fixture=b%20c');
});

// ---- Layering -----------------------------------------------------------------------------------------

const walk = dir => readdirSync(dir, { withFileTypes: true, recursive: true }).filter(e => e.isFile()).map(e => path.join(e.parentPath, e.name));

test('the resolvers a client island may run import nothing from node and no service at runtime', () => {
  const pure = ['filters', 'rowdata', 'rows', 'fixtures', 'families', 'format', 'peers', 'detectors', 'inventory', 'report'];
  for (const name of pure) {
    const source = readFileSync(`web/resolvers/${name}.ts`, 'utf8');
    assert.doesNotMatch(source, /from\s+['"]node:/, `${name}.ts imports node`);
    assert.doesNotMatch(source, /^\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*services[^'"]*['"]/m, `${name}.ts imports a service at runtime`);
  }
  for (const file of walk('web/app').filter(f => /\.tsx?$/.test(f))) {
    const source = readFileSync(file, 'utf8');
    if (!/^'use client'/m.test(source)) continue;
    assert.doesNotMatch(source, /resolvers\/pages/, `${file} is a client component and imports the page resolvers`);
  }
});
