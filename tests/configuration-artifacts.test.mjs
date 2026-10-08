import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canonical, findingShape, readBenchmarkContext, fileInventory, measurePlan, sha256, validatePlan, verifyQualification, workload } from '../scripts/measure-configuration-artifacts.mjs';

const sourceCommit = 'a'.repeat(40);
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'configuration-artifacts-test-'));
  writeFileSync(join(directory, 'a.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  writeFileSync(join(directory, 'glue.js'), 'export default () => {};');
  const plan = { schema: 'configuration-performance-plan/v1', sourceCommit, selection: ['jwt'], samples: 5, iterations: 1, inputBytes: [1024, 2048], artifacts: ['full', 'common', 'custom'].map(id => ({ id, directory, binary: join(directory, 'a.wasm'), coreDist: directory, glue: join(directory, 'glue.js') })) };
  return { directory, plan };
}
const fakeSample = request => ({ manifestDigest: `sha256:${request.artifact.id}`, includedDetectors: 1, enabled: ['jwt'], initialization: { initializationMs: 1, rssInitializedBytes: 100 }, workloads: request.inputBytes.map(bytes => ({ inputBytes: bytes, inputSha256: sha256(workload(bytes)), findingsDigest: 'same', findingCount: 1, scanMs: 1, scanBytesPerSecond: bytes * 1000 })) });

test('rejects missing profiles, moving source identity and unbounded inputs before loading', () => {
  const { directory, plan } = fixture();
  try {
    assert.throws(() => validatePlan({ ...plan, sourceCommit: 'main' }), /identity/);
    assert.throws(() => validatePlan({ ...plan, artifacts: plan.artifacts.slice(1) }), /Require/);
    assert.throws(() => validatePlan({ ...plan, inputBytes: [1024, 2097152] }), /sizes/);
    assert.throws(() => validatePlan({ ...plan, samples: 1 }), /protocol/);
    const piiArtifacts = ['full-pii', 'common-pii'].map(id => ({ ...plan.artifacts[0], id, initializeOptions: { pii: ['pii:global'] } }));
    assert.equal(validatePlan({ ...plan, artifacts: [...plan.artifacts, ...piiArtifacts] }).artifacts.length, 5);
    assert.throws(() => validatePlan({ ...plan, artifacts: [...plan.artifacts, ...piiArtifacts.map(a => ({ ...a, initializeOptions: { pii: { selectors: ['pii:global'] } } }))] }), /PII selection/);
    assert.throws(() => validatePlan({ ...plan, artifacts: plan.artifacts.map(a => ({ ...a, binary: '/elsewhere/a.wasm' })) }), /inside/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('collects complete fresh sample matrix with hash-only workload identity', () => {
  const { directory, plan } = fixture();
  try {
    let calls = 0;
    const report = measurePlan(plan, { runSample: request => { calls++; return fakeSample(request); } });
    assert.equal(calls, 30);
    assert.equal(report.rows.length, 6);
    assert.equal(report.rows[0].summary.workloads[0].inputBytes, 1024);
    assert.equal(report.sizes[0].sha256, sha256(readFileSync(plan.artifacts[0].binary)));
    assert.equal(report.supportClaims, false);
    assert.equal(report.fullBrotliBound.comparableBuildEnvironmentVerified, false);
    assert.ok(!JSON.stringify(report).includes('ghp_'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('records product parity disagreement and rejects artifact file mutation', () => {
  const { directory, plan } = fixture();
  try {
    const mismatch = measurePlan(plan, { runSample: request => {
      const result = fakeSample(request);
      if (request.artifact.id === 'custom') result.workloads[0].findingsDigest = 'different';
      return result;
    } });
    assert.equal(mismatch.comparisons[0].matches, false);
    let changed = false;
    assert.throws(() => measurePlan(plan, { runSample: request => {
      if (!changed) { writeFileSync(join(directory, 'a.wasm'), 'changed'); changed = true; }
      return fakeSample(request);
    } }), /files changed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('inventory refuses symlinks outside the immutable input tree', () => {
  const { directory } = fixture();
  try {
    symlinkSync('/tmp', join(directory, 'outside'));
    assert.throws(() => fileInventory(directory), /symlinks/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('real fresh child validates custom manifest and build report and never returns plaintext', () => {
  const { directory, plan } = fixture();
  try {
    const manifest = { schema: 'artifact-manifest/v1', sourceRevision: sourceCommit, artifact: { kind: 'wasm', variant: 'custom', pii: false }, detectors: [{ id: 'jwt' }] };
    manifest.digest = `sha256:${sha256(canonical(manifest))}`;
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    writeFileSync(join(directory, 'artifact-manifest.custom.json'), JSON.stringify(manifest));
    writeFileSync(join(directory, 'index.js'), `
      export async function initialize() {}
      export const artifact = () => 'wasm';
      export const artifactManifest = () => (${JSON.stringify(manifest)});
      export const describeConfig = () => ({ detection: { enabled: ['jwt'] } });
      export const scan = input => [{detector:'jwt',type:'jwt',confidence:'high',obfuscation:'none',start:0,end:1,action:'redact',value:input}];
      export const resolveConfig = () => ({ok:true});
      export const compareConfigurations = () => ({});
      export const createIncrementalSanitizer = () => ({append:()=>({}),finalize:()=>({}),abort:()=>{}});
    `);
    const report = { engine: { sourceRevision: sourceCommit, sourceTreeDirty: false }, manifest: { digest: manifest.digest }, files: { 'index.js': sha256(readFileSync(join(directory, 'index.js'))) } };
    writeFileSync(join(directory, 'build-report.json'), JSON.stringify(report));
    const request = { artifact: plan.artifacts[2], mode: 'narrowed', sourceCommit, selection: ['jwt'], inputBytes: [1024, 2048], iterations: 1 };
    const run = () => spawnSync(process.execPath, ['scripts/configuration-artifact-worker.mjs'], { input: JSON.stringify(request), encoding: 'utf8', timeout: 10000 });
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    assert.equal(JSON.parse(success.stdout).workloads[0].findingCount, 1);
    assert.ok(!success.stdout.includes('ghp_'));
    request.sourceCommit = 'b'.repeat(40);
    assert.notEqual(run().status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test('null-source qualification binding checks inventory, tarball and complete runtime bytes', () => {
  const { directory, plan } = fixture();
  const packageRoot = mkdtempSync(join(tmpdir(), 'configuration-package-test-'));
  try {
    mkdirSync(join(packageRoot, 'package', 'dist'), { recursive: true });
    cpSync(directory, join(packageRoot, 'package', 'dist'), { recursive: true });
    const tarball = join(packageRoot, 'core.tgz');
    execFileSync('tar', ['-czf', tarball, '-C', packageRoot, 'package']);
    const inventory = { sourceCommit, workflowRun: 'test', installedJavaScriptQualification: [{ packageArtifacts: [{ name: '@redact-secret/core', sha256: sha256(readFileSync(tarball)) }] }], artifacts: ['wasm-web', 'wasm-web-common'].flatMap(artifact => ['a.wasm', 'glue.js'].map(file => ({ artifact, file, sha256: sha256(readFileSync(join(directory, file))) }))) };
    const inventoryFile = join(packageRoot, 'inventory.json');
    writeFileSync(inventoryFile, JSON.stringify(inventory));
    const qualified = { ...plan, qualificationInventory: inventoryFile, corePackageTarball: tarball };
    const inventories = plan.artifacts.map(a => ({ runtimeFiles: fileInventory(a.coreDist) }));
    assert.equal(verifyQualification(qualified, inventories).sourceCommit, sourceCommit);
    assert.throws(() => verifyQualification({ ...qualified, sourceCommit: 'b'.repeat(40) }, inventories), /source mismatch/);
    writeFileSync(join(directory, 'glue.js'), 'changed');
    assert.throws(() => verifyQualification(qualified, inventories), /WASM files/);
  } finally { rmSync(directory, { recursive: true, force: true }); rmSync(packageRoot, { recursive: true, force: true }); }
});


test('public flat offsets are required and changing an offset changes the finding digest', () => {
  const finding = { detector: 'jwt', type: 'jwt', start: 1, end: 20, action: 'redact', confidence: 'high', obfuscation: 'none' };
  assert.notEqual(sha256(canonical(findingShape([finding]))), sha256(canonical(findingShape([{ ...finding, end: 21 }]))));
  assert.throws(() => findingShape([{ ...finding, start: undefined }]), /shape/);
});

test('dirty benchmark checkout is rejected before samples can start', () => {
  const directory = mkdtempSync(join(tmpdir(), 'configuration-git-test-'));
  try {
    execFileSync('git', ['init', '--quiet', directory]);
    writeFileSync(join(directory, 'fixture'), 'synthetic');
    execFileSync('git', ['add', 'fixture'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: directory });
    assert.equal(readBenchmarkContext(directory).benchmarkTreeDirty, false);
    writeFileSync(join(directory, 'fixture'), 'changed');
    assert.throws(() => readBenchmarkContext(directory), /clean before sampling/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
