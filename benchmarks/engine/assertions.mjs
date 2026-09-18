import { score } from '../lib/scoring.mjs';
import { secrets } from './model.mjs';

export function observe(variant, findings) {
  return score([variant.fixture], findings.filter(f => f.path === variant.fixture.path)).rows[0];
}

export function absolute(variant, row) {
  if (variant.strategy === 'review-required' || variant.fixture.assessment.tier === 'T0')
    return { type: 'absolute', status: 'review-required', reason: 'Expectation is pending review.' };
  const positive = secrets(variant.fixture).length > 0;
  const pass = positive
    ? row.spanOutcomes.every(o => o === 'EXACT' || o === 'COVERED') && row.collateralBytes === 0
    : !row.flagged;
  return { type: positive ? 'present-within-envelope' : 'absent', status: pass ? 'pass' : 'fail' };
}

export function relation(baseline, candidate, baselineRow, candidateRow, type) {
  const a = absolute(baseline, baselineRow), b = absolute(candidate, candidateRow);
  if ([a, b].some(r => r.status === 'review-required')) return { type, baseline: baseline.id, candidate: candidate.id, status: 'review-required' };
  // Do not allow two missed positives to pass an invariance assertion.
  let pass = a.status === 'pass' && b.status === 'pass';
  if (type === 'must-flip') pass &&= secrets(baseline.fixture).length > 0 && secrets(candidate.fixture).length === 0;
  else if (type === 'same-detection') pass &&= JSON.stringify(baselineRow.spanOutcomes ?? baselineRow.flagged) === JSON.stringify(candidateRow.spanOutcomes ?? candidateRow.flagged);
  else throw new Error('Unknown relation assertion');
  return { type, baseline: baseline.id, candidate: candidate.id, status: pass ? 'pass' : 'fail' };
}

export function evaluateAssertions({ variants, observations }) {
  return observations.map(scanner => {
    if (scanner.status !== 'complete') return { scanner: scanner.id, status: scanner.status, variants: [], assertions: [] };
    const rows = variants.map(v => observe(v, scanner.findings));
    const assertions = variants.map((v, i) => ({ variant: v.id, ...absolute(v, rows[i]) }));
    for (let i = 1; i < variants.length; i++) {
      const type = variants[i].transformation.relation;
      if (type) assertions.push(relation(variants[0], variants[i], rows[0], rows[i], type));
    }
    return { scanner: scanner.id, status: 'complete', assertions,
      variants: variants.map((v, i) => ({ id: v.id, row: rows[i] })) };
  });
}
