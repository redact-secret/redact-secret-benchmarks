// Round-2 scoring (#739): the round-1 scorer plus multi-span positives (a value that appears more than once).
import { scoreCase as scoreOne, summarize as summarizeR1, parity } from './score.mjs';
export { parity };

export function scoreCase(kase, observation) {
  if (kase.kind !== 'positive') return scoreOne(kase, observation);
  const spans = [kase.expected, ...(kase.expectedExtra ?? [])];
  const parts = spans.map(expected => scoreOne({ ...kase, expected }, observation));
  const first = parts[0];
  return {
    ...first,
    spans: parts.length,
    // every occurrence must be exact with the contract type and action
    pass: parts.every(p => p.pass),
    fullyCovered: parts.every(p => p.fullyCovered),
    leakedBytes: parts.reduce((a, p) => a + p.leakedBytes, 0),
    spanOutcomes: parts.map(p => p.span),
  };
}

export function summarize(cases, observations) {
  const out = { positives: 0, pass: 0, exact: 0, fullyCovered: 0, misses: 0, typeOk: 0, actionOk: 0, controls: 0, controlFlagged: 0, unsupported: 0, conflict: 0 };
  for (const kase of cases) {
    const score = scoreCase(kase, observations[kase.id]);
    if (kase.kind === 'positive') {
      out.positives += 1;
      if (score.pass) out.pass += 1;
      if (score.spanOutcomes.every(s => s === 'exact')) out.exact += 1;
      if (score.fullyCovered) out.fullyCovered += 1;
      if (score.spanOutcomes.some(s => s === 'miss')) out.misses += 1;
      if (score.typeOk) out.typeOk += 1;
      if (score.actionOk) out.actionOk += 1;
    } else if (kase.kind === 'control') {
      out.controls += 1;
      if (score.flagged) out.controlFlagged += 1;
    } else out[kase.kind] += 1;
  }
  return out;
}
export { summarizeR1 };
