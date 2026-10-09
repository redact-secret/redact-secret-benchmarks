import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sourceCommit = '65ffe7dcb3e7124e7f66cff96cab814f0365f69a';
const manifestDigest = '8d5166a4a1d1757e3040e00077c244996065251a22cdc672985b08efe80cc37b';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const restored = process.env.HYGIENE_EVIDENCE_ARCHIVE_ROOT;
const originalSource = process.env.HYGIENE_ORIGINAL_SOURCE_ROOT;

function archive() {
  if (!restored) return null;
  const raw = readFileSync(path.join(restored, 'evidence-original-879-v1.manifest.json'));
  if (sha(raw) !== manifestDigest) throw new Error('Historical archive manifest digest mismatch');
  const manifest = JSON.parse(raw);
  if (manifest.sourceCommit !== sourceCommit || manifest.files.length !== 684)
    throw new Error('Historical archive source or member scope mismatch');
  const files = new Map(manifest.files.map(row => [row.path, row]));
  if (files.size !== 684) throw new Error('Historical archive has duplicate paths');
  return { files, root: path.resolve(restored) };
}
export const historicalArchive = archive();
export const historicalReplayOptions = { skip: !historicalArchive && 'Explicit verified historical archive required' };
export function historicalBytes(file) {
  if (!historicalArchive) throw new Error('Set HYGIENE_EVIDENCE_ARCHIVE_ROOT to an explicitly restored original archive');
  const entry = historicalArchive.files.get(file);
  if (!entry || !file.startsWith('evidence/') || file.split('/').includes('..')) throw new Error('Unregistered historical archive member');
  const bytes = readFileSync(path.join(historicalArchive.root, file));
  if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw new Error('Historical archive member digest mismatch: ' + file);
  return bytes;
}
export const historicalJson = file => JSON.parse(historicalBytes(file));
export function originalSourceBytes(file) {
  if (file.startsWith('evidence/')) return historicalBytes(file);
  if (!originalSource) throw new Error('Historical source checks require HYGIENE_ORIGINAL_SOURCE_ROOT to a Git repository containing the original source tag');
  if (path.isAbsolute(file) || file.split('/').includes('..')) throw new Error('Unsafe original source path');
  // Read the exact immutable object, never a dirty working tree at a matching HEAD.
  return execFileSync('git', ['show', `${sourceCommit}:${file}`], { cwd: originalSource, maxBuffer: 256 * 1024 * 1024 });
}
