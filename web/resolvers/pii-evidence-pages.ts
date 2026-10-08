import { loadPiiEvidenceComparisonPage } from '../services/pii-evidence';
import { resolvePiiEvidenceView } from './pii-evidence';

export async function resolvePiiEvidencePage() {
  return resolvePiiEvidenceView(await loadPiiEvidenceComparisonPage());
}
