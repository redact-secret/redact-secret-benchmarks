import type { Finding, ScoredRow } from '../types.ts';
import type { GeneratedVariant, Assertion, Relation, EvaluationContext, ScannerResult } from './types.ts';
import { score } from '../lib/scoring.ts';
import { scoreRow } from '../lib/lattice.ts';
import { secrets } from './model.ts';

export function observe(variant: GeneratedVariant, findings: Finding[]) {
  const row = score([variant.fixture], findings.filter(f => f.path === variant.fixture.path)).rows[0];
  // A generated variant's fixture never carries `twinOf` (the engine gives every variant its
  // own id space, so a corpus-relative `twinOf` would dangle); `transformation.relation ===
  // 'must-flip'` is the engine-native twin signal instead (only `authored.twin` sets it).
  // Scope the reading to the twin's own declared contract family, per
  // docs/specs/evaluation-methods/02-negative-twin.md — a finding from a different, known family is
  // legitimate co-detection, not a twin failure.
  if (variant.transformation.relation === 'must-flip' && variant.fixture.assessment.contract)
    return { ...row, ...scoreRow(row.expected, row.actual, variant.fixture.assessment.contract) };
  return row;
}

export function absolute(variant: GeneratedVariant, row: ScoredRow): Assertion {
  if (variant.strategy === 'review-required' || variant.fixture.assessment.tier === 'T0')
    return { type: 'absolute', status: 'review-required', reason: 'Expectation is pending review.' };
  const positive = secrets(variant.fixture).length > 0;
  const pass = positive
    ? row.spanOutcomes!.every(o => o === 'EXACT' || o === 'COVERED') && row.collateralBytes === 0
    : !row.flagged;
  return { type: positive ? 'present-within-envelope' : 'absent', status: pass ? 'pass' : 'fail' };
}

export function relation(baseline: GeneratedVariant, candidate: GeneratedVariant, baselineRow: ScoredRow, candidateRow: ScoredRow, type: Relation): Assertion {
  const a = absolute(baseline, baselineRow), b = absolute(candidate, candidateRow);
  if ([a, b].some(r => r.status === 'review-required')) return { type, baseline: baseline.id, candidate: candidate.id, status: 'review-required' };
  // Do not allow two missed positives to pass an invariance assertion.
  let pass = a.status === 'pass' && b.status === 'pass';
  if (type === 'must-flip') pass &&= secrets(baseline.fixture).length > 0 && secrets(candidate.fixture).length === 0;
  else if (type === 'same-detection') pass &&= JSON.stringify(baselineRow.spanOutcomes ?? baselineRow.flagged) === JSON.stringify(candidateRow.spanOutcomes ?? candidateRow.flagged);
  else throw new Error('Unknown relation assertion');
  return { type, baseline: baseline.id, candidate: candidate.id, status: pass ? 'pass' : 'fail' };
}

export function evaluateAssertions({ variants, observations }: Pick<EvaluationContext, 'variants' | 'observations'>): ScannerResult[] {
  return observations.map(scanner => {
    // An absent observation is a measured gap, not an empty one (v1.1 §4).
    if (scanner.status !== 'complete') return { scanner: scanner.id, status: scanner.status, variants: [],
      assertions: variants.map(v => ({ variant: v.id, type: 'absolute', status: 'not-measured' as const, reason: scanner.status })) };
    const rows = variants.map(v => observe(v, scanner.findings));
    const assertions: Assertion[] = variants.map((v, i) => ({ variant: v.id, ...absolute(v, rows[i]) }));
    for (let i = 1; i < variants.length; i++) {
      const type = variants[i].transformation.relation;
      if (type) assertions.push(relation(variants[0], variants[i], rows[0], rows[i], type));
    }
    return { scanner: scanner.id, status: 'complete', assertions,
      variants: variants.map((v, i) => ({ id: v.id, row: rows[i] })) };
  });
}
