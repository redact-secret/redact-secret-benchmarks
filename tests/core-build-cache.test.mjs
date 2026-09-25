import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const script = path.resolve('scripts/core-build-cache.mjs');
const run = (...args) => execFileSync(process.execPath, [script, ...args], { stdio: 'pipe', encoding: 'utf8' });
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();

function checkout(root, name) {
  const dir = path.join(root, name);
  mkdirSync(dir);
  git(dir, 'init', '-q');
  writeFileSync(path.join(dir, '.gitignore'), 'dist/\nnode_modules/\ntarget/\n');
  writeFileSync(path.join(dir, 'src.txt'), 'source\n');
  git(dir, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'add', '.');
  git(dir, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'c');
  return dir;
}

test('the baseline build cache keeps only build outputs, verifies digests and the commit, and records its source', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'build-cache-'));
  const built = checkout(root, 'built');
  mkdirSync(path.join(built, 'dist'));
  mkdirSync(path.join(built, 'node_modules'));
  mkdirSync(path.join(built, 'target/release'), { recursive: true });
  writeFileSync(path.join(built, 'dist/wheel.whl'), 'wheel');
  writeFileSync(path.join(built, 'node_modules/dep.js'), 'dependency');
  writeFileSync(path.join(built, 'target/release/redact-secret'), 'cli');
  writeFileSync(path.join(built, 'target/release/other'), 'intermediate');
  const cache = path.join(root, 'cache');
  run('collect', '--core', built, '--out', cache);
  const manifest = JSON.parse(readFileSync(path.join(cache, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.files), ['dist/wheel.whl', 'target/release/redact-secret']);
  assert.equal(manifest.commit, git(built, 'rev-parse', 'HEAD'));

  // Same commit elsewhere: restored and recorded.
  const target = path.join(root, 'target-clone');
  git(root, 'clone', '-q', built, target);
  const record = path.join(root, 'record.json');
  run('restore', '--cache', cache, '--core', target, '--source', 'cache', '--key', 'k', '--out', record);
  assert.equal(readFileSync(path.join(target, 'dist/wheel.whl'), 'utf8'), 'wheel');
  const recorded = JSON.parse(readFileSync(record, 'utf8'));
  assert.equal(recorded.source, 'cache');
  assert.equal(recorded.cacheKey, 'k');
  assert.equal(recorded.files, 2);
  assert.match(recorded.manifestSha256, /^[0-9a-f]{64}$/);

  // A changed file, an extra file, or another commit fails the run.
  writeFileSync(path.join(cache, 'files/dist/wheel.whl'), 'tampered');
  assert.throws(() => run('restore', '--cache', cache, '--core', target, '--source', 'cache'), /does not match its manifest digest/);
  writeFileSync(path.join(cache, 'files/dist/wheel.whl'), 'wheel');
  writeFileSync(path.join(cache, 'files/dist/extra.bin'), 'x');
  assert.throws(() => run('restore', '--cache', cache, '--core', target, '--source', 'cache'), /not in its manifest/);
  const other = checkout(root, 'other');
  writeFileSync(path.join(other, 'src.txt'), 'changed\n');
  git(other, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-qam', 'd');
  assert.throws(() => run('restore', '--cache', cache, '--core', other, '--source', 'cache'), /the cached build is of/);
});
