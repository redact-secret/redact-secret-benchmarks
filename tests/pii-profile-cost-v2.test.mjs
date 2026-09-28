// PII profile cost v2 (#428): the reviewed re-freeze of the #286 protocol for a pii-context/v2 candidate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { piiProfileCostPlan as v1Plan, validatePiiProfileCostPlan as validateV1 } from '../benchmarks/evaluation/domains/pii/profile-cost.ts';
import { piiProfileCostPlan as v2Plan, validatePiiProfileCostPlan as validateV2 } from '../benchmarks/evaluation/domains/pii/profile-cost-v2.ts';
import { verifyImplementationFreeze } from '../scripts/pii-profile-cost/adapter-protocol.mjs';

const text = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v1 stays intact: its plan validates and every frozen v1 file keeps its reviewed bytes', async () => {
  validateV1(v1Plan);
  assert.equal(await verifyImplementationFreeze(v1Plan), true);
  assert.equal(v1Plan.inputs.candidateProductCommit, '2e1bdcf0905f7a374c4c54b7caac41303cd7d88b');
});

test('v2 is a reviewed plan for a pii-context/v2 candidate with its own implementation freeze', async () => {
  const plan = validateV2(v2Plan);
  assert.equal(plan.id, 'pii-profile-cost-v2');
  assert.equal(plan.inputs.contextVocabulary, 'pii-context/v2');
  assert.ok(['interim', 'final'].includes(plan.inputs.candidateRole));
  assert.equal(plan.inputs.candidateProductCommit, '1db8ff38b16e50c51229eb27025452952bf621e1');
  assert.equal(await verifyImplementationFreeze(v2Plan), true);
  // The plan is a separate version: v1 files are not part of the v2 freeze except the shared, unchanged adapters.
  const shared = v2Plan.implementationFreeze.files.filter(row => v1Plan.implementationFreeze.files.some(item => item.path === row.path));
  assert.ok(shared.every(row => row.path.startsWith('scripts/pii-profile-cost/')));
  for (const row of shared) assert.equal(row.sha256, v1Plan.implementationFreeze.files.find(item => item.path === row.path).sha256);
  assert.throws(() => validateV2({ ...structuredClone(v2Plan), inputs: { ...v2Plan.inputs, contextVocabulary: 'pii-context/v1' } }));
});

test('v2 adapters expect the plan vocabulary and the size roster keeps a split-out PII Wasm apart', () => {
  const measure = text('scripts/measure-pii-profile-cost-v2.mjs');
  assert.ok(measure.includes('vocabulary=${piiProfileCostPlan.inputs.contextVocabulary}'));
  assert.ok(!measure.includes('vocabulary=pii-context/v1'));
  const collect = text('scripts/collect-pii-profile-cost-sizes-v2.mjs');
  assert.ok(collect.includes("verdict: 'no-frozen-budget'") && collect.includes('piiArtifacts'));
  assert.ok(collect.includes("filter(profile => !profile.startsWith('pii:'))") && collect.includes('_pii_bg.wasm'));
  // redact-secret#937: raw browser Wasm with PII on runs the `_pii` builds; PII-off runs the default builds.
  const chromium = text('scripts/pii-profile-cost/chromium-sample-v2.mjs'), prepare = text('scripts/prepare-pii-profile-cost-linux-v2.mjs');
  assert.ok(chromium.includes("input.selectors.length ? '-pii' : ''"));
  for (const entry of ['redact_secret_wasm_pii.js', 'redact_secret_wasm_common_pii.js', 'redact_secret_wasm_pii_bg.wasm', 'redact_secret_wasm_common_pii_bg.wasm'])
    assert.ok(prepare.includes(entry), entry);
  const workflow = text('.github/workflows/pii-profile-cost-v2.yml');
  assert.ok(!workflow.includes('2e1bdcf0905f') && workflow.includes('qualification/pii-profile-cost-v2.json'));
  assert.ok(!/pii-profile-cost\.yml/.test(workflow.replace(/pii-profile-cost-v2\.yml/g, '')));
});
