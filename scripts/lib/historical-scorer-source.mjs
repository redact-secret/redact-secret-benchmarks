import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Archive revisions bind input bytes; the freeze independently binds executable scorer sources.
export async function verifyHistoricalScorerSources(frozen, root) {
  if (!Array.isArray(frozen?.evaluationSchema) || frozen.evaluationSchema.length === 0)
    throw new Error('Historical freeze lacks the original scorer source scope');
  for (const row of frozen.evaluationSchema) {
    if (!row || typeof row.path !== 'string' || path.isAbsolute(row.path) || row.path.split(/[\\/]/).includes('..') || !/^[a-f0-9]{64}$/.test(row.sha256))
      throw new Error('Historical scorer source scope is invalid');
    const actual = createHash('sha256').update(await readFile(path.join(root, row.path))).digest('hex');
    if (actual !== row.sha256)
      throw new Error(`Historical scorer source drift: ${row.path}; restore the original recorded implementation checkout, archive source only identifies input bytes`);
  }
}
