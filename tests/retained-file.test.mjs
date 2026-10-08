import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { retainedEntry, restoreRetainedFile } from '../scripts/restore-retained-file.mjs';
import { dataDispositions, verifyDataState } from '../scripts/retained-data-dispositions.mjs';

const file = 'evidence/test/record.json';
const text = '{"synthetic":true}\n';
const tag = 'hygiene-retained-test';
const digest = createHash('sha256').update(text).digest('hex');

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'retained-test-'));
  git(root, ['init', '--quiet']);
  await mkdir(path.join(root, 'evidence/test'), { recursive: true });
  await writeFile(path.join(root, file), text);
  await symlink('record.json', path.join(root, 'evidence/test/link.json'));
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'synthetic']);
  const sourceCommit = git(root, ['rev-parse', 'HEAD']);
  git(root, ['tag', tag]);
  const manifest = { schema: 'redact-secret/retention-archive/v1', retainedTag: tag, sourceCommit };
  const inventory = { schemaVersion: 1, sourceCommit, entries: [{ path: file, size: Buffer.byteLength(text), sha256: digest }] };
  return { root, manifest, inventory, file };
}

async function withFixture(fn) {
  const options = await fixture();
  try { await fn(options); } finally { await rm(options.root, { recursive: true, force: true }); }
}

test('restore validates bytes and writes only into ignored output, without replacing a file', async () => {
  await withFixture(async options => {
    const receipt = await restoreRetainedFile(options);
    assert.equal(receipt.sha256, digest);
    assert.equal(await readFile(path.join(options.root, receipt.path), 'utf8'), text);
    assert.equal(git(options.root, ['rev-parse', 'HEAD']), options.manifest.sourceCommit);
    await assert.rejects(restoreRetainedFile(options), { code: 'EEXIST' });
  });
});

test('incorrect digest, byte length, inventory commit and duplicate entry fail before writing', async () => {
  await withFixture(async options => {
    for (const change of [entry => { entry.sha256 = '0'.repeat(64); }, entry => { entry.size++; }]) {
      const inventory = structuredClone(options.inventory); change(inventory.entries[0]);
      await assert.rejects(restoreRetainedFile({ ...options, inventory }), /checksum/);
    }
    const wrongCommit = { ...options.inventory, sourceCommit: '0'.repeat(40) };
    assert.throws(() => retainedEntry(options.manifest, wrongCommit, file), /identity/);
    const duplicate = { ...options.inventory, entries: [...options.inventory.entries, ...options.inventory.entries] };
    assert.throws(() => retainedEntry(options.manifest, duplicate, file), /unique/);
  });
});

test('absolute, traversal, malformed and unsupported paths are refused', async () => {
  await withFixture(async options => {
    for (const unsafe of ['/evidence/test/record.json', 'evidence/../record.json', 'evidence/./record.json', 'evidence//record.json', 'holdout/private.json', 'evidence/test/a\nb'])
      assert.throws(() => retainedEntry(options.manifest, options.inventory, unsafe), /Unsafe/);
  });
});

test('linked output ancestors and output destinations are refused', async () => {
  await withFixture(async options => {
    await mkdir(path.join(options.root, 'outside'));
    await symlink(path.join(options.root, 'outside'), path.join(options.root, 'results-output'));
    await assert.rejects(restoreRetainedFile(options), /Unsafe restore/);
    await rm(path.join(options.root, 'results-output'));
    await mkdir(path.join(options.root, 'results-output/retained/evidence/test'), { recursive: true });
    await symlink(path.join(options.root, file), path.join(options.root, 'results-output/retained', file));
    await assert.rejects(restoreRetainedFile(options));
    assert.equal(await readFile(path.join(options.root, file), 'utf8'), text);
  });
});

test('Git symlinks are refused even when their blob bytes are checksummed', async () => {
  await withFixture(async options => {
    const link = 'evidence/test/link.json';
    const inventory = { ...options.inventory, entries: [{ path: link, size: 11, sha256: createHash('sha256').update('record.json').digest('hex') }] };
    await assert.rejects(restoreRetainedFile({ ...options, inventory, file: link }), /regular file/);
  });
});

test('tag target must match recorded commit and fetch restores an absent tag without accepting another target', async () => {
  await withFixture(async options => {
    const remote = await mkdtemp(path.join(tmpdir(), 'retained-origin-'));
    try {
      git(remote, ['init', '--bare', '--quiet']);
      git(options.root, ['remote', 'add', 'origin', remote]);
      git(options.root, ['push', '--quiet', 'origin', `refs/tags/${tag}`]);
      git(options.root, ['tag', '-d', tag]);
      await assert.rejects(restoreRetainedFile(options), /unavailable/);
      await restoreRetainedFile({ ...options, fetch: true });
      await assert.rejects(restoreRetainedFile({ ...options, manifest: { ...options.manifest, sourceCommit: '0'.repeat(40) }, inventory: { ...options.inventory, sourceCommit: '0'.repeat(40) } }), /differs/);
    } finally { await rm(remote, { recursive: true, force: true }); }
  });
});


test('data disposition preserves release, rollback and policy inputs and never approves a cold removal', () => {
  const sourceCommit = 'a'.repeat(40);
  const manifest = { schema: 'redact-secret/retention-archive/v1', sourceCommit, retainedTag: tag,
    coldCandidates: [{ path: 'evidence/test/cold.json', disposition: 'retain-pending-review', reason: 'External reader unresolved.' }] };
  const entries = ['baselines/example.json', 'peer-observations/comparison/example.json', 'benchmarks/review-ledger.json', 'evidence/test/cold.json', 'scripts/example.mjs']
    .map(path => ({ path, size: 1, sha256: 'b'.repeat(64), callers: [] }));
  const inventory = { schemaVersion: 1, sourceCommit, entries };
  const result = dataDispositions(manifest, inventory);
  assert.deepEqual(result.map(entry => entry.disposition), ['retain-release-anchor', 'retain-active-rollback', 'retain-policy-input', 'retain-pending-review']);
  assert.ok(result.every(entry => entry.removalAllowed === false && entry.after.sha256 === entry.sha256));
  assert.throws(() => dataDispositions(manifest, { ...inventory, sourceCommit: 'c'.repeat(40) }), /differs/);
});

test('only an explicit checksum-bound archived payload may be absent', async () => {
  const options = await fixture();
  try {
    const { manifest, inventory, root } = options;
    inventory.entries[0].callers = [];
    manifest.coldCandidates = [];
    manifest.dispositions = { payloadsRemoved: [file] };
    const row = { ...inventory.entries[0], disposition: 'historical-record-migrated', removalApproved: true, reason: 'Scoped synthetic history', preservation: { sha256: digest, ref: `refs/tags/${tag}`, verifiedAt: '2026-10-08' } };
    const removals = { sourceCommit: manifest.sourceCommit, preservationTag: tag, entries: [row] };
    assert.throws(() => dataDispositions(manifest, inventory, removals), /byte-verified/);
    manifest.dataPayloadRetrievals = [{ path: file, sourceCommit: manifest.sourceCommit, fileBytes: Buffer.byteLength(text), fileSha256: digest, assetSha256: 'b'.repeat(64), verifiedAt: '2026-10-08' }];
    const entries = dataDispositions(manifest, inventory, removals);
    assert.equal(entries[0].after.present, false);
    await assert.rejects(verifyDataState(root, entries, manifest.sourceCommit), /unexpectedly present/);
    await rm(path.join(root, file));
    await verifyDataState(root, entries, manifest.sourceCommit);
    const retained = [{ ...entries[0], after: { ...entries[0].after, present: true } }];
    await assert.rejects(verifyDataState(root, retained, manifest.sourceCommit), /missing/);
    assert.throws(() => dataDispositions(manifest, inventory, { ...removals, entries: [{ ...row, sha256: 'c'.repeat(64) }] }), /byte-verified/);
  } finally { await rm(options.root, { recursive: true, force: true }); }
});

test('reference migrations cannot authorize measurement payload drift', () => {
  const sourceCommit = 'a'.repeat(40), markdown = 'evidence/test/README.md';
  const manifest = { schema: 'redact-secret/retention-archive/v1', sourceCommit, retainedTag: tag, coldCandidates: [], dispositions: { referenceUpdates: [{ path: markdown, sourceSha256: digest, afterSha256: 'b'.repeat(64), afterBytes: 20, reason: 'Retained link migration' }] } };
  const inventory = { schemaVersion: 1, sourceCommit, entries: [{ path: markdown, size: 10, sha256: digest, callers: [] }] };
  assert.equal(dataDispositions(manifest, inventory)[0].after.size, 20);
  assert.throws(() => dataDispositions({ ...manifest, dispositions: { referenceUpdates: [{ ...manifest.dispositions.referenceUpdates[0], sourceSha256: 'c'.repeat(64) }] } }, inventory), /Markdown digest/);
  assert.throws(() => dataDispositions({ ...manifest, dispositions: { referenceUpdates: [{ ...manifest.dispositions.referenceUpdates[0], path: file }] } }, { ...inventory, entries: [{ ...inventory.entries[0], path: file }] }), /Markdown digest/);
  assert.throws(() => dataDispositions({ ...manifest, dispositions: { referenceUpdates: [manifest.dispositions.referenceUpdates[0], manifest.dispositions.referenceUpdates[0]] } }, inventory), /Duplicate/);
});
