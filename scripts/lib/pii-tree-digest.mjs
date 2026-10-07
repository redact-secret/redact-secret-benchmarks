// The tree digest pii-eval pins a scanner package with (crates/pii-eval-adapters/src/pin.rs, "Tree digest"): hash every regular file, list
// "<file sha256 hex>  <relative path>\n" for all files sorted by relative path bytewise (paths use "/"), and take the SHA-256 of that listing.
//   find . -type f | sed 's|^\./||' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256
// Symlinks are refused anywhere in the tree, and a file name must be printable ASCII without a backslash (the engine refuses the same). The engine
// recomputes the digest before it runs a scanner; this function lets the caller state the digest it expects, and a mismatch is the engine's refusal.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const listable = name => name.length > 0 && !/[^\x20-\x7e]/.test(name) && !name.includes('\\');

export function treeEntries(root, prefix = '') {
  const out = [];
  for (const name of readdirSync(root).sort()) {
    if (!listable(name)) throw new Error(`a file name in the tree is not listable: ${JSON.stringify(name)}`);
    const path = join(root, name), rel = prefix ? `${prefix}/${name}` : name, stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`a symlink is not allowed in a pinned tree: ${rel}`);
    if (stat.isDirectory()) out.push(...treeEntries(path, rel));
    else if (stat.isFile()) out.push({ path: rel, sha256: sha256(readFileSync(path)), bytes: stat.size });
    else throw new Error(`not a regular file: ${rel}`);
  }
  return out;
}

export function treeSha256(root) {
  const entries = treeEntries(root).sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  if (!entries.length) throw new Error('a pinned tree holds no file');
  return sha256(entries.map(e => `${e.sha256}  ${e.path}\n`).join(''));
}
