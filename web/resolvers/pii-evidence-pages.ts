import { loadPiiEvidenceComparisonPage } from '../services/pii-evidence';
import { resolvePiiEvidenceView, resolvePiiOutcomeSummary } from './pii-evidence';

export async function resolvePiiEvidencePage() {
  const comparison = await loadPiiEvidenceComparisonPage();
  return { ...resolvePiiEvidenceView(comparison), outcomes: resolvePiiOutcomeSummary(comparison) };
}
