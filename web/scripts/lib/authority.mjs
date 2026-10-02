/**
 * Which pipeline the credential report pages were built from, for the post-build checks (#608). Read here, independently of
 * `web/services/authority.ts`, from the one committed value: an absent file means `legacy`, and a value that is neither `legacy` nor
 * `new` stops the check rather than selecting a recount.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function readAuthority(repoRoot) {
  let file;
  try { file = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/qualification-authority.json'), 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return 'legacy';
    throw error;
  }
  if (file.authority !== 'legacy' && file.authority !== 'new') throw new Error('benchmarks/qualification-authority.json: authority must be "legacy" or "new"');
  return file.authority;
}

/** The stamp a page carries: which pipeline it was built from and whether that pipeline is the authority (components/qualification/PipelineStamp.tsx). */
export const stampOf = html => {
  const m = /<aside\b[^>]*\bdata-pipeline="(legacy|new)"[^>]*\bdata-role="(authority|oracle)"/.exec(html) ?? /<aside\b[^>]*\bdata-role="(authority|oracle)"[^>]*\bdata-pipeline="(legacy|new)"/.exec(html);
  if (!m) return null;
  return /\bdata-pipeline="new"/.test(m[0]) ? { pipeline: 'new', role: /data-role="authority"/.test(m[0]) ? 'authority' : 'oracle' } : { pipeline: 'legacy', role: /data-role="authority"/.test(m[0]) ? 'authority' : 'oracle' };
};
