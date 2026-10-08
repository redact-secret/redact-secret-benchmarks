#!/usr/bin/env node
/** Restore one retained public repository file without changing the working tree. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 128 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, maxBuffer: MAX_BYTES, encoding: null });
  if (result.status !== 0) throw new Error('Retained Git object unavailable; fetch the recorded tag with --fetch');
  return result.stdout;
}

export function retainedEntry(manifest, inventory, file) {
  if (manifest?.schema !== 'redact-secret/retention-archive/v1' ||
      !/^[a-f0-9]{40}$/.test(manifest.sourceCommit ?? '') ||
      !/^hygiene-[a-z0-9][a-z0-9-]{0,120}$/.test(manifest.retainedTag ?? '') ||
      inventory?.schemaVersion !== 1 || inventory.sourceCommit !== manifest.sourceCommit || !Array.isArray(inventory.entries))
    throw new Error('Invalid retained manifest or inventory source identity');
  if (typeof file !== 'string' || !/^(?:docs|evidence|baselines|peer-observations|benchmarks|public)\/[A-Za-z0-9_./-]+$/.test(file) ||
      file.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe retained file path');
  const entries = inventory.entries.filter(entry => entry.path === file);
  if (entries.length !== 1 || !/^[a-f0-9]{64}$/.test(entries[0].sha256 ?? '') ||
      !Number.isSafeInteger(entries[0].size) || entries[0].size < 0 || entries[0].size > MAX_BYTES)
    throw new Error('File lacks a unique bounded checksum in the inventory');
  return entries[0];
}

async function safeOutputDirectory(root, parts) {
  let dir = await realpath(root);
  for (const part of parts) {
    dir = path.join(dir, part);
    await mkdir(dir, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const stat = await lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe restore output directory');
  }
  return dir;
}

export async function restoreRetainedFile({ root = ROOT, manifest, inventory, file, fetch = false }) {
  const entry = retainedEntry(manifest, inventory, file);
  if (fetch) git(root, ['fetch', '--no-tags', 'origin', `refs/tags/${manifest.retainedTag}:refs/tags/${manifest.retainedTag}`]);
  const commit = git(root, ['rev-parse', '--verify', `refs/tags/${manifest.retainedTag}^{commit}`]).toString().trim();
  if (commit !== manifest.sourceCommit) throw new Error('Retained tag differs from the recorded source commit');
  if (manifest.tagObject && git(root, ['rev-parse', '--verify', `refs/tags/${manifest.retainedTag}`]).toString().trim() !== manifest.tagObject)
    throw new Error('Retained tag object differs from the recorded immutable tag');
  const record = git(root, ['ls-tree', '-z', commit, '--', file]).toString();
  if (!/^100(?:644|755) blob [a-f0-9]+\t/.test(record) || record.split('\t')[1] !== `${file}\0`)
    throw new Error('Retained object is not a regular file');
  const bytes = git(root, ['show', `${commit}:${file}`]);
  if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error('Retained file checksum differs from inventory');
  const parts = file.split('/');
  const dir = await safeOutputDirectory(root, ['results-output', 'retained', ...parts.slice(0, -1)]);
  const destination = path.join(dir, parts.at(-1));
  // Exclusive, no-follow creation protects existing output and linked destinations.
  const handle = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
  return { path: path.relative(root, destination), size: bytes.length, sha256: entry.sha256, sourceCommit: commit };
}

async function main() {
  const args = process.argv.slice(2);
  const fetch = args.includes('--fetch');
  const value = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const allowed = new Set(['--file', '--inventory', '--fetch']);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error('Usage: restore-retained-file.mjs --file <path> [--inventory <json>] [--fetch]');
    if (args[i] !== '--fetch') { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing argument value'); i++; }
  }
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'benchmarks/retention-archive.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(path.resolve(ROOT, value('--inventory') ?? 'results-output/hygiene/inventory.json'), 'utf8'));
  const receipt = await restoreRetainedFile({ manifest, inventory, file: value('--file'), fetch });
  console.log(JSON.stringify(receipt));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Retained restore refused: ${error.code ?? error.message}`); process.exitCode = 1; });
}
