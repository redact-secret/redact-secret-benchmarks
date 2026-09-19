import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { runEvaluation } from '../benchmarks/engine/runner.ts';
import { publicEvaluation } from '../benchmarks/engine/public-report.ts';
import { assertionRows, reviewRows, summarizeEvaluation, evaluationProblem } from '../src/evaluation-model.ts';
import { parseRoute } from '../src/model.mjs';
const operators = createOperators(), sources = await loadCases(operators);
const selected = ['twin','benign','mutation','differential'].map(m => sources.find(c => c.method === m));
const scanners = [{ id: 'redact-secret', mode: 'test', async version() { return '1.0.0'; }, async scan() { return []; } },
  { id: 'peer', mode: 'test', async version() { throw Error('unavailable'); }, async scan() { return []; } }];
const raw = await runEvaluation({ cases: selected, methods: createMethods(), operators, scanners });
const hashes = { test: 'hash' };
const published = () => publicEvaluation(structuredClone(raw), sources, hashes);
test('absolute and relational failures share one affected case; review never counts as failure', () => {
  const report = published(), twin = report.cases.filter(c => c.method === 'twin');
  const summary = summarizeEvaluation(twin), rows = assertionRows(twin);
  assert.equal(summary.affected, 1);
  assert.equal(summary.assertions.fail, 2);
  assert.equal(rows.filter(r => r.overlap).length, 1);
  const mutation = report.cases.filter(c => c.method === 'mutation');
  assert.ok(summarizeEvaluation(mutation).assertions['review-required'] > 0);
  assert.ok(reviewRows(report).every(r => r.status === 'review-required'));
  assert.equal(report.cases.find(c => c.method === 'differential').assertions.length, 0);
  assert.equal(report.scanners[1].status, 'unavailable');
});
test('publication rejects protected/unknown/stale source cases and drops unapproved payloads', () => {
  for (const edit of [c => c.visibility = 'holdout', c => c.id = 'private-case', c => c.provenance.sourceHash = 'stale']) {
    const input = structuredClone(raw); edit(input.results[0]);
    assert.throws(() => publicEvaluation(input, sources, hashes), /publication refused/);
  }
  const input = structuredClone(raw), sentinel = 'PROTECTED_SENTINEL_DO_NOT_PUBLISH';
  input.content = sentinel; input.results[0].content = sentinel;
  input.results[0].source.path = sentinel;
  input.results[0].provenance.seed = sentinel;
  input.scanners[0].configuration = { secret: sentinel };
  const result = publicEvaluation(input, sources, hashes);
  assert.ok(!JSON.stringify(result).includes(sentinel));
  assert.ok(!JSON.stringify(result).includes('"expected":'));
  assert.ok(!JSON.stringify(result).includes('"content":'));
});
test('missing, legacy, stale, dangling assertions and scored T0 evidence fail closed', () => {
  assert.ok(evaluationProblem(null));
  assert.ok(evaluationProblem(raw));
  assert.match(evaluationProblem(published(), {test:'different'}), /Stale/);
  assert.equal(evaluationProblem(published(), hashes), null);
  const bad = published(); bad.cases[0].assertions[0].variant = 'missing';
  assert.ok(evaluationProblem(bad));
  const scored = published(); scored.cases[0].variants[0].tier = 'T0';
  assert.ok(evaluationProblem(scored));
});
test('every pre-redesign evaluation route forwards to Workbench on direct navigation', () => {
  for (const path of ['/evaluation','/evaluation/failures','/evaluation/reviews','/evaluation/operators', ...['twin','benign','metamorphic','mutation','differential','holdout'].map(m => `/evaluation/method/${m}`)]) {
    const route = parseRoute(path + '/');
    assert.equal(route.kind, 'redirect', path);
    assert.equal(parseRoute(route.to).kind, 'workbench', path);
  }
  assert.equal(parseRoute('/evaluation/detector/github-token').to, '/coverage/github-token');
  assert.equal(parseRoute('/evaluation/unknown').kind, 'missing');
});

test('public contract rejects unknown fields and injected holdout detail', () => {
  const report = published(); report.cases[0].content = 'not public';
  assert.match(evaluationProblem(report), /contract/);
  const source = published(); source.cases[0].sourceSlug = '../holdout';
  assert.ok(evaluationProblem(source));
});

test('operator summaries cannot drift from generated attempts and assertions', () => {
  const report = published();
  Object.values(report.byOperator)[0].generated++;
  assert.match(evaluationProblem(report), /Operator totals/);
});

test('rendered method, detector, review and holdout views retain the evidence boundaries', async () => {
  const { createServer } = await import('vite');
  const { readFile } = await import('node:fs/promises');
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const { evaluationPage, evaluationEmpty } = await server.ssrLoadModule('/src/pages/evaluation.ts');
    const r = published();
    const overview = evaluationPage(r,'overview','');
    for (const method of ['twin','benign','metamorphic','mutation','differential','holdout']) assert.ok(overview.includes(`/evaluation/method/${method}`));
    assert.ok(overview.includes('Affected failing cases') && overview.includes('Failed assertions'));
    assert.ok(evaluationPage(r,'method','twin').includes('Discriminated pairs'));
    assert.ok(evaluationPage(r,'method','benign').includes('Flagged controls'));
    assert.ok(evaluationPage(r,'method','differential').includes('not ground truth or votes'));
    assert.ok(evaluationPage(r,'reviews','').includes('Human review evidence'));
    assert.ok(evaluationPage(r,'detector','github-token').includes('/benchmark/github-token'));
    assert.ok(evaluationEmpty('Stale evaluation').includes('npm run eval:publish'));
    r.qualification = JSON.parse(await readFile('docs/qualification/engine-v1.json','utf8'));
    const holdout = evaluationPage(r,'method','holdout');
    assert.ok(holdout.includes('supportClaims: false'));
    assert.ok(!holdout.includes('/fixture/'));
    assert.ok(holdout.includes('No case drill-down'));
    const raw = structuredClone(r); raw.qualification.holdout.cases = [{content:'PROTECTED_SENTINEL'}];
    assert.ok(evaluationProblem(raw));
  } finally { await server.close(); }
});
