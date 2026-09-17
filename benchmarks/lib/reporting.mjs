import { cohorts, validateAssessment } from './cohorts.mjs';
import { score } from './scoring.mjs';

// A report has no combined score across different measurement purposes.
// Unreviewed observations retain raw ranges but are not scored.
export function scoreCohorts(fixtures, findings) {
  fixtures.forEach(validateAssessment);
  const { rows } = score(fixtures, findings);
  return {
    rows: rows.map(r => {
      if (r.assessment.cohort !== 'unreviewed') return r;
      const { tp, fp, fn, tn, contained, broader, ...observation } = r;
      return observation;
    }),
    cohorts: Object.fromEntries(Object.entries(cohorts).map(([id, definition]) => {
      const selected = fixtures.filter(f => f.assessment.cohort === id);
      const paths = new Set(selected.map(f => f.path));
      const base = { title: definition.title, fixtureCount: selected.length, expectedCount: selected.reduce((n, f) => n + f.expected.length, 0) };
      if (id === 'unreviewed') return [id, { ...base, scored: false }];
      const { rows: ignored, ...metrics } = score(selected, findings.filter(f => paths.has(f.path)));
      return [id, { ...base, scored: true, ...metrics }];
    })),
  };
}
