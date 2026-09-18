import { constants } from 'node:fs';
import { lstat, open, readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash } from '../benchmarks/engine/model.ts';
import { validateCorpus } from '../benchmarks/lib/scoring.ts';
import { validateAssessment } from '../benchmarks/lib/assessment.ts';
import { validateStructures } from '../benchmarks/lib/validate-structures.ts';
import type { HoldoutCorpus, HoldoutManifest } from './types.ts';

export class HoldoutError extends Error {
  constructor(public code: string) { super(`Holdout operation rejected: ${code}`); }
}
export const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const digest = (x: unknown) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export function validateManifest(value: unknown): HoldoutManifest {
  const m = value as HoldoutManifest;
  const fields = ['schemaVersion', 'id', 'revision', 'purpose', 'review', 'corpusHash', 'seedHash', 'dataDirectory', 'maxRuns', 'publicSeed'];
  if (!m || Object.keys(m).some(k => !fields.includes(k)) || m.schemaVersion !== 1 || typeof m.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(m.id) ||
      !Number.isInteger(m.revision) || m.revision < 1 || !digest(m.corpusHash) || !digest(m.seedHash) ||
      !/^generated\/[a-z0-9-]+$/.test(m.dataDirectory) || !Number.isInteger(m.maxRuns) || m.maxRuns < 1 || m.maxRuns > 10 ||
      (m.purpose === 'public-conformance' ? m.review !== 'conformance-only' || typeof m.publicSeed !== 'string' || hash(m.publicSeed) !== m.seedHash
        : m.purpose !== 'protected' || m.review !== 'reviewed' || m.publicSeed !== undefined))
    throw new HoldoutError('invalid-manifest');
  return m;
}
export async function readManifest(file: string) {
  try {
    if (!(await lstat(file)).isFile()) throw new Error();
    return validateManifest(JSON.parse(await readFile(file, 'utf8')));
  } catch { throw new HoldoutError('invalid-manifest'); }
}
export async function privateDirectory(directory: string) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new HoldoutError('unsafe-storage-permissions');
}
export async function privateRead(file: string) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077)) throw new HoldoutError('unsafe-file-permissions');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}
export async function atomicPrivateWrite(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, serialize(value), { mode: 0o600, flag: 'wx' });
  await rename(temporary, file);
}
export function validateHoldoutCorpus(value: unknown): HoldoutCorpus {
  try {
    const c = value as HoldoutCorpus;
    if (c.schemaVersion !== 2 || typeof c.seed !== 'string' || !c.seed) throw new Error();
    validateCorpus(c);
    for (const f of c.fixtures) {
      validateAssessment(f);
      if (f.twinOf || f.assessment.tier === 'T0') throw new Error();
    }
    validateStructures(c.fixtures);
    return c;
  } catch { throw new HoldoutError('invalid-corpus'); }
}

/** Raw inputs always live under generated/, whether inside or outside the repo. */
export async function storeDirectory(manifestFile: string, m: HoldoutManifest, create = false) {
  const parent = path.dirname(path.resolve(manifestFile));
  const generated = path.join(parent, 'generated');
  if (create) await mkdir(generated, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  await privateDirectory(generated);
  const directory = path.join(parent, m.dataDirectory);
  if (create) await mkdir(directory, { mode: 0o700 });
  await privateDirectory(directory);
  if (path.dirname(await realpath(directory)) !== await realpath(generated)) throw new HoldoutError('unsafe-storage-path');
  return directory;
}

export async function sealProtectedCorpus(manifestFile: string, sourceFile: string, review: string) {
  if (review !== 'reviewed') throw new HoldoutError('review-declaration-required');
  const text = await privateRead(sourceFile), corpus = validateHoldoutCorpus(JSON.parse(text));
  const id = randomUUID();
  const manifest: HoldoutManifest = { schemaVersion: 1, id, revision: 1, purpose: 'protected', review: 'reviewed',
    corpusHash: hash(serialize(corpus)), seedHash: hash(corpus.seed), dataDirectory: `generated/${hash(serialize(corpus))}`, maxRuns: 1 };
  let directory;
  try { directory = await storeDirectory(manifestFile, manifest, true); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new HoldoutError('corpus-already-sealed');
    throw error;
  }
  await writeFile(path.join(directory, 'corpus.json'), serialize(corpus), { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(directory, 'state.json'), serialize({ corpusHash: manifest.corpusHash, status: 'sealed', runs: [] }), { mode: 0o600, flag: 'wx' });
  // Never overwrite an existing epoch or silently reset its use budget.
  await writeFile(manifestFile, serialize(manifest), { mode: 0o644, flag: 'wx' });
  return manifest;
}
