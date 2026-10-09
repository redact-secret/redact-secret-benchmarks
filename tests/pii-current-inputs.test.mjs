import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { piiInputCommitment, validatePiiCurrentInputIndex, validatePiiGapPolicy, validatePiiFixtureCorrections } from '../benchmarks/evaluation/domains/pii/current-inputs.ts';
import { productEvidenceFor, validateCurrentPiiProductRegistry } from '../scripts/pii-publication-inputs.ts';
import { piiCurrentProtectedRoute } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';
import { loadPiiProtectedSupportEvidence, validatePiiProtectedSupportBinding } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
const json = file => readFile(new URL('../' + file, import.meta.url), 'utf8').then(JSON.parse);
const recompute = value => { const { projectionCommitment, ...body } = value; value.projectionCommitment = piiInputCommitment(body); return value; };

test('current policy and correction inputs preserve authored axes and corrected identities', async () => {
  assert.equal(validatePiiGapPolicy(await json('benchmarks/inputs/pii/gap-policy.json')).axisBacklog.length, 33);
  assert.equal(validatePiiFixtureCorrections(await json('benchmarks/inputs/pii/fixture-corrections.json')).corrections.length, 3);
});
for (const [role, validator, mutate] of [
  ['gap-policy', validatePiiGapPolicy, x => x.axisBacklog[0].owner = '#425'],
  ['fixture-corrections', validatePiiFixtureCorrections, x => x.corrections[0].corrected.publicFinding = !x.corrections[0].corrected.publicFinding],
]) test(`${role} rejects tampering even after recomputing its self-hash`, async () => {
  const value = await json(`benchmarks/inputs/pii/${role}.json`); mutate(value);
  assert.throws(() => validator(recompute(value)), /binding mismatch/);
  value.source.sha256 = 'a'.repeat(64);
  assert.throws(() => validator(recompute(value)), /binding mismatch/);
});
test('current products remain not measured without a matching reviewed activation receipt', async () => {
  const registry = await json('benchmarks/inputs/pii/product-bindings.json');
  assert.equal(validateCurrentPiiProductRegistry(registry).bindings.length, 0);
  for (const product of registry.products) assert.equal(await productEvidenceFor(product), null);
  await assert.rejects(productEvidenceFor({ ...registry.products[0], coreSha256: 'a'.repeat(64) }), /another core artifact/);
  const changed = structuredClone(registry); changed.bindings.push({}); recompute(changed);
  assert.throws(() => validateCurrentPiiProductRegistry(changed), /registry|projection/);
  assert.throws(() => validateCurrentPiiProductRegistry(undefined), /missing/);
  const duplicate = structuredClone(registry); duplicate.products[1] = duplicate.products[0]; recompute(duplicate);
  assert.throws(() => validateCurrentPiiProductRegistry(duplicate), /projection|Ambiguous/);
});
test('protected current receipt preserves its reviewed original commitments and rederives its route', async () => {
  const binding = piiCurrentProtectedRoute(), evidence = await loadPiiProtectedSupportEvidence(process.cwd(), binding);
  assert.deepEqual(validatePiiProtectedSupportBinding(binding, evidence), binding);
  assert.equal(evidence.report.artifactCommitment, binding.reportCommitment);
  assert.notEqual(evidence.currentInput.projectionCommitment, binding.reportCommitment);
  assert.equal(evidence.protectedDisposition.distribution.stable, 0);
  assert.equal(evidence.protectedDisposition.distribution.provisional, 5);
});
for (const field of ['report', 'runs', 'profileCost']) test(`protected ${field} tampering with recomputed self-hash rejects the separate binding`, async () => {
  const binding = piiCurrentProtectedRoute(), evidence = await loadPiiProtectedSupportEvidence(process.cwd(), binding);
  const receipt = structuredClone(evidence.currentInput);
  if (field === 'report') receipt.data.report.families[0].views.reviewed[0].cases++;
  if (field === 'runs') receipt.data.runs[0].trust.decision = 'rejected';
  if (field === 'profileCost') receipt.data.profileCost.candidate.sourceCommit = 'a'.repeat(40);
  recompute(receipt);
  assert.throws(() => validatePiiProtectedSupportBinding(binding, { ...receipt.data, currentInput: receipt }), /schema|source-or-projection-mismatch/);
});
test('protected loader rejects data replaced after receipt validation', async () => {
  const binding = piiCurrentProtectedRoute(), evidence = await loadPiiProtectedSupportEvidence(process.cwd(), binding);
  evidence.report = structuredClone(evidence.report);
  evidence.report.families[0].gates[0].status = 'unresolved';
  assert.throws(() => validatePiiProtectedSupportBinding(binding, evidence), /data-changed/);
});

test('input preparation CLI rejects implicit sources, output escapes and accepted input overwrite', async () => {
  const { execFile } = await import('node:child_process'), { promisify } = await import('node:util');
  const run = args => promisify(execFile)(process.execPath, ['--import','tsx','scripts/prepare-pii-protected-current-input.mjs',...args], { cwd: process.cwd() });
  await assert.rejects(run([]), /Explicit original tree/);
  const source = ['--source-root=.', '--source-commit=65ffe7dcb3e7124e7f66cff96cab814f0365f69a', '--prepared=benchmarks/inputs/pii/protected-route.json'];
  await assert.rejects(run([...source,'--output=evidence/new-current-input.json']), /ignored results-output/);
  await assert.rejects(run([...source,'--promote=benchmarks/inputs/pii/protected-route.json']), /cannot overwrite/);
  await assert.rejects(run([...source,'--promote=benchmarks/accepted-pii-profile-cost.json']), /reviewed protected input role/);
  await assert.rejects(run(['--source-root=.', '--source-commit=' + 'a'.repeat(40)]), /differs from the separately reviewed input/);
});

test('current role index rejects unknown, duplicate, missing and unbound paths or source hashes', async () => {
  const original = await json('benchmarks/inputs/pii/current-inputs-index.json');
  assert.equal(validatePiiCurrentInputIndex(original).inputs.length, 4);
  for (const mutate of [x => x.inputs[0].role = 'historical', x => x.inputs[1] = x.inputs[0], x => x.inputs.pop(),
    x => x.inputs[0].path = 'benchmarks/inputs/pii/other.json', x => x.inputs[0].source.commit = 'not-sha', x => x.inputs[0].source.sha256 = 'a']) {
    const value = structuredClone(original); mutate(value);
    assert.throws(() => validatePiiCurrentInputIndex(value), /role index/);
  }
});

test('validated promotion publishes an absent role exclusively and rolls back a tampered original', async context => {
  const { execFile, execFileSync } = await import('node:child_process'), { promisify } = await import('node:util');
  const { mkdtemp, mkdir, writeFile, cp, symlink, rm, access } = await import('node:fs/promises');
  const path = await import('node:path');
  const root = process.cwd(), receipt = await json('benchmarks/inputs/pii/protected-route.json');
  try { execFileSync('git', ['cat-file','-e',receipt.source.commit], { cwd: root, stdio: 'ignore' }); }
  catch { context.skip('Explicit preserved original source commit is required for full-source promotion replay'); return; }
  await mkdir(path.join(root,'results-output'), { recursive: true });
  const overlay = await mkdtemp(path.join(root,'results-output/pii-promotion-'));
  try {
    await mkdir(path.join(overlay,'scripts'), {recursive:true});
    await mkdir(path.join(overlay,'benchmarks/inputs/pii'), {recursive:true});
    await cp(path.join(root,'scripts/prepare-pii-protected-current-input.mjs'),path.join(overlay,'scripts/prepare-pii-protected-current-input.mjs'));
    await symlink(path.join(root,'scripts/lib'),path.join(overlay,'scripts/lib'),'dir');
    await symlink(path.join(root,'benchmarks/evaluation'),path.join(overlay,'benchmarks/evaluation'),'dir');
    const source = path.join(overlay,'original');
    for (const row of receipt.sources) {
      const file = path.join(source,row.path); await mkdir(path.dirname(file), {recursive:true});
      await writeFile(file, execFileSync('git',['show',`${receipt.source.commit}:${row.path}`],{cwd:root,maxBuffer:10*1024*1024}));
    }
    const template = path.join(overlay,'prepared.json'); await writeFile(template,JSON.stringify(receipt));
    const target = path.join(overlay,'benchmarks/inputs/pii/protected-route.json');
    const args = ['--import','tsx',path.join(overlay,'scripts/prepare-pii-protected-current-input.mjs'),`--source-root=${source}`,`--source-commit=${receipt.source.commit}`,`--prepared=${template}`,'--promote=benchmarks/inputs/pii/protected-route.json'];
    const run = () => promisify(execFile)(process.execPath,args,{cwd:root});
    const victim=path.join(source,receipt.sources[0].path), original=await readFile(victim);
    await writeFile(victim,Buffer.concat([original,Buffer.from(' ')]));
    await assert.rejects(run(), /Restored original input bytes/);
    await assert.rejects(access(target));
    await writeFile(victim,original); await run();
    assert.deepEqual(JSON.parse(await readFile(target,'utf8')),receipt);
    await assert.rejects(run(), /cannot overwrite/);
    assert.deepEqual(JSON.parse(await readFile(target,'utf8')),receipt);
  } finally { await rm(overlay,{recursive:true,force:true}); }
});
