import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, fixtureSlug, parseRoute, reportProblem, summarize, contentSegments, rowSignal } from '../src/model.mjs';
import { scoreReport } from '../benchmarks/lib/reporting.ts';
const read = async path => JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const categories = await read('benchmarks/categories.json');
const registry = await read('benchmarks/detectors.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const corpora = Object.fromEntries(await Promise.all(categories.map(async c => [c.id, await read(c.corpus)])));
const fixtures = buildCatalog(categories,corpora,assignments,registry.detectors);

test('all corpus fixtures have unique, routable slugs and explicit detector assignments', () => {
  assert.equal(fixtures.length,1071);
  assert.equal(registry.detectors.length,46);
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
const suites = categories.map(c => c.id);
const resolve = path => parseRoute(path, { suites });
test('the redesign route table resolves, with or without a trailing slash', () => {
  assert.equal(resolve('/report').kind, 'report');
  assert.equal(resolve('/coverage/').kind, 'coverage');
  assert.equal(resolve('/support').kind, 'support');
  assert.deepEqual(resolve('/coverage/github-token'), { kind: 'coverage', id: 'github-token', view: '', to: '' });
  assert.deepEqual(resolve('/suites/accuracy'), { kind: 'suite', id: 'accuracy', view: '', to: '' });
  assert.deepEqual(resolve('/workbench'), { kind: 'workbench', id: '', view: 'overview', to: '' });
  assert.deepEqual(resolve('/workbench/review/lexical-invalid-alphabet'), { kind: 'workbench', id: 'lexical-invalid-alphabet', view: 'review', to: '' });
  assert.equal(resolve('/workbench/changes').view, 'changes');
  assert.equal(resolve('/workbench/qualification/').view, 'qualification');
  for (const method of ['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout']) assert.deepEqual(resolve(`/workbench/method/${method}`), { kind: 'workbench', id: method, view: 'method', to: '' });
  assert.equal(resolve('/how-to-read').kind, 'how-to-read');
  for (const path of ['/fixture', '/coverage/a/b', '/coverage/%3Cscript%3E', '/support/github', '/workbench/method/unknown', '/workbench/review', '/suites', '/nope']) assert.equal(resolve(path).kind, 'missing', path);
});
test('no bookmark breaks: every pre-redesign path redirects to a page that resolves', () => {
  const legacy = {
    '/': '/report', '/benchmark': '/report', '/benchmark/': '/report', '/coverage-gaps': '/coverage', '/methodology': '/how-to-read',
    '/pending': '/workbench/review/t0-fixtures', '/pending/': '/workbench/review/t0-fixtures',
    '/evaluation': '/workbench', '/evaluation/reviews': '/workbench', '/evaluation/failures': '/workbench', '/evaluation/operators': '/workbench/method/mutation',
    '/evaluation/detector/github-token': '/coverage/github-token',
    ...Object.fromEntries(['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'].map(m => [`/evaluation/method/${m}`, `/workbench/method/${m}`])),
    ...Object.fromEntries(registry.detectors.map(d => [`/benchmark/${d.id}`, `/coverage/${d.id}`])),
    ...Object.fromEntries(categories.map(c => [`/benchmark/${c.id}`, `/suites/${c.id}`])),
  };
  assert.ok(Object.keys(legacy).length > 60);
  for (const [from, to] of Object.entries(legacy)) {
    assert.deepEqual(resolve(from), { kind: 'redirect', id: '', view: '', to }, from);
    assert.ok(!['redirect', 'missing'].includes(resolve(to).kind), `${from} -> ${to} must land on a real page`);
  }
  assert.equal(resolve('/evaluation/unknown').kind, 'missing');
});
test('the public-only allowlist drops Workbench and nothing else', () => {
  const open = path => parseRoute(path, { suites, publicOnly: true }).kind;
  for (const path of ['/workbench', '/workbench/changes', '/workbench/method/twin', '/evaluation', '/pending']) assert.equal(open(path), 'missing', path);
  assert.equal(open('/report'), 'report');
  assert.equal(open('/coverage/github-token'), 'coverage');
  assert.equal(open('/benchmark/accuracy'), 'redirect');
  assert.equal(open('/how-to-read'), 'how-to-read');
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
const accounting = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url))).accounting;
const report = {schemaVersion:5,accountingVersion:'1.1',accounting,runId,category:'accuracy',corpusHash:'hash',lockHash:'lock',matching:'v4',generatedAt:'2026-09-17T12:00:01.000Z',reviewStatus:'draft',scanners:[{id:'test',name:'Test scanner',mode:'offline',version:'1',status:'complete',...scoreReport(corpora.accuracy.fixtures, [], accounting)}]};
test('reports require a run id, matching bytes, fixture identity and recomputable outcomes before joining', () => {
  assert.equal(reportProblem(report,'accuracy','hash',fixtures),null);
  assert.match(reportProblem({...report,schemaVersion:4},'accuracy','hash',fixtures),/Legacy/);
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
  // Three spans are below minDenominator: the rate is withheld, the counts are not.
  assert.equal(summary.metrics.leakedSpanRate,'insufficient-evidence');
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
