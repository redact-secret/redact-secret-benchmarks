import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const receipt = JSON.parse(readFileSync(new URL('../benchmarks/corpora/source-migrations.json', import.meta.url)));
// Immutable freezes name original source bytes, independently archived and restored before merge.
export function frozenSourceDigest(path) {
  const original = receipt.files.find(row => row.path === path || row.destination === path);
  return original ? original.sha256 : createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
}
