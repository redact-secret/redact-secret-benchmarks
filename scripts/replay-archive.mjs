#!/usr/bin/env node
/**
 * Keep and fetch the artifacts of a replay run (an engine candidate or a product candidate) durably (#690, #698). The canonical accepted runs have their own
 * archive (scripts/official-run-archive.mjs, bound to the registry); a replay is never an accepted run, so this one is bound to the digest the adoption record
 * (or the pull request that proposes it) carries.
 *
 *   node scripts/replay-archive.mjs pack  --in <dir> --out <dir> [--tag <release tag> --notes <text>]   tar.gz of <dir>, its sha256, optionally as a release
 *   node scripts/replay-archive.mjs fetch --release <tag> --sha256 sha256:<64 hex> --out <dir>           download, verify the digest, extract
 *
 * `fetch` fails closed: a digest that differs, a link, a duplicate, an unexpected, absolute or parent path in the tarball exits 1 and extracts nothing. macOS AppleDouble members (basename `._*`) are skipped, never read or extracted; the digest still covers the original bytes. `pack` keeps only
 * <population>/artifact.json, <population>/run-record.json, <population>/methods/{artifact,run-record}.json and product-candidate-receipt.json files.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const KEEP = /(^|\/)(artifact\.json|run-record\.json|product-candidate-receipt\.json)$/;
export const sha256File = file => `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;

export function listKept(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`refusing a link: ${full}`);
      if (entry.isDirectory()) walk(full);
      else if (KEEP.test(path.relative(dir, full).split(path.sep).join('/'))) found.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return found.sort();
}

export function pack({ input, out, tag, notes }) {
  const files = listKept(input);
  if (!files.length) throw new Error(`no artifacts under ${input}`);
  mkdirSync(out, { recursive: true });
  const stage = mkdtempSync(path.join(os.tmpdir(), 'replay-pack-'));
  try {
    for (const f of files) { mkdirSync(path.dirname(path.join(stage, f)), { recursive: true }); copyFileSync(path.join(input, f), path.join(stage, f)); }
    const name = `${tag ?? 'replay'}.tar.gz`;
    const tarball = path.join(out, name);
    execFileSync('tar', ['-czf', tarball, '-C', stage, ...files], { env: { ...process.env, COPYFILE_DISABLE: '1' } }); // COPYFILE_DISABLE: macOS tar would add `._*` AppleDouble members
    const appleDouble = readTarEntries(readFileSync(tarball)).filter(e => isAppleDouble(e.name));
    if (appleDouble.length) throw new Error(`the new archive holds AppleDouble members: ${appleDouble.map(e => e.name).join(', ')}`);
    const digest = sha256File(tarball);
    writeFileSync(`${tarball}.sha256`, `${digest.replace('sha256:', '')}  ${name}\n`);
    if (tag) execFileSync('gh', ['release', 'create', tag, tarball, `${tarball}.sha256`, '--title', tag, '--notes', notes ?? `Replay artifacts ${tag}; sha256 ${digest}. Never accepted runs and never public evidence.`], { stdio: 'inherit' });
    return { tarball, digest, files };
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

export function fetchArchive({ release, sha256, out, repository }) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'replay-fetch-'));
  try {
    execFileSync('gh', ['release', 'download', release, ...(repository ? ['-R', repository] : []), '-p', '*.tar.gz', '-D', scratch], { stdio: 'inherit' });
    const tarball = readdirSync(scratch).find(f => f.endsWith('.tar.gz'));
    if (!tarball) throw new Error(`release ${release} has no tarball`);
    const digest = sha256File(path.join(scratch, tarball));
    if (digest !== sha256) throw new Error(`release ${release} has digest ${digest}, expected ${sha256}`);
    extractVerified(path.join(scratch, tarball), out);
    return { digest };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

/** macOS tar adds `._<name>` AppleDouble metadata members. They are skipped (never read or extracted); everything else stays on the allowlist. */
export const isAppleDouble = name => path.posix.basename(name.replace(/\/+$/, '')).startsWith('._');

const field = (block, from, length) => { const raw = block.subarray(from, from + length); const end = raw.indexOf(0); return raw.subarray(0, end < 0 ? length : end).toString('utf8'); };
const octal = (block, from, length) => parseInt(field(block, from, length).trim() || '0', 8);

/** Members of a gzip tarball, read here rather than through `tar -t` (bsdtar hides `._*` members on macOS, GNU tar lists them), so every platform sees the same names. */
export function readTarEntries(gz) {
  const buf = gunzipSync(gz);
  const entries = [];
  let pax = {}; let longName;
  for (let at = 0; at + 512 <= buf.length;) {
    const header = buf.subarray(at, at + 512);
    if (header.every(b => b === 0)) break;
    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const data = buf.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') { for (let i = 0; i < data.length;) { const sp = data.indexOf(32, i); const len = parseInt(data.subarray(i, sp).toString(), 10); const [k, ...v] = data.subarray(sp + 1, i + len - 1).toString('utf8').split('='); pax[k] = v.join('='); i += len; } continue; }
    if (type === 'g') continue;
    if (type === 'L') { longName = data.toString('utf8').replace(/\0+$/, ''); continue; }
    const prefix = field(header, 345, 155);
    const name = pax.path ?? longName ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
    entries.push({ name, type, data });
    pax = {}; longName = undefined;
  }
  return entries;
}

export function extractVerified(tarball, out) {
  const kept = new Map();
  for (const { name, type, data } of readTarEntries(readFileSync(tarball))) {
    if (type !== '0' && type !== '5') throw new Error(`the archive holds a link or special entry: ${name}`);
    if (name.startsWith('/') || name.split('/').includes('..')) throw new Error(`unexpected path in the archive: ${name}`);
    if (type === '5') { if (!isAppleDouble(name)) continue; throw new Error(`unexpected path in the archive: ${name}`); }
    if (isAppleDouble(name)) continue;
    if (!KEEP.test(name)) throw new Error(`unexpected path in the archive: ${name}`);
    if (kept.has(name)) throw new Error(`duplicate path in the archive: ${name}`);
    kept.set(name, data);
  }
  mkdirSync(out, { recursive: true });
  for (const [name, data] of kept) { const target = path.join(out, name); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, data, { mode: 0o644 }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, ...rest] = process.argv.slice(2);
  const option = name => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  try {
    if (command === 'pack') console.log(JSON.stringify(pack({ input: path.resolve(option('in')), out: path.resolve(option('out')), tag: option('tag'), notes: option('notes') }), null, 1));
    else if (command === 'fetch') console.log(JSON.stringify(fetchArchive({ release: option('release'), sha256: option('sha256'), out: path.resolve(option('out')), repository: option('repository') ?? 'redact-secret/redact-secret-benchmarks' })));
    else { console.error('usage: replay-archive.mjs pack|fetch ...'); process.exit(2); }
  } catch (error) { console.error(`replay archive refused: ${error.message}`); process.exit(1); }
}
