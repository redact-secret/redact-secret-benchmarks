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
  assert.equal(parseRoute('/evaluation/detector/github-token').to, '/coverage/detectors/github-token');
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

test('rendered Workbench method, review and holdout views retain the evidence boundaries', async () => {
  const { createServer } = await import('vite');
  const { readFile } = await import('node:fs/promises');
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const { methodPage } = await server.ssrLoadModule('/src/pages/workbench/method.ts');
    const { workbenchPage } = await server.ssrLoadModule('/src/pages/workbench/index.ts');
    const { qualificationPage } = await server.ssrLoadModule('/src/pages/workbench/qualification.ts');
    const { reviewClasses } = await server.ssrLoadModule('/src/evaluation-model.ts');
    const r = published();
    const ledger = JSON.parse(await readFile('benchmarks/review-ledger.json','utf8'));
    const data = { loaded: [], hashes: {} };
    const home = workbenchPage({ data, evaluation: r, evaluationProblem: null, reviewLedgerProblem: 'No published review provenance', classes: reviewClasses(ledger), changes: { data, fixtures: [] } });
    for (const method of ['twin','benign','metamorphic','mutation','differential','holdout']) assert.ok(home.includes(`/workbench/method/${method}`), method);
    assert.ok(home.includes('never ground truth'));
    assert.ok(!home.includes('/evaluation'), 'no link points at a pre-redesign path');
    assert.ok(methodPage(r,'twin').includes('Discriminated pairs'));
    assert.ok(methodPage(r,'twin').includes('affected failing cases') && methodPage(r,'twin').includes('failed assertions'));
    assert.ok(methodPage(r,'benign').includes('Flagged controls'));
    assert.ok(methodPage(r,'benign').includes(selected[1].taxonomy), 'benign method page renders the case\'s reviewed taxonomy axis (#91)');
    assert.ok(methodPage(r,'mutation').includes('Operator evidence'), 'operator evidence moved in with the method that generates variants');
    assert.ok(methodPage(r,'differential').includes('not ground truth or votes'));
    assert.ok(methodPage(r,'differential').includes('Human review evidence'));
    const missing = workbenchPage({ data, evaluation: null, evaluationProblem: 'Stale evaluation: fixture corpus changed', reviewLedgerProblem: 'Stale evaluation: fixture corpus changed', classes: reviewClasses(ledger), changes: { data, fixtures: [] } });
    assert.ok(missing.includes('Stale evaluation') && missing.includes('npm run eval:publish'));
    assert.ok(missing.includes('Review queue') && missing.includes('Release or historical follow-up'), 'the ledger remains visible but resolution is locked without a report');
    assert.ok(!missing.includes('lexical.invalid-alphabet'), 'a class settled not-assertable carries no open entries, so it drops out of the open queue');
    assert.ok(methodPage(r,'holdout').includes('No qualification aggregate published'));
    r.qualification = JSON.parse(await readFile('docs/specs/qualification/engine-v1.json','utf8'));
    const holdout = methodPage(r,'holdout');
    assert.ok(holdout.includes('supportClaims: false'));
    assert.ok(!holdout.includes('/fixture/'));
    assert.ok(holdout.includes('No case drill-down'));
    const floors = qualificationPage(data, r);
    assert.ok(floors.includes('supportClaims: false') && floors.includes('Ledger rows for every entry'));
    const raw = structuredClone(r); raw.qualification.holdout.cases = [{content:'PROTECTED_SENTINEL'}];
    assert.ok(evaluationProblem(raw));
  } finally { await server.close(); }
});

test('production Changes states the released package it measures instead of asking for candidate evidence (#213)', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const { changesPage } = await server.ssrLoadModule('/src/pages/workbench/changes.ts');
    const baseline = { version: '0.1.0-beta.7', rows: {} };
    const data = { loaded: [], hashes: {}, run: { scannerVersions: { 'redact-secret': '0.1.0-beta.7' } } };
    const input = site => ({ data, baseline, site, fixtures: [] });
    // With no current rows the page still answers, and only off production does it ask for candidate evidence.
    const withRows = site => changesPage({ ...input(site), fixtures: [{ slug: 'common-formats--x', category: 'common-formats', id: 'x', assessment: { kind: 'must-redact', tier: 'T1' } }],
      data: { ...data, loaded: [{ category: { id: 'common-formats' }, report: { category: 'common-formats', runId: 'r', scanners: [{ id: 'redact-secret', status: 'complete', rows: [{ id: 'x', expected: [], actual: [] }] }] } }] } }, 'fixed-corpus');
    for (const site of ['production', 'staging', 'local']) assert.ok(!changesPage(input(site), 'fixed-corpus').includes('undefined'), site);
    const production = withRows('production');
    assert.ok(production.includes('0.1.0-beta.7 → this run'), 'the saved baseline is read against the run');
    assert.ok(!production.includes('No candidate evidence published'));
    assert.ok(production.includes('Released package only') && production.includes('<b>0.1.0-beta.7</b>'));
    assert.ok(withRows('staging').includes('No candidate evidence published'));
  } finally { await server.close(); }
});
