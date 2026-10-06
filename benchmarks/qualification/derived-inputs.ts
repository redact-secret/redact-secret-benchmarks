import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AXIS_OVERLAY_ID, axisOverlayProblems, buildAxisOverlay, serializeAxisOverlay, type AxisOverlay, type SnapshotLike } from './axis-overlay.ts';
import { TWIN_SCOPE_ID, buildTwinScopeMap, serializeTwinScopeMap, twinScopeMapProblems, type PublicSnapshotLike, type TwinScopeMap } from './twin-scope.ts';
import { LEDGER_REKEY_ID, buildLedgerRekey, ledgerRekeyProblems, serializeLedgerRekey, type LedgerRekey } from './ledger-rekey.ts';
import { sha256Digest } from './canonical.ts';
import type { RunArtifact } from './run-artifact.ts';
import { legacyReview, type LegacyReviewSource } from './legacy-review.ts';

/**
 * Snapshot-derived qualification inputs (#699): the axis overlay, the twin-scope map and the review-ledger re-key of ONE evidence snapshot, derived
 * from that snapshot (and, for the re-key, from the methods artifact that ran on it) into a directory, with a receipt that binds them to it.
 *
 * Why a directory and a receipt. The three files are bound to a corpus by digest, and the committed copies under benchmarks/support/ belong to the
 * ACCEPTED population. A replay of a changed snapshot must never read them (they name the old corpus, and the adapter refuses them), and must never
 * overwrite them (that would move the accepted authority before the owner accepts). So a candidate's view is built from a derived directory, and the
 * committed files change only in the owner's acceptance commit. Validation stays fail closed: the adapter still refuses an overlay, a twin-scope map
 * or a re-key bound to another corpus, and a derived directory is refused unless every file is present, valid and equal to its receipt digest.
 */
export const DERIVED_INPUTS_SCHEMA = 'redact-secret/derived-qualification-inputs/v1';
export const DERIVED_RECEIPT_FILE = 'derived-inputs.json';
export const DERIVED_FILES = { axisOverlay: 'public-axis-overlay.json', twinScope: 'public-twin-scope-map.json', ledgerRekey: 'public-review-ledger-map.json' } as const;
export type DerivedKind = keyof typeof DERIVED_FILES;

export interface DerivedReceipt {
  schema: typeof DERIVED_INPUTS_SCHEMA;
  snapshot: { corpusDigest: string; cases: number; bytesDigest?: string };
  /** Run artifacts the derivation read, bound to the snapshot by the corpus digest they ran on. */
  artifacts: { plain?: { semanticDigest: string; corpusDigest: string }; methods?: { semanticDigest: string; corpusDigest: string; run?: string } };
  files: Record<DerivedKind, { file: string; digest: string; corpusDigest: string }>;
}

export interface DerivedInputs { receipt: DerivedReceipt; bytes: Record<DerivedKind, string>; axisOverlay: AxisOverlay; twinScope: TwinScopeMap; ledgerRekey: LedgerRekey }

const root = fileURLToPath(new URL('../../', import.meta.url));
const readJson = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const corpusOf = (artifact: RunArtifact) => artifact.manifest.evidence.corpus_digest;

/** The review-ledger re-key of a methods artifact over the snapshot it ran on. `run` names the methods run in the re-key (the registry id, or `replay` for an unrecorded run). */
export async function deriveLedgerRekey(snapshot: SnapshotLike, methods: RunArtifact, semanticDigest: string, run: string, source: LegacyReviewSource = legacyReview): Promise<{ map: LedgerRekey; ledger: unknown }> {
  const { ledger, legacyQueue, legacyOtherMethods, joined } = await source(snapshot);
  const map = buildLedgerRekey({
    snapshot: { corpusDigest: snapshot.identity.corpus_digest, cases: snapshot.cases.length },
    methodsRun: { run, semanticDigest, reviewQueue: methods.review_queue as never, variants: (methods as unknown as { variants: never }).variants },
    legacyQueue, legacyOtherMethods, joined, ledger,
  });
  const problems = ledgerRekeyProblems(map, ledger);
  if (problems.length) throw new Error(`The derived re-key is invalid:\n  - ${problems.join('\n  - ')}`);
  return { map, ledger };
}

export interface DeriveOptions {
  snapshot: SnapshotLike;
  snapshotBytes?: Buffer;
  /** The plain run's artifact, when given its corpus digest must be the snapshot's. */
  plain?: { artifact: RunArtifact; semanticDigest: string };
  /** The methods run's artifact (required: the re-key is of that run's occurrences). Its corpus digest must be the snapshot's. */
  methods: { artifact: RunArtifact; semanticDigest: string; run?: string };
}

/**
 * Derive all three inputs from the snapshot and the methods artifact. Fails (before any file is written by the caller) when an artifact ran on another
 * corpus than the snapshot: a stale pairing is a refusal here, not a view-stage surprise.
 */
export async function deriveSnapshotInputs({ snapshot, snapshotBytes, plain, methods }: DeriveOptions): Promise<DerivedInputs> {
  const digest = snapshot.identity.corpus_digest;
  for (const [label, a] of [['plain', plain], ['methods', methods]] as const)
    if (a && corpusOf(a.artifact) !== digest) throw new Error(`The ${label} artifact ran corpus ${corpusOf(a.artifact)}, the snapshot is corpus ${digest}; derive the inputs from the snapshot the run used`);
  const axisOverlay = await buildAxisOverlay(snapshot);
  const twinScope = await buildTwinScopeMap(snapshot as unknown as PublicSnapshotLike);
  const { map: ledgerRekey } = await deriveLedgerRekey(snapshot, methods.artifact, methods.semanticDigest, methods.run ?? 'replay');
  return assembleDerivedInputs({ snapshot, snapshotBytes, plain, methods, axisOverlay, twinScope, ledgerRekey });
}

/** Serialize derived inputs and write their receipt. Pure: no file is read or written. */
export function assembleDerivedInputs({ snapshot, snapshotBytes, plain, methods, axisOverlay, twinScope, ledgerRekey }: DeriveOptions & { axisOverlay: AxisOverlay; twinScope: TwinScopeMap; ledgerRekey: LedgerRekey }): DerivedInputs {
  const digest = snapshot.identity.corpus_digest;
  for (const problems of [axisOverlayProblems(axisOverlay), twinScopeMapProblems(twinScope)]) if (problems.length) throw new Error(`A derived input is invalid:\n  - ${problems.join('\n  - ')}`);
  const bytes: Record<DerivedKind, string> = { axisOverlay: serializeAxisOverlay(axisOverlay), twinScope: serializeTwinScopeMap(twinScope), ledgerRekey: serializeLedgerRekey(ledgerRekey) };
  const entry = (kind: DerivedKind, corpusDigest: string) => ({ file: DERIVED_FILES[kind], digest: sha256Digest(bytes[kind]), corpusDigest });
  const receipt: DerivedReceipt = {
    schema: DERIVED_INPUTS_SCHEMA,
    snapshot: { corpusDigest: digest, cases: snapshot.cases.length, ...(snapshotBytes ? { bytesDigest: sha256Digest(snapshotBytes) } : {}) },
    artifacts: {
      ...(plain ? { plain: { semanticDigest: plain.semanticDigest, corpusDigest: corpusOf(plain.artifact) } } : {}),
      methods: { semanticDigest: methods.semanticDigest, corpusDigest: corpusOf(methods.artifact), ...(methods.run ? { run: methods.run } : {}) },
    },
    files: { axisOverlay: entry('axisOverlay', axisOverlay.snapshot.corpusDigest), twinScope: entry('twinScope', twinScope.snapshot.corpusDigest), ledgerRekey: entry('ledgerRekey', ledgerRekey.snapshot.corpusDigest) },
  };
  return { receipt, bytes, axisOverlay, twinScope, ledgerRekey };
}

export interface VerifiedInputs { receipt: DerivedReceipt; axisOverlay: AxisOverlay; twinScope: TwinScopeMap; ledgerRekey: LedgerRekey; digests: Record<DerivedKind, string> }

/**
 * Read a derived directory and refuse anything that is not exactly what the derivation wrote: every file present, equal to its receipt digest, of the
 * expected identity, and bound to the receipt's snapshot corpus. The adapter then checks the same binding against the artifact it is given.
 */
export async function readDerivedInputs(dir: string, { ledger }: { ledger?: unknown } = {}): Promise<VerifiedInputs> {
  const read = async (file: string) => readFile(path.join(dir, file), 'utf8').catch(() => { throw new Error(`${dir} has no ${file}; a derived input directory holds the receipt and all three derived files (npm run qualification:derive-inputs)`); });
  const receipt: DerivedReceipt = JSON.parse(await read(DERIVED_RECEIPT_FILE));
  if (receipt.schema !== DERIVED_INPUTS_SCHEMA) throw new Error(`${path.join(dir, DERIVED_RECEIPT_FILE)} is not a ${DERIVED_INPUTS_SCHEMA} receipt`);
  const out = {} as Record<DerivedKind, unknown>, digests = {} as Record<DerivedKind, string>;
  for (const kind of Object.keys(DERIVED_FILES) as DerivedKind[]) {
    const entry = receipt.files?.[kind];
    if (!entry || entry.file !== DERIVED_FILES[kind]) throw new Error(`the receipt does not list ${DERIVED_FILES[kind]}`);
    const text = await read(entry.file);
    digests[kind] = sha256Digest(text);
    if (digests[kind] !== entry.digest) throw new Error(`${entry.file} has digest ${digests[kind]}, the receipt records ${entry.digest}; the derived input changed after it was derived`);
    out[kind] = JSON.parse(text);
    const bound = (out[kind] as { snapshot?: { corpusDigest?: string } }).snapshot?.corpusDigest;
    if (bound !== receipt.snapshot.corpusDigest) throw new Error(`${entry.file} is bound to corpus ${bound}, the receipt's snapshot is ${receipt.snapshot.corpusDigest}`);
  }
  const axisOverlay = out.axisOverlay as AxisOverlay, twinScope = out.twinScope as TwinScopeMap, ledgerRekey = out.ledgerRekey as LedgerRekey;
  const problems = [
    ...(axisOverlay.id === AXIS_OVERLAY_ID ? axisOverlayProblems(axisOverlay) : ['the axis overlay has another identity']),
    ...(twinScope.id === TWIN_SCOPE_ID ? twinScopeMapProblems(twinScope) : ['the twin-scope map has another identity']),
    ...(ledgerRekey.id === LEDGER_REKEY_ID ? (ledger ? ledgerRekeyProblems(ledgerRekey, ledger as never) : []) : ['the review-ledger re-key has another identity']),
  ];
  if (problems.length) throw new Error(`The derived inputs in ${dir} are invalid:\n  - ${problems.join('\n  - ')}`);
  return { receipt, axisOverlay, twinScope, ledgerRekey, digests };
}
