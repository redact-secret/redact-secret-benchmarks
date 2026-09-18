import type { Fixture, Finding } from '../types.ts';
import { validateAssessment } from './assessment.ts';
import { aggregateGroups } from './lattice.ts';
import { score } from './scoring.ts';

// A report has no combined score across kinds or tiers. T0 observations
// retain raw ranges but carry no outcome or byte fields.
export function scoreReport(fixtures: Fixture[], findings: Finding[]) {
  fixtures.forEach(validateAssessment);
  const { rows } = score(fixtures, findings);
  return { groups: aggregateGroups(rows), rows };
}
