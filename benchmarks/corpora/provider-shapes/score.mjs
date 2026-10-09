import { EXPECTED_ACTION, GENERIC_TYPES } from './corpus.mjs';

// Pure scoring of one observation against its authored expectation (#717).
// An observation is `{ findings: [{ start, end, type, detector, action }] }` with
// UTF-8 byte offsets (exclusive end). Nothing here reads a scanner or an engine.

const touches = (a, b) => a.start < b.end && b.start < a.end;

/** Positive span outcomes: exact, over (covers the value and more), under (inside it), partial (overlaps it), miss. */
export function spanOutcome(expected, finding) {
  if (!finding) return 'miss';
  if (finding.start === expected.start && finding.end === expected.end) return 'exact';
  if (finding.start <= expected.start && finding.end >= expected.end) return 'over';
  if (finding.start >= expected.start && finding.end <= expected.end) return 'under';
  return 'partial';
}

/** The finding that best serves a positive: exact first, otherwise the largest overlap with the value. */
export function primaryFinding(expected, findings) {
  const hits = findings.filter(f => touches(expected, f));
  if (!hits.length) return null;
  const overlap = f => Math.min(f.end, expected.end) - Math.max(f.start, expected.start);
  return [...hits].sort((a, b) => (spanOutcome(expected, a) === 'exact' ? 0 : 1) - (spanOutcome(expected, b) === 'exact' ? 0 : 1) || overlap(b) - overlap(a))[0];
}

export function scoreCase(kase, observation) {
  const findings = observation.findings;
  if (kase.kind === 'positive') {
    const hits = findings.filter(f => touches(kase.expected, f));
    const primary = primaryFinding(kase.expected, findings);
    const span = spanOutcome(kase.expected, primary);
    return {
      detected: hits.length > 0,
      span,
      action: primary ? primary.action : null,
      actionOk: primary ? primary.action === EXPECTED_ACTION : false,
      type: primary ? primary.type : null,
      detector: primary ? primary.detector : null,
      typeGeneric: primary ? GENERIC_TYPES.includes(primary.type) : false,
      overlaps: hits.length,
      leakedBytes: primary ? Math.max(0, kase.expected.end - kase.expected.start - Math.max(0, Math.min(primary.end, kase.expected.end) - Math.max(primary.start, kase.expected.start))) : kase.expected.end - kase.expected.start,
      collateralBytes: primary ? Math.max(0, primary.end - primary.start - (Math.min(primary.end, kase.expected.end) - Math.max(primary.start, kase.expected.start))) : 0,
      pass: span === 'exact' && primary.action === EXPECTED_ACTION,
    };
  }
  if (kase.kind === 'control') {
    return { flagged: findings.length > 0, findings: findings.length, pass: findings.length === 0 };
  }
  return { observed: findings.length, pass: null };
}

/** The same findings, whole and streamed: equal when the sorted (start, end, type, action) tuples are equal. */
export function parity(whole, stream) {
  const key = list => JSON.stringify([...list].map(f => [f.start, f.end, f.type, f.action]).sort());
  return key(whole.findings) === key(stream.findings);
}

export function summarize(cases, observations) {
  const out = { positives: 0, exact: 0, detected: 0, misses: 0, over: 0, under: 0, partial: 0, actionOk: 0, controls: 0, controlFlagged: 0, unsupported: 0 };
  for (const kase of cases) {
    const score = scoreCase(kase, observations[kase.id]);
    if (kase.kind === 'positive') {
      out.positives += 1;
      if (score.span === 'exact') out.exact += 1;
      if (score.detected) out.detected += 1;
      if (score.span === 'miss') out.misses += 1;
      if (score.span === 'over') out.over += 1;
      if (score.span === 'under') out.under += 1;
      if (score.span === 'partial') out.partial += 1;
      if (score.actionOk) out.actionOk += 1;
    } else if (kase.kind === 'control') {
      out.controls += 1;
      if (score.flagged) out.controlFlagged += 1;
    } else out.unsupported += 1;
  }
  return out;
}
