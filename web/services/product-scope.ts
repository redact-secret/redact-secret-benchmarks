/**
 * What the product itself documents it does not cover (#622): `scanners/product-scope.json`, validated with the ledger pipeline's validator
 * (`productScopeProblems`, `npm run peer-rules:check`). The product is not a peer, so the peer registry does not list it; this is its counterpart, read at a named
 * product revision. The registered-detector count of `benchmarks/detectors.json` is returned with the revision that file was read at.
 */
import { productScopeProblems, type ProductScope } from '../../benchmarks/lib/peer-rule-families';
import { once, readJson } from './repo';

export interface ProductScopeProfile {
  outOfScope: string[];
  /** The product commit the statements were read at (`readAt.revision`). */
  readAt: string;
  /** The registered-detector catalog (`benchmarks/detectors.json`) and the product revision it was read at. */
  detectors: { count: number; revision: string } | null;
}

export function loadProductScope(): Promise<ProductScopeProfile> {
  return once('product-scope', async () => {
    const scope = await readJson<ProductScope>('scanners/product-scope.json');
    const problems = productScopeProblems(scope);
    if (problems.length) throw new Error(`the product scope statement is invalid: ${problems.join('; ')}`);
    const catalog = await readJson<{ sourceRevision?: string; detectors?: unknown[] }>('benchmarks/detectors.json');
    return {
      outOfScope: scope.outOfScope, readAt: scope.readAt.revision,
      detectors: catalog.detectors?.length && catalog.sourceRevision ? { count: catalog.detectors.length, revision: catalog.sourceRevision } : null,
    };
  });
}
