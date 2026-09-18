import { readdir, readFile, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';
import path from 'node:path';
import { hash } from './model.ts';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

async function treeEntries(root: string, directory: string): Promise<[string, string][]> {
  const entries: [string, string][] = [];
  for (const name of (await readdir(directory)).sort()) {
    const file = path.join(directory, name);
    const relative = path.relative(root, file);
    if (relative === 'holdout/generated' || (relative.startsWith('fixtures/generated/') && relative.endsWith('.json'))) continue;
    const stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error('Cannot fingerprint a symlinked artifact');
    if (stat.isDirectory()) entries.push(...await treeEntries(root, file));
    else if (stat.isFile()) entries.push([path.relative(root, file), hash(await readFile(file))]);
  }
  return entries;
}

export async function runtimeProvenance() {
  let revision = 'unknown', dirty = true;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {}
  const sources: [string, string][] = [];
  for (const directory of ['benchmarks', 'scanners', 'corpora', 'holdout', 'schemas', 'qualification'])
    sources.push(...await treeEntries(repositoryRoot, path.join(repositoryRoot, directory)));
  for (const [name, digest] of await treeEntries(repositoryRoot, path.join(repositoryRoot, 'fixtures')))
    if (!name.startsWith('fixtures/generated/') || !name.endsWith('.json')) sources.push([name, digest]);
  return {
    revision, dirty, sourceHash: hash(sources.sort(([a], [b]) => a.localeCompare(b))),
    lockHash: hash(await readFile(path.join(repositoryRoot, 'package-lock.json'))),
    candidateArtifactHash: hash(await treeEntries(repositoryRoot, path.join(repositoryRoot, 'node_modules/@redact-secret'))),
    runtime: { node: process.version, platform: platform(), arch: arch() },
  };
}
