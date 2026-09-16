import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { buildCatalog, fixtureSlug, parseRoute, reportProblem, summarize, contentSegments } from '../src/model.mjs';
import { score } from '../benchmarks/lib/scoring.mjs';
const read = async path => JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const categories = await read('benchmarks/categories.json');
const registry = await read('benchmarks/detectors.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const corpora = Object.fromEntries(await Promise.all(categories.map(async c => [c.id, await read(c.corpus)])));
const fixtures = buildCatalog(categories,corpora,assignments,registry.detectors);

test('all corpus fixtures have unique, routable slugs and explicit detector assignments', () => {
  assert.equal(fixtures.length,491);
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
test('routes distinguish overview, detectors/cases, fixtures, methodology and invalid paths', () => {
  assert.equal(parseRoute('/').kind,'overview');
  assert.equal(parseRoute('/benchmark/').kind,'overview');
  assert.deepEqual(parseRoute('/benchmark/github-token'),{kind:'benchmark',id:'github-token'});
  assert.equal(parseRoute('/methodology').kind,'methodology');
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
const rowScore = score(corpora.accuracy.fixtures, []);
const report = {schemaVersion:1,category:'accuracy',corpusHash:'hash',lockHash:'lock',matching:'exact',scanners:[{id:'test',name:'Test scanner',mode:'offline',version:'1',status:'complete',...rowScore}]};
test('reports require matching bytes, fixture identity and complete ground truth before joining', () => {
  assert.equal(reportProblem(report,'accuracy','hash',fixtures),null);
  assert.match(reportProblem(report,'accuracy','changed',fixtures),/Stale/);
  assert.match(reportProblem({...report,category:'other'},'accuracy','hash',fixtures),/invalid/);
  const changed = structuredClone(report); changed.scanners[0].rows[0].expected=[];
  assert.match(reportProblem(changed,'accuracy','hash',fixtures),/ground truth/);
  changed.scanners[0].rows.pop();
  assert.match(reportProblem(changed,'accuracy','hash',fixtures),/rows/);
});
test('projections score selected rows and keep versions separate without scoring failed runs', () => {
  const selected = source.filter(f => f.detectors.includes('github-token'));
  const [summary] = summarize(selected,[report]);
  assert.equal(summary.rows.length,3);
  assert.equal(summary.fn,3);
  assert.equal(summary.fp,0);
  assert.equal(summary.precision,null);
  assert.equal(summary.recall,0);
  const other = structuredClone(report); other.scanners[0].version='2';
  assert.equal(summarize(selected,[report,other]).length,2);
  other.scanners[0].status='error';
  assert.equal(summarize(selected,[other])[0].rows.length,0);
  assert.equal(summarize(selected,[other])[0].recall,null);
  other.scanners[0].version='1'; other.lockHash='different';
  assert.equal(summarize(selected,[report,other]).length,2);
});
test('same fixture IDs in different suites remain separate observations', () => {
  const copy = structuredClone(report); copy.category='other';
  const chosen = [source[0], {...source[0],category:'other',slug:'other--'+source[0].id}];
  const [summary] = summarize(chosen,[report,copy]);
  assert.equal(summary.rows.length,2);
  assert.equal(new Set(summary.rows.map(r => r.slug)).size,2);
  assert.equal(summary.fn,2);
});
test('page renderers expose every fixture, escape input markup, and preserve negative/empty cases', async () => {
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const pages = await server.ssrLoadModule('/src/pages/browse.ts');
    const { accuracy } = await server.ssrLoadModule('/src/pages/accuracy.ts');
    const listing = pages.fixtureList(fixtures,[]);
    for (const f of fixtures) {
      assert.ok(listing.includes(`/fixture/${f.slug}`),f.slug);
      const html = pages.fixturePage(f,[]);
      assert.ok(html.includes('Exact synthetic input'),f.slug);
      assert.ok(html.includes('No current report'),f.slug);
    }
    const malicious = {...fixtures[0],content:'<script>alert(1)</script>',expected:[]};
    assert.ok(!pages.fixturePage(malicious,[]).includes('<script>'));
    assert.ok(pages.fixturePage(malicious,[]).includes('&lt;script&gt;'));
    assert.ok(pages.overview([]).includes('/benchmark/openai-token'));
    const corpusReport = {...report,fixtureCount:10,expectedCount:5,reviewStatus:'draft'};
    assert.ok(accuracy(corpusReport).includes('/fixture/accuracy--github-token'));
    const bom = fixtures.find(f => f.slug==='context-edges--bom');
    assert.ok(pages.fixturePage(bom,[]).includes('\\uFEFF'));
    assert.ok(pages.fixturePage(fixtures.find(f => f.slug==='negative-controls--empty'),[]).includes('(empty file)'));
  } finally { await server.close(); }
});
