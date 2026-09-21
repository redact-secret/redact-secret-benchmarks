import type { Finding } from '../types.ts';
import type { ReviewEntry, MethodResult, Method, GeneratedVariant, ObservedRange } from '../engine/types.ts';
import { generate } from './common.ts';
import { observe } from '../engine/assertions.ts';

// Deduplicate ranges, sort families and retain unknown mappings explicitly.
// Ordering and duplicate adapter rows must not change disagreement identity.
export function classifications(v: GeneratedVariant, findings: Finding[]): ObservedRange[] {
  const groups = new Map<string, { start: number; end: number; families: Set<string>; unmapped: boolean }>();
  for (const f of findings.filter(f => f.path === v.fixture.path)) {
    const key = `${f.start}:${f.end}`;
    const row = groups.get(key) ?? { start: f.start, end: f.end, families: new Set<string>(), unmapped: false };
    if (f.family) row.families.add(f.family); else row.unmapped = true;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => a.start - b.start || a.end - b.end)
    .map(r => ({ ...r, families: [...r.families].sort() }));
}

export const differential: Method = {
  id: 'differential', version: 2, generate,
  validateCase(c) { if (c.operators.length) throw new Error('Differential observes the canonical input'); },
  evaluate({ variants, observations }) {
    const queue: ReviewEntry[] = [], comparisons: NonNullable<MethodResult['comparisons']> = [];
    const primary = observations.find(s => s.id === 'redact-secret');
    for (const v of variants) {
      for (const peer of observations.filter(s => s.id !== 'redact-secret')) {
        if (primary?.status !== 'complete' || peer.status !== 'complete') {
          comparisons.push({ variant: v.id, peer: peer.id,
            status: primary?.status === 'unsupported' || peer.status === 'unsupported' ? 'unsupported' : 'incomplete',
            reason: `redact-secret: ${primary?.status ?? 'not-selected'}; ${peer.id}: ${peer.status}` });
          continue;
        }
        const a = observe(v, primary.findings), b = observe(v, peer.findings);
        const ac = classifications(v, primary.findings), bc = classifications(v, peer.findings);
        // Range agreement is family-blind by design: classification agreement is ac/bc's job.
        const sortRanges = (ranges: typeof a.actual) => [...ranges].map(({ start, end }) => ({ start, end })).sort((x, y) => x.start - y.start || x.end - y.end);
        a.actual = sortRanges(a.actual); b.actual = sortRanges(b.actual);
        const rangesEqual = JSON.stringify(a.actual) === JSON.stringify(b.actual);
        const classifiable = rangesEqual && ac.length > 0 && [...ac, ...bc].every(r => !r.unmapped && r.families.length);
        const disagreement = !rangesEqual
          ? !b.actual.length ? 'redact-secret-only' : !a.actual.length ? 'peer-only' : 'range-disagreement'
          : classifiable && JSON.stringify(ac) !== JSON.stringify(bc) ? 'classification-disagreement' : 'none';
        comparisons.push({ variant: v.id, peer: peer.id, status: 'complete', disagreement,
          classification: classifiable ? 'compared' : 'unsupported' });
        if (disagreement !== 'none') queue.push({ variant: v.id, peer: peer.id, disagreement,
          status: 'review-required', observations: { 'redact-secret': a.actual, [peer.id]: b.actual },
          classifications: { 'redact-secret': ac, [peer.id]: bc },
          evidence: { input: { path: v.fixture.path, contentHash: v.provenance.contentHash, fixtureHash: v.provenance.fixtureHash },
            tools: [primary, peer].map(s => ({ id: s.id, version: s.version, mode: s.mode,
              configurationHash: s.configurationHash, configuration: s.configuration })) } });
      }
    }
    return { scanners: [], comparisons, queue,
      observations: observations.map(s => ({ scanner: s.id, status: s.status,
        variants: s.status === 'complete' ? variants.map(v => ({ id: v.id, actual: observe(v, s.findings).actual,
          classifications: classifications(v, s.findings) })) : [] })),
      capabilities: { ranges: true, classification: comparisons.some(c => c.classification === 'compared'), redaction: false },
      complete: Boolean(primary?.status === 'complete' && comparisons.length && comparisons.every(c => c.status === 'complete')) };
  },
};
