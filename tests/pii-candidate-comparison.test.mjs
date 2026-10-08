import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPackages, runComparison } from '../scripts/run-pii-candidate-comparison.mjs';
import { comparisonPlan } from '../scripts/pii-candidate-comparison-plan.mjs';
import { comparisonDigest, loadPiiCandidateComparison, ACTIVATION_SELECTORS, ACTIVATION_FAMILIES } from '../benchmarks/evaluation/domains/pii/candidate-comparison.mjs';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const h = character => character.repeat(64);
// The upstream synthetic three-case fixture supplies schema structure, never a ledger measurement.
export function syntheticComparison() {
  const plan = comparisonPlan({costDecision:null}), template = read('tests/fixtures/pii-eval/ci-37551091456-projection.public-synthetic-artifact.json');
  plan.populations = plan.populations.map((p, i) => ({ ...p, memberships: 3, snapshotDigest: h(String(i + 1)), rosterDigest: h(String(i + 5)) }));
  const scannerTemplate = read('benchmarks/pii-eval-population-pins.json');
  const receipt = { schema: 'pii-candidate-comparison-receipt/1', supportClaims: false, authorityChanged: false, ownerAcceptance: null, planDigest: comparisonDigest(plan), mode: 'exploratory', durationMs: 1,
    engine: { commit: plan.engine.commit, binarySha256: plan.execution.localDarwinBinarySha256, shimSha256: plan.engine.shimSha256, canonical: false, platform: 'darwin-arm64' }, activation: {}, pins: {} };
  const artifacts = [];
  for (const [index, side] of ['baseline', 'candidate'].entries()) {
    const tree = h(index ? 'b' : 'a');
    receipt[side] = { sourceCommit: plan[side].sourceCommit, version: plan[side].version, packageTreeSha256: tree, addonTreeSha256: h('c'), wasmTreeSha256: h('d'), nativePackageProvenance: index ? 'local-repacked-qualified-payloads' : 'published-npm-lockfile',
      tarballs: { core: plan.candidate.coreTarballSha256, node: plan.candidate.localNativeDarwinTarballSha256, wasm: plan.candidate.piiWasmTarballSha256 },
      tarballIntegrity: { core: plan.baseline.packages['@redact-secret/core'].integrity, node: plan.baseline.packages['@redact-secret/node-darwin-arm64'].integrity, wasm: plan.baseline.packages['@redact-secret/wasm'].integrity } };
    const sets = ACTIVATION_SELECTORS;
    receipt.activation[side] = { state: 'available', scope: 'installed-product-configuration-only', supportClaims: false, surfaces: ['node-addon', 'node-forced-wasm'].map(surface => ({ surface, checks: sets.map(selectors => ({ requestedSelectors: selectors, artifact: surface === 'node-addon' ? 'addon' : 'wasm', activationIdentity: `credentials=full;selectors=${selectors.join(',') || 'off'};families=${(selectors.length === 0 ? [] : selectors[0] === 'pii:global' && selectors.length === 1 ? ACTIVATION_FAMILIES.filter(f => f.startsWith('pii:global:')) : selectors[0] === 'pii:us' || selectors.length === 2 ? ACTIVATION_FAMILIES : selectors.map(s => s.replace('pii:family:', 'pii:'))).join(',')};vocabulary=pii-context/v2` })) })) };
    const pins = structuredClone(scannerTemplate); pins.build.binarySha256 = receipt.engine.binarySha256; pins.populations = [];
    for (const population of plan.populations) {
      const doc = structuredClone(template); doc.schemaVersion = '1.4';
      const sem = doc.semantic; sem.protocol = structuredClone(pins.protocol); sem.population = { populationId: population.populationId, populationVersion: 1, populationDigest: population.snapshotDigest, visibility: 'public-synthetic' };
      sem.scanners[0].identity = { ...sem.scanners[0].identity, scannerVersion: plan[side].version, artifactDigest: tree, product: { candidateDigest: tree, kind: 'candidate' } };
      sem.productProjection.requiredViews = [population.view]; sem.productProjection.rosterDigest = population.rosterDigest;
      for (const row of sem.productProjection.rows) { row.view = population.view; row.mode = 'exploratory'; row.binding.population = structuredClone(sem.population); row.binding.product = structuredClone(sem.scanners[0].identity.product); }
      const patch = value => { if (!value || typeof value !== 'object') return; if (value.counts?.eligible !== undefined) value.counts.unresolved = 0; for (const item of Object.values(value)) if (typeof item === 'object') patch(item); }; patch(sem);
      doc.semanticDigest = semanticDigest(doc);
      pins.populations.push({ label: population.view, population: structuredClone(sem.population), artifactDigest: doc.semanticDigest, manifestDigest: sem.manifestDigest, runClass: 'public-synthetic', projection: { mode: 'exploratory', requiredViews: [population.view], rosterDigest: population.rosterDigest }, scanners: [{ ...structuredClone(sem.scanners[0].identity), candidateSourceCommit: plan[side].sourceCommit }], retiredArtifactDigests: [], retiredManifestDigests: [] });
      artifacts.push({ side, view: population.view, text: JSON.stringify(doc) });
    }
    receipt.pins[side] = pins;
  }
  return { plan, receipt, artifacts };
}
test('missing comparison is explicit and cannot claim support', () => assert.deepEqual(loadPiiCandidateComparison(), { state: 'absent', reason: 'current-comparison-not-recorded', publicOnly: true, supportClaims: false, qualified: false }));
test('distinct public identities preserve all four populations and withheld cells', () => {
  const result = loadPiiCandidateComparison(syntheticComparison());
  assert.equal(result.state, 'recorded', result.reason); assert.equal(result.qualified, false); assert.equal(result.supportClaims, false);
  assert.equal(result.populations.length, 4); assert.ok(result.populations.every(p => p.memberships === 3));
  assert.ok(result.populations.every(p => p.metrics.some(m => m.delta === null)));
  assert.equal(result.validator.reason, 'product-validator-primitive-seam-unavailable');
});
for (const [name, mutate] of [
  ['missing population', e => e.artifacts.pop()], ['duplicate population', e => e.artifacts[0] = e.artifacts[1]],
  ['source mismatch', e => e.receipt.candidate.sourceCommit = 'f'.repeat(40)], ['same product tree', e => e.receipt.candidate.packageTreeSha256 = e.receipt.baseline.packageTreeSha256],
  ['activation unavailable', e => e.receipt.activation.candidate.surfaces.pop()], ['activation scope inflated', e => e.receipt.activation.candidate.scope = 'qualified'],
  ['selector closure differs', e => e.receipt.activation.candidate.surfaces[0].checks[3].activationIdentity = 'credentials=full;selectors=pii:global,pii:us;families=pii:global:phone;vocabulary=pii-context/v2'],
  ['off activation mislabeled', e => e.receipt.activation.baseline.surfaces[0].checks[0].activationIdentity = e.receipt.activation.baseline.surfaces[0].checks[1].activationIdentity],
  ['baseline integrity changed', e => e.receipt.baseline.tarballIntegrity.core = 'sha512-wrong'], ['candidate wasm wrong lane', e => e.receipt.candidate.tarballs.wasm = h('f')],
  ['engine binary differs', e => e.receipt.engine.binarySha256 = h('f')], ['support claim', e => e.receipt.supportClaims = true],
  ['receipt unexpected raw field', e => e.receipt.rawInput = 'synthetic'], ['artifact altered', e => e.artifacts[0].text = e.artifacts[0].text.replace('"authoredCases":3', '"authoredCases":4')],
]) test(`refuses ${name}`, () => { const evidence = syntheticComparison(); mutate(evidence); assert.equal(loadPiiCandidateComparison(evidence).state, 'invalid'); });

test('package preflight refuses unverified baseline and inventory bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pii-comparison-test-'));
  try { const file = join(dir, 'synthetic'); writeFileSync(file, 'synthetic');
    assert.throws(() => verifyPackages({ plan: comparisonPlan(), side: 'baseline', tarballs: {core:file,node:file,wasm:file} }), /integrity mismatch/);
    assert.throws(() => verifyPackages({ plan: comparisonPlan(), side: 'candidate', tarballs: {core:file,node:file,wasm:file}, inventory:file }), /inventory digest mismatch/);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
test('official execution refuses absent fresh cost approval before any package is launched', async () => {
  const plan = comparisonPlan({costDecision:null}); plan.dispatch = {authorised:false};
  await assert.rejects(runComparison({ plan, requireCanonical:true, out:join(tmpdir(), 'pii-never-launched-' + Date.now()) }), /cost decision missing/);
});

test('fresh owner cost decision binds the exact pair and enables only an official plan', () => {
  const pending = comparisonPlan({costDecision:null});
  assert.equal(pending.mode, 'exploratory'); assert.equal(pending.dispatch.authorised, false);
  const costDecision = { schema:'pii-candidate-comparison-cost-decision/1', state:'approved', decidedBy:'synthetic owner', decidedAt:'2026-10-08T00:00:00Z', baselineSourceCommit:pending.baseline.sourceCommit, candidateSourceCommit:pending.candidate.sourceCommit, engineCommit:pending.engine.commit, qualificationRunId:pending.candidate.qualificationRunId, inventorySha256:pending.candidate.inventorySha256, runs:8, replaysPerRun:2, protectedRuns:0, maxJobs:1, timeoutMinutes:15 };
  const approved = comparisonPlan({costDecision});
  assert.equal(approved.mode, 'official'); assert.equal(approved.dispatch.authorised, true);
  assert.equal(approved.dispatch.costDecisionSha256, comparisonDigest(costDecision));
  for (const [field, value] of [['candidateSourceCommit','f'.repeat(40)], ['runs',4], ['protectedRuns',1], ['decidedAt','invalid']]) assert.throws(() => comparisonPlan({costDecision:{...costDecision,[field]:value}}), /cost decision/);
});
