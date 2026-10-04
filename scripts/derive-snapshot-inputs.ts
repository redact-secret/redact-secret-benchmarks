/**
 * Derive the product-owned qualification inputs of ONE evidence snapshot into a directory (#699): the axis overlay, the twin-scope map and, from the
 * methods artifact that ran on that snapshot, the review-ledger re-key, with a receipt (`derived-inputs.json`) carrying the snapshot digest and the
 * digest of every generated file.
 *
 *   npm run qualification:derive-inputs -- --snapshot <credential-eval-corpus-snapshot.json> --methods-run <methods/artifact.json> --out <dir>
 *     [--plain-run <artifact.json>] [--methods-run-id <registry run id, default public-evidence-snapshot+methods@linux-x64>] [--expect-corpus-digest sha256:<hex>]
 *
 * Nothing under benchmarks/ is written: the committed copies belong to the accepted population and change only in the owner's acceptance commit.
 * Build the candidate view from the directory with `npm run qualification:view -- --artifacts <dir> --inputs <this dir>`. A snapshot and an artifact of
 * different corpora are refused here. The method and the boundary: benchmarks/qualification/derived-inputs.ts, docs/specs/evidence-adoption.md.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DERIVED_FILES, DERIVED_RECEIPT_FILE, deriveSnapshotInputs, type DerivedKind } from '../benchmarks/qualification/derived-inputs.ts';
import type { SnapshotLike } from '../benchmarks/qualification/axis-overlay.ts';
import { AXIS_OVERLAY_FILE } from '../benchmarks/qualification/axis-overlay.ts';
import { TWIN_SCOPE_FILE } from '../benchmarks/qualification/twin-scope.ts';
import { LEDGER_REKEY_FILE } from '../benchmarks/qualification/ledger-rekey.ts';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';

/** The registry id the canonical linux-x64 methods run of the floors population is recorded under (docs/specs/official-runs.md); the re-key names its run by it. */
const CANONICAL_METHODS_RUN = 'public-evidence-snapshot+methods@linux-x64';
const usage = 'Usage: qualification:derive-inputs --snapshot <file> --methods-run <artifact.json> --out <dir> [--plain-run <artifact.json>] [--methods-run-id <id>] [--expect-corpus-digest <digest>]';
const args = process.argv.slice(2);
if (args.length % 2 !== 0 || args.some((a, i) => i % 2 === 0 && !/^--(snapshot|methods-run|plain-run|methods-run-id|expect-corpus-digest|out)$/.test(a))) throw new Error(usage);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const snapshotFile = option('snapshot'), methodsFile = option('methods-run'), outDir = option('out');
if (!snapshotFile || !methodsFile || !outDir) throw new Error(usage);
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(outDir);
if (path.resolve(root, 'benchmarks') === out || out.startsWith(`${path.resolve(root, 'benchmarks')}${path.sep}`)) throw new Error('--out must not be inside benchmarks/: the committed inputs belong to the accepted population and change only in the owner\'s acceptance commit');

const snapshotBytes = await readFile(path.resolve(snapshotFile));
const snapshot: SnapshotLike = JSON.parse(snapshotBytes.toString('utf8'));
const expected = option('expect-corpus-digest');
if (expected && snapshot.identity.corpus_digest !== expected) throw new Error(`The snapshot is corpus ${snapshot.identity.corpus_digest}, expected ${expected}`);
const methods = readRunArtifact(await readFile(path.resolve(methodsFile)), { forceBytes: true });
const plainFile = option('plain-run');
const plain = plainFile ? readRunArtifact(await readFile(path.resolve(plainFile))) : undefined;

const derived = await deriveSnapshotInputs({
  snapshot, snapshotBytes,
  plain: plain && { artifact: plain.artifact, semanticDigest: plain.semanticDigest },
  methods: { artifact: methods.artifact, semanticDigest: methods.semanticDigest, run: option('methods-run-id') ?? CANONICAL_METHODS_RUN },
});
await mkdir(out, { recursive: true });
for (const kind of Object.keys(DERIVED_FILES) as DerivedKind[]) await writeFile(path.join(out, DERIVED_FILES[kind]), derived.bytes[kind]);
await writeFile(path.join(out, DERIVED_RECEIPT_FILE), `${JSON.stringify(derived.receipt, null, 2)}\n`);

const committed: Record<DerivedKind, string> = { axisOverlay: AXIS_OVERLAY_FILE, twinScope: TWIN_SCOPE_FILE, ledgerRekey: LEDGER_REKEY_FILE };
console.log(`Derived inputs for corpus ${derived.receipt.snapshot.corpusDigest} (${derived.receipt.snapshot.cases} cases) into ${path.relative(process.cwd(), out) || '.'}`);
for (const kind of Object.keys(DERIVED_FILES) as DerivedKind[]) {
  const same = (await readFile(path.join(root, committed[kind]), 'utf8').catch(() => undefined)) === derived.bytes[kind];
  console.log(`  ${DERIVED_FILES[kind]} ${derived.receipt.files[kind].digest} (${same ? 'identical to' : 'differs from'} the committed ${committed[kind]}; the committed file is not read for a candidate view)`);
}
