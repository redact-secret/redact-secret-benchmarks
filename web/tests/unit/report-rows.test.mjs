// Unit tests for the pure resolvers behind the peer columns, the rows, fixture, detector and
// findings pages (#558, #559). Synthetic catalog, run and ledger data only: no credentials, no
// filesystem reads by the code under test, and fixture bytes that are obviously fake.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { agreesWithSummary, inputsAt, sliceInputs } from '../../resolvers/peers.ts';
import { resolvePeers, resolveAnswers, resolveHubTiles } from '../../resolvers/report.ts';
import { resolveFamilyList } from '../../resolvers/families.ts';
import { FLAG, expandRows, fixtureHref, resolveRowsData, rowFacts, rowsSource } from '../../resolvers/rows.ts';
import { isRowsData } from '../../resolvers/rowdata.ts';
import { BUILD_DATA_PATH, recordsDataPath, rowsDataPath } from '../../lib/data-paths.ts';
import { PAGE_SIZE, filterRows, rowsQueryOf, rowsQueryString } from '../../resolvers/filters.ts';
import { boundText, resolveDetector, resolveDetectorList } from '../../resolvers/detectors.ts';
import { milestoneLabel, resolveFindingsInventory, ledgerStamp, resolveSuiteRows } from '../../resolvers/inventory.ts';
import { buildSuiteRecords, byteLines, changedRanges, isSuiteRecordsFile, packRow, resolveFixtureRecord, segment, unpackRow, verdictsOf } from '../../resolvers/fixtures.ts';
const WEB = path.resolve(import.meta.dirname, '../..');

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
  id: 'demo', slug: 's--demo', category: 's', group: '#1 · demo · sdk-config', path: 'cases/demo.txt', content, contextAxis: 'sdk-config',
  expected: [{ start: 2, end: 10, role: 'secret', envelope: { start: 0, end: 10, reason: 'the name may go with the value.' }, note: 'synthetic' }],
  detectors: ['det'], assessment: { kind: 'must-redact', tier: 'T1', contract: 'det', reason: 'Because.', sources: ['https://docs.example.com/x/y/z'] }, ...over,
});
const scanner = (id, name, rows, over = {}) => ({ id, name, version: '1.0.0', mode: 'Directory scan', status: 'complete', rows: new Map(rows), observations: [{ observedAt: '2026-09-29T10:00:00Z' }], ...over });
const suite = { id: 's', title: 'Suite S', description: '', reviewStatus: 'Reviewed 2026-09-30' };
const hashOf = slug => `${slug.length.toString(16).padStart(2, '0')}abcdef0123456789`.padEnd(64, '0');

/** Records and shared text of one synthetic suite, then the page of one fixture. */
function suiteOf(items, scanners, over = {}) {
  const fixtures = items.map(i => i.entry);
  const out = buildSuiteRecords({
    suite, fixtures, bytes: new Map(items.map(i => [i.entry.slug, i.built])), hashes: new Map(items.map(i => [i.entry.slug, hashOf(i.entry.slug)])), scanners,
    run: { date: '2026-09-30', mode: 'published' }, findings: [{ number: 7, url: 'https://example.com/7', milestone: 'Beta.3', fixtures: ['s--demo'] }],
    detectorTitles: new Map([['det', 'Det']]), familyNames: new Map([['x:one', 'One']]), providerNames: new Map([['x:one', 'Ex']]),
    scenarioTitles: new Map([['ctx', 'Context and encoding']]), ...over,
  });
  const page = id => resolveFixtureRecord(out.records.find(r => r.id === id), out.shared, out.records);
  return { ...out, page };
}
const demoEntry = (over = {}) => fx('demo', 'must-redact', 'T1', ['x:one'], { detectors: ['det'], scenarioIds: ['ctx'], milestone: 'beta.8', ...over });

test('bytes are cut at range boundaries in UTF-8 offsets, never in the middle of a character', () => {
  assert.deepEqual(byteLines(bytes).map(l => [l.start, l.end]), [[0, 11], [11, bytes.length]]);
  const pieces = segment(bytes, 11, bytes.length, [{ start: 12, end: 14 }]);
  assert.deepEqual(pieces.map(p => p.text), [' ', 'é', ' value '], 'a two-byte character stays whole');
  assert.deepEqual(pieces.map(p => [p.start, p.end]), [[11, 12], [12, 14], [14, bytes.length]]);
});

test('the input marks what was expected and the output draws what redact-secret reported, exposed bytes included', () => {
  const { page } = suiteOf([{ entry: demoEntry(), built: built() }], [
    scanner('redact-secret', 'redact-secret', [['s--demo', { spanOutcomes: ['PARTIAL'], actual: [{ start: 2, end: 6 }], leakedBytes: 4, collateralBytes: 0 }]]),
    scanner('q', 'Quiet', [['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }]]),
    scanner('n', 'NoRow', []),
  ]);
  const detail = page('demo');
  const segs = row => row.segments.map(x => [x.text, x.mark ?? '-', !!x.envelope]);
  assert.deepEqual(segs(detail.input.rows[0]), [['k=', '-', true], ['synth-01', 'expected', true]], 'the secret sits inside its envelope; the line break is not drawn');
  assert.equal(detail.input.rows[0].segments[1].title, 'Expected secret, bytes 2 to 10');
  assert.deepEqual(segs(detail.output.rows[0]), [['k=', '-', false], ['synt', 'partial', false], ['h-01', 'exposed', false]], 'a range over a partly exposed secret is hatched; the bytes it leaves are a dashed frame');
  assert.equal(detail.output.rows[0].segments[1].label, 'redacted, a secret is partly exposed, 4 bytes');
  assert.equal(detail.input.facts, '21 bytes · LF · UTF-8');
  assert.equal(detail.output.title, '1 range reported');
  assert.equal(detail.output.note, 'bytes 2–6');
  assert.deepEqual(detail.key.map(k => k.mark), ['expected', 'envelope', 'partial', 'exposed']);
  assert.deepEqual(detail.spans.map(r => [r.label, r.expected.range, r.reported.map(x => x.range), r.outcome.label, r.outcomeNote]), [['Secret 1', '2–10', ['2–6'], 'Partly exposed', 'Reported ranges overlap it but none contains it']]);
  assert.equal(detail.spans[0].expected.envelope, '0–10: the name may go with the value');
  assert.deepEqual(detail.verdict.headline, { status: 'fail', label: 'Left readable' });
  assert.deepEqual(detail.verdict.figures, [{ label: 'Secret spans covered', value: '0', of: 'of 1' }, { label: 'Bytes left readable', value: '4' }, { label: 'Bytes redacted outside the envelope', value: '0' }]);
  assert.match(detail.verdict.who, /^redact-secret 1\.0\.0$/);
  assert.equal(detail.verdict.run, 'published run 2026-09-30');
  // The other scanners: the product is not among them, a scanner with no row is not measured, ranges are as recorded.
  assert.deepEqual(detail.peers.rows.map(r => [r.name, r.fixture.map(x => x.label), r.ranges]), [['Quiet 1.0.0', ['Exact'], '[2, 10)'], ['NoRow 1.0.0', ['Not measured'], '—']]);
  assert.equal(detail.peers.summary, 'Same input, 2 other scanners');
  assert.match(detail.peers.rows[0].detail, /^Results from 2026-09-29 · Directory scan/);
  assert.equal(detail.peers.relatedHeading, undefined, 'no twin, no related column');
  assert.deepEqual(detail.peers.lanes.scanners.map(s => s.name), ['redact-secret', 'Quiet'], 'a scanner with no row gets no lane');
});

test('an exact outcome is said in words, and a control is Quiet or Flagged with its ranges listed', () => {
  const exactRow = { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 };
  const control = (id, row) => ({ entry: fx(id, 'must-not-flag', 'T1', []), built: built({ id, slug: `s--${id}`, expected: [], assessment: { kind: 'must-not-flag', tier: 'T1', reason: 'Because.', sources: [] } }), row });
  const items = [{ entry: demoEntry(), built: built() }, control('quiet'), control('flagged')];
  const { page } = suiteOf(items, [scanner('redact-secret', 'redact-secret', [['s--demo', exactRow], ['s--quiet', { flagged: false, actual: [] }], ['s--flagged', { flagged: true, findings: 2, actual: [{ start: 0, end: 3 }, { start: 5, end: 9 }] }]])]);
  const exact = page('demo');
  assert.deepEqual(exact.verdict.headline, { status: 'pass', label: 'Redacted exactly' });
  assert.equal(exact.verdict.explanation, 'It reported one range that starts and ends on the same bytes as the expected secret.');
  assert.deepEqual(exact.verdict.figures[0], { label: 'Secret spans covered', value: '1', of: 'of 1' });
  assert.equal(exact.peers, undefined, 'the only scanner is the product: no other scanners to list');
  const quiet = page('quiet');
  assert.deepEqual(quiet.verdict.headline, { status: 'pass', label: 'Quiet' });
  assert.deepEqual(quiet.spans, [], 'a quiet control has no span rows');
  assert.match(quiet.spansLede, /^No secret is expected in this file\. Any reported range is a false alarm\./);
  assert.equal(quiet.output.title, 'no range reported');
  const flagged = page('flagged');
  assert.deepEqual(flagged.verdict.headline, { status: 'fail', label: 'Flagged' });
  assert.deepEqual(flagged.spans.map(r => [r.label, r.reported[0].range, r.outcome.label]), [['Reported range 1', '0–3', 'Flagged'], ['Reported range 2', '5–9', 'Flagged']]);
  assert.deepEqual(flagged.output.rows[0].segments.map(x => x.mark ?? '-'), ['extra', '-', 'extra', '-'], 'ranges on a control are bars');
  assert.equal(flagged.verdict.figures[2].value, '7', 'the bytes in the reported ranges, as recorded');
});

test('a policy row is information, an overbroad one is a review, a missed one is left readable', () => {
  const run = rows => suiteOf([{ entry: demoEntry({ kind: 'policy', tier: 'T3' }), built: built({ assessment: { kind: 'policy', tier: 'T3', reason: 'Policy.', sources: [] } }) }], [scanner('redact-secret', 'redact-secret', [['s--demo', rows]])]).page('demo');
  assert.deepEqual(run({ spanOutcomes: ['MISS'], actual: [] }).verdict.headline, { status: 'info', label: 'Left readable' });
  assert.equal(run({ spanOutcomes: ['MISS'], actual: [] }).spans[0].outcome.status, 'info');
  const over = suiteOf([{ entry: demoEntry(), built: built() }], [scanner('redact-secret', 'redact-secret', [['s--demo', { spanOutcomes: ['OVERBROAD'], actual: [{ start: 0, end: 20 }], leakedBytes: 0, collateralBytes: 10 }]])]).page('demo');
  assert.deepEqual(over.verdict.headline, { status: 'review', label: 'Redacted past the envelope' });
  assert.equal(over.verdict.figures[2].value, '10');
  assert.equal(verdictsOf('policy', { spanOutcomes: ['MISS'] })[0].status, 'info');
  assert.deepEqual(verdictsOf('must-not-flag', { flagged: false }).map(v => v.label), ['Quiet']);
  assert.deepEqual(verdictsOf('must-not-flag', { flagged: true, findings: 3 }).map(v => v.label), ['Flagged ×3']);
  assert.equal(verdictsOf('must-redact', undefined, 'unstable')[0].label, 'Unstable');
});

test('a fixture with no row, or a run that left the suite out, says Not measured and why, never a pass', () => {
  const none = suiteOf([{ entry: demoEntry(), built: built() }], [scanner('redact-secret', 'redact-secret', [])]).page('demo');
  assert.deepEqual(none.verdict.headline, { status: 'not-measured', label: 'Not measured' });
  assert.equal(none.verdict.explanation, 'The run holds no row for these bytes.');
  assert.deepEqual(none.verdict.figures, []);
  assert.equal(none.output, undefined);
  assert.equal(none.outputNote, 'The run holds no row for these bytes.');
  assert.deepEqual(none.spans[0].outcome, { status: 'not-measured', label: 'Not measured' });
  assert.equal(none.spans[0].reportedNote, 'not measured');
  const left = suiteOf([{ entry: demoEntry(), built: built() }], [], { run: undefined, runProblem: 'No benchmark run is published for this checkout.' }).page('demo');
  assert.equal(left.verdict.run, 'no run recorded');
  assert.equal(left.verdict.explanation, 'No benchmark run is published for this checkout.');
  assert.equal(left.runProblem, 'No benchmark run is published for this checkout.');
  assert.equal(left.input.rows.length, 2, 'the expectation stands without a run');
  const incomplete = suiteOf([{ entry: demoEntry(), built: built() }], [scanner('redact-secret', 'redact-secret', [], { status: 'unstable' })]).page('demo');
  assert.equal(incomplete.verdict.explanation, 'redact-secret did not complete in this run (unstable).');
});

test('a candidate run names the build and its commit', () => {
  const detail = suiteOf([{ entry: demoEntry(), built: built() }], [scanner('redact-secret', 'redact-secret', [['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }]])], { run: { date: '2026-10-01', mode: 'candidate', commit: '1a2b3c4d5e6f' } }).page('demo');
  assert.equal(detail.verdict.who, 'redact-secret candidate main 1a2b3c4');
  assert.equal(detail.verdict.run, 'candidate run 2026-10-01');
});

test('what the corpus does not hold is stated as not recorded, and what it holds is shown as recorded', () => {
  const { page, records, shared } = suiteOf([{ entry: demoEntry(), built: built() }], [scanner('redact-secret', 'redact-secret', [])]);
  const detail = page('demo');
  const fact = term => detail.facts.find(f => f.term === term);
  assert.equal(fact('What it tests').notRecorded, true, 'the corpus has no description of what a fixture tests');
  assert.match(fact('What it tests').note, /group label, “#1 · demo · sdk-config”/);
  assert.equal(fact('Why it must be redacted').value, 'Because.');
  assert.deepEqual(fact('Family').links, [{ label: 'One', href: '/report/families/x--one/' }]);
  assert.deepEqual(fact('Detector').links, [{ label: 'Det', href: '/report/detectors/det/' }]);
  assert.equal(fact('Scenarios').value, 'Context and encoding');
  assert.equal(fact('Context axis').value, 'sdk-config');
  assert.equal(fact('Added').value, 'Beta.8 · suite Suite S');
  assert.deepEqual(fact('Issues').links, [{ label: 'Issue #1', href: 'https://github.com/redact-secret/redact-secret/issues/1', external: true }, { label: 'Beta.3 #7', href: 'https://example.com/7', external: true }], 'the issue the group label names, as the old page read it, then the findings that rest on the fixture');
  assert.equal(fact('File').note, '21 bytes · sha256 ' + hashOf('s--demo').slice(0, 12) + '…');
  assert.deepEqual(detail.sources, [{ href: 'https://docs.example.com/x/y/z', label: 'docs.example.com/x/y' }]);
  assert.equal(detail.escaped, JSON.stringify(content));
  assert.equal(detail.command, 'npm run bench -- --category=s');
  assert.equal(detail.head.eyebrow, 'Fixture · must redact');
  assert.deepEqual(detail.head.tags.map(t => t.label), ['Must redact', 'T1 · Provider-documented', 'sdk-config', 'Synthetic value']);
  assert.deepEqual(detail.crumbs.map(c => c.label), ['Report', 'Providers', 'Ex', 'One', 'demo']);
  assert.equal(detail.crumbs[3].href, '/report/families/x--one/');
  // A fixture without a reason or a family says so instead of leaving a blank.
  const bare = suiteOf([{ entry: fx('bare', 'must-redact', 'T0', [], { unscopedReason: 'No provider owns this shape.', detectors: [] }), built: built({ id: 'bare', slug: 's--bare', contextAxis: undefined, assessment: { kind: 'must-redact', tier: 'T0', sources: [] } }) }], []).page('bare');
  assert.equal(bare.facts.find(f => f.term === 'Why it must be redacted').notRecorded, true);
  assert.deepEqual(bare.facts.find(f => f.term === 'Family'), { term: 'Family', value: 'None', note: 'No provider owns this shape.' });
  assert.deepEqual(bare.crumbs.map(c => c.label), ['Report', 'Suites', 'Suite S', 'bare']);
  assert.match(bare.facts.find(f => f.term === 'Evidence level').note, /excluded from comparative scores/);
  // The records hold a label once, however many fixtures share it.
  assert.equal(shared.texts.filter(t => t === '#1 · demo · sdk-config').length, 1);
  assert.equal(records[0].sha.length, 12);
});

test('the exact bytes can be taken as a file, and text that cannot be encoded says so', () => {
  const detail = suiteOf([{ entry: demoEntry(), built: built() }], []).page('demo');
  assert.equal(detail.actions.download.filename, 'demo.txt');
  assert.equal(decodeURIComponent(detail.actions.download.href.replace('data:text/plain;charset=utf-8,', '')), content);
  assert.equal(detail.actions.corpusHref, '/report/fixtures/s/');
  const lone = suiteOf([{ entry: demoEntry(), built: built({ content: 'a\ud800b', expected: [] }) }], []).page('demo');
  assert.equal(lone.actions.download, undefined, 'a lone surrogate cannot be saved as UTF-8: no link is better than a wrong file');
  assert.match(lone.input.notice, /1 character that is not valid text/);
});

test('characters nobody can see are named, in a notice under the file', () => {
  const hidden = '\ufeffkey=v\u200b\r\nx\u0000\n';
  const detail = suiteOf([{ entry: demoEntry(), built: built({ content: hidden, expected: [{ start: 7, end: 8, role: 'secret' }] }) }], []).page('demo');
  assert.equal(detail.input.facts, '16 bytes · mixed line endings · UTF-8 with BOM');
  assert.match(detail.input.notice, /3 characters that are not normally visible \(U\+FEFF, U\+200B, U\+0000\), drawn as symbols\./);
  assert.equal(suiteOf([{ entry: demoEntry(), built: built() }], []).page('demo').input.notice, undefined, 'ordinary text carries no notice');
});

test('a long file keeps the lines a mark touches with one line of context and counts the rest', () => {
  const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
  const long = `${lines.join('\n')}\n`;
  const start = new TextEncoder().encode(lines.slice(0, 60).join('\n') + '\n').length;
  const detail = suiteOf([{ entry: demoEntry(), built: built({ content: long, expected: [{ start, end: start + 4, role: 'secret' }] }) }], [scanner('redact-secret', 'redact-secret', [['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start, end: start + 4 }], leakedBytes: 0, collateralBytes: 0 }]])]).page('demo');
  assert.deepEqual(detail.input.rows.map(r => ('gap' in r ? `gap ${r.gap}` : r.number)), ['gap 59', 60, 61, 62, 'gap 38'], 'the marked line and one of context each side; 97 of 100 lines are counted, not shown');
});

test('a twin is held against its original with the changed bytes boxed, and each is the other’s related file', () => {
  assert.deepEqual(changedRanges(new TextEncoder().encode('abcdef'), new TextEncoder().encode('abXdeY')), [{ start: 2, end: 3 }, { start: 5, end: 6 }]);
  assert.deepEqual(changedRanges(new TextEncoder().encode('abcdef'), new TextEncoder().encode('abXXef')), [{ start: 2, end: 4 }], 'adjacent bytes are one range');
  assert.deepEqual(changedRanges(new TextEncoder().encode('abcdef'), new TextEncoder().encode('abcZZdef')), [{ start: 3, end: 5 }], 'a longer file: the prefix and suffix they share are left out');
  assert.deepEqual(changedRanges(new TextEncoder().encode('abc'), new TextEncoder().encode('abc')), []);
  const twinContent = content.replace('synth-01', 'synth!01');
  const items = [
    { entry: demoEntry(), built: built() },
    { entry: fx('demo-twin', 'must-not-flag', 'T1', [], { twinOf: 's--demo', detectors: ['det'] }), built: built({ id: 'demo-twin', slug: 's--demo-twin', path: 'cases/demo-twin.txt', content: twinContent, twinOf: 'demo', mutationKind: 'alphabet', mutation: 'alphabet: one character replaced with !', expected: [], assessment: { kind: 'must-not-flag', tier: 'T1', reason: 'Twin.', sources: [] } }) },
  ];
  const { page } = suiteOf(items, [
    scanner('redact-secret', 'redact-secret', [['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }], ['s--demo-twin', { flagged: false, actual: [] }]]),
    scanner('g', 'Gitleaks', [['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }], ['s--demo-twin', { flagged: true, findings: 1, actual: [{ start: 2, end: 10 }] }]]),
  ]);
  const positive = page('demo');
  assert.equal(positive.twins.heading, 'Its near-twin');
  const item = positive.twins.items[0];
  assert.deepEqual([item.id, item.title, item.changed, item.linkLabel, item.href], ['demo-twin', 'Alphabet twin', 'byte 7 changed', 'Open the twin', '/report/fixtures/s/?fixture=demo-twin']);
  assert.equal(item.description, 'alphabet: one character replaced with !');
  assert.deepEqual(item.file.rows[0].segments.map(x => [x.text, x.mark ?? '-']), [['k=synth', '-'], ['!', 'changed'], ['01', '-']]);
  assert.deepEqual(item.outcome, [{ status: 'pass', label: 'Quiet' }]);
  assert.equal(item.outcomeNote, 'redact-secret flagged nothing');
  assert.equal(positive.peers.relatedHeading, 'Its twin');
  assert.deepEqual(positive.peers.rows[0].related, [{ label: 'demo-twin', outcome: [{ status: 'fail', label: 'Flagged' }] }], 'what another scanner recorded on the twin is a fact, shown without comment');
  const twin = page('demo-twin');
  assert.equal(twin.twins.heading, 'Its original');
  assert.equal(twin.twins.items[0].title, 'The original');
  assert.equal(twin.twins.items[0].linkLabel, 'Open the original');
  assert.equal(twin.twins.items[0].file.rows[0].segments.find(x => x.mark === 'changed').text, '-', 'the original’s own byte is the one boxed');
  assert.equal(twin.peers.relatedHeading, 'Its original');
  assert.equal(twin.verdict.headline.label, 'Quiet');
  assert.equal(twin.input.rows.length, 2);
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

test('a suite page ships compact records, shared text once, and rebuilds the same fixture page after a round trip through JSON', () => {
  const twinBuilt = built({ id: 'demo-twin', slug: 's--demo-twin', twinOf: 'demo', expected: [], assessment: { kind: 'must-not-flag', tier: 'T1', reason: 'Because.', sources: ['https://docs.example.com/x/y/z'] } });
  const items = [{ entry: demoEntry(), built: built() }, { entry: fx('demo-twin', 'must-not-flag', 'T1', [], { twinOf: 's--demo', detectors: ['det'], scenarioIds: ['ctx'] }), built: twinBuilt }];
  const { records, shared, page } = suiteOf(items, [scanner('redact-secret', 'redact-secret', [['s--demo', { spanOutcomes: ['EXACT'], actual: [{ start: 2, end: 10 }], leakedBytes: 0, collateralBytes: 0 }]])]);
  assert.equal(shared.assessments.length, 1, 'the same reason and sources, held by two fixtures, are shipped once');
  assert.equal(shared.texts.filter(t => t === '#1 · demo · sdk-config').length, 1, 'a group label shared by two fixtures is held once');
  assert.deepEqual(shared.scenarios, [{ id: 'ctx', title: 'Context and encoding' }]);
  assert.deepEqual(shared.scanners[0].observed, ['2026-09-29']);
  assert.deepEqual(shared.run, { date: '2026-09-30', mode: 'published' });
  assert.deepEqual(shared.providerNames, { 'x:one': 'Ex' });
  assert.deepEqual(records.map(r => r.twins), [['demo-twin'], []]);
  assert.deepEqual(records[0].followUps, [0]);
  assert.deepEqual(records[0].scenarios, [0]);
  assert.equal(records[1].rows[0], null, 'a fixture the scanner holds no row for is null, not a pass');
  assert.match(records[0].sha, /^[0-9a-f]{12}$/);
  const wire = JSON.parse(JSON.stringify({ records, shared }));
  assert.ok(isSuiteRecordsFile(wire));
  assert.deepEqual(resolveFixtureRecord(wire.records[0], wire.shared, wire.records), page('demo'), 'the browser builds exactly what the build would');
  assert.ok(!isSuiteRecordsFile({ records: [], shared: { scanners: [], assessments: [], category: 's' } }), 'a file from before the texts and scenarios were added is refused');
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

test('the ledger stamp reads as the last review and measurement, derived from the header and never a milestone', () => {
  const base = { reviewedAt: '2030-02-03', measuredVersion: '9.9.9' };
  assert.equal(ledgerStamp(base), 'Ledger last reviewed 2030-02-03; last measured release 9.9.9.');
  const stamp = ledgerStamp({ ...base, reverification: { fixed: { records: 4, allFixturesPass: 4, notCovered: [], stillFailing: [] }, verified: { records: 3, allFixturesPass: 1, notCovered: [7], stillFailing: [8] } } });
  assert.match(stamp, /last measured release 9\.9\.9, when 5 of 7 fixed and verified records were confirmed against the accepted run and 2 kept their status/);
  assert.doesNotMatch(stamp, /milestone/i);
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
  const pure = ['filters', 'rowdata', 'rows', 'fixtures', 'families', 'format', 'peers', 'detectors', 'inventory', 'report', 'evaluation-checks-view', 'qualification'];
  for (const name of pure) {
    const source = readFileSync(`${WEB}/resolvers/${name}.ts`, 'utf8');
    assert.doesNotMatch(source, /from\s+['"]node:/, `${name}.ts imports node`);
    assert.doesNotMatch(source, /^\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*services[^'"]*['"]/m, `${name}.ts imports a service at runtime`);
  }
  for (const file of walk(WEB + '/app').filter(f => /\.tsx?$/.test(f))) {
    const source = readFileSync(file, 'utf8');
    if (!/^'use client'/m.test(source)) continue;
    assert.doesNotMatch(source, /resolvers\/pages/, `${file} is a client component and imports the page resolvers`);
  }
});
