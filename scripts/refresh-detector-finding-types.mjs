/**
 * Snapshot the product's finding types per detector from the core repository's code-derived detector inventory
 * (`docs/coverage/detector-inventory.json`, reconciled against the real registry by a Rust test there), read through
 * git at one exact revision. Never reads a detector implementation. The snapshot is `benchmarks/detector-finding-types.json`;
 * `benchmarks/support/finding-types.ts` derives each support-matrix row's finding-type key from it (#647).
 *
 *   node scripts/refresh-detector-finding-types.mjs --core=<path to a redact-secret checkout> [--revision=<40-hex>] [--check]
 *
 * `--revision` defaults to the `sourceRevision` of `benchmarks/detectors.json`, so the two snapshots describe one product
 * revision. `--check` writes nothing and fails when the committed snapshot differs from what that revision derives.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z]+)(?:=(.+))?$/.exec(arg);
  if (!match) throw new Error('Usage: node scripts/refresh-detector-finding-types.mjs --core=<checkout> [--revision=<sha>] [--check]');
  return [match[1], match[2] ?? true];
}));
if (typeof options.core !== 'string') throw new Error('Pass --core=<path to a redact-secret checkout>');
const detectors = JSON.parse(await readFile(path.join(root, 'benchmarks/detectors.json'), 'utf8'));
const revision = typeof options.revision === 'string' ? options.revision : detectors.sourceRevision;
if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('The revision must be a full 40-hex commit id');
const SOURCE_PATH = 'docs/coverage/detector-inventory.json';
const bytes = execFileSync('git', ['-C', options.core, 'show', `${revision}:${SOURCE_PATH}`], { maxBuffer: 64 * 1024 * 1024 });
const inventory = JSON.parse(bytes.toString('utf8'));
const byDetector = new Map();
for (const row of inventory.types) {
  if (!byDetector.has(row.detector)) byDetector.set(row.detector, []);
  byDetector.get(row.detector).push(row.type);
}
const registered = detectors.sourceRevision === revision ? new Set(detectors.detectors.map(d => d.id)) : null;
if (registered) {
  const missing = [...registered].filter(id => !byDetector.has(id)), extra = [...byDetector.keys()].filter(id => !registered.has(id));
  if (missing.length || extra.length) throw new Error(`The inventory and benchmarks/detectors.json disagree at ${revision}: no type for ${missing.join(', ') || 'none'}; unregistered ${extra.join(', ') || 'none'}`);
}
const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const snapshot = {
  schemaVersion: 1,
  source: { repository: 'redact-secret/redact-secret', revision, path: SOURCE_PATH, sha256: createHash('sha256').update(bytes).digest('hex') },
  note: 'Finding types per registered detector, copied from the core detector inventory at one revision. A detector with several types is a shared detector; the support matrix keys each row by these types (docs/specs/support-matrix.md).',
  detectors: Object.fromEntries([...byDetector].sort(([a], [b]) => byteOrder(a, b)).map(([id, types]) => [id, types.slice().sort(byteOrder)])),
};
const text = JSON.stringify(snapshot, null, 2) + '\n';
const target = path.join(root, 'benchmarks/detector-finding-types.json');
if (options.check) {
  if ((await readFile(target, 'utf8').catch(() => '')) !== text) { console.error('benchmarks/detector-finding-types.json is stale: run node scripts/refresh-detector-finding-types.mjs --core=<checkout>'); process.exit(1); }
  console.log(`Detector finding types are current at ${revision}.`);
} else {
  await writeFile(target, text);
  console.log(`Wrote benchmarks/detector-finding-types.json: ${byDetector.size} detectors, ${inventory.types.length} finding types, revision ${revision}.`);
}
