import type { Fixture, Finding, AccountingConfig } from '../types.ts';
import { validateAssessment } from './assessment.ts';
import { accountGroups, accountingDelta } from './accounting.ts';
import { score } from './scoring.ts';

// A report has no combined score across kinds or tiers. T0 observations
// retain raw ranges but carry no outcome or byte fields.
// Groups are published under v1.1 accounting; `accountingDelta` carries the
// v1.0 figure beside each one until a release has been qualified under v1.1.
export function scoreReport(fixtures: Fixture[], findings: Finding[], accounting: AccountingConfig) {
  fixtures.forEach(validateAssessment);
  const { rows } = score(fixtures, findings);
  return { groups: accountGroups(rows, accounting), accountingDelta: accountingDelta(rows, accounting), rows };
}
