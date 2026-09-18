import { generate } from './common.mjs';
import { observe } from '../engine/assertions.mjs';

const ranges = row => JSON.stringify([...row.actual].sort((a, b) => a.start - b.start || a.end - b.end));
export const differential = {
  id: 'differential', version: 1, generate,
  validateCase(c) { if (c.operators.length) throw new Error('Differential observes the canonical input'); },
  evaluate({ variants, observations }) {
    const queue = [], comparisons = [];
    const primary = observations.find(s => s.id === 'redact-secret');
    for (const v of variants) {
      for (const peer of observations.filter(s => s.id !== 'redact-secret')) {
        if (primary?.status !== 'complete' || peer.status !== 'complete') {
          comparisons.push({ variant: v.id, peer: peer.id, status: 'incomplete' });
          continue;
        }
        const a = observe(v, primary.findings), b = observe(v, peer.findings);
        const disagreement = ranges(a) === ranges(b) ? 'none'
          : !b.actual.length ? 'redact-secret-only'
          : !a.actual.length ? 'peer-only' : 'range-disagreement';
        comparisons.push({ variant: v.id, peer: peer.id, status: 'complete', disagreement });
        if (disagreement !== 'none') queue.push({ variant: v.id, peer: peer.id, disagreement,
          status: 'review-required', observations: { 'redact-secret': a.actual, [peer.id]: b.actual } });
      }
    }
    return { scanners: [], comparisons, queue,
      observations: observations.map(s => ({ scanner: s.id, status: s.status,
        variants: s.status === 'complete' ? variants.map(v => ({ id: v.id, actual: observe(v, s.findings).actual })) : [] })),
      capabilities: { ranges: true, classification: false, redaction: false },
      complete: Boolean(primary?.status === 'complete' && comparisons.length && comparisons.every(c => c.status === 'complete')) };
  },
};
