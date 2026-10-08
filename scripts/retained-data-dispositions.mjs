#!/usr/bin/env node
/** Data ownership view over the exhaustive inventory; no deletion decisions are inferred. */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function dataDispositions(manifest, inventory) {
  if (manifest?.schema !== 'redact-secret/retention-archive/v1' || inventory?.schemaVersion !== 1 || inventory.sourceCommit !== manifest.sourceCommit)
    throw new Error('Data inventory differs from the retained source commit');
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
    return { ...entry, disposition, reason, after: { present: true, size: entry.size, sha256: entry.sha256 },
      archive: { tag: manifest.retainedTag, sourceCommit: manifest.sourceCommit, path: entry.path },
      removalAllowed: false };
  });
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/retained-data-dispositions.mjs');
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'benchmarks/retention-archive.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(path.join(ROOT, manifest.inventory.output), 'utf8'));
  const entries = dataDispositions(manifest, inventory);
  for (const entry of entries) {
    const bytes = await readFile(path.join(ROOT, entry.path));
    if (bytes.length !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256)
      throw new Error(`Retained working bytes drifted: ${entry.path}`);
  }
  const output = path.join(ROOT, manifest.dispositions.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ schema: 'redact-secret/data-retention-dispositions/v1', sourceCommit: manifest.sourceCommit,
    retainedTag: manifest.retainedTag, verification: 'Every retained working file matched inventory byte length and SHA256.',
    payloadsRemoved: [], entries }) + '\n');
  console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, files: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.size, 0), payloadsRemoved: 0, output: manifest.dispositions.output }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
