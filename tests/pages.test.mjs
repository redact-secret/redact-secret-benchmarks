import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { buildCatalog } from '../src/model.mjs';
import { scoreReport } from '../benchmarks/lib/reporting.ts';
import { accountGroups } from '../benchmarks/lib/accounting.ts';
import { summarizeRun } from '../benchmarks/lib/run-summary.ts';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const categories = await read('benchmarks/categories.json');
const registry = await read('benchmarks/detectors.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const corpora = Object.fromEntries(await Promise.all(categories.map(async c => [c.id, await read(c.corpus)])));
const fixtures = buildCatalog(categories, corpora, assignments, registry.detectors);
const accounting = (await read('qualification/suite-v1.json')).accounting;
const runId = '2026-09-19T12:00:00.000Z-0a0b0c';
const percent = v => `${(v * 100).toFixed(1)}%`;
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

/** The product reports every secret exactly; one reference scanner reports nothing; one never ran. */
const exact = list => list.flatMap(f => f.expected.filter(s => (s.role ?? 'secret') === 'secret').map(s => ({ path: f.path, start: s.start, end: s.end })));
const reports = categories.map(c => ({
  schemaVersion: 5, accountingVersion: '1.1', accounting, runId, category: c.id, generatedAt: '2026-09-19T12:00:01.000Z', reviewStatus: 'draft', corpusHash: 'hash', lockHash: 'lock', revision: 'r', dirty: false,
  runtime: { node: 'v22', platform: 'darwin', arch: 'arm64' }, matching: 'v4', fixtureCount: corpora[c.id].fixtures.length, expectedCount: 0,
  scanners: [
    { id: 'redact-secret', name: 'redact-secret', mode: 'test', version: '0.1.0-test', status: 'complete', ...scoreReport(corpora[c.id].fixtures, exact(corpora[c.id].fixtures), accounting) },
    { id: 'silent', name: 'Silent', mode: 'test', version: '1', status: 'complete', ...scoreReport(corpora[c.id].fixtures, [], accounting) },
    { id: 'absent', name: 'Absent', mode: 'test', version: null, status: 'unavailable', message: 'Install the released binary and add it to PATH.' },
  ],
}));
const run = { schemaVersion: 5, runId, startedAt: '2026-09-19T12:00:00.000Z', finishedAt: '2026-09-19T12:00:02.000Z', categories: categories.map(c => c.id), partial: false, scannerVersions: { 'redact-secret': '0.1.0-test' }, lockHash: 'lock', revision: 'r', dirty: false };
const summary = summarizeRun(reports, assignments, '2026-09-19T12:00:03.000Z');
const data = { run, summary, hashes: {}, loaded: categories.map((category, i) => ({ category, report: reports[i] })) };
const productRows = reports.flatMap(r => r.scanners[0].rows.map(row => ({ ...row, category: r.category, id: `${r.category}--${row.id}`, twinOf: row.twinOf ? `${r.category}--${row.twinOf}` : undefined })));
const truth = accountGroups(productRows, accounting);

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const load = path => server.ssrLoadModule(path);
test.after(() => server.close());

test('Report: every bound and n on the page is the accounting.ts result, per evidence level', async () => {
  const { reportPage } = await load('/src/pages/report.ts');
  const { summaryProblem } = await load('/src/pages/data.ts');
  assert.equal(summaryProblem(summary, data), null);
  for (const level of ['T1', 'T2', 'T3']) {
    const html = reportPage(data, level, fixtures), plain = text(html);
    const redact = truth[level === 'T3' ? 'policy/T3' : `must-redact/${level}`], control = truth[`must-not-flag/${level}`];
    if (typeof redact.leakedSpanRate === 'object' && redact.leakedSpanRate) {
      assert.ok(plain.includes(`at most ${percent(redact.leakedSpanRate.bound)}`), `${level} leak bound`);
      assert.ok(plain.includes(`${redact.leakedSpans} of ${redact.spans} secret spans leaked`), `${level} leak n`);
      assert.equal(redact.leakedSpanRate.n, redact.spans);
      assert.ok(!plain.includes(percent(redact.leakedSpanRate.point) + ' at most'), 'the point never takes the large slot');
    } else assert.ok(plain.includes('Withheld') || plain.includes('Not measured'), `${level} leak withheld with a reason`);
    assert.ok(plain.includes(`at most ${percent(control.falseAlarmRate.bound)}`), `${level} alarm bound`);
    assert.ok(plain.includes(`${control.flaggedFiles} of ${control.files.toLocaleString('en-US')} controls flagged`), `${level} alarm n`);
    if (typeof redact.twins.rate === 'object' && redact.twins.rate) {
      assert.ok(plain.includes(`at least ${percent(redact.twins.rate.bound)}`), `${level} twin bound`);
      assert.ok(plain.includes(`${redact.twins.discriminated} of ${redact.twins.pairs} pairs discriminated`), `${level} twin n`);
    } else assert.ok(plain.includes('Withheld') || plain.includes('Not measured'), `${level} twins withheld with a reason`);
  }
  const t1 = reportPage(data, 'T1', fixtures);
  assert.equal((t1.match(/class="fig"/g) ?? []).length, 3, 'three answers');
  assert.ok(t1.indexOf('Provider-documented') < t1.indexOf('Tool-corroborated'), 'T1 is the first segment');
  assert.match(t1, /href="\/report"[^>]*aria-current="true"/);
  assert.equal(truth['must-not-flag/T1'].files, 6);
  assert.match(t1, /<b>0 of 6<\/b> controls flagged <span class="st st-held"[^>]*>Few samples/, 'n = 6: the warning sits beside that number');
  assert.ok(!/class="(banner|notice)"/.test(t1), 'no page-level disclaimer banner');
});

test('Report: reference scanners are muted rows in run order with no rank, and an absent scanner is Not measured, not zero', async () => {
  const { reportPage } = await load('/src/pages/report.ts');
  const html = reportPage(data, 'T1', fixtures), peers = html.slice(html.indexOf('OTHER SCANNERS'), html.indexOf('data-rows'));
  assert.ok(peers.indexOf('silent') < peers.indexOf('absent'), 'run order, never sorted by result');
  assert.ok(!/\b(rank|winner|best|worst|#1|leader|score)\b/i.test(text(peers).replace('Not a ranking', '')));
  assert.match(peers, /absent[\s\S]*data-status="not-measured">Not measured/);
  assert.ok(text(html).includes('absent was not found on PATH'), 'scanner-unavailable empty state');
  assert.ok(!text(peers).includes('redact-secret'), 'the product is not a row in the reference table');
});

test('Report: the three empty states name what is missing and the next command', async () => {
  const { reportPage } = await load('/src/pages/report.ts');
  const none = reportPage({ hashes: {}, loaded: categories.map(category => ({ category, problem: 'Missing or unreadable report' })) }, 'T1', fixtures);
  assert.ok(none.includes('No benchmark results for this checkout') && none.includes('npm run bench'));
  assert.ok(!none.includes('class="fig"'), 'no numbers without results');
  const stale = structuredClone(data); stale.loaded[0].report.runId = 'older'; stale.loaded[1].report.runId = 'older';
  const { summaryProblem } = await load('/src/pages/data.ts');
  stale.summary = summarizeRun(reports.slice(2), assignments); stale.summaryProblem = summaryProblem(stale.summary, stale) ?? undefined;
  const html = text(reportPage(stale, 'T1', fixtures));
  assert.ok(html.includes('2 suites are from an older run'), html.slice(0, 200));
  assert.ok(html.includes(categories[0].id) && html.includes('left out of every total'));
  const tampered = structuredClone(data); tampered.summary.overall['redact-secret']['must-redact/T1'].spans += 1;
  assert.match(summaryProblem(tampered.summary, tampered), /does not add up to its suites/);
  for (const page of [none, reportPage(stale, 'T1', fixtures)]) assert.ok(!/sorry|apolog|oops|unfortunately/i.test(page));
});

test('Coverage: detectors by fixture count with the minimum sample size drawn on every bar', async () => {
  const { coveragePage, detectorCounts, detectorPage } = await load('/src/pages/coverage.ts');
  const counts = detectorCounts(fixtures);
  assert.equal(counts.length, registry.detectors.length);
  assert.deepEqual(counts.map(d => d.fixtures), [...counts.map(d => d.fixtures)].sort((a, b) => b - a));
  for (const d of counts) assert.equal(d.fixtures, Object.values(assignments).filter(ids => ids.includes(d.id)).length, d.id);
  const html = coveragePage(fixtures, 'all'), atMinimum = counts.filter(d => d.fixtures <= accounting.minDenominator).length;
  assert.ok(text(html).includes(`${atMinimum} at the minimum sample size`));
  assert.equal((html.match(/At minimum/g) ?? []).length, counts.filter(d => d.fixtures === accounting.minDenominator).length);
  assert.equal((html.match(/<u style="left:/g) ?? []).length, counts.length, 'a minDenominator line on every bar');
  for (const d of registry.detectors) assert.ok(html.includes(`href="/coverage/${d.id}"`), d.id);
  for (const c of categories) assert.ok(html.includes(`href="/suites/${c.id}"`), c.id);
  assert.equal((coveragePage(fixtures, 'thin').match(/class="cov-row" role="row"/g) ?? []).length, atMinimum);
  // #36: the twin figure separates discriminated / not discriminated / un-probeable.
  const { twinProbe } = await load('/benchmarks/lib/twin-probe.ts');
  const { contracts } = await load('/benchmarks/lib/assessment.ts');
  const probe = twinProbe(registry.detectors.map(d => d.id), fixtures.map(f => ({ id: f.slug, detectors: f.detectors, twinOf: f.twinOf && `${f.category}--${f.twinOf}` })), productRows, contracts);
  const measured = text(coveragePage(fixtures, 'all', data));
  assert.ok(measured.includes(`${probe.counts.discriminated} discriminated · ${probe.counts['not-discriminated']} not discriminated · ${probe.counts['un-probeable']} un-probeable`), 'three separate lines');
  assert.equal(probe.counts['un-probeable'], 8);
  assert.equal(probe.counts.discriminated + probe.counts['not-discriminated'], 49, 'the test product reports every secret exactly and nothing else');
  for (const entry of probe.entries.filter(x => x.status === 'un-probeable')) assert.ok(measured.replaceAll('&quot;', '"').replaceAll('&#39;', "'").includes(entry.reason), entry.id);
  assert.ok(text(coveragePage(fixtures, 'all')).includes('49 not measured'), 'without a run nothing is claimed');
  assert.ok(!coveragePage(fixtures, 'thin', data).includes('id="twin-probe"'));
  assert.ok(text(detectorPage(data, fixtures, 'vercel-token')).includes('Un-probeable'));
  assert.ok(detectorPage(data, fixtures, 'bearer-token').includes('Twin source'));
  const page = detectorPage(data, fixtures, 'github-token'), groups = summary.byDetector['github-token']['redact-secret'];
  for (const [key, g] of Object.entries(groups)) if (g.leakedSpanRate?.bound != null) assert.ok(text(page).includes(`at most ${percent(g.leakedSpanRate.bound)}`), key);
  assert.ok(page.includes('Pending review') === Boolean(groups['pending/T0']));
  assert.ok(detectorPage(data, fixtures, 'nope').includes('No such detector'));
});

test('Evidence: every fixture renders its bytes, its expectation and a way to reproduce it', async () => {
  const { fixturePage } = await load('/src/pages/fixture.ts');
  const { rowsTable } = await load('/src/pages/rows.ts');
  const listing = rowsTable({ fixtures, reports: [] });
  for (const f of fixtures) {
    assert.ok(listing.includes(`/fixture/${f.slug}`), f.slug);
    const html = fixturePage(f, undefined);
    assert.ok(html.includes('class="bytes"') && html.includes('Download exact bytes'), f.slug);
    assert.ok(html.includes(`npm run bench -- --category=${f.category}`), f.slug);
    assert.ok(html.includes('No scanner results for these bytes'), f.slug);
    assert.equal((html.match(/class="sec"/g) ?? []).length > 0, f.expected.some(s => (s.role ?? 'secret') === 'secret' && s.end > s.start), f.slug);
  }
  const malicious = { ...fixtures[0], content: '<script>alert(1)</script>', expected: [] };
  assert.ok(!fixturePage(malicious, undefined).includes('<script>'));
  const twin = fixtures.find(f => f.twinOf);
  assert.ok(fixturePage(twin, undefined).includes('Twin of'));
  assert.ok(fixturePage(fixtures.find(f => f.assessment.tier === 'T0'), undefined).includes('Pending review: excluded from comparative scores'));
  const enveloped = fixtures.find(f => f.expected.some(r => r.envelope));
  assert.ok(text(fixturePage(enveloped, undefined)).includes(enveloped.expected.find(r => r.envelope).envelope.reason.slice(0, 30)));
  assert.ok(fixturePage(enveloped, undefined).includes('class="env"'));
  assert.ok(fixturePage(fixtures.find(f => f.slug === 'context-edges--bom'), undefined).includes('\\uFEFF'));
  assert.ok(fixturePage(fixtures.find(f => f.slug === 'negative-controls--empty'), undefined).includes('∅'));
});

test('Evidence: lanes draw what each scanner covered; outcome is a shape and a word, and policy is never a failure', async () => {
  const { fixturePage } = await load('/src/pages/fixture.ts');
  const positive = fixtures.find(f => f.assessment.kind === 'must-redact' && f.assessment.tier === 'T1' && f.expected.length === 1);
  const report = reports.find(r => r.category === positive.category), html = fixturePage(positive, report);
  assert.match(html, /<i class="fill">/, 'the product covered the secret: a solid bar');
  assert.match(html, /<i class="outline">/, 'the silent scanner missed it: a dashed empty frame');
  assert.ok(html.includes('Redacted exactly') && html.includes('Missed'));
  assert.match(html, /Absent<\/span>[\s\S]*?data-status="not-measured"/, 'a scanner that did not run is Not measured');
  assert.equal((html.match(/class="lane"/g) ?? []).length % 3, 0, 'every active line carries every scanner');
  const policy = fixtures.find(f => f.assessment.kind === 'policy' && f.expected.length), policyHtml = fixturePage(policy, reports.find(r => r.category === policy.category));
  assert.ok(!policyHtml.includes('st-fail'), 'a policy difference is information, not a failure');
  assert.match(policyHtml, /st-info[^>]*>Missed/);
});

test('Suite and How to read: published groups untouched; every caveat lives in one place', async () => {
  const { suitePage } = await load('/src/pages/suite.ts');
  const { howToRead } = await load('/src/pages/how-to-read.ts');
  const html = suitePage(data, fixtures, 'accuracy');
  assert.ok(html.includes('/fixture/accuracy--github-token') && html.includes('Run provenance') && html.includes('draft'));
  const group = reports.find(r => r.category === 'accuracy').scanners[0].groups;
  for (const [key, g] of Object.entries(group)) if (g.leakedSpanRate?.bound != null) assert.ok(text(html).includes(`at most ${percent(g.leakedSpanRate.bound)}`), key);
  assert.ok(suitePage(data, fixtures, 'nope').includes('No such suite'));
  const guide = howToRead();
  for (const claim of ['Not a representative sample', 'corpus-relative', 'not issuance', 'policy difference', 'bounded by which twins', 'not a speed benchmark', 'derives none']) assert.ok(guide.includes(claim), claim);
});

test('Performance: page reads the committed criteria file, verbatim', async () => {
  const { performancePage } = await load('/src/pages/performance.ts');
  const criteria = await read('benchmarks/performance-criteria.json');
  const html = performancePage();
  assert.ok(html.includes(criteria.criteriaId) && html.includes(criteria.baseline.sourceCommit));
  assert.ok(html.includes('Linux x86_64 is the only official profile'));
  for (const criterion of criteria.performance) assert.ok(html.includes(criterion.surface) && html.includes(criterion.profileId));
});

test('boundary rule: pages measure and record; none asserts product quality or ranks a scanner', async () => {
  const { reportPage } = await load('/src/pages/report.ts');
  const { coveragePage, detectorPage } = await load('/src/pages/coverage.ts');
  const { suitePage } = await load('/src/pages/suite.ts');
  const { howToRead } = await load('/src/pages/how-to-read.ts');
  const { performancePage } = await load('/src/pages/performance.ts');
  const pages = [reportPage(data, 'T1', fixtures), coveragePage(fixtures, 'all'), detectorPage(data, fixtures, 'github-token'), suitePage(data, fixtures, 'accuracy'), howToRead(), performancePage()];
  for (const html of pages) {
    const plain = text(html).replace(/Precision, recall and F1 are not exported[^.]*\./, '').replace(/not a product ranking|Not a ranking/g, '');
    assert.ok(!/\b(precision|recall|F1)\b/i.test(plain), 'no rates outside the v4 headline metrics');
    assert.ok(!/\b(is safe|secure|best|winner|wins|outperforms|superior|top-ranked|ranking|grade [A-F])\b/i.test(plain), plain.match(/\b(is safe|secure|best|winner|wins|outperforms|superior|top-ranked|ranking|grade [A-F])\b/i)?.[0]);
    assert.ok(!html.includes('/benchmark') && !html.includes('/evaluation') && !html.includes('/methodology') && !html.includes('/pending'), 'no link to a pre-redesign path');
  }
});
