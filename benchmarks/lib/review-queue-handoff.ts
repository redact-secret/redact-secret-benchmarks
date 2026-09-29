import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { digest } from './peer-observations.ts';

/**
 * Same-job handoff (#479 P2): `eval:classify` has already evaluated the
 * suite-development corpus with the same validated peer observations that
 * `queue:check` would replay, so it leaves the review queue it computed here
 * and `queue:check` reads it back instead of recomputing (2m of a 5m job).
 *
 * The file is a cache, never an authority. It is consumed only when every
 * binding below matches the current tree; any mismatch, parse problem or
 * missing file means "compute it yourself", which is exactly the pre-#479
 * behaviour. It carries only synthetic-corpus ids, no scanner output, and is
 * written under gitignored `results-output/` with mode 0600. It is never
 * uploaded or restored across jobs: it lives in one runner workspace.
 */
export const HANDOFF_SCHEMA = 1;
export const HANDOFF_PATH = 'results-output/review-queue-handoff.json';

export interface QueueEntry { id: string; method: string; targets: string[]; caseId: string }
export interface HandoffBinding {
  /** Commit id of HEAD at the time of the run. */
  revision: string;
  /** True only when the working tree matched `revision` exactly (no tracked or non-ignored untracked change). */
  clean: boolean;
  /** `digest(inputIdentity(...))`: suite, corpus, fixtures, semantic index. */
  inputDigest: string;
  /** `digest(ledger)` of the parsed `benchmarks/review-ledger.json`. */
  ledgerDigest: string;
  /** Version of the published `@redact-secret/core` that was executed. */
  productVersion: string;
}
export interface Handoff extends HandoffBinding {
  schemaVersion: typeof HANDOFF_SCHEMA; runId: string; reviewQueue: QueueEntry[]; digest: string;
}

export function worktreeState(root: string): { revision: string; clean: boolean } {
  try {
    const run = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { revision: run(['rev-parse', 'HEAD']), clean: run(['status', '--porcelain']) === '' };
  } catch { return { revision: 'unknown', clean: false }; }
}

const entriesOf = (queue: ReadonlyArray<QueueEntry>): QueueEntry[] =>
  queue.map(q => ({ id: q.id, method: q.method, targets: [...q.targets], caseId: q.caseId }));

export function makeHandoff(binding: HandoffBinding, runId: string, queue: ReadonlyArray<QueueEntry>): Handoff {
  const payload = { schemaVersion: HANDOFF_SCHEMA, runId, ...binding, reviewQueue: entriesOf(queue) } as const;
  return { ...payload, digest: digest(payload) };
}

export async function writeHandoff(root: string, handoff: Handoff, file = HANDOFF_PATH) {
  const target = path.resolve(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${handoff.runId}.tmp`;
  await writeFile(temporary, JSON.stringify(handoff) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
}

/** A run that is not eligible to feed `queue:check` must not leave an older file behind. */
export const removeHandoff = (root: string) => rm(path.join(root, HANDOFF_PATH), { force: true });

/** The reusable queue, or `{ reason }` naming why the caller must recompute. */
export async function readHandoff(root: string, expected: HandoffBinding, file = HANDOFF_PATH): Promise<{ queue: QueueEntry[]; runId: string } | { reason: string }> {
  let value: any;
  try { value = JSON.parse(await readFile(path.resolve(root, file), 'utf8')); }
  catch (error) { return { reason: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'no eval:classify handoff present' : 'handoff unreadable' }; }
  if (!value || typeof value !== 'object' || value.schemaVersion !== HANDOFF_SCHEMA || !Array.isArray(value.reviewQueue) || typeof value.runId !== 'string')
    return { reason: 'handoff has an unknown shape' };
  const { digest: sealed, ...payload } = value;
  if (sealed !== digest(payload)) return { reason: 'handoff digest mismatch' };
  if (!expected.clean || value.clean !== true) return { reason: 'working tree is not clean, so the run cannot be tied to a commit' };
  for (const key of ['revision', 'inputDigest', 'ledgerDigest', 'productVersion'] as const)
    if (value[key] !== expected[key]) return { reason: `handoff ${key} does not match the current tree` };
  const wellFormed = (q: any) => q && typeof q.id === 'string' && typeof q.method === 'string' && typeof q.caseId === 'string'
    && Array.isArray(q.targets) && q.targets.every((t: unknown) => typeof t === 'string');
  if (!value.reviewQueue.every(wellFormed)) return { reason: 'handoff review queue is malformed' };
  return { queue: entriesOf(value.reviewQueue), runId: value.runId };
}
