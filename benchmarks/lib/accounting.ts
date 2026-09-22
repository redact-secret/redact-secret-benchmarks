import type { ScoredRow, AccountingConfig, Floor, Published, AccountedGroup, AccountedCounts, AccountingDelta, DeltaCause } from '../types.ts';
import { aggregateGroups, groupKey } from './lattice.ts';
// Engine v1.1 accounting: anything unmeasured, unstable or unreviewed consumes
// denominator, and the published figure is the worst defensible bound. Pure
// closed-form arithmetic so the browser can re-verify every group without
// fixture bytes. See docs/specs/evaluation-engine-v1.1.md.

export const ACCOUNTING_VERSION = '1.1';
export const INSUFFICIENT_EVIDENCE = 'insufficient-evidence';
export const INSUFFICIENT_COVERAGE = 'insufficient-coverage';
export const STATUSES = ['pass', 'fail', 'review-required', 'not-measured'] as const;

/** Floors are a number, or a map with a `default` and per-key overrides. */
export const floorFor = (floor: Floor, key: string) => (typeof floor === 'number' ? floor : floor[key] ?? floor.default);

export function validateAccounting(value: unknown): AccountingConfig {
  const a = value as AccountingConfig;
  const unit = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1;
  const floor = (f: unknown) => unit(f) || (!!f && typeof f === 'object' && unit((f as Record<string, number>).default) && Object.values(f).every(unit));
  if (!a || a.version !== ACCOUNTING_VERSION || !Number.isInteger(a.minDenominator) || a.minDenominator < 1 ||
      !floor(a.resolvedRateFloor) || !floor(a.measurableShareFloor) || !floor(a.twinCoverageFloor) ||
      !Number.isInteger(a.replays) || a.replays < 2 || !(a.intervalZ > 0) ||
      !Number.isInteger(a.intervalPrecision) || a.intervalPrecision < 1 || a.intervalPrecision > 12)
    throw new Error('Invalid accounting configuration');
  return a;
}

const round = (value: number, precision: number) => Number(value.toFixed(precision));

/** Wilson score interval endpoint on the pessimistic side. `p` may be a byte share rather than k/n. */
export function wilson(p: number, n: number, direction: 'upper' | 'lower', { intervalZ: z, intervalPrecision }: Pick<AccountingConfig, 'intervalZ' | 'intervalPrecision'>) {
  const scale = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / scale;
  const spread = (z / scale) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return round(Math.min(1, Math.max(0, direction === 'upper' ? centre + spread : centre - spread)), intervalPrecision);
}

/**
 * A published proportion. `n` is the count of independent observations the
 * interval is drawn over, which is not always the arithmetic denominator:
 * bytes inside one span are not independent trials, so byte rates pass spans.
 */
export function proportion(numerator: number, denominator: number, direction: 'upper' | 'lower', config: AccountingConfig, n = denominator): Published {
  if (!denominator || !n) return null;
  if (n < config.minDenominator) return INSUFFICIENT_EVIDENCE;
  const point = numerator / denominator;
  return { point: round(point, config.intervalPrecision), bound: wilson(point, n, direction, config), n, direction };
}

/** An unbounded ratio is not binomial: it carries no interval, by decision, not by omission. */
export function ratio(numerator: number, denominator: number, config: AccountingConfig, n = denominator): Published {
  if (!denominator || !n) return null;
  if (n < config.minDenominator) return INSUFFICIENT_EVIDENCE;
  return { point: round(numerator / denominator, config.intervalPrecision), bound: null, n: denominator, direction: null };
}

const pointOf = (rate: Published | 'insufficient-coverage') => (rate && typeof rate === 'object' ? rate.point : null);
const secretsOf = (row: ScoredRow) => row.expected.filter(e => (e.role ?? 'secret') === 'secret');
const acceptable = (outcome: string) => outcome === 'EXACT' || outcome === 'COVERED';

/**
 * v1.1 groups. Counts are identical to `aggregateGroups` (the v1.0 scorer)
 * except `twins.discriminated`, which follows the absolute assertion:
 * an OVERBROAD positive has not demonstrated discrimination (§3).
 */
export function accountGroups(rows: ScoredRow[], config: AccountingConfig): Record<string, AccountedGroup> {
  const v10 = aggregateGroups(rows);
  const byId = new Map(rows.map(r => [r.id, r]));
  // The candidate kind of a T0 row is the kind its assessment already carries.
  const pending: Record<string, number> = {};
  for (const r of rows) if (r.tier === 'T0' && r.kind) pending[r.kind] = (pending[r.kind] ?? 0) + 1;
  const strict: Record<string, number> = {}, envelopes: Record<string, { spans: number; bytes: number }> = {};
  for (const twin of rows) {
    const positive = twin.twinOf && twin.tier !== 'T0' ? byId.get(twin.twinOf) : undefined;
    if (!positive || positive.kind === 'must-not-flag' || positive.tier === 'T0') continue;
    const key = groupKey(positive.kind, positive.tier);
    strict[key] ??= 0;
    if (positive.spanOutcomes!.every(acceptable) && !twin.flagged) strict[key]++;
  }
  for (const r of rows) {
    if (r.tier === 'T0' || r.kind === 'must-not-flag') continue;
    const e = (envelopes[groupKey(r.kind, r.tier)] ??= { spans: 0, bytes: 0 });
    for (const s of secretsOf(r)) if (s.envelope) { e.spans++; e.bytes += (s.envelope.end - s.envelope.start) - (s.end - s.start); }
  }
  const groups: Record<string, AccountedGroup> = {};
  for (const [key, g] of Object.entries(v10)) {
    if (key === 'pending/T0') { groups[key] = { files: g.files, scored: false, candidateKinds: Object.fromEntries(Object.entries(pending).sort(([a], [b]) => a.localeCompare(b))) }; continue; }
    if (key.startsWith('must-not-flag/')) {
      groups[key] = { files: g.files, flaggedFiles: g.flaggedFiles, findings: g.findings,
        falseAlarmRate: proportion(g.flaggedFiles!, g.files, 'upper', config),
        meanFindingsPerFlagged: ratio(g.findings!, g.flaggedFiles!, config, g.files),
        diagnostics: g.diagnostics };
      continue;
    }
    const kind = key.split('/')[0], twins = g.twins!;
    const pendingFiles = pending[kind] ?? 0;
    const measurableShare = proportion(g.files, g.files + pendingFiles, 'lower', config);
    const measurable = g.files / (g.files + pendingFiles) >= floorFor(config.measurableShareFloor, kind);
    const withheld = <T>(rate: T) => (measurable ? rate : INSUFFICIENT_EVIDENCE);
    const coverage = proportion(twins.pairs, twins.positives, 'lower', config);
    const covered = twins.positives > 0 && twins.pairs / twins.positives >= floorFor(config.twinCoverageFloor, kind);
    const discriminated = strict[key] ?? 0;
    groups[key] = {
      files: g.files, spans: g.spans, secretBytes: g.secretBytes, outcomes: g.outcomes,
      pendingFiles, measurableShare, envelopeWidth: envelopes[key] ?? { spans: 0, bytes: 0 },
      leakedSpans: g.leakedSpans, leakedSpanRate: withheld(proportion(g.leakedSpans!, g.spans!, 'upper', config)),
      leakedBytes: g.leakedBytes, leakedByteRate: withheld(proportion(g.leakedBytes!, g.secretBytes!, 'upper', config, g.spans!)),
      collateralBytes: g.collateralBytes, collateralRatio: withheld(ratio(g.collateralBytes!, g.secretBytes!, config, g.spans!)),
      twins: { positives: twins.positives, pairs: twins.pairs, discriminated, coDetected: twins.coDetected, coverage,
        rate: !twins.pairs ? null : !measurable ? INSUFFICIENT_EVIDENCE : !covered ? INSUFFICIENT_COVERAGE
          : proportion(discriminated, twins.pairs, 'lower', config) },
      diagnostics: g.diagnostics,
    };
  }
  return groups;
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

/** Assertion counts under v1.1 (§1, §4): unresolved and not-measured rows stay in the denominator. */
export function accountCounts(counts: Partial<Record<(typeof STATUSES)[number], number>>, config: AccountingConfig): AccountedCounts {
  const c = Object.fromEntries(STATUSES.map(s => [s, counts[s] ?? 0])) as Record<(typeof STATUSES)[number], number>;
  const resolved = c.pass + c.fail, total = resolved + c['review-required'] + c['not-measured'];
  return { ...c, total, resolved, unresolved: total - resolved, resolvedRate: proportion(resolved, total, 'lower', config) };
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
