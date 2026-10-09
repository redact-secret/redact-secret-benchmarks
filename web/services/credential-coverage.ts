import { loadCredentialEvaluation, type CredentialEvaluation } from './domains';
import { loadProductScope, type ProductScopeProfile } from './product-scope';
import { loadDossiers, type DossierFamily } from './dossiers';
import { loadQualificationView, type QualificationLoad } from './qualification';

export interface CredentialCoverageInput {
  evaluation: CredentialEvaluation;
  scope: ProductScopeProfile;
  dossiers: Map<string, DossierFamily>;
  qualification?: QualificationLoad;
}

/** Keep the authority-approved measurement seam; a rollback never borrows the new view's verdicts. */
export async function loadCredentialCoverage(): Promise<CredentialCoverageInput> {
  const [evaluation, scope, dossiers] = await Promise.all([loadCredentialEvaluation(), loadProductScope(), loadDossiers()]);
  const qualification = evaluation.pipeline.authority === 'new' && evaluation.pipeline.view?.state === 'ready'
    ? await loadQualificationView() : undefined;
  return { evaluation, scope, dossiers, qualification };
}
