import type { ScoredRow, AccountingConfig, Published, AccountedGroup, AccountingDelta, DeltaCause } from '../../../types.ts';
import { aggregateGroups } from '../../../scoring/lattice.ts';
import { credentialIdentity } from '../../../consumer/credential-identity.ts';
import {
  INSUFFICIENT_EVIDENCE, INSUFFICIENT_COVERAGE, STATUSES, floorFor, round, wilson, proportion, ratio, accountCounts,
} from '../../../accounting/shared/primitives.ts';
// Engine v1.1 accounting: anything unmeasured, unstable or unreviewed consumes
// denominator, and the published figure is the worst defensible bound. Pure
// closed-form arithmetic so the browser can re-verify every group without
// fixture bytes. See docs/specs/evaluation-engine-v1.1.md.

export { ACCOUNTING_VERSION, validateAccounting } from '../../../consumer/credential-metrics.ts';
import { accountRecordedCounts } from '../../../consumer/credential-metrics.ts';
export const DOMAIN_ACCOUNTING_VERSION = credentialIdentity.domainAccountingVersion;
export { INSUFFICIENT_EVIDENCE, INSUFFICIENT_COVERAGE, STATUSES, floorFor, wilson, proportion, ratio, accountCounts };

export { credentialAccountingIdentity, readCredentialAccountingIdentity, assertCredentialAccountingIdentities } from '../../../consumer/credential-metrics.ts';

const pointOf = (rate: Published | 'insufficient-coverage') => (rate && typeof rate === 'object' ? rate.point : null);
/** Retained oracle range diagnostics are supplied by the legacy scorer; statistic rules are shared. */
export function accountGroups(rows: ScoredRow[], config: AccountingConfig): Record<string, AccountedGroup> {
  return accountRecordedCounts(rows, config, aggregateGroups(rows));
}

const RATES = ['leakedSpanRate', 'leakedByteRate', 'collateralRatio', 'falseAlarmRate', 'meanFindingsPerFlagged'] as const;

/**
 * Dual-scorer transition (§9): the same rows under v1.0 and v1.1, with the
 * rule that moved each figure. A group with no cause is a proven no-op:
 * every v1.1 point equals its v1.0 figure to the configured precision.
 */
export function accountingDelta(rows: ScoredRow[], config: AccountingConfig): AccountingDelta {
  const v10 = aggregateGroups(rows), v11 = accountGroups(rows, config);
  const groups: AccountingDelta['groups'] = {};
  for (const [key, before] of Object.entries(v10)) {
    if (key === 'pending/T0') continue;
    const after = v11[key], cause = new Set<DeltaCause>();
    const old: Record<string, number | null> = {}, next: AccountingDelta['groups'][string]['v11'] = {};
    for (const k of RATES) if (k in before) {
      old[k] = before[k] == null ? null : round(before[k]!, config.intervalPrecision);
      next[k] = after[k] as Published;
    }
    if (before.twins) {
      old['twins.rate'] = before.twins.rate == null ? null : round(before.twins.rate, config.intervalPrecision);
      next['twins.rate'] = after.twins!.rate;
      next['twins.coverage'] = after.twins!.coverage;
      next.measurableShare = after.measurableShare!;
      if (after.twins!.discriminated !== before.twins.discriminated) cause.add('overbroad-twin');
      if (after.twins!.rate === INSUFFICIENT_COVERAGE) cause.add('twin-coverage');
      const share = after.measurableShare;
      if (after.leakedSpanRate === INSUFFICIENT_EVIDENCE && share && typeof share === 'object' && after.pendingFiles! > 0 &&
          share.point < floorFor(config.measurableShareFloor, key.split('/')[0])) cause.add('t0-share');
    }
    // The bound is an addition beside an unchanged point; the interval rule
    // only *moves* a figure when it withholds one for a small denominator.
    for (const k of Object.keys(old)) if (old[k] != null && next[k] === INSUFFICIENT_EVIDENCE && !cause.has('t0-share')) cause.add('interval');
    for (const k of Object.keys(old)) if (pointOf(next[k]) != null && pointOf(next[k]) !== old[k] && !cause.size) throw new Error(`Unattributed accounting delta: ${key}`);
    groups[key] = { v10: old, v11: next, cause: [...cause].sort() };
  }
  return { version: '1.0 -> 1.1', groups };
}

/**
 * Comparability key (§10). Two records may be compared only under one
 * accounting version, unless one of them carries the `accountingDelta`
 * mapping that attributes the difference to the engine. A record without the
 * field predates it and is v1.0.
 */
export function assertComparable(before: { accountingVersion?: string; accountingDelta?: unknown }, after: { accountingVersion?: string; accountingDelta?: unknown }) {
  const version = (r: { accountingVersion?: string }) => r.accountingVersion ?? '1.0';
  if (version(before) !== version(after) && !before.accountingDelta && !after.accountingDelta)
    throw new Error(`Accounting versions are not comparable: ${version(before)} vs ${version(after)} without an accountingDelta mapping`);
}

/**
 * Summary rows whose resolved share is below the floor for their method.
 * T0 strata are unresolved by construction and are already charged through
 * `measurableShare` (§2) and the review ledger (§6), so the floor is held over
 * scored strata; a method that resolved nothing at all is listed as `<method>/*`.
 */
export function unresolvedGroups(summary: Record<string, Partial<Record<(typeof STATUSES)[number], number>>>, config: AccountingConfig) {
  const below: string[] = [], methods: Record<string, { total: number; resolved: number }> = {};
  for (const [key, counts] of Object.entries(summary)) {
    const [method, , stratum] = key.split('/');
    const { total, resolved } = accountCounts(counts, config);
    const m = (methods[method] ??= { total: 0, resolved: 0 });
    m.total += total; m.resolved += resolved;
    if (stratum.includes(':T0') || !total) continue;
    if (resolved / total < floorFor(config.resolvedRateFloor, method)) below.push(key);
  }
  for (const [method, m] of Object.entries(methods)) if (m.total > 0 && m.resolved === 0 && floorFor(config.resolvedRateFloor, method) > 0) below.push(`${method}/*`);
  return below.sort();
}
