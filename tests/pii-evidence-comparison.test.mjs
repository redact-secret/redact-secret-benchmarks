import test from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { syntheticEvidenceComparison, syntheticEvidenceOfficialUpload, syntheticFutureEvidenceOfficialUpload } from './helpers/pii-evidence-comparison-fixture.mjs';
import { loadPiiEvidenceComparison } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { executionScope, evidenceDigest, evidenceComparisonPlan, validateEvidenceProductTuple, readEvidenceComparisonPlan, validateEvidencePlanPath, validateEvidenceExecutionPaths, validateEvidenceExecutionSelection, validateEvidenceComparisonPlan, validateEvidenceCostDecision } from '../scripts/lib/pii-evidence-comparison-plan.mjs';
import { sha256, expectedPreflightReport } from '../scripts/lib/pii-evidence-contract.mjs';
import { parseEvidenceJson } from '../scripts/lib/pii-evidence-json.mjs';
import { runEvidenceComparison, evidenceExecutionContext } from '../scripts/run-pii-evidence-comparison.mjs';
import { verifyCurrentDispatch } from '../scripts/check-pii-evidence-dispatch.mjs';
import { collectEvidenceComparison, writeCollectedEvidence, evidenceComparisonSourceProblems, UPLOAD_NAMES } from '../scripts/record-pii-evidence-comparison.mjs';
test('missing evidence receipt is explicit and cannot grant support', () => assert.equal(loadPiiEvidenceComparison().state, 'absent'));
test('strict paired public result keeps all cells, memberships and withheld reasons', () => {
  const r = loadPiiEvidenceComparison(syntheticEvidenceComparison());
  assert.equal(r.state, 'recorded', r.reason); assert.equal(r.outcomes.length, 139); assert.equal(r.metrics.length, 10);
  assert.equal(r.qualified, false); assert.equal(r.supportClaims, false); assert.ok(r.metrics.some(row => row.delta === null));
  assert.equal(r.familyMetrics.state, 'unavailable'); assert.equal(r.historical.state, 'descriptive-only');
  assert.equal(r.historical.platformMatches, true); assert.equal(r.historical.engineBinaryMatches, true);
  assert.equal(r.changes.total, 0); assert.equal(r.mappedFamilies['pii:us:ssn'].variants, 9);
});
for (const [name, mutate] of [
  ['same product source', e => e.receipt.candidate.sourceCommit = e.receipt.baseline.sourceCommit],
  ['unknown engine', e => e.receipt.engine.commit = 'f'.repeat(40)],
  ['wrong Darwin binary', e => e.receipt.engine.binarySha256 = 'f'.repeat(64)],
  ['fake Linux receipt', e => e.receipt.engine.platform = 'linux-x64'],
  ['raw receipt field', e => e.receipt.raw = 'synthetic'],
  ['missing product', e => e.artifacts.pop()],
  ['duplicate product', e => e.artifacts[1] = e.artifacts[0]],
  ['tampered index method', e => e.populationIndex[0].method = 'schema-only'],
  ['invented mapping', e => e.populationIndex[0].family = 'pii:global:iban'],
  ['wrong release', e => e.plan.evidence.release.commit = 'f'.repeat(40)],
  ['claim qualification', e => e.plan.qualified = true],
  ['replay failed', e => e.receipt.candidate.replays[0].parity = 'different'],
  ['binding digest tampered', e => e.receipt.import.population.bindingDigest = 'f'.repeat(64)],
  ['raw artifact field', e => { const d = JSON.parse(e.artifacts[0].text); d.raw = 'synthetic'; e.artifacts[0].text = JSON.stringify(d); }],
]) test(`refuses ${name}`, () => { const e = syntheticEvidenceComparison(); mutate(e); assert.equal(loadPiiEvidenceComparison(e).state, 'invalid'); });
function resign(e, mutate) {
  const doc = JSON.parse(e.artifacts[0].text); mutate(doc); doc.semanticDigest = semanticDigest(doc);
  e.artifacts[0].text = JSON.stringify(doc); e.receipt.baseline.artifactDigest = doc.semanticDigest;
  e.receipt.baseline.artifactSha256 = sha256(e.artifacts[0].text);
  e.receipt.baseline.replays.forEach(row => row.publicArtifactDigest = doc.semanticDigest);
}
for (const [name, mutate] of [
  ['same count different member', d => d.semantic.outcomes[0].variantId = 'ev-not-in-reviewed-population'],
  ['method changed', d => d.semantic.outcomes[0].method = 'schema-only'],
  ['occurrence changed', d => d.semantic.outcomes[0].occurrenceId = 'occurrence-2'],
  ['scanner changed', d => d.semantic.outcomes[0].scannerId = 'unreviewed-peer'],
  ['metrics missing', d => d.semantic.scannerMetrics[0].metrics.pop()],
]) test(`rehashed artifact still refuses ${name}`, () => { const e = syntheticEvidenceComparison(); resign(e, mutate); assert.equal(loadPiiEvidenceComparison(e).state, 'invalid'); });
test('prepared plan is not an official execution allowance', async () => {
  const { plan } = syntheticEvidenceComparison(); validateEvidenceComparisonPlan(plan);
  await assert.rejects(runEvidenceComparison({ plan, requireCanonical: true, out: '/tmp/evidence-refusal-never-created' }), /fresh-cost/);
  const cost = { schema: 'pii-evidence-comparison-cost-decision/1', state: 'prepared', decidedBy: null, decidedAt: null, scope: plan.execution };
  validateEvidenceCostDecision(cost); cost.state = 'approved'; assert.throws(() => validateEvidenceCostDecision(cost));
});
test('plan digest detects any changed evidence or execution budget', () => {
  const { plan } = syntheticEvidenceComparison(), digest = evidenceDigest(plan); plan.execution.runs++;
  assert.notEqual(evidenceDigest(plan), digest); assert.throws(() => validateEvidenceComparisonPlan(plan));
});
test('official receipt requires separately verified immutable Actions collection', () => {
  const e = syntheticEvidenceOfficialUpload(); assert.equal(loadPiiEvidenceComparison(e).state, 'invalid');
  const result = collectEvidenceComparison(e);
  assert.equal(result.summary.state, 'recorded'); assert.equal(result.summary.mode, 'official');
  assert.equal(result.summary.provenance.workflow.runId, e.run.id);
  assert.equal(result.summary.historical.platformMatches, false); assert.equal(result.summary.historical.engineBinaryMatches, false);
});
test('future reviewed release uses runtime preflight without changing initial snapshot anchor', () => {
  const future = syntheticFutureEvidenceOfficialUpload(), first = syntheticEvidenceComparison();
  validateEvidenceComparisonPlan(future.plan, { populationIndex: future.populationIndex });
  assert.notEqual(future.plan.evidence.snapshot.id, first.plan.evidence.snapshot.id);
  assert.equal(future.plan.engine.commit, first.plan.engine.commit); assert.equal(future.plan.consumer.source.commit, first.plan.consumer.source.commit);
  assert.equal(collectEvidenceComparison(future).summary.state, 'recorded');
  assert.notEqual(future.costDecision.scope.preflightDigest, first.plan.execution.preflightDigest);
  future.costDecision.scope.snapshotDigest = first.plan.execution.snapshotDigest;
  assert.throws(() => collectEvidenceComparison(future));
});
test('future population size and mapping derive from reviewed preflight rather than initial constants', () => {
  const e = syntheticFutureEvidenceOfficialUpload(), row = e.populationIndex.find(row => row.method === 'type-validation' && row.family === 'pii:global:email');
  const counts = { evidenceCases: 1, evidenceCasesCarried: 1, evidenceCasesWithoutFixtures: 0, evidenceFixtures: 1, evidenceSkipped: 0,
    corpusCases: 1, corpusVariants: 1, occurrences: 1, locatedOccurrences: 1, rangeLessOccurrences: 0 };
  const preflight = expectedPreflightReport(e.plan.policy, { snapshotPin: e.plan.evidence, consumerPin: e.plan.consumer, counts,
    losses: Object.fromEntries(Object.keys(e.plan.losses).map(key => [key, 0])), outputs: e.plan.preflight.outputs,
    mappedKinds: ['email/global/basic'], mappedFamilies: { 'pii:global:email': { cases: 1, variants: 1 } } });
  const one = syntheticEvidenceOfficialUpload({ preflight, policy: e.plan.policy, populationIndex: [row] });
  assert.equal(collectEvidenceComparison(one).summary.outcomes.length, 1);
  one.populationIndex[0].method = 'schema-only'; assert.throws(() => collectEvidenceComparison(one));
});
test('nullable metadata parser rejects duplicate keys, hidden extras and nonfinite values', () => {
  assert.equal(parseEvidenceJson('{"approved":null}').approved, null);
  for (const text of ['{"state":"prepared","state":"approved"}', '{"x":1e999}', '{"x":0} trailing', '\ufeff{}', '['.repeat(66) + '0' + ']'.repeat(66)])
    assert.throws(() => parseEvidenceJson(text));
});
test('canonical identity and elapsed setup budget are checked before any scanner', () => {
  const e = syntheticEvidenceOfficialUpload(), now = Date.parse('2026-10-08T00:20:00Z');
  const environment = { GITHUB_REPOSITORY: e.receipt.github.repository, GITHUB_RUN_ID: String(e.run.id), GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: e.expectedHeadSha, GITHUB_WORKFLOW_REF: e.receipt.github.workflowRef, EVIDENCE_JOB_STARTED_AT: String((now - 600000) / 1000) };
  assert.equal(evidenceExecutionContext({ requireCanonical: true, plan: e.plan, environment, now }).deadline - now, 300000);
  assert.throws(() => evidenceExecutionContext({ requireCanonical: true, plan: e.plan, environment: { ...environment, GITHUB_RUN_ATTEMPT: '2' }, now }));
  assert.throws(() => evidenceExecutionContext({ requireCanonical: true, plan: e.plan, environment: { ...environment, EVIDENCE_JOB_STARTED_AT: String((now - 900000) / 1000) }, now }));
  assert.throws(() => evidenceExecutionContext({ requireCanonical: true, plan: e.plan, environment: { ...environment, GITHUB_SHA: '' }, now }));
});
for (const [name, mutate] of [
  ['failed Actions conclusion', e => e.run.conclusion = 'failure'],
  ['other immutable head', e => e.expectedHeadSha = '2'.repeat(40)],
  ['second attempt', e => e.run.run_attempt = 2],
  ['foreign fork', e => e.run.head_repository.full_name = 'foreign/repository'],
  ['main dispatch', e => e.run.head_branch = 'main'],
  ['expired archive', e => e.artifact.expired = true],
  ['other archive hash', e => e.archiveSha256 = 'b'.repeat(64)],
  ['extra upload member', e => e.files['hidden.txt'] = 'synthetic'],
  ['replay bytes changed', e => e.files['replay-inputs/baseline/observation.json'] = '{"changed":true}'],
  ['missing separate build receipt', e => delete e.files['build-receipt.json']],
  ['unapproved cost', e => e.costDecision.state = 'prepared'],
]) test(`canonical collector refuses ${name}`, () => { const e = syntheticEvidenceOfficialUpload(); mutate(e); assert.throws(() => collectEvidenceComparison(e)); });

test('web consumer imports plan library without executable CLI syntax', () => {
  const source = readFileSync(new URL('../scripts/lib/pii-evidence-comparison-plan.mjs', import.meta.url), 'utf8');
  assert.ok(!source.startsWith('#!'));
  assert.ok(!source.includes('process.argv'));
  assert.ok(!source.includes('new URL('));
  const consumer = readFileSync(new URL('../benchmarks/evaluation/domains/pii/evidence-comparison.mjs', import.meta.url), 'utf8');
  assert.ok(consumer.includes('scripts/lib/pii-evidence-comparison-plan.mjs'));
});

test('durable collector retains and rehashes all replay inputs and importer receipt', () => {
  const e = syntheticEvidenceOfficialUpload(), result = collectEvidenceComparison(e);
  assert.deepEqual(Object.keys(result.files).sort(), [...UPLOAD_NAMES].sort());
  const root = mkdtempSync(join(tmpdir(), 'pii-evidence-durable-test-'));
  const dir = join(root, 'benchmarks/pii-evidence-comparison');
  try {
    for (const [name, text] of Object.entries({ ...result.files, 'record.json': JSON.stringify(result.record), 'population-index.json': JSON.stringify(e.populationIndex), 'cost-decision.json': JSON.stringify(e.costDecision) })) {
      const file = join(dir, name); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text);
    }
    assert.deepEqual(evidenceComparisonSourceProblems({ root, plan: e.plan }), []);
    for (const name of ['build-receipt.json', ...e.receipt.replayInputs.map(row => row.name)]) {
      writeFileSync(join(dir, name), result.files[name] + ' ');
      assert.ok(evidenceComparisonSourceProblems({ root, plan: e.plan }).length > 0, name);
      writeFileSync(join(dir, name), result.files[name]);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function reviewedFutureProducts() {
  const first = syntheticEvidenceComparison();
  const tuple = { schema: 'pii-evidence-reviewed-products/1', reviewedBy: 'external synthetic reviewer', reviewedAt: '2026-10-08T00:00:00Z',
    baseline: structuredClone(first.plan.baseline), candidate: structuredClone(first.plan.candidate) };
  tuple.candidate.sourceCommit = '8'.repeat(40); tuple.candidate.qualificationRunId = '12';
  for (const key of Object.keys(tuple.candidate).filter(key => key.endsWith('Sha256'))) tuple.candidate[key] = '9'.repeat(64);
  return tuple;
}
test('reviewed future product tuple collects with a fresh full-tuple cost scope', () => {
  const tuple = reviewedFutureProducts(), e = syntheticEvidenceOfficialUpload({ productTuple: tuple });
  assert.equal(e.plan.candidate.sourceCommit, tuple.candidate.sourceCommit);
  assert.equal(e.plan.execution.productTupleDigest, evidenceDigest(tuple));
  assert.equal(collectEvidenceComparison(e).summary.state, 'recorded');
  assert.equal(collectEvidenceComparison(e).summary.candidate.sourceCommit, tuple.candidate.sourceCommit);
  const old = syntheticEvidenceOfficialUpload();
  assert.throws(() => validateEvidenceCostDecision(old.costDecision, { productTuple: tuple, executionPaths: e.plan.executionPaths }), /cost-decision-invalid/);
  const stale = structuredClone(e); stale.costDecision.scope.productTupleDigest = old.plan.execution.preflightDigest;
  assert.throws(() => collectEvidenceComparison(stale));
  const mutated = structuredClone(e); mutated.plan.productTuple.candidate.sourceCommit = '7'.repeat(40);
  assert.throws(() => collectEvidenceComparison(mutated));
});
for (const [name, mutate] of [
  ['extra engine override', t => t.engine = { commit: 'a'.repeat(40) }],
  ['extra scanner override', t => t.scanner = { activation: [] }],
  ['output newline', t => t.candidate.version = '1.0.0\nproduct_sha=bad'],
  ['oversized version', t => t.candidate.version = '1.0.0-' + 'x'.repeat(100)],
  ['invalid calendar date', t => t.reviewedAt = '2026-02-30T00:00:00Z'],
  ['review newline', t => t.reviewedBy = 'reviewer\nspoof'],
  ['numeric run', t => t.candidate.qualificationRunId = 12],
  ['registry host drift', t => t.baseline.packages['@redact-secret/core'].resolved = 'https://example.org/package.tgz'],
  ['missing package', t => delete t.baseline.packages['@redact-secret/wasm']],
  ['invalid SRI', t => t.baseline.packages['@redact-secret/core'].integrity = 'sha512-invalid'],
  ['invalid candidate hash', t => t.candidate.coreTarballSha256 = 'bad'],
]) test('reviewed future product tuple refuses ' + name, () => { const t = reviewedFutureProducts(); mutate(t); assert.throws(() => validateEvidenceProductTuple(t)); });
test('without the optional tuple, canonical initial plan and cost remain exact', () => {
  const plan = JSON.parse(readFileSync(new URL('../benchmarks/pii-evidence-comparison/plan.json', import.meta.url)));
  const cost = JSON.parse(readFileSync(new URL('../benchmarks/pii-evidence-comparison/cost-decision.json', import.meta.url)));
  assert.deepEqual(evidenceComparisonPlan({ costDecision: cost, preflight: plan.preflight, policy: plan.policy, populationIndexDigest: plan.populationIndexDigest }), plan);
  assert.ok(!Object.hasOwn(plan, 'productTuple')); assert.ok(!Object.hasOwn(cost.scope, 'productTupleDigest'));
});

test('CLI prepares a separate reviewed product plan and emits only origin-bound dynamic identities', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pii-products-cli-'));
  const id = 'tuple-cli-' + scratch.split('/').at(-1).toLowerCase();
  const executionPaths = { planPath: `benchmarks/pii-evidence-comparison/${id}/plan.json`, costDecisionPath: `benchmarks/pii-evidence-comparison/${id}/cost-decision.json` };
  const dir = fileURLToPath(new URL('../' + dirname(executionPaths.planPath), import.meta.url));
  const productTuple = reviewedFutureProducts(), e = syntheticEvidenceOfficialUpload({ productTuple, executionPaths });
  mkdirSync(dir);
  try {
    const tupleFile = join(scratch, 'products.json'), pathsFile = join(scratch, 'paths.json');
    writeFileSync(tupleFile, JSON.stringify(productTuple)); writeFileSync(pathsFile, JSON.stringify(executionPaths));
    writeFileSync(join(dir, 'cost-decision.json'), JSON.stringify(e.costDecision));
    const run = args => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/pii-evidence-comparison-plan.mjs', import.meta.url)), ...args], { encoding: 'utf8' });
    run([`--product-tuple=${tupleFile}`, `--execution-paths=${pathsFile}`, `--cost-decision=${executionPaths.costDecisionPath}`, '--write', `--out=${join(dir, 'plan.json')}`]);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'plan.json'))), e.plan);
    verifyCurrentDispatch({ environment: { EVIDENCE_PLAN: executionPaths.planPath, GITHUB_REPOSITORY: e.run.repository.full_name, GITHUB_RUN_ID: String(e.run.id), GITHUB_RUN_ATTEMPT: '1', GITHUB_REF: 'refs/heads/' + e.run.head_branch },
      readDecision: () => JSON.stringify(e.costDecision), readApi: endpoint => endpoint.includes('/runs?')
        ? JSON.stringify({ total_count: 1, workflow_runs: [{ id: e.run.id, head_sha: e.expectedHeadSha, created_at: e.costDecision.decidedAt }] })
        : JSON.stringify({ encoding: 'base64', content: Buffer.from(JSON.stringify(e.costDecision)).toString('base64') }) });
    run(['--check', `--plan=${executionPaths.planPath}`]);
    assert.equal(run(['--github-output', `--plan=${executionPaths.planPath}`]),
      `has_candidate=true\nproduct_sha=${productTuple.candidate.sourceCommit}\nqualification_run_id=${productTuple.candidate.qualificationRunId}\nbaseline_version=${productTuple.baseline.version}\ncandidate_version=${productTuple.candidate.version}\n`);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(scratch, { recursive: true, force: true }); }
});
test('execution origins refuse copied active plans, other ids and unsafe paths', () => {
  const e = syntheticEvidenceOfficialUpload({ productTuple: reviewedFutureProducts() });
  validateEvidenceExecutionSelection(e.plan, { planPath: e.plan.executionPaths.planPath });
  assert.throws(() => validateEvidenceExecutionSelection(e.plan), /origin-mismatch/);
  assert.throws(() => validateEvidenceExecutionSelection(e.plan, { planPath: 'benchmarks/pii-evidence-comparison/another/plan.json' }), /origin-mismatch/);
  for (const path of ['../plan.json', '/tmp/plan.json', 'benchmarks/pii-evidence-comparison/replay-inputs/plan.json', 'benchmarks/pii-evidence-comparison/UPPER/plan.json', 'benchmarks/pii-evidence-comparison/a/../../plan.json'])
    assert.throws(() => validateEvidencePlanPath(path));
  assert.throws(() => validateEvidenceExecutionPaths({ ...e.plan.executionPaths, costDecisionPath: 'benchmarks/pii-evidence-comparison/another/cost-decision.json' }));
  const moved = structuredClone(e); moved.plan.executionPaths.planPath = 'benchmarks/pii-evidence-comparison/copied/plan.json';
  moved.plan.executionPaths.costDecisionPath = 'benchmarks/pii-evidence-comparison/copied/cost-decision.json';
  assert.throws(() => collectEvidenceComparison(moved));
});
test('separate variant collection keeps current and historical durable records intact', () => {
  const root = mkdtempSync(join(tmpdir(), 'pii-variant-collect-')), e = syntheticEvidenceOfficialUpload({ productTuple: reviewedFutureProducts() });
  try {
    const first = collectEvidenceComparison(syntheticEvidenceOfficialUpload()), next = collectEvidenceComparison(e);
    const current = 'benchmarks/pii-evidence-comparison';
    writeCollectedEvidence({ root, outDir: current, result: first });
    const before = readFileSync(join(root, current, 'record.json'));
    const checkedDir = 'benchmarks/pii-evidence-comparison/existing-plan';
    mkdirSync(join(root, checkedDir));
    writeFileSync(join(root, checkedDir, 'plan.json'), '{}');
    assert.throws(() => writeCollectedEvidence({ root, outDir: checkedDir, result: next }), /existing-plan-mismatch/);
    assert.equal(existsSync(join(root, checkedDir, 'receipt.json')), false);
    writeFileSync(join(root, checkedDir, 'plan.json'), next.files['plan.json']);
    writeFileSync(join(root, checkedDir, 'build-receipt.json'), 'unrelated');
    assert.throws(() => writeCollectedEvidence({ root, outDir: checkedDir, result: next }), /existing-member/);
    assert.equal(existsSync(join(root, checkedDir, 'receipt.json')), false);
    rmSync(join(root, checkedDir, 'build-receipt.json'));
    writeCollectedEvidence({ root, outDir: checkedDir, result: next });
    assert.equal(readFileSync(join(root, checkedDir, 'plan.json'), 'utf8'), next.files['plan.json']);

    writeCollectedEvidence({ root, outDir: dirname(e.plan.executionPaths.planPath), result: next });
    assert.deepEqual(readFileSync(join(root, current, 'record.json')), before);
    assert.throws(() => writeCollectedEvidence({ root, outDir: dirname(e.plan.executionPaths.planPath), result: next }), /existing-record/);
    const badDir = 'benchmarks/pii-evidence-comparison/broken';
    mkdirSync(join(root, badDir)); symlinkSync(join(root, 'missing'), join(root, badDir, 'plan.json'));
    assert.throws(() => writeCollectedEvidence({ root, outDir: badDir, result: next }), /symlink/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('dispatch guard resolves immutable history at the original scoped cost path and rejects copies before API', () => {
  const e = syntheticEvidenceOfficialUpload({ productTuple: reviewedFutureProducts() });
  const environment = { EVIDENCE_PLAN: e.plan.executionPaths.planPath, GITHUB_REPOSITORY: e.run.repository.full_name,
    GITHUB_RUN_ID: String(e.run.id), GITHUB_RUN_ATTEMPT: '1', GITHUB_REF: 'refs/heads/' + e.run.head_branch };
  const endpoints = [];
  const readApi = endpoint => {
    endpoints.push(endpoint);
    if (endpoint.includes('/runs?event=workflow_dispatch')) return JSON.stringify({ total_count: 1, workflow_runs: [{ id: e.run.id, head_sha: e.expectedHeadSha, created_at: e.costDecision.decidedAt }] });
    assert.ok(endpoint.includes('/contents/' + e.plan.executionPaths.costDecisionPath + '?ref='));
    return JSON.stringify({ encoding: 'base64', content: Buffer.from(JSON.stringify(e.costDecision)).toString('base64') });
  };
  verifyCurrentDispatch({ plan: e.plan, environment, readApi, readDecision: () => JSON.stringify(e.costDecision) });
  assert.equal(endpoints.length, 2);
  for (const EVIDENCE_PLAN of ['benchmarks/pii-evidence-comparison/plan.json', 'benchmarks/pii-evidence-comparison/copied/plan.json', '../unsafe.json']) {
    let accessed = false;
    assert.throws(() => verifyCurrentDispatch({ plan: e.plan, environment: { ...environment, EVIDENCE_PLAN }, readApi: () => { accessed = true; } }));
    assert.equal(accessed, false);
  }
});

test('selected plan and cost symlinks refuse before loading or API access', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pii-symlink-test-'));
  const id = 'path-test-' + scratch.split('/').at(-1).toLowerCase();
  const executionPaths = { planPath: `benchmarks/pii-evidence-comparison/${id}/plan.json`, costDecisionPath: `benchmarks/pii-evidence-comparison/${id}/cost-decision.json` };
  const e = syntheticEvidenceOfficialUpload({ productTuple: reviewedFutureProducts(), executionPaths });
  const dir = fileURLToPath(new URL('../' + dirname(executionPaths.planPath), import.meta.url));
  mkdirSync(dir);
  try {
    symlinkSync(join(scratch, 'missing'), join(dir, 'plan.json'));
    assert.throws(() => readEvidenceComparisonPlan(executionPaths.planPath), /symlink/);
    rmSync(join(dir, 'plan.json'));
    symlinkSync(join(scratch, 'missing'), join(dir, 'cost-decision.json'));
    let accessed = false;
    assert.throws(() => verifyCurrentDispatch({ plan: e.plan, environment: { EVIDENCE_PLAN: executionPaths.planPath }, readApi: () => { accessed = true; } }), /symlink/);
    assert.equal(accessed, false);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(scratch, { recursive: true, force: true }); }
});

test('reviewed local variant binds its exact reviewed native tarball too', () => {
  const e = syntheticEvidenceComparison({ productTuple: reviewedFutureProducts() });
  assert.equal(loadPiiEvidenceComparison(e).state, 'recorded');
  e.receipt.candidate.tarballs.node = 'f'.repeat(64);
  assert.equal(loadPiiEvidenceComparison(e).state, 'invalid');
});


test('a published-only execution preserves one product and rejects candidate observations', () => {
  const e = syntheticEvidenceComparison();
  const productTuple = { schema: 'pii-evidence-reviewed-products/1', reviewedBy: 'synthetic reviewer', reviewedAt: '2026-10-09T00:00:00Z', baseline: e.plan.baseline, candidate: null };
  const executionPaths = { planPath: 'benchmarks/pii-evidence-comparison/synthetic-single/plan.json', costDecisionPath: 'benchmarks/pii-evidence-comparison/synthetic-single/cost-decision.json' };
  const runtime = { preflight: e.plan.preflight, policy: e.plan.policy, populationIndex: e.populationIndex, productTuple, executionPaths };
  const costDecision = { schema: 'pii-evidence-comparison-cost-decision/1', state: 'prepared', decidedBy: null, decidedAt: null, scope: executionScope(runtime) };
  e.plan = evidenceComparisonPlan({ ...runtime, costDecision });
  const extraArtifact = e.artifacts.find(row => row.side === 'candidate');
  delete e.receipt.candidate; e.receipt.planDigest = evidenceDigest(e.plan);
  e.receipt.replayInputs = e.receipt.replayInputs.filter(row => row.name.includes('/baseline/'));
  e.artifacts = e.artifacts.filter(row => row.side === 'baseline');
  const result = loadPiiEvidenceComparison(e);
  assert.equal(result.state, 'recorded', result.reason);
  assert.equal(e.plan.execution.runs, 1); assert.equal(e.plan.execution.protectedRuns, 0);
  assert.equal(result.candidate, null); assert.ok(result.metrics.every(row => row.candidate === null && row.delta === null));
  assert.ok(result.outcomes.every(row => row.candidate === null && !row.changed));
  e.artifacts.push(extraArtifact); assert.equal(loadPiiEvidenceComparison(e).state, 'invalid');
});
