import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { joinLegacyToSnapshot, type SnapshotLike } from './axis-overlay.ts';
import { canonical, sha256Digest } from './canonical.ts';
import type { LegacyOccurrence } from './ledger-rekey.ts';
import type { ReviewLedger } from '../evaluation/model/review-ledger.ts';

/**
 * The legacy review queue the review-ledger re-key reads, as frozen evidence (#660). `qualification:derive-inputs` maps the legacy review decisions to the
 * canonical occurrences of a methods run; the legacy side of that map is the queue the legacy engine computed over the development partition. The owner
 * decided to freeze it (docs/decisions/2026-10-05-record-the-oracle-exit-and-retire-the-legacy-credential-evaluator.md): `benchmarks/support/legacy-review-queue.json`
 * carries the differential entries and a count of the other methods, bound by a digest, and this module reads it. Nothing here runs the legacy engine, so a repin
 * derives its inputs from the new path and the engine need not live on for it. The file is never regenerated; `frozenQueueProblems` fails closed on a file that
 * differs from its digest (the ledger digest it records is provenance: the ledger gains product decisions, and the re-key checks the ledger itself).
 */
export const FROZEN_QUEUE_FILE = 'benchmarks/support/legacy-review-queue.json';
export const FROZEN_QUEUE_ID = 'credential-legacy-review-queue-frozen-v1';

export interface FrozenQueue {
  schemaVersion: 1; id: typeof FROZEN_QUEUE_ID; owner: string; note: string;
  frozen: { on: string; decidedBy: string; engineCommit: string; generator: string };
  inputs: { reviewLedgerSha256: string; suiteSha256: string; redactSecretCore: string };
  counts: { total: number; differential: number; otherMethods: Record<string, number> };
  digest: string;
  otherMethods: Record<string, number>;
  differential: LegacyOccurrence[];
}
export interface LegacyReview { ledger: ReviewLedger; legacyQueue: LegacyOccurrence[]; legacyOtherMethods: Record<string, number>; joined: Map<string, string> }
export type LegacyReviewSource = (snapshot: SnapshotLike) => Promise<LegacyReview>;

const root = fileURLToPath(new URL('../../', import.meta.url));

/** What is wrong with a frozen queue: its identity, its digest and its counts. Pure. */
export function frozenQueueProblems(queue: FrozenQueue): string[] {
  const problems: string[] = [];
  if (queue?.id !== FROZEN_QUEUE_ID || queue.schemaVersion !== 1) return [`${FROZEN_QUEUE_FILE} is not a ${FROZEN_QUEUE_ID} document`];
  const digest = sha256Digest(canonical({ differential: queue.differential, otherMethods: queue.otherMethods }));
  if (digest !== queue.digest) problems.push(`the occurrences have digest ${digest}, the file records ${queue.digest}; the frozen queue was edited`);
  const other = Object.values(queue.otherMethods ?? {}).reduce((a, b) => a + b, 0);
  if (queue.counts?.differential !== queue.differential?.length) problems.push('counts.differential is not the number of differential entries');
  if (queue.counts?.total !== (queue.differential?.length ?? 0) + other) problems.push('counts.total is not the differential entries plus the other methods');
  if (queue.differential?.some(q => q.method !== 'differential')) problems.push('the frozen queue carries an entry that is not differential');
  return problems;
}

const readJson = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

export const legacyReview: LegacyReviewSource = async (snapshot) => {
  const queue: FrozenQueue = await readJson(FROZEN_QUEUE_FILE);
  const ledgerBytes = await readFile(path.join(root, 'benchmarks/review-ledger.json'));
  // The ledger may gain decisions after the freeze (decisions are product-owned), so its bytes are not compared here; the queue's own digest is.
  const problems = frozenQueueProblems(queue);
  if (problems.length) throw new Error(`The frozen legacy review queue is invalid:\n  - ${problems.join('\n  - ')}`);
  return { ledger: JSON.parse(ledgerBytes.toString('utf8')), legacyQueue: queue.differential, legacyOtherMethods: queue.otherMethods, joined: await joinLegacyToSnapshot(snapshot) };
};
