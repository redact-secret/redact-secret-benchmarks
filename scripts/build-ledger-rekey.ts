/**
 * Generate (or --check) the review-ledger re-key of the canonical methods run (#638).
 *
 *   npm run qualification:ledger-rekey -- --snapshot <credential-eval-corpus-snapshot.json> --methods-run <methods/artifact.json>         write it
 *   npm run qualification:ledger-rekey -- --snapshot <...> --methods-run <...> --check                                                 fail when stale
 *   npm run qualification:ledger-rekey -- --validate                                                  structure only, no inputs
 *
 * The snapshot is the evidence release asset the public artifact was run on and the methods artifact is the canonical methods run
 * recorded in benchmarks/official-runs.json (its semantic digest is checked). The legacy review queue is the frozen evidence in
 * benchmarks/support/legacy-review-queue.json (#660, bound by its digest); the legacy engine is not run.
 * Nothing here decides anything: it maps a legacy decision to the canonical occurrence it was made for. The method and boundary
 * are benchmarks/qualification/ledger-rekey.ts and docs/specs/qualification-adapter.md.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ledgerRekeyProblems, LEDGER_REKEY_FILE, serializeLedgerRekey } from '../benchmarks/qualification/ledger-rekey.ts';
import { type SnapshotLike } from '../benchmarks/qualification/axis-overlay.ts';
import { deriveLedgerRekey } from '../benchmarks/qualification/derived-inputs.ts';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { FROZEN_QUEUE_FILE, frozenQueueProblems } from '../benchmarks/qualification/legacy-review.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, LEDGER_REKEY_FILE);
const readJson = async (p: string) => JSON.parse(await readFile(p, 'utf8'));
const registry = await readJson(path.join(root, 'benchmarks/official-runs.json'));
const pinned: string = registry.populations.find((p: { id: string }) => p.id === 'public-evidence-snapshot').evidence.corpusDigest;
const canonicalMethods = registry.runs.find((r: { kind?: string; canonical?: boolean; population: string }) => r.kind === 'methods' && r.canonical && r.population === 'public-evidence-snapshot');
if (!canonicalMethods) throw new Error('benchmarks/official-runs.json records no canonical methods run');
const ledger = await readJson(path.join(root, 'benchmarks/review-ledger.json'));

if (args.includes('--validate')) {
  const committed = JSON.parse(await readFile(file, 'utf8').catch(() => 'null'));
  const problems = ledgerRekeyProblems(committed, ledger);
  if (committed && committed.snapshot?.corpusDigest !== pinned) problems.push(`the mapping is bound to ${committed.snapshot?.corpusDigest}, the registry pins the public corpus ${pinned}`);
  if (committed && committed.methodsRun?.semanticDigest !== canonicalMethods.artifact.semanticDigest) problems.push(`the mapping is of methods run ${committed.methodsRun?.semanticDigest}, the registry records ${canonicalMethods.artifact.semanticDigest} as ${canonicalMethods.id}`);
  problems.push(...frozenQueueProblems(await readJson(path.join(root, FROZEN_QUEUE_FILE))).map(p => `${FROZEN_QUEUE_FILE}: ${p}`));
  if (problems.length) { console.error(`${LEDGER_REKEY_FILE}:\n  - ${problems.join('\n  - ')}`); process.exit(1); }
  console.log(`${LEDGER_REKEY_FILE} is well formed, one to one with the legacy ledger and bound to the pinned corpus and the canonical methods run (${Object.keys(committed.occurrences).length} occurrences mapped); the frozen legacy review queue matches its digest`);
  process.exit(0);
}

const snapshotFile = option('snapshot'), methodsFile = option('methods-run');
if (!snapshotFile || !methodsFile) throw new Error('Usage: qualification:ledger-rekey --snapshot <file> --methods-run <artifact.json> [--check] | --validate');
const snapshot: SnapshotLike = await readJson(path.resolve(snapshotFile));
if (snapshot.identity.corpus_digest !== pinned) throw new Error(`The snapshot is corpus ${snapshot.identity.corpus_digest}, the registry pins ${pinned}`);
const methods = readRunArtifact(await readFile(path.resolve(methodsFile)));
if (methods.semanticDigest !== canonicalMethods.artifact.semanticDigest) throw new Error(`The methods artifact has semantic digest ${methods.semanticDigest}; ${canonicalMethods.id} records ${canonicalMethods.artifact.semanticDigest}`);

const { map } = await deriveLedgerRekey(snapshot, methods.artifact, methods.semanticDigest, canonicalMethods.id);
const problems = ledgerRekeyProblems(map, ledger);
if (problems.length) throw new Error(`The derived mapping is invalid:\n  - ${problems.join('\n  - ')}`);
const bytes = serializeLedgerRekey(map);
const d = map.derivation;
if (args.includes('--check')) {
  if ((await readFile(file, 'utf8').catch(() => '')) !== bytes) { console.error(`${LEDGER_REKEY_FILE} is stale; run npm run qualification:ledger-rekey -- --snapshot <file> --methods-run <artifact.json>`); process.exit(1); }
  console.log(`${LEDGER_REKEY_FILE} matches the derivation`);
} else {
  await writeFile(file, bytes);
  console.log(`Wrote ${LEDGER_REKEY_FILE}: ${d.canonical.mapped} of ${d.canonical.occurrences} canonical occurrences mapped (${d.legacy.mapped} of ${d.legacy.differential} legacy differential entries); canonical unmatched ${JSON.stringify(d.canonical.unmatched)}; legacy unmatched ${JSON.stringify(d.legacy.unmatched)}; other legacy methods ${JSON.stringify(d.legacy.otherMethods)}`);
}
