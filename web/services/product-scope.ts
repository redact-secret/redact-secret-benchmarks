/**
 * What the product itself documents it does not cover (#622): `scanners/product-scope.json`, validated with the ledger pipeline's validator
 * (`productScopeProblems`, `npm run peer-rules:check`). The product is not a peer, so the peer registry does not list it; this is its counterpart, read at a named
 * product revision and bound to a release and a measured configuration (`boundTo`). The page compares that binding with what an observation of the product
 * recorded; this service only reads. The registered-detector count of `benchmarks/detectors.json` is returned with the revision that file was read at.
 */
import { productScopeProblems, type ProductScope, type ProductScopeStatement } from '../../benchmarks/lib/peer-rule-families';
import { once, readJson } from './repo';

export interface ProductScopeProfile {
  /** The reviewed statements, each with its kind (product scope, optional profile, unmeasured surface). */
  statements: ProductScopeStatement[];
  /** The product commit the statements were read at (`readAt.revision`). */
  readAt: string;
  /** The release and configuration the statements are bound to, and the check that binds them. */
  boundTo: ProductScope['boundTo'];
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
      statements: scope.outOfScope, readAt: scope.readAt.revision, boundTo: scope.boundTo,
      detectors: catalog.detectors?.length && catalog.sourceRevision ? { count: catalog.detectors.length, revision: catalog.sourceRevision } : null,
    };
  });
}
