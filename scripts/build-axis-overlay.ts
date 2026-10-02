/**
 * Generate (or --check) the product-owned axis overlay of the public evidence snapshot (#636).
 *
 *   npm run qualification:axis-overlay -- --snapshot <credential-eval-corpus-snapshot.json>            write it
 *   npm run qualification:axis-overlay -- --snapshot <credential-eval-corpus-snapshot.json> --check    fail when stale
 *   npm run qualification:axis-overlay -- --validate                                                  structure only, no snapshot
 *
 * The snapshot is the evidence release asset the public artifact was run on (its corpus digest is checked against the pin in
 * benchmarks/official-runs.json). The overlay is derived from the legacy development fixtures and never hand-edited;
 * the method and the boundary are benchmarks/qualification/axis-overlay.ts and docs/specs/qualification-inputs.md.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AXIS_OVERLAY_FILE, axisOverlayProblems, buildAxisOverlay, serializeAxisOverlay, type SnapshotLike } from '../benchmarks/qualification/axis-overlay.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, AXIS_OVERLAY_FILE);
const registry = JSON.parse(await readFile(path.join(root, 'benchmarks/official-runs.json'), 'utf8'));
const pinned: string = registry.populations.find((p: { id: string }) => p.id === 'public-evidence-snapshot').evidence.corpusDigest;

const committed = JSON.parse(await readFile(file, 'utf8').catch(() => 'null'));
if (args.includes('--validate')) {
  const problems = axisOverlayProblems(committed);
  if (committed && committed.snapshot?.corpusDigest !== pinned) problems.push(`the overlay is bound to ${committed.snapshot?.corpusDigest}, the registry pins the public corpus ${pinned}`);
  if (problems.length) { console.error(`${AXIS_OVERLAY_FILE}:\n  - ${problems.join('\n  - ')}`); process.exit(1); }
  console.log(`${AXIS_OVERLAY_FILE} is well formed and bound to the pinned public corpus (${Object.keys(committed.contexts).length} contexts, ${Object.keys(committed.controls).length} controls)`);
  process.exit(0);
}

const snapshotFile = option('snapshot');
if (!snapshotFile) throw new Error('Usage: qualification:axis-overlay --snapshot <file> [--check] | --validate');
const snapshot: SnapshotLike = JSON.parse(await readFile(path.resolve(snapshotFile), 'utf8'));
if (snapshot.identity.corpus_digest !== pinned) throw new Error(`The snapshot is corpus ${snapshot.identity.corpus_digest}, the registry pins ${pinned}`);
const overlay = await buildAxisOverlay(snapshot);
const problems = axisOverlayProblems(overlay);
if (problems.length) throw new Error(`The derived overlay is invalid:\n  - ${problems.join('\n  - ')}`);
const bytes = serializeAxisOverlay(overlay);
if (args.includes('--check')) {
  if ((await readFile(file, 'utf8').catch(() => '')) !== bytes) { console.error(`${AXIS_OVERLAY_FILE} is stale against the snapshot; run npm run qualification:axis-overlay -- --snapshot <file>`); process.exit(1); }
  console.log(`${AXIS_OVERLAY_FILE} matches the derivation from the snapshot`);
} else {
  await writeFile(file, bytes);
  console.log(`Wrote ${AXIS_OVERLAY_FILE}: ${Object.keys(overlay.contexts).length} contexts, ${Object.keys(overlay.controls).length} controls, ${overlay.derivation.joinedCases} joined and ${overlay.derivation.unjoinedCases} unjoined of ${overlay.snapshot.cases} cases`);
}
