import { validateAssessment } from './assessment.mjs';
import { aggregateGroups } from './lattice.mjs';
import { score } from './scoring.mjs';

// A report has no combined score across kinds or tiers. T0 observations
// retain raw ranges but carry no outcome or byte fields.
export function scoreReport(fixtures, findings) {
  fixtures.forEach(validateAssessment);
  const { rows } = score(fixtures, findings);
  return { groups: aggregateGroups(rows), rows };
}
