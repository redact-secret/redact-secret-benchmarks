import { piiEvidencePublication } from '../../scripts/pii-evidence-publication.mjs';
import { once, REPO_ROOT } from './repo';

/** This public population is independent of protected execution and both authority switches. */
export function loadPiiEvidenceComparisonPage() {
  return once('pii-evidence-comparison', async () => (await piiEvidencePublication(REPO_ROOT)).view.comparison);
}
