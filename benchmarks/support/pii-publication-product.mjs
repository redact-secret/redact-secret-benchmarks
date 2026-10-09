import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPiiCandidateComparison } from '../evaluation/domains/pii/candidate-comparison.mjs';

const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);

export function bindPiiPublicationProduct(comparison, plan, receipt, product) {
  if (!product || !hex(product.sourceCommit, 40) || !hex(product.coreSha256, 64))
    return { state: 'absent', reason: 'publication-product-artifact-identity-unavailable' };
  if (!comparison || typeof comparison !== 'object') return { state: 'invalid', reason: 'comparison-publication-binding-unusable' };
  if (comparison.state !== 'recorded')
    return { state: comparison.state === 'absent' ? 'absent' : 'invalid', reason: comparison.reason };
  if (comparison.mode !== 'official') return { state: 'invalid', reason: 'publication-comparison-not-official' };
  if (comparison.candidate.sourceCommit !== product.sourceCommit || receipt.candidate.tarballs.core !== product.coreSha256)
    return { state: 'other-product', reason: 'recorded-comparison-measures-another-product' };
  return {
    state: 'matched', sourceCommit: product.sourceCommit, coreSha256: product.coreSha256,
    packageTreeSha256: comparison.candidate.packageTreeSha256,
    engineCommit: plan.engine.commit,
    protocol: { id: plan.protocol.id, revision: plan.protocol.revision },
    populationDigests: Object.fromEntries(comparison.populations.map(row => [row.population.populationId, row.population.populationDigest])),
    supportClaims: false, qualified: false,
  };
}

export async function loadPiiPublicationProductBinding(root, product) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) return { state: 'invalid', reason: 'comparison-publication-root-invalid' };
  const directory = path.join(root, 'benchmarks/pii-candidate-comparison');
  const optional = async file => {
    try { // Comparison metadata permits ownerAcceptance:null; only public engine artifacts use the no-null format parser.
      return JSON.parse(await readFile(path.join(directory, file), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  };
  try {
    const [plan, receipt, record] = await Promise.all(['plan.json', 'receipt.json', 'record.json'].map(optional));
    if (!plan || !receipt) return { state: 'absent', reason: 'current-comparison-not-recorded' };
    if (!Array.isArray(plan.populations) || plan.populations.length !== 4 ||
        plan.populations.some(row => !/^[a-z0-9-]+$/.test(row.view)))
      return { state: 'invalid', reason: 'comparison-population-invalid' };
    const artifacts = await Promise.all(['baseline', 'candidate'].flatMap(side => plan.populations.map(async ({ view }) => ({
      side, view, text: await readFile(path.join(directory, `${side}.${view}.public-synthetic-artifact.json`), 'utf8'),
    }))));
    // The recorded producer binds exact tarballs to semantic package trees; a source commit alone cannot do that.
    return bindPiiPublicationProduct(loadPiiCandidateComparison({ plan, receipt, record, artifacts }), plan, receipt, product);
  } catch {
    return { state: 'invalid', reason: 'comparison-publication-binding-unusable' };
  }
}
