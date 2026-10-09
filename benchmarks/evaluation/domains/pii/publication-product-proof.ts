import type { PiiEvalMeasurement } from './support-v2.ts';

const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

function validatePublicationProductProof(row: PiiEvalMeasurement['populations'][number], engineCommit: string, product?: PiiEvalMeasurement['publicationProduct']) {
  const proof = row.productBinding.proof;
  const scannerProduct = row.scanners[0]?.identity.product as { kind?: string; candidateDigest?: string } | undefined;
  if (row.productBinding.state !== 'measures-publication-product') {
    if (proof !== undefined) throw new Error('Unexpected PII publication product proof');
    return;
  }
  if (!proof || !exact(proof, ['coreSha256', 'packageTreeSha256', 'engineCommit', 'protocol', 'populationDigest']) ||
      !product || proof.coreSha256 !== product.coreSha256 || row.productBinding.candidateSourceCommit !== product.sourceCommit ||
      !digest(proof.coreSha256) || !digest(proof.packageTreeSha256) || proof.engineCommit !== engineCommit ||
      !exact(proof.protocol, ['id', 'revision']) || proof.protocol.id !== 'pii-v1' || proof.protocol.revision !== 2 ||
      proof.populationDigest !== row.population.populationDigest || row.productBinding.candidateSourceCommit === null ||
      row.scanners.length !== 1 || row.scanners[0].identity.artifactDigest !== proof.packageTreeSha256 ||
      scannerProduct?.kind !== 'candidate' || scannerProduct?.candidateDigest !== proof.packageTreeSha256)
    throw new Error('Invalid or missing PII publication product proof');
}

/** Readback consistency only. Receipt provenance is established by the strict publication loader. */
export function piiPublicationProductProofProblem(measurement: unknown): string | null {
  if (measurement === undefined) return null;
  try {
    const value = measurement as PiiEvalMeasurement;
    if (!value || !Array.isArray(value.populations) || !value.build) return 'Invalid PII publication product proof input';
    if (value.publicationProduct && (!exact(value.publicationProduct, ['sourceCommit', 'coreSha256']) ||
        !/^[a-f0-9]{40}$/.test(value.publicationProduct.sourceCommit) || !digest(value.publicationProduct.coreSha256)))
      return 'Invalid PII publication product identity';
    for (const row of value.populations) validatePublicationProductProof(row, value.build.commit, value.publicationProduct);
    return null;
  } catch (error) { return error instanceof Error ? error.message : 'Invalid PII publication product proof'; }
}
