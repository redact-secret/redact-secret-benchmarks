#!/usr/bin/env node
/** Data ownership view over the exhaustive inventory; no deletion decisions are inferred. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function dataDispositions(manifest, inventory, removals = { entries: [] }) {
  if (manifest?.schema !== 'redact-secret/retention-archive/v1' || inventory?.schemaVersion !== 1 || inventory.sourceCommit !== manifest.sourceCommit)
    throw new Error('Data inventory differs from the retained source commit');
  const migrated = new Set(manifest.dispositions?.payloadsRemoved ?? []);
  const approved = new Map(removals.entries.map(entry => [entry.path, entry]));
  const receipts = new Map((manifest.dataPayloadRetrievals ?? []).map(entry => [entry.path, entry]));
  const referenceUpdates = new Map((manifest.dispositions?.referenceUpdates ?? []).map(entry => [entry.path, entry]));
  if (migrated.size !== (manifest.dispositions?.payloadsRemoved ?? []).length || referenceUpdates.size !== (manifest.dispositions?.referenceUpdates ?? []).length)
    throw new Error('Duplicate migrated payload or reference update');
  for (const [file, update] of referenceUpdates) {
    const original = inventory.entries.find(entry => entry.path === file);
    if (!file.endsWith('.md') || !original || update.sourceSha256 !== original.sha256 || !/^[a-f0-9]{64}$/.test(update.afterSha256) || !Number.isSafeInteger(update.afterBytes) || update.afterBytes < 0 || !update.reason)
      throw new Error('Reference update must bind an original Markdown digest and reviewed after bytes');
  }
  if (migrated.size && (removals.sourceCommit !== manifest.sourceCommit || removals.preservationTag !== manifest.retainedTag))
    throw new Error('Migrated payload source differs from retained archive');
  for (const file of migrated) {
    const entry = inventory.entries.find(entry => entry.path === file), row = approved.get(file), receipt = receipts.get(file);
    if (!entry || !row || row.disposition !== 'historical-record-migrated' || row.removalApproved !== true ||
        row.sha256 !== entry.sha256 || row.size !== entry.size || row.preservation?.sha256 !== entry.sha256 ||
        row.preservation?.ref !== `refs/tags/${manifest.retainedTag}` || !row.preservation?.verifiedAt ||
        !receipt?.verifiedAt || receipt.fileSha256 !== entry.sha256 || receipt.fileBytes !== entry.size ||
        receipt.sourceCommit !== manifest.sourceCommit || !/^[a-f0-9]{64}$/.test(receipt.assetSha256 ?? ''))
      throw new Error('Migrated payload lacks approved byte-verified preservation');
  }
  const cold = new Map(manifest.coldCandidates.map(entry => [entry.path, entry]));
  return inventory.entries.filter(entry => /^(?:evidence|baselines|peer-observations|public\/results)\//.test(entry.path) ||
    /^benchmarks\/.*\.json$/.test(entry.path)).map(entry => {
    let disposition = 'retain-pending-review';
    let reason = 'Historical/indirect/external reproduction readers remain unresolved; no payload migration authorised.';
    if (entry.path.startsWith('baselines/')) {
      disposition = 'retain-release-anchor';
      reason = 'baseline:report reads every release; candidate and legacy UI fallback use the newest comparison point; accounting also reads beta.4.';
    } else if (entry.path.startsWith('peer-observations/')) {
      disposition = 'retain-active-rollback';
      reason = 'Computed snapshot paths support replay and the legacy scanner-page fallback; removing one changes provenance or availability.';
    } else if (entry.path === 'benchmarks/review-ledger.json') {
      disposition = 'retain-policy-input';
      reason = 'Qualification policy hashes this ledger; re-key, settlement, queue coverage and rollback readers remain active. Compaction changes identity.';
    } else if (entry.callers.some(caller => caller.active)) {
      disposition = 'retain-active-consumers';
      reason = 'Inventory records active consumers; preserve the original bytes and their measurement identity.';
    }
    if (cold.has(entry.path)) ({ disposition, reason } = cold.get(entry.path));
    const removed = migrated.has(entry.path);
    const update = referenceUpdates.get(entry.path);
    if (removed) { disposition = 'historical-record-migrated'; reason = approved.get(entry.path).reason; }
    return { ...entry, disposition, reason, before: { present: true, size: entry.size, sha256: entry.sha256 },
      after: { present: !removed, size: removed ? 0 : update?.afterBytes ?? entry.size, sha256: removed ? null : update?.afterSha256 ?? entry.sha256, ...(update ? { referenceUpdate: update.reason } : {}) },
      archive: { tag: manifest.retainedTag, sourceCommit: manifest.sourceCommit, path: entry.path, ...(removed ? { receipt: receipts.get(entry.path) } : {}) },
      removalAllowed: false };
  });
}

export async function verifyDataState(root, entries, sourceCommit) {
  for (const entry of entries) {
    const location = path.join(root, entry.path);
    const info = await lstat(location).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    let bytes;
    if (!entry.after.present) {
      if (info) throw new Error(`Migrated payload unexpectedly present: ${entry.path}`);
      bytes = execFileSync('git', ['show', `${sourceCommit}:${entry.path}`], { cwd: root, maxBuffer: 128 * 1024 * 1024 });
    } else {
      if (!info || !info.isFile() || info.isSymbolicLink()) throw new Error(`Retained file missing or not regular: ${entry.path}`);
      bytes = await readFile(location);
    }
    const expected = entry.after.present ? entry.after : entry;
    if (bytes.length !== expected.size || createHash('sha256').update(bytes).digest('hex') !== expected.sha256)
      throw new Error(`Retained or archived bytes drifted: ${entry.path}`);
  }
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/retained-data-dispositions.mjs');
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'docs/retention/archive.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(path.join(ROOT, manifest.inventory.output), 'utf8'));
  const removals = JSON.parse(await readFile(path.join(ROOT, 'docs/retention/removals.json'), 'utf8'));
  const entries = dataDispositions(manifest, inventory, removals);
  await verifyDataState(ROOT, entries, manifest.sourceCommit);
  const beforeBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  const afterBytes = entries.reduce((sum, entry) => sum + entry.after.size, 0);
  const payloadsRemoved = entries.filter(entry => !entry.after.present).map(entry => entry.path);
  const output = path.join(ROOT, manifest.dispositions.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ schema: 'redact-secret/data-retention-dispositions/v1', sourceCommit: manifest.sourceCommit,
    retainedTag: manifest.retainedTag, verification: 'Retained working files matched recorded after digests; explicitly migrated source Git blobs matched the source inventory.',
    before: { files: entries.length, bytes: beforeBytes }, after: { files: entries.length - payloadsRemoved.length, bytes: afterBytes },
    payloadsRemoved, entries }) + '\n');
  console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, beforeFiles: entries.length, beforeBytes, afterFiles: entries.length - payloadsRemoved.length, afterBytes, payloadsRemoved: payloadsRemoved.length, output: manifest.dispositions.output }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
