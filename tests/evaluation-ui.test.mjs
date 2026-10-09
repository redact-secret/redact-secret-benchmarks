import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCases } from '../benchmarks/evaluation/domains/credential/cases.ts';
import { createMethods } from '../benchmarks/evaluation/domains/credential/methods/index.ts';
import { createOperators } from '../benchmarks/evaluation/domains/credential/operators/index.ts';
import { runEvaluation } from '../benchmarks/evaluation/domains/credential/runner.ts';
import { publicEvaluation } from '../benchmarks/evaluation/domains/credential/public-report.ts';
import { assertionRows, reviewRows, summarizeEvaluation, evaluationProblem } from '../benchmarks/shared/evaluation-model.ts';
import { parseRoute } from '../benchmarks/shared/report-model.mjs';
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
test('domain routes are public while pre-redesign detail routes still forward to Workbench', () => {
  assert.equal(parseRoute('/evaluation').to, '/evaluation/credentials');
  assert.deepEqual(parseRoute('/evaluation/credentials'), { kind: 'evaluation-domain', id: 'credential', view: '', to: '' });
  assert.deepEqual(parseRoute('/evaluation/pii'), { kind: 'evaluation-domain', id: 'pii', view: '', to: '' });
  for (const path of ['/evaluation/failures','/evaluation/reviews','/evaluation/operators', ...['twin','benign','metamorphic','mutation','differential','holdout'].map(m => `/evaluation/method/${m}`)]) {
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
