#!/usr/bin/env node
/**
 * Keep and fetch the artifacts of a replay run (an engine candidate or a product candidate) durably (#690, #698). The canonical accepted runs have their own
 * archive (scripts/official-run-archive.mjs, bound to the registry); a replay is never an accepted run, so this one is bound to the digest the adoption record
 * (or the pull request that proposes it) carries.
 *
 *   node scripts/replay-archive.mjs pack  --in <dir> --out <dir> [--tag <release tag> --notes <text>]   tar.gz of <dir>, its sha256, optionally as a release
 *   node scripts/replay-archive.mjs fetch --release <tag> --sha256 sha256:<64 hex> --out <dir>           download, verify the digest, extract
 *
 * `fetch` fails closed: a digest that differs, a link or an absolute or parent path in the tarball exits 1 and extracts nothing. `pack` keeps only
 * <population>/artifact.json, <population>/run-record.json, <population>/methods/{artifact,run-record}.json and product-candidate-receipt.json files.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
    execFileSync('tar', ['-czf', tarball, '-C', stage, ...files]);
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

export function extractVerified(tarball, out) {
  const names = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const n of names) if (n.startsWith('/') || n.split('/').includes('..') || !(KEEP.test(n) || n.endsWith('/'))) throw new Error(`unexpected path in the archive: ${n}`);
  const listing = execFileSync('tar', ['-tvzf', tarball], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (listing.some(l => /^[lh]/.test(l))) throw new Error('the archive holds a link');
  mkdirSync(out, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', out]);
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
