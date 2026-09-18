import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { buildCatalog, fixtureSlug, parseRoute, reportProblem, summarize, contentSegments, rowSignal } from '../src/model.mjs';
import { scoreReport } from '../benchmarks/lib/reporting.mjs';
const read = async path => JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const categories = await read('benchmarks/categories.json');
const registry = await read('benchmarks/detectors.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const corpora = Object.fromEntries(await Promise.all(categories.map(async c => [c.id, await read(c.corpus)])));
const fixtures = buildCatalog(categories,corpora,assignments,registry.detectors);

test('all corpus fixtures have unique, routable slugs and explicit detector assignments', () => {
  assert.equal(fixtures.length,605);
  assert.equal(registry.detectors.length,25);
  for (const f of fixtures) {
    assert.equal(parseRoute('/fixture/'+f.slug).id,f.slug);
    assert.equal(f.slug,fixtureSlug(f.category,f.id));
  }
  const missing = {...assignments}; delete missing[fixtures[0].slug];
  assert.throws(() => buildCatalog(categories,corpora,missing,registry.detectors),/Missing/);
  assert.throws(() => buildCatalog(categories,corpora,{...assignments,orphan:[]},registry.detectors),/Orphan/);
  assert.throws(() => buildCatalog(categories,corpora,{...assignments,[fixtures[0].slug]:['unknown']},registry.detectors),/Unknown/);
  assert.throws(() => buildCatalog(categories,corpora,assignments,[{id:categories[0].id}]),/unique/);
});
test('routes distinguish overview, detectors/cases, fixtures, pending, methodology and invalid paths', () => {
  assert.equal(parseRoute('/').kind,'overview');
  assert.equal(parseRoute('/benchmark/').kind,'overview');
  assert.deepEqual(parseRoute('/benchmark/github-token'),{kind:'benchmark',id:'github-token'});
  assert.equal(parseRoute('/methodology').kind,'methodology');
  assert.equal(parseRoute('/pending/').kind,'pending');
  for (const path of ['/fixture','/benchmark/a/b','/benchmark/%3Cscript%3E']) assert.equal(parseRoute(path).kind,'missing');
});
test('UTF-8 highlighting round-trips every input including BOM, Unicode, CRLF and multiple secrets', () => {
  for (const f of fixtures) {
    const segments = contentSegments(f.content,f.expected);
    assert.equal(segments.map(s => s.text).join(''),f.content,f.slug);
    assert.deepEqual(segments.filter(s => s.highlighted).map(s => Buffer.byteLength(s.text)),f.expected.map(r => r.end-r.start),f.slug);
  }
});
const source = fixtures.filter(f => f.category === 'accuracy');
const runId = '2026-09-17T12:00:00.000Z-0a0b0c';
const report = {schemaVersion:4,runId,category:'accuracy',corpusHash:'hash',lockHash:'lock',matching:'v4',generatedAt:'2026-09-17T12:00:01.000Z',reviewStatus:'draft',scanners:[{id:'test',name:'Test scanner',mode:'offline',version:'1',status:'complete',...scoreReport(corpora.accuracy.fixtures, [])}]};
test('reports require a run id, matching bytes, fixture identity and recomputable outcomes before joining', () => {
  assert.equal(reportProblem(report,'accuracy','hash',fixtures),null);
  assert.match(reportProblem({...report,schemaVersion:3},'accuracy','hash',fixtures),/Legacy/);
  assert.match(reportProblem({...report,runId:undefined},'accuracy','hash',fixtures),/run id/);
  const badCounts = structuredClone(report); badCounts.scanners[0].groups['must-not-flag/T3'].flaggedFiles = 999;
  assert.match(reportProblem(badCounts,'accuracy','hash',fixtures),/recompute/);
  assert.match(reportProblem(report,'accuracy','changed',fixtures),/Stale/);
  assert.match(reportProblem({...report,category:'other'},'accuracy','hash',fixtures),/invalid/);
  const changed = structuredClone(report); changed.scanners[0].rows[0].expected=[];
  assert.match(reportProblem(changed,'accuracy','hash',fixtures),/ground truth/);
  changed.scanners[0].rows.pop();
  assert.match(reportProblem(changed,'accuracy','hash',fixtures),/rows/);
  const rated = structuredClone(report); rated.scanners[0].precision = 1;
  assert.match(reportProblem(rated,'accuracy','hash',fixtures),/not allowed/);
});
test('projections aggregate selected rows per group and keep versions and runs separate', () => {
  const selected = source.filter(f => f.detectors.includes('github-token'));
  const { summaries } = summarize(selected,[report]);
  const [summary] = summaries;
  assert.equal(summaries.length,1);
  assert.equal(summary.key,'policy/T3');
  assert.equal(summary.rows.length,3);
  assert.equal(summary.metrics.leakedSpans,3);
  assert.equal(summary.metrics.leakedSpanRate,1);
  const other = structuredClone(report); other.scanners[0].version='2';
  assert.equal(summarize(selected,[report,other]).summaries.length,2);
  other.scanners[0].status='error';
  assert.equal(summarize(selected,[other]).summaries[0].rows.length,0);
  assert.equal(summarize(selected,[other]).summaries[0].metrics,null);
  other.scanners[0].version='1'; other.lockHash='different';
  assert.equal(summarize(selected,[report,other]).summaries.length,2);
  assert.deepEqual(rowSignal(report.scanners[0].rows[0], 'EXACT'), { changed: true, clean: false });
  assert.deepEqual(rowSignal(report.scanners[0].rows.find(r => r.flagged === false), 'clean'), { changed: false, clean: true });
});
test('same fixture IDs in different suites remain separate observations', () => {
  const copy = structuredClone(report); copy.category='other';
  const chosen = [source[0], {...source[0],category:'other',slug:'other--'+source[0].id}];
  const [summary] = summarize(chosen,[report,copy]).summaries;
  assert.equal(summary.rows.length,2);
  assert.equal(new Set(summary.rows.map(r => r.slug)).size,2);
  assert.equal(summary.metrics.leakedSpans,2);
});
test('page renderers expose every fixture, escape input markup, and keep caveats out of the data path', async () => {
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const pages = await server.ssrLoadModule('/src/pages/browse.ts');
    const { accuracy } = await server.ssrLoadModule('/src/pages/accuracy.ts');
    const { methodology } = await server.ssrLoadModule('/src/pages/methodology.ts');
    const listing = pages.fixtureList(fixtures,[]);
    for (const f of fixtures) {
      assert.ok(listing.includes(`/fixture/${f.slug}`),f.slug);
      const html = pages.fixturePage(f,[]);
      assert.ok(html.includes('Exact synthetic input'),f.slug);
      assert.ok(html.includes('No current report'),f.slug);
      assert.ok(html.includes(`tier-${f.assessment.tier}`),f.slug);
    }
    const malicious = {...fixtures[0],content:'<script>alert(1)</script>',expected:[]};
    assert.ok(!pages.fixturePage(malicious,[]).includes('<script>'));
    assert.ok(pages.fixturePage(malicious,[]).includes('&lt;script&gt;'));
    assert.ok(pages.overview([]).includes('/benchmark/openai-token'));
    const corpusReport = {...report,fixtureCount:10,expectedCount:5};
    const run = {schemaVersion:4,runId,startedAt:'2026-09-17T12:00:00.000Z',finishedAt:'2026-09-17T12:00:02.000Z',categories:['accuracy'],partial:true,scannerVersions:{test:'1'},lockHash:'lock',revision:'r',dirty:false};
    const suite = accuracy(corpusReport, run);
    assert.ok(suite.includes('/fixture/accuracy--github-token'));
    assert.ok(suite.includes('Secrets left readable') && suite.includes('Safe files wrongly flagged') && suite.includes('draft'));
    assert.ok(suite.includes('This run:') && !suite.includes('How to read this') && !suite.includes('tp/fp/fn'), 'a lead sentence replaces the glossary; diagnostics live in provenance');
    const overview = pages.overview([corpusReport], run);
    assert.ok(overview.includes('Partial run — 1 of 10 suites'), 'a run that covers one suite is named as partial');
    assert.ok(overview.includes('shown, never scored'));
    const detector = pages.comparison(fixtures.filter(f => f.detectors.includes('anthropic-token')), [corpusReport], run);
    for (const html of [overview, detector, suite]) {
      for (const kind of ['must-redact', 'must-not-flag', 'policy']) assert.ok(html.includes(`data-kind="${kind}"`), kind);
      assert.ok(!/precision|recall|F1\b/i.test(html.replace(/no precision|Precision, recall and F1 are not exported/g, '')), 'no rates leak into the data path');
      assert.ok(!html.includes('Results are separated by measurement purpose'), 'per-panel notices are gone');
    }
    assert.equal((overview.match(/reading-note/g) ?? []).length, 1, 'one reading note per page');
    const twin = fixtures.find(f => f.twinOf);
    assert.ok(pages.fixturePage(twin, []).includes('Negative twin of'));
    const pending = fixtures.find(f => f.assessment.tier === 'T0');
    assert.ok(pages.fixturePage(pending, []).includes('Pending review: excluded from comparative scores'));
    const enveloped = fixtures.find(f => f.expected.some(r => r.envelope));
    assert.ok(pages.fixturePage(enveloped, []).includes(enveloped.expected[0].envelope.reason.slice(0, 30)));
    const bom = fixtures.find(f => f.slug==='context-edges--bom');
    assert.ok(pages.fixturePage(bom,[]).includes('\\uFEFF'));
    assert.ok(pages.fixturePage(fixtures.find(f => f.slug==='negative-controls--empty'),[]).includes('(empty file)'));
    assert.ok(listing.includes('data-signal="1"') || listing.includes('data-signal="0"'));
    assert.ok(listing.includes('id="show-all"'));
    for (const glyph of ['■', '◩', '◫', '◪', '□']) assert.ok(listing.includes(glyph), glyph);
    const m = methodology();
    for (const claim of ['Not a representative sample', 'corpus-relative', 'not issuance', 'policy difference', 'bounded by which twins', 'not a speed benchmark']) assert.ok(m.includes(claim), claim);
  } finally { await server.close(); }
});
