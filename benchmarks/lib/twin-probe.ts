import type { FormatContract, ScoredRow } from '../types.ts';

/**
 * Twin probe, per detector family (#36). The group twin rate divides by
 * authored pairs, so a family with no twin silently leaves the denominator.
 * This line puts every family in exactly one state instead:
 *
 * - `discriminated`     every scored pair: positive covered and twin clean
 * - `not-discriminated` at least one scored pair failed
 * - `un-probeable`      no twin authored; the contract records why
 * - `not-measured`      twins exist but no scored pair (no run, or T0 positives)
 * - `unrecorded`        neither a twin nor an un-probeable record: a corpus gap
 *
 * Un-probeable families are counted on their own and never enter a rate.
 * A pair is scored under the same rule as `accountGroups` (v1.1, strict).
 */
export type TwinProbeStatus = 'discriminated' | 'not-discriminated' | 'un-probeable' | 'not-measured' | 'unrecorded';
export interface TwinProbeEntry { id: string; status: TwinProbeStatus; twins: number; pairs: number; discriminated: number; reason?: string; observedAt?: string }
export interface TwinProbe { entries: TwinProbeEntry[]; counts: Record<TwinProbeStatus, number> }
interface ProbeFixture { id: string; detectors?: string[]; twinOf?: string }

const acceptable = (outcome: string) => outcome === 'EXACT' || outcome === 'COVERED';

/** `fixtures` and `rows` must share one id space (both slugs, or both corpus-local ids). */
export function twinProbe(detectors: string[], fixtures: ProbeFixture[], rows: ScoredRow[] | undefined, contracts: Record<string, FormatContract>): TwinProbe {
  const byId = new Map((rows ?? []).map(r => [r.id, r]));
  const entries = detectors.map((id): TwinProbeEntry => {
    const twins = fixtures.filter(f => f.twinOf && f.detectors?.[0] === id);
    const record = contracts[id]?.unprobeable;
    if (twins.length && record) throw new Error(`Un-probeable family with twins: ${id}`);
    if (!twins.length) return record ? { id, status: 'un-probeable', twins: 0, pairs: 0, discriminated: 0, ...record } : { id, status: 'unrecorded', twins: 0, pairs: 0, discriminated: 0 };
    let pairs = 0, discriminated = 0;
    for (const f of twins) {
      const twin = byId.get(f.id), positive = byId.get(f.twinOf!);
      if (!twin || !positive || twin.tier === 'T0' || positive.tier === 'T0' || positive.kind === 'must-not-flag' || !positive.spanOutcomes) continue;
      pairs++;
      if (positive.spanOutcomes.every(acceptable) && !twin.flagged) discriminated++;
    }
    return { id, status: !pairs ? 'not-measured' : discriminated === pairs ? 'discriminated' : 'not-discriminated', twins: twins.length, pairs, discriminated };
  });
  const counts: Record<TwinProbeStatus, number> = { discriminated: 0, 'not-discriminated': 0, 'un-probeable': 0, 'not-measured': 0, unrecorded: 0 };
  for (const entry of entries) counts[entry.status]++;
  return { entries, counts };
}
