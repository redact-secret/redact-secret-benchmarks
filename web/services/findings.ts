/**
 * The findings this benchmark handed to the product: `benchmarks/known-gaps.json`,
 * validated by the same `validateKnownGaps` the promotion checks use. The ledger
 * is a snapshot of lifecycle records, not live issue status; the page says so.
 */
import { validateKnownGaps, type KnownGaps, type KnownGapRecord } from '../../benchmarks/lib/promotion';
import { once, readJson } from './repo';

export type { KnownGaps, KnownGapRecord };

export function loadFindings(): Promise<KnownGaps> {
  return once('findings', async () => validateKnownGaps(await readJson<KnownGaps>('benchmarks/known-gaps.json')));
}
