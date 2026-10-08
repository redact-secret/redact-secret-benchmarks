import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { syntheticEvidenceComparison, syntheticEvidenceOfficialUpload, syntheticFutureEvidenceOfficialUpload } from './helpers/pii-evidence-comparison-fixture.mjs';
import { loadPiiEvidenceComparison } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { evidenceDigest, validateEvidenceComparisonPlan, validateEvidenceCostDecision } from '../scripts/lib/pii-evidence-comparison-plan.mjs';
import { sha256, expectedPreflightReport } from '../scripts/lib/pii-evidence-contract.mjs';
import { parseEvidenceJson } from '../scripts/lib/pii-evidence-json.mjs';
import { runEvidenceComparison, evidenceExecutionContext } from '../scripts/run-pii-evidence-comparison.mjs';
import { collectEvidenceComparison, evidenceComparisonSourceProblems, UPLOAD_NAMES } from '../scripts/record-pii-evidence-comparison.mjs';
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
    for (const [name, text] of Object.entries({ ...result.files, 'record.json': JSON.stringify(result.record), 'population-index.json': JSON.stringify(e.populationIndex) })) {
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
