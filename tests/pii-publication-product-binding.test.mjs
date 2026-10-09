import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { loadPiiPublicationProductBinding } from '../benchmarks/support/pii-publication-product.mjs';
import { piiEvalMeasurementFrom } from '../scripts/pii-publication-inputs.ts';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'benchmarks/pii-candidate-comparison');
const json = async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const productOf = receipt => ({ sourceCommit: receipt.candidate.sourceCommit, coreSha256: receipt.candidate.tarballs.core });

test('real recorded official metadata permits null owner acceptance and binds the exact core tarball to engine package tree', async () => {
  const [plan, receipt] = await Promise.all(['plan.json', 'receipt.json'].map(json));
  assert.equal(receipt.ownerAcceptance, null);
  const proof = await loadPiiPublicationProductBinding(root, productOf(receipt));
  assert.equal(proof.state, 'matched');
  assert.equal(proof.packageTreeSha256, receipt.candidate.packageTreeSha256);
  assert.equal(proof.engineCommit, plan.engine.commit);
  assert.deepEqual(proof.protocol, { id: plan.protocol.id, revision: plan.protocol.revision });
  assert.deepEqual(proof.populationDigests, Object.fromEntries(plan.populations.map(row => [row.populationId, row.snapshotDigest])));
  assert.equal(proof.supportClaims, false);
  assert.equal(proof.qualified, false);
});

test('default publication resolver matches real recorded artifacts and persists a readback-valid proof without a scanner run', async () => {
  const [plan, receipt] = await Promise.all(['plan.json', 'receipt.json'].map(json));
  const scratch = await mkdtemp(path.join(tmpdir(), 'pii-receipt-pins-'));
  try {
    const pins = path.join(scratch, 'pins.json');
    await writeFile(pins, JSON.stringify(receipt.pins.candidate));
    const artifacts = plan.populations.map(({ view }) => path.join(directory, `candidate.${view}.public-synthetic-artifact.json`));
    const measurement = await piiEvalMeasurementFrom(pins, artifacts, productOf(receipt));
    assert.ok(measurement.populations.every(row => row.productBinding.state === 'measures-publication-product' && row.productBinding.proof));
    const explicitRoot = await piiEvalMeasurementFrom(pins, artifacts, productOf(receipt), { repoRoot: root });
    assert.deepEqual(explicitRoot, measurement, 'bundled callers use the injected repository root');
    const missingRoot = await piiEvalMeasurementFrom(pins, artifacts, productOf(receipt), { repoRoot: scratch });
    assert.ok(missingRoot.populations.every(row => row.productBinding.state === 'publication-artifact-not-bound'), 'another root cannot borrow source-module comparison receipts');
    const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: measurement });
    assert.equal(validatePiiSupportMatrixV2(JSON.parse(JSON.stringify(matrix))).artifactCommitment, matrix.artifactCommitment);
  } finally { await rm(scratch, { recursive: true, force: true }); }
});

test('another source or core tarball and an unavailable product identity cannot borrow the recorded comparison', async () => {
  const product = productOf(await json('receipt.json'));
  assert.equal((await loadPiiPublicationProductBinding(root, { ...product, sourceCommit: 'f'.repeat(40) })).state, 'other-product');
  assert.equal((await loadPiiPublicationProductBinding(root, { ...product, coreSha256: 'f'.repeat(64) })).state, 'other-product');
  assert.equal((await loadPiiPublicationProductBinding(root, { ...product, coreSha256: null })).state, 'absent');
  assert.equal((await loadPiiPublicationProductBinding(root, { ...product, sourceCommit: 'invalid' })).state, 'absent');
});

test('missing, malformed, traversal-bearing and incomplete inputs fail closed before publication', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'pii-product-binding-'));
  const target = path.join(scratch, 'benchmarks/pii-candidate-comparison');
  const [plan, receipt, record] = await Promise.all(['plan.json', 'receipt.json', 'record.json'].map(json));
  const product = productOf(receipt);
  try {
    assert.deepEqual(await loadPiiPublicationProductBinding(scratch, product), { state: 'absent', reason: 'current-comparison-not-recorded' });
    assert.equal((await loadPiiPublicationProductBinding('../relative', product)).state, 'invalid');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'plan.json'), '{broken');
    assert.equal((await loadPiiPublicationProductBinding(scratch, product)).state, 'invalid');
    const malicious = structuredClone(plan); malicious.populations[0].view = '../outside';
    await writeFile(path.join(target, 'plan.json'), JSON.stringify(malicious));
    await writeFile(path.join(target, 'receipt.json'), JSON.stringify(receipt));
    await writeFile(path.join(target, 'record.json'), JSON.stringify(record));
    assert.deepEqual(await loadPiiPublicationProductBinding(scratch, product), { state: 'invalid', reason: 'comparison-population-invalid' });
    await writeFile(path.join(target, 'plan.json'), JSON.stringify(plan));
    assert.equal((await loadPiiPublicationProductBinding(scratch, product)).state, 'invalid', 'missing artifacts cannot bind');
    for (const side of ['baseline', 'candidate']) for (const { view } of plan.populations) {
      const name = `${side}.${view}.public-synthetic-artifact.json`;
      await symlink(path.join(directory, name), path.join(target, name));
    }
    assert.equal((await loadPiiPublicationProductBinding(scratch, product)).state, 'matched');
    const wrongReceipt = structuredClone(receipt); wrongReceipt.candidate.tarballs.core = 'f'.repeat(64);
    await writeFile(path.join(target, 'receipt.json'), JSON.stringify(wrongReceipt));
    assert.equal((await loadPiiPublicationProductBinding(scratch, product)).state, 'invalid', 'a receipt must reconcile with the plan and official record');
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
