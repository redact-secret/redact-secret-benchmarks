import { loadPiiEvidenceComparisonPage } from '../services/pii-evidence';
import { resolvePiiEvidenceView, resolvePiiOutcomeSummary } from './pii-evidence';
import { loadPiiCoveragePage } from '../services/pii-coverage';
import { resolvePiiCoverageView } from './pii-coverage';

export async function resolvePiiEvidencePage() {
  const comparison = await loadPiiEvidenceComparisonPage();
  const coverage = await loadPiiCoveragePage();
  return { ...resolvePiiEvidenceView(comparison), outcomes: resolvePiiOutcomeSummary(comparison), fullCoverage: resolvePiiCoverageView(coverage) };
}
