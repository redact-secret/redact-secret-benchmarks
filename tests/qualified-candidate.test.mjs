import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ARTIFACTS, pickArtifacts, productShaInput, qualifiedCandidate, selectQualificationRun, sha256, verifyPacked } from '../scripts/qualified-candidate.mjs';

const SHA = 'de9080eb6e9e78fd5d60301ea477fdb32cbe91cb';
const REPO = 'redact-secret/redact-secret';
const hex = seed => sha256(Buffer.from(seed));

test('PRODUCT_SHA is untrusted: empty resolves main, anything but 40 lower-case hex fails', () => {
  assert.equal(productShaInput(''), null);
  assert.equal(productShaInput(undefined), null);
  assert.equal(productShaInput(SHA), SHA);
  for (const bad of [SHA.toUpperCase(), SHA.slice(0, 7), `${SHA}\n`, ` ${SHA}`, `${SHA};rm -rf /`, 'main', '../x', `${SHA}0`])
    assert.throws(() => productShaInput(bad), /40-character/, JSON.stringify(bad));
});

const runOf = overrides => ({ id: 10, run_attempt: 1, head_sha: SHA, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success',
  head_repository: { full_name: REPO }, path: '.github/workflows/artifact-qualification.yml', ...overrides });

test('only a successful main qualification run of exactly that commit is selected, newest first', () => {
  assert.equal(selectQualificationRun([runOf({ id: 10 }), runOf({ id: 12 }), runOf({ id: 11 })], { sha: SHA, repository: REPO }).id, 12);
  for (const reject of [{ conclusion: 'failure' }, { status: 'in_progress', conclusion: null }, { head_branch: 'rc/0.2' }, { event: 'pull_request' },
    { head_sha: 'f'.repeat(40) }, { head_repository: { full_name: 'someone/fork' } }, { path: '.github/workflows/ci.yml' }])
    assert.equal(selectQualificationRun([runOf(reject)], { sha: SHA, repository: REPO }), null, JSON.stringify(reject));
});

test('each required artifact must exist once, unexpired, with an upload digest', () => {
  const listing = ARTIFACTS.map((name, id) => ({ id, name, expired: false, digest: `sha256:${hex(name)}` }));
  assert.deepEqual(Object.keys(pickArtifacts([...listing, { id: 99, name: 'cli-x86_64-unknown-linux-gnu', digest: null }])), ARTIFACTS);
  assert.throws(() => pickArtifacts(listing.slice(1)), /0 artifacts named artifact-inventory/);
  assert.throws(() => pickArtifacts([...listing, listing[0]]), /2 artifacts named artifact-inventory/);
  assert.throws(() => pickArtifacts(listing.map(a => (a.name === 'wasm-web' ? { ...a, expired: true } : a))), /wasm-web has expired/);
  assert.throws(() => pickArtifacts(listing.map(a => (a.name === 'wasm-web' ? { ...a, digest: null } : a))), /wasm-web carries no sha256/);
});

const inventoryOf = (overrides = {}, lane = {}) => ({
  sourceCommit: SHA, sourceRef: 'refs/heads/main', workflowRun: '35938949409', productVersion: '0.1.0-beta.7', ...overrides,
  cleanInstallQualification: [{ lane: 'browser', sourceCommit: SHA, results: { install: 'failed' } }, {
    lane: 'node', sourceCommit: SHA, results: { install: 'passed', artifact: 'passed' },
    packages: [
      { name: '@redact-secret/core', version: '0.1.0-beta.7', file: 'redact-secret-core-0.1.0-beta.7.tgz', sha256: hex('core') },
      { name: '@redact-secret/node-linux-x64-gnu', version: '0.1.0-beta.7', file: 'redact-secret-node-linux-x64-gnu-0.1.0-beta.7.tgz', sha256: hex('node') },
      { name: '@redact-secret/wasm', version: '0.1.0-beta.7', file: 'redact-secret-wasm-0.1.0-beta.7.tgz', sha256: hex('wasm') },
    ],
    binaries: [
      { file: 'redact-secret.linux-x64-gnu.node', sha256: hex('addon') },
      { file: 'redact_secret_wasm_bg.wasm', sha256: hex('full') },
      { file: 'redact_secret_wasm_common_bg.wasm', sha256: hex('common') },
    ], ...lane }],
});

test('the inventory must attest this commit, main, this run, and a passing node lane', () => {
  const qualified = qualifiedCandidate(inventoryOf(), { sha: SHA, runId: 35938949409 });
  assert.equal(qualified.packages.core.sha256, hex('core'));
  assert.equal(qualified.packages.node.file, 'redact-secret-node-linux-x64-gnu-0.1.0-beta.7.tgz');
  assert.equal(qualified.binaries['wasm-web-common'].sha256, hex('common'));
  assert.throws(() => qualifiedCandidate(inventoryOf({ sourceCommit: 'f'.repeat(40) }), { sha: SHA, runId: 35938949409 }), /inventory is for/);
  assert.throws(() => qualifiedCandidate(inventoryOf({ sourceRef: 'refs/pull/9/merge' }), { sha: SHA, runId: 35938949409 }), /not refs\/heads\/main/);
  assert.throws(() => qualifiedCandidate(inventoryOf(), { sha: SHA, runId: 1 }), /names run 35938949409, not 1/);
  assert.throws(() => qualifiedCandidate(inventoryOf({}, { results: { install: 'passed', artifact: 'failed' } }), { sha: SHA, runId: 35938949409 }), /did not pass: artifact/);
  assert.throws(() => qualifiedCandidate(inventoryOf({}, { results: {} }), { sha: SHA, runId: 35938949409 }), /did not pass/);
  assert.throws(() => qualifiedCandidate(inventoryOf({}, { packages: [] }), { sha: SHA, runId: 35938949409 }), /exactly one @redact-secret\/core/);
  assert.throws(() => qualifiedCandidate(inventoryOf({}, { binaries: [] }), { sha: SHA, runId: 35938949409 }), /exactly one redact-secret\.linux-x64-gnu\.node/);
});

test('a repacked tarball that differs from the qualified bytes is refused', () => {
  const qualified = qualifiedCandidate(inventoryOf(), { sha: SHA, runId: 35938949409 });
  const digests = Object.fromEntries(Object.entries(qualified.packages).map(([role, p]) => [path.join('/packed', p.file), hex(role)]));
  assert.deepEqual(Object.keys(verifyPacked(qualified, '/packed', file => digests[file])), ['core', 'node', 'wasm']);
  digests[path.join('/packed', qualified.packages.wasm.file)] = hex('tampered');
  assert.throws(() => verifyPacked(qualified, '/packed', file => digests[file]), /repacked redact-secret-wasm-0\.1\.0-beta\.7\.tgz .* Refusing to measure it/);
});
