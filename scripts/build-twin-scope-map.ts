/**
 * Generate (or --check) the product-owned twin-scope map of the public evidence snapshot (#602).
 *
 *   npm run qualification:twin-scope -- --snapshot <credential-eval-corpus-snapshot.json>            write it
 *   npm run qualification:twin-scope -- --snapshot <credential-eval-corpus-snapshot.json> --check    fail when stale
 *   npm run qualification:twin-scope -- --validate                                                   structure only, no snapshot
 *
 * The snapshot is the evidence release asset the public artifact was run on (its corpus digest is checked against the pin in
 * benchmarks/official-runs.json). The map is derived from the public snapshot and the project twin-scope corpus and never hand-edited; the
 * method and the boundary are benchmarks/qualification/twin-scope.ts and docs/specs/qualification-inputs.md.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TWIN_SCOPE_FILE, buildTwinScopeMap, serializeTwinScopeMap, twinScopeMapProblems, type PublicSnapshotLike } from '../benchmarks/qualification/twin-scope.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, TWIN_SCOPE_FILE);
const registry = JSON.parse(await readFile(path.join(root, 'benchmarks/official-runs.json'), 'utf8'));
const pinned: string = registry.populations.find((p: { id: string }) => p.id === 'public-evidence-snapshot').evidence.corpusDigest;

const committed = JSON.parse(await readFile(file, 'utf8').catch(() => 'null'));
if (args.includes('--validate')) {
  const problems = twinScopeMapProblems(committed);
  if (committed && committed.snapshot?.corpusDigest !== pinned) problems.push(`the map is bound to ${committed.snapshot?.corpusDigest}, the registry pins the public corpus ${pinned}`);
  if (problems.length) { console.error(`${TWIN_SCOPE_FILE}:\n  - ${problems.join('\n  - ')}`); process.exit(1); }
  console.log(`${TWIN_SCOPE_FILE} is well formed and bound to the pinned public corpus (${Object.keys(committed.twins).length} twins)`);
  process.exit(0);
}

const snapshotFile = option('snapshot');
if (!snapshotFile) throw new Error('Usage: qualification:twin-scope --snapshot <file> [--check] | --validate');
const snapshot: PublicSnapshotLike = JSON.parse(await readFile(path.resolve(snapshotFile), 'utf8'));
if (snapshot.identity.corpus_digest !== pinned) throw new Error(`The snapshot is corpus ${snapshot.identity.corpus_digest}, the registry pins ${pinned}`);
const map = await buildTwinScopeMap(snapshot);
const problems = twinScopeMapProblems(map);
if (problems.length) throw new Error(`The derived map is invalid:\n  - ${problems.join('\n  - ')}`);
const bytes = serializeTwinScopeMap(map);
if (args.includes('--check')) {
  if ((await readFile(file, 'utf8').catch(() => '')) !== bytes) { console.error(`${TWIN_SCOPE_FILE} is stale against the snapshot and the project twin-scope corpus; run npm run qualification:twin-scope -- --snapshot <file>`); process.exit(1); }
  console.log(`${TWIN_SCOPE_FILE} matches the derivation from the snapshot`);
} else {
  await writeFile(file, bytes);
  console.log(`Wrote ${TWIN_SCOPE_FILE}: ${map.derivation.mapped} of ${map.derivation.familyLessTwins} family-less public twins map to a project case`);
}
