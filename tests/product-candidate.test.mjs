import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, packagesFor } from '../scripts/install-product-candidate.mjs';
import { problems } from '../scripts/check-product-candidates.mjs';

const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pc-test-'));
  const assets = path.join(dir, 'assets'), nodeDir = path.join(dir, 'node');
  mkdirSync(assets);
  const packages = [];
  for (const [name, platform, files] of [['@redact-secret/core', null, { 'index.js': 'export const VERSION = "9.9.9";' }], ['@redact-secret/node-linux-x64-gnu', 'linux-x64', { 'addon.node': 'ADDON' }], ['@redact-secret/node-darwin-arm64', 'darwin-arm64', { 'addon.node': 'OTHER' }], ['@redact-secret/wasm', null, { 'w.wasm': 'W' }]]) {
    const stage = path.join(dir, `stage-${packages.length}`, 'package');
    mkdirSync(stage, { recursive: true });
    writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name, version: '9.9.9' }));
    for (const [f, c] of Object.entries(files)) writeFileSync(path.join(stage, f), c);
    const file = `${name.replace(/\W/g, '-')}.tgz`;
    execFileSync('tar', ['-czf', path.join(assets, file), '-C', path.dirname(stage), 'package']);
    const bytes = readFileSync(path.join(assets, file));
    packages.push({ name, file, platform, sha256: digest(bytes), size: bytes.length });
  }
  for (const name of ['@redact-secret/core', '@redact-secret/wasm', '@redact-secret/node-linux-x64-gnu']) {
    mkdirSync(path.join(nodeDir, 'node_modules', ...name.split('/')), { recursive: true });
    writeFileSync(path.join(nodeDir, 'node_modules', ...name.split('/'), 'published-only.txt'), 'published');
  }
  const registry = { schema: 'redact-secret/product-candidates/v1', candidates: [{ id: 'c1', platform: 'linux-x64', runClass: 'exploratory', publication: 'internal', product: { commit: 'a'.repeat(40), version: '9.9.9', published: false }, release: { repository: 'o/r', tag: 't' }, control: { version: '9.9.8' }, packages }] };
  return { dir, assets, nodeDir, registry };
}

test('a candidate installs only the registered bytes for its platform and leaves nothing of the published build (#698)', () => {
  const { dir, assets, nodeDir, registry } = fixture();
  try {
    assert.deepEqual(packagesFor(registry.candidates[0], 'linux-x64').map(p => p.name), ['@redact-secret/core', '@redact-secret/node-linux-x64-gnu', '@redact-secret/wasm']);
    const receipt = install({ registry, id: 'c1', nodeDir, platform: 'linux-x64', assets, receipt: path.join(dir, 'receipt.json') });
    assert.equal(receipt.runClass, 'exploratory');
    assert.equal(receipt.packages.length, 3);
    assert.ok(readFileSync(path.join(nodeDir, 'node_modules/@redact-secret/core/index.js'), 'utf8').includes('9.9.9'));
    assert.ok(!existsSync(path.join(nodeDir, 'node_modules/@redact-secret/core/published-only.txt')), 'the published build is emptied first');
    assert.equal(receipt.packages[0].files.find(f => f.path === 'index.js').sha256, digest(Buffer.from('export const VERSION = "9.9.9";')));
    assert.ok(existsSync(path.join(dir, 'receipt.json')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a tarball whose digest or size is not the registered one is refused before anything is extracted (#698)', () => {
  const { dir, assets, nodeDir, registry } = fixture();
  try {
    writeFileSync(path.join(assets, registry.candidates[0].packages[0].file), 'tampered');
    assert.throws(() => install({ registry, id: 'c1', nodeDir, platform: 'linux-x64', assets }), /registry pins/);
    assert.ok(existsSync(path.join(nodeDir, 'node_modules/@redact-secret/core/published-only.txt')), 'a refused install leaves the published build in place');
    assert.throws(() => install({ registry, id: 'c1', nodeDir, platform: 'darwin-arm64', assets }), /built for linux-x64/);
    assert.throws(() => install({ registry, id: 'nope', nodeDir, platform: 'linux-x64', assets }), /no product candidate/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the registry gate refuses a published, official or malformed candidate and the committed registry passes (#698)', () => {
  const { dir, registry } = fixture();
  try {
    const adoption = { engineCandidate: { product: { version: '9.9.8' } } };
    assert.deepEqual(problems(registry, adoption), []);
    const bad = structuredClone(registry);
    Object.assign(bad.candidates[0], { runClass: 'official' });
    bad.candidates[0].product.published = true;
    bad.candidates[0].product.commit = 'abc';
    bad.candidates[0].control.version = '1.0.0';
    const found = problems(bad, adoption).join('\n');
    assert.match(found, /exploratory and internal/);
    assert.match(found, /unpublished/);
    assert.match(found, /40-character/);
    assert.match(found, /control 1\.0\.0/);
    const committed = JSON.parse(readFileSync(new URL('../benchmarks/product-candidates.json', import.meta.url), 'utf8'));
    const record = JSON.parse(readFileSync(new URL('../benchmarks/evidence-adoption.json', import.meta.url), 'utf8'));
    assert.deepEqual(problems(committed, record), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a replay receipt is complete, bound to an archive digest and consistent with its verdict (#698)', async () => {
  const { recordReplay, pickDispatchedRun, dataDir } = await import('../scripts/run-candidate-replay.mjs');
  const registry = { candidates: [{ id: 'c1' }, { id: 'c2' }] };
  const replay = { ciRun: 'https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/1', benchmarkRevision: 'b'.repeat(40), data: dataDir('c1'), worsened: false, fixed: 3, regressed: 0, archive: { release: 'candidate-runs-1', sha256: `sha256:${'0'.repeat(64)}` } };
  const next = recordReplay(registry, 'c1', replay);
  assert.equal(next.candidates[0].replay.state, 'replayed');
  assert.equal(next.candidates[1].replay, undefined);
  assert.throws(() => recordReplay(registry, 'c1', { ...replay, archive: { release: 'x', sha256: 'nope' } }), /archive release and its sha256/);
  assert.throws(() => recordReplay(registry, 'c1', { ...replay, benchmarkRevision: 'main' }), /full commit/);
  assert.throws(() => recordReplay(registry, 'c9', replay), /no product candidate/);
  assert.throws(() => recordReplay(registry, 'c1', { ...replay, fixed: undefined }), /lacks fixed/);

  const t = Date.parse('2026-10-04T12:00:00Z');
  const runs = [
    { databaseId: 1, event: 'workflow_dispatch', headBranch: 'b', headSha: 'x', createdAt: '2026-10-04T11:00:00Z' },
    { databaseId: 2, event: 'push', headBranch: 'b', headSha: 'x', createdAt: '2026-10-04T12:00:01Z' },
    { databaseId: 3, event: 'workflow_dispatch', headBranch: 'b', headSha: 'y', createdAt: '2026-10-04T12:00:01Z' },
    { databaseId: 4, event: 'workflow_dispatch', headBranch: 'b', headSha: 'x', createdAt: '2026-10-04T12:00:02Z' },
    { databaseId: 5, event: 'workflow_dispatch', headBranch: 'b', headSha: 'x', createdAt: '2026-10-04T12:00:03Z' },
  ];
  assert.equal(pickDispatchedRun(runs, { ref: 'b', sha: 'x', after: t }).databaseId, 5, 'the newest dispatch of this commit created after the request');
  assert.equal(pickDispatchedRun(runs.slice(0, 3), { ref: 'b', sha: 'x', after: t }), undefined, 'an older run or another commit is never taken');
});

test('the registry gate verifies the shape of a recorded replay (#698)', () => {
  const { dir, registry } = fixture();
  try {
    const adoption = { engineCandidate: { product: { version: '9.9.8' } } };
    const replayed = structuredClone(registry);
    replayed.candidates[0].replay = { state: 'replayed', ciRun: 'https://example.com/x', archive: { release: 'nope', sha256: 'bad' }, benchmarkRevision: 'abc', worsened: false, fixed: 1, regressed: 2, repeatRunsEqual: false, data: 'docs/none' };
    const found = problems(replayed, adoption).join('\n');
    assert.match(found, /replay.ciRun/);
    assert.match(found, /replay.archive/);
    assert.match(found, /benchmarkRevision/);
    assert.match(found, /worsened is false but 2/);
    assert.match(found, /repeat runs did not agree/);
    assert.match(found, /candidate-effect.json/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
