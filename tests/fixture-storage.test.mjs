import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildCorpora } from '../fixtures/generated/build.mjs';

test('committed manifest preserves every generated corpus byte without storing credentials', async () => {
  const manifest = JSON.parse(await readFile(new URL('../benchmarks/generated-corpora.json', import.meta.url)));
  const corpora = buildCorpora();
  assert.deepEqual(Object.keys(manifest).sort(), Object.keys(corpora).sort());
  for (const [id, corpus] of Object.entries(corpora)) {
    assert.equal(manifest[id].sha256, createHash('sha256').update(JSON.stringify(corpus, null, 2) + '\n').digest('hex'));
    assert.equal(manifest[id].fixtures, corpus.fixtures.length);
  }
});

test('storage guard rejects force-added generated JSON in the index', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fixture-storage-'));
  const script = fileURLToPath(new URL('../scripts/check-fixture-storage.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  try {
    execFileSync('git', ['init', '--quiet', root]);
    await mkdir(join(root, 'fixtures/generated'), { recursive: true });
    await writeFile(join(root, 'fixtures/generated/input.json'), '{}\n');
    assert.equal(run().status, 0);
    execFileSync('git', ['add', '--', 'fixtures/generated/input.json'], { cwd: root });
    const failed = run();
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /must not be staged or tracked/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
