import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir, access, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publicConformanceCorpus } from '../holdout/conformance.ts';
import { sealProtectedCorpus, serialize } from '../holdout/storage.ts';
import { runHoldout, contaminateHoldout } from '../holdout/lifecycle.ts';
import { hash } from '../benchmarks/engine/model.ts';
import { runEvaluation } from '../benchmarks/engine/runner.ts';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { validateEvidence } from '../benchmarks/engine/evidence.ts';

const candidate = { sourceHash: 'a'.repeat(64), lockHash: 'b'.repeat(64), candidateArtifactHash: 'c'.repeat(64) };
const cleanScanner = (extra = {}) => ({ id: 'test', mode: 'offline test', configuration: { verification: false },
  version: async () => '1.2.3', scan: async () => [], ...extra });
async function fixture(t, purpose = 'protected') {
  const root = await mkdtemp(path.join(tmpdir(), 'holdout-lifecycle-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifestFile = path.join(root, 'manifest.json');
  const corpus = publicConformanceCorpus('PRIVATE-SEED-SENTINEL');
  corpus.fixtures[0].id = 'private-case-sentinel';
  corpus.fixtures[0].group = 'PRIVATE-GROUP-SENTINEL';
  const source = path.join(root, 'input.json');
  await writeFile(source, serialize(corpus), { mode: 0o600 });
  let manifest;
  if (purpose === 'protected') manifest = await sealProtectedCorpus(manifestFile, source, 'reviewed');
  else {
    const publicSeed = 'public-test';
    manifest = { schemaVersion: 1, id: 'public-test', revision: 1, purpose, review: 'conformance-only',
      corpusHash: hash(serialize(publicConformanceCorpus(publicSeed))), seedHash: hash(publicSeed),
      dataDirectory: 'generated/public-test', maxRuns: 1, publicSeed };
    await writeFile(manifestFile, serialize(manifest));
  }
  return { root, manifestFile, manifest, corpus, store: path.join(root, manifest.dataDirectory) };
}
const execute = (f, scanners = [cleanScanner()], extra = {}) => runHoldout({ manifestFile: f.manifestFile, scanners, candidate,
  verifyCandidate: async () => candidate, ...extra });

test('default registries/catalogs exclude holdout and development runner rejects protected cases before execution', async () => {
  const methods = createMethods(), operators = createOperators();
  assert.throws(() => methods.get('holdout'));
  const cases = await loadCases(operators);
  assert.equal(cases.some(c => c.visibility === 'holdout' || c.method === 'holdout'), false);
  await assert.rejects(runEvaluation({ cases: [{ ...cases[0], visibility: 'holdout', method: 'holdout' }], methods, operators,
    scanners: [cleanScanner({ version() { assert.fail('protected case reached scanner'); } })] }), /isolated lifecycle/);
});

test('repository-shaped protected storage returns aggregates without bytes, seeds, identifiers, ranges or case hashes', async t => {
  const f = await fixture(t);
  let scratch;
  const report = await execute(f, [cleanScanner({ async scan(root, fixtures) {
    scratch = root;
    assert.ok(root.startsWith(f.store));
    assert.deepEqual(Object.keys(fixtures[0]).sort(), ['content', 'id', 'path']);
    assert.equal(await readFile(path.join(root, fixtures[0].path), 'utf8'), fixtures[0].content);
    return [];
  } })]);
  assert.equal(report.status, 'complete');
  assert.equal(report.independence, 'custodian-declared');
  assert.deepEqual(report.scanners[0].assertions, { pass: 6, fail: 6, 'review-required': 0 });
  assert.deepEqual(Object.keys(report.scanners[0].byStratum).sort(), ['must-not-flag:T3', 'must-redact:T1']);
  const text = JSON.stringify(report);
  for (const protectedValue of ['PRIVATE-SEED-SENTINEL', 'PRIVATE-GROUP-SENTINEL', 'private-case-sentinel',
    f.corpus.fixtures[0].content, hash(f.corpus.fixtures[0]), '"results"', '"actual"', '"expected"']) assert.equal(text.includes(protectedValue), false);
  await assert.rejects(access(scratch));
  assert.equal((await readdir(f.store)).some(name => name.startsWith('plan-')), true);
  validateEvidence(report, 'holdout');
});

test('a protected attempt is single-use; scanner failures still consume the frozen budget', async t => {
  const f = await fixture(t);
  const report = await execute(f, [cleanScanner({ async scan() { throw new Error('PRIVATE-RAW-FAILURE'); } })]);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.scanners[0].status, 'error');
  assert.equal(JSON.stringify(report).includes('PRIVATE-RAW-FAILURE'), false);
  await assert.rejects(execute(f), /run-budget-exhausted/);
  assert.equal(JSON.parse(await readFile(path.join(f.store, 'state.json'))).runs.length, 1);
});

test('public lifecycle controls are repeatable and cannot claim independent holdout validation', async t => {
  const f = await fixture(t, 'public-conformance');
  const a = await execute(f), b = await execute(f);
  assert.equal(a.independence, 'public-control');
  assert.equal(a.corpus.corpusHash, b.corpus.corpusHash);
  assert.notEqual(a.runId, b.runId);
  assert.deepEqual(await readdir(f.store), []);
  assert.throws(() => validateEvidence({ ...a, independence: 'custodian-declared' }, 'holdout'));
});

test('tampering with protected bytes is rejected before scanning and never reveals input', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.store, 'corpus.json'), 'PRIVATE-TAMPER-SENTINEL');
  await assert.rejects(execute(f, [cleanScanner({ scan() { assert.fail('tampered corpus scanned'); } })]), /corpus-integrity-mismatch/);
});

test('candidate changes before access reject; changes during execution invalidate all results', async t => {
  const f = await fixture(t);
  await assert.rejects(execute(f, [], { verifyCandidate: async () => ({ ...candidate, sourceHash: 'd'.repeat(64) }) }), /invalid-plan/);
  await assert.rejects(execute(f, [cleanScanner()], { verifyCandidate: async () => ({ ...candidate, sourceHash: 'd'.repeat(64) }) }), /candidate-changed/);
  assert.equal(JSON.parse(await readFile(path.join(f.store, 'state.json'))).runs.length, 0);
  let calls = 0;
  const report = await execute(f, [cleanScanner()], { verifyCandidate: async () => ++calls === 1 ? candidate : { ...candidate, candidateArtifactHash: 'd'.repeat(64) } });
  assert.equal(report.status, 'incomplete');
  assert.equal(report.scanners[0].status, 'error');
  assert.deepEqual(report.scanners[0].assertions, { pass: 0, fail: 0, 'review-required': 0 });
});

test('tool version changes between preflight and execution invalidate holdout evidence', async t => {
  const f = await fixture(t);
  let versions = 0;
  const report = await execute(f, [cleanScanner({ version: async () => ++versions === 1 ? '1.2.3' : '1.2.4' })]);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.scanners[0].status, 'error');
});

test('contamination preserves audit history and blocks further execution', async t => {
  const f = await fixture(t);
  const report = await execute(f);
  await contaminateHoldout(f.manifestFile, 'used-for-tuning');
  const state = JSON.parse(await readFile(path.join(f.store, 'state.json')));
  assert.equal(state.status, 'contaminated');
  assert.deepEqual(state.runs, [report.runId]);
  await assert.rejects(execute(f), /corpus-not-sealed/);
  assert.ok((await readdir(f.store)).some(f => f.startsWith('aggregate-')));
});

test('loose permissions and symlinked inputs fail closed', async t => {
  const f = await fixture(t);
  await chmod(path.join(f.store, 'corpus.json'), 0o644);
  await assert.rejects(execute(f), /unsafe-file-permissions/);
  const g = await fixture(t);
  const target = path.join(g.store, 'corpus.json');
  await rm(target);
  await symlink(path.join(g.root, 'input.json'), target);
  await assert.rejects(execute(g), /access-execution-or-validation-failed/);
  const h = await fixture(t);
  await chmod(path.join(h.root, 'generated'), 0o755);
  await assert.rejects(execute(h), /unsafe-storage-permissions/);
});

test('simultaneous holdout runs cannot bypass the use budget', async t => {
  const f = await fixture(t);
  let announce, release;
  const scanning = new Promise(resolve => { announce = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const first = execute(f, [cleanScanner({ async scan() { announce(); await barrier; return []; } })]);
  await scanning;
  try { await assert.rejects(execute(f), /access-execution-or-validation-failed/); }
  finally { release(); }
  assert.equal((await first).status, 'complete');
});

test('schema validation rejects case disclosure, forged aggregates and false completeness', async t => {
  const f = await fixture(t), report = await execute(f);
  assert.throws(() => validateEvidence({ ...report, fixtures: f.corpus.fixtures }, 'holdout'));
  assert.throws(() => validateEvidence({ ...report, corpus: { ...report.corpus, seed: 'PRIVATE-SEED-SENTINEL' } }, 'holdout'));
  for (const change of [
    r => r.scanners[0].assertions.pass++,
    r => r.scanners.push(r.scanners[0]),
    r => r.scanners[0].status = 'unavailable',
    r => r.scanners[0].configuration.verification = true,
  ]) {
    const invalid = structuredClone(report); change(invalid);
    assert.throws(() => validateEvidence(invalid, 'holdout'));
  }
});

test('missing tools and unsafe run identity fail before protected inputs are read', async t => {
  const f = await fixture(t);
  await assert.rejects(execute(f, [cleanScanner({ async version() { throw new Error('unavailable'); } })]), /access-execution-or-validation-failed/);
  await assert.rejects(execute(f, [cleanScanner()], { runId: '../../outside' }), /invalid-plan/);
  assert.equal(JSON.parse(await readFile(path.join(f.store, 'state.json'))).runs.length, 0);
});

test('renaming a manifest cannot reset the budget of an already sealed corpus', async t => {
  const f = await fixture(t);
  await execute(f);
  await assert.rejects(sealProtectedCorpus(path.join(f.root, 'another-manifest.json'), path.join(f.root, 'input.json'), 'reviewed'), /corpus-already-sealed/);
  assert.equal(JSON.parse(await readFile(path.join(f.store, 'state.json'))).runs.length, 1);
});
