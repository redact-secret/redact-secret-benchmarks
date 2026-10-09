// Pure scoring of one observation against its frozen Batch 2 expectation (#739).
// An observation is `{ findings: [{ start, end, type, detector, action }] }` with UTF-8 byte offsets (exclusive end).
// Nothing here reads a scanner. Only `positive` cases are scored for span, type and action; `control` cases are
// scored for "no finding"; `unsupported` and `conflict` cases are observed and never scored.

const touches = (a, b) => a.start < b.end && b.start < a.end;

export function spanOutcome(expected, finding) {
  if (!finding) return 'miss';
  if (finding.start === expected.start && finding.end === expected.end) return 'exact';
  if (finding.start <= expected.start && finding.end >= expected.end) return 'over';
  if (finding.start >= expected.start && finding.end <= expected.end) return 'under';
  return 'partial';
}

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
    const width = kase.expected.end - kase.expected.start;
    const covered = primary ? Math.max(0, Math.min(primary.end, kase.expected.end) - Math.max(primary.start, kase.expected.start)) : 0;
    const typeOk = primary ? primary.type === kase.expectedType : false;
    const actionOk = primary ? primary.action === kase.expectedAction : false;
    return {
      detected: hits.length > 0,
      span,
      type: primary ? primary.type : null,
      action: primary ? primary.action : null,
      typeOk,
      actionOk,
      overlaps: hits.length,
      leakedBytes: width - covered,
      collateralBytes: primary ? primary.end - primary.start - covered : 0,
      // covering the whole value is the masking outcome; exact + type + action is the contract outcome
      fullyCovered: width - covered === 0 && !!primary,
      pass: span === 'exact' && typeOk && actionOk,
    };
  }
  if (kase.kind === 'control') return { flagged: findings.length > 0, findings: findings.length, pass: findings.length === 0 };
  return { observed: findings.length, pass: null };
}

export function parity(whole, stream) {
  const key = list => JSON.stringify([...list].map(f => [f.start, f.end, f.type, f.action]).sort());
  return key(whole.findings) === key(stream.findings);
}

export function summarize(cases, observations) {
  const out = { positives: 0, pass: 0, exact: 0, fullyCovered: 0, misses: 0, over: 0, under: 0, partial: 0, typeOk: 0, actionOk: 0, controls: 0, controlFlagged: 0, unsupported: 0, conflict: 0 };
  for (const kase of cases) {
    const obs = observations[kase.id];
    const score = scoreCase(kase, obs);
    if (kase.kind === 'positive') {
      out.positives += 1;
      if (score.pass) out.pass += 1;
      if (score.span === 'exact') out.exact += 1;
      if (score.fullyCovered) out.fullyCovered += 1;
      if (score.span === 'miss') out.misses += 1;
      if (score.span === 'over') out.over += 1;
      if (score.span === 'under') out.under += 1;
      if (score.span === 'partial') out.partial += 1;
      if (score.typeOk) out.typeOk += 1;
      if (score.actionOk) out.actionOk += 1;
    } else if (kase.kind === 'control') {
      out.controls += 1;
      if (score.flagged) out.controlFlagged += 1;
    } else out[kase.kind] += 1;
  }
  return out;
}
