import { constants, existsSync } from 'node:fs';
import { lstat, open, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { repositoryRoot } from '../engine/provenance.ts';
import type { PrivateCorpus, PrivateFixture, PrivateFreeze, PrivateLedger } from './types.ts';

/** Every rejection carries a code only: no path, fixture id or content reaches an error message. */
export class BlindError extends Error {
  constructor(public code: string) { super(`Blind evaluation rejected: ${code}`); }
}

export const CORPUS_FILE = 'fixtures.json';
export const FREEZE_FILE = 'freeze.json';
export const LEDGER_FILE = 'ledger.json';
export const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

/** Walks up from `directory` looking for a `.git` entry (directory or worktree file). */
export function insideGitRepository(directory: string) {
  for (let current = directory; ; current = path.dirname(current)) {
    if (existsSync(path.join(current, '.git'))) return true;
    if (path.dirname(current) === current) return false;
  }
}

/** Default private root: the sibling `redact-secret-blind-fixture` of the benchmark checkout. */
export const DEFAULT_FIXTURES_DIRECTORY_NAME = 'redact-secret-blind-fixture';

/**
 * The custodian's private root: absolute, a real directory (no symlink), mode
 * 0700, and outside every Git work tree, so no `git add` can ever reach it.
 * These are local filesystem controls, not a sandbox against the same OS user.
 */
export async function privateRoot(directory: string) {
  if (!path.isAbsolute(directory)) throw new BlindError('fixtures-directory-must-be-absolute');
  let stat;
  try { stat = await lstat(directory); } catch { throw new BlindError('fixtures-directory-missing'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new BlindError('fixtures-directory-not-a-directory');
  if (stat.mode & 0o077) throw new BlindError('fixtures-directory-permissions-must-be-0700');
  const resolved = await realpath(directory), repository = await realpath(repositoryRoot);
  if (resolved === repository || resolved.startsWith(repository + path.sep)) throw new BlindError('fixtures-directory-inside-benchmark-repository');
  if (insideGitRepository(resolved)) throw new BlindError('fixtures-directory-inside-git-repository');
  return resolved;
}

export async function privateRead(file: string) {
  let handle;
  try { handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { throw new BlindError((error as NodeJS.ErrnoException).code === 'ENOENT' ? `missing-${path.basename(file, '.json')}` : 'unsafe-private-file'); }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077)) throw new BlindError('private-file-permissions-must-be-0600');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}

export async function privateWrite(file: string, value: unknown, { replace = false } = {}) {
  if (!replace) return writeFile(file, serialize(value), { mode: 0o600, flag: 'wx' });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, serialize(value), { mode: 0o600, flag: 'wx' });
  await rename(temporary, file);
}

const SHA256 = /^[a-f0-9]{64}$/;
const LABEL = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9._\-/]{1,200}$/;
const isRange = (r: unknown): r is { start: number; end: number } => !!r && typeof r === 'object' &&
  Number.isInteger((r as any).start) && Number.isInteger((r as any).end) && (r as any).start >= 0 && (r as any).start < (r as any).end;
const exactKeys = (value: object, allowed: string[], required: string[]) =>
  Object.keys(value).every(k => allowed.includes(k)) && required.every(k => k in value);

function validateFixture(value: unknown): PrivateFixture {
  const f = value as PrivateFixture;
  if (!f || typeof f !== 'object' || !exactKeys(f, ['id', 'path', 'content', 'kind', 'expected', 'credentialStatus', 'stratum'],
    ['id', 'path', 'content', 'kind', 'expected', 'credentialStatus'])) throw new BlindError('invalid-fixture-shape');
  if (typeof f.id !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(f.id) || typeof f.path !== 'string' || !SAFE_PATH.test(f.path) ||
      typeof f.content !== 'string' || !f.content) throw new BlindError('invalid-fixture-identity');
  if (!['synthetic', 'revoked'].includes(f.credentialStatus)) throw new BlindError('credential-not-synthetic-or-revoked');
  if (f.stratum !== undefined && (typeof f.stratum !== 'string' || !LABEL.test(f.stratum))) throw new BlindError('invalid-stratum-label');
  if (!Array.isArray(f.expected)) throw new BlindError('invalid-expected-ranges');
  if (f.kind === 'must-not-flag' ? f.expected.length !== 0 : f.kind !== 'must-redact' || f.expected.length === 0) throw new BlindError('invalid-fixture-kind');
  const bytes = Buffer.byteLength(f.content);
  for (const e of f.expected) {
    if (!isRange(e) || e.end > bytes || !exactKeys(e, ['start', 'end', 'envelope'], ['start', 'end'])) throw new BlindError('invalid-expected-ranges');
    if (e.envelope !== undefined && (!isRange(e.envelope) || e.envelope.end > bytes || e.envelope.start > e.start || e.envelope.end < e.end ||
        !exactKeys(e.envelope, ['start', 'end'], ['start', 'end']))) throw new BlindError('invalid-expected-envelope');
  }
  return f;
}

/** The custodian's authored corpus. Structural only: it cannot prove values are synthetic. */
export function validateCorpus(value: unknown): PrivateCorpus {
  const c = value as PrivateCorpus;
  if (!c || typeof c !== 'object' || !exactKeys(c, ['schemaVersion', 'corpusType', 'epoch', 'nonce', 'custodian', 'safetyReview', 'fixtures'],
    ['schemaVersion', 'corpusType', 'epoch', 'nonce', 'custodian', 'safetyReview', 'fixtures']) ||
      c.schemaVersion !== 1 || c.corpusType !== 'blind-custodian-fixtures') throw new BlindError('invalid-corpus-shape');
  if (typeof c.epoch !== 'string' || !LABEL.test(c.epoch)) throw new BlindError('invalid-epoch');
  // The nonce makes the published commitment unguessable even for a small corpus.
  if (typeof c.nonce !== 'string' || !SHA256.test(c.nonce)) throw new BlindError('invalid-nonce');
  if (!c.custodian || c.custodian.role !== 'isolated-custodian-agent' || typeof c.custodian.session !== 'string' || !c.custodian.session)
    throw new BlindError('invalid-custodian');
  const s = c.safetyReview;
  if (!s || s.status !== 'passed' || typeof s.reviewedAt !== 'string' || Number.isNaN(Date.parse(s.reviewedAt)) ||
      typeof s.statement !== 'string' || !s.statement || !Array.isArray(s.credentialStatuses)) throw new BlindError('safety-review-not-passed');
  if (!Array.isArray(c.fixtures) || !c.fixtures.length) throw new BlindError('empty-corpus');
  const fixtures = c.fixtures.map(validateFixture);
  if (new Set(fixtures.map(f => f.id)).size !== fixtures.length || new Set(fixtures.map(f => f.path)).size !== fixtures.length)
    throw new BlindError('duplicate-fixture-identity');
  const declared = new Set(s.credentialStatuses);
  if (fixtures.some(f => !declared.has(f.credentialStatus))) throw new BlindError('safety-review-does-not-cover-credential-status');
  return c;
}

export function validateFreeze(value: unknown): PrivateFreeze {
  const f = value as PrivateFreeze;
  if (!f || f.schemaVersion !== 1 || f.freezeType !== 'blind-freeze' || typeof f.freezeId !== 'string' || !SHA256.test(f.corpusCommitment ?? '') ||
      !SHA256.test(f.candidate?.artifactSha256 ?? '') || !SHA256.test(f.configurationHash ?? '') || !Number.isInteger(f.replays) || f.replays < 2)
    throw new BlindError('invalid-freeze');
  return f;
}

export function validateLedger(value: unknown): PrivateLedger {
  const l = value as PrivateLedger;
  if (!l || l.schemaVersion !== 1 || l.ledgerType !== 'blind-ledger' || !Array.isArray(l.epochs) || !Array.isArray(l.runs))
    throw new BlindError('invalid-ledger');
  return l;
}

export async function readLedger(root: string): Promise<PrivateLedger> {
  const file = path.join(root, LEDGER_FILE);
  if (!existsSync(file)) return { schemaVersion: 1, ledgerType: 'blind-ledger', epochs: [], runs: [] };
  try { return validateLedger(JSON.parse(await privateRead(file))); }
  catch (error) { throw error instanceof BlindError ? error : new BlindError('invalid-ledger'); }
}

export async function readCorpus(root: string) {
  const text = await privateRead(path.join(root, CORPUS_FILE));
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new BlindError('corpus-not-json'); }
  return { text, corpus: validateCorpus(parsed) };
}
