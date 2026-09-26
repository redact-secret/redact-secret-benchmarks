import type { AccountingConfig, Floor, Published, AccountedCounts } from '../../types.ts';

/** Mathematical/mechanical accounting only. Domain populations and meanings never belong here. */
export const INSUFFICIENT_EVIDENCE = 'insufficient-evidence';
export const INSUFFICIENT_COVERAGE = 'insufficient-coverage';
export const STATUSES = ['pass', 'fail', 'review-required', 'not-measured'] as const;

export interface AccountingArtifactIdentity {
  domain: string;
  evaluationProfile: string;
  domainAccountingVersion: string;
}

export const floorFor = (floor: Floor, key: string) => (typeof floor === 'number' ? floor : floor[key] ?? floor.default);
export const round = (value: number, precision: number) => Number(value.toFixed(precision));

export function validateMechanicalAccounting(value: unknown) {
  const a = value as Partial<AccountingConfig> | null;
  if (!a || !Number.isInteger(a.minDenominator) || Number(a.minDenominator) < 1 ||
      !Number.isInteger(a.replays) || Number(a.replays) < 2 || !(Number(a.intervalZ) > 0) ||
      !Number.isInteger(a.intervalPrecision) || Number(a.intervalPrecision) < 1 || Number(a.intervalPrecision) > 12)
    throw new Error('Invalid accounting mechanics');
}

/** Wilson score interval endpoint on the pessimistic side. */
export function wilson(p: number, n: number, direction: 'upper' | 'lower', { intervalZ: z, intervalPrecision }: Pick<AccountingConfig, 'intervalZ' | 'intervalPrecision'>) {
  const scale = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / scale;
  const spread = (z / scale) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return round(Math.min(1, Math.max(0, direction === 'upper' ? centre + spread : centre - spread)), intervalPrecision);
}

export function proportion(numerator: number, denominator: number, direction: 'upper' | 'lower', config: AccountingConfig, n = denominator): Published {
  if (!denominator || !n) return null;
  if (n < config.minDenominator) return INSUFFICIENT_EVIDENCE;
  const point = numerator / denominator;
  return { point: round(point, config.intervalPrecision), bound: wilson(point, n, direction, config), n, direction };
}

export function ratio(numerator: number, denominator: number, config: AccountingConfig, n = denominator): Published {
  if (!denominator || !n) return null;
  if (n < config.minDenominator) return INSUFFICIENT_EVIDENCE;
  return { point: round(numerator / denominator, config.intervalPrecision), bound: null, n: denominator, direction: null };
}

/** Resolved/measurable state mechanics; domains decide which rows enter each state. */
export function accountCounts(counts: Partial<Record<(typeof STATUSES)[number], number>>, config: AccountingConfig): AccountedCounts {
  const c = Object.fromEntries(STATUSES.map(s => [s, counts[s] ?? 0])) as Record<(typeof STATUSES)[number], number>;
  const resolved = c.pass + c.fail, total = resolved + c['review-required'] + c['not-measured'];
  return { ...c, total, resolved, unresolved: total - resolved, resolvedRate: proportion(resolved, total, 'lower', config) };
}

export function assertCompatibleIdentities(identities: AccountingArtifactIdentity[]) {
  if (!identities.length) throw new Error('Accounting aggregation needs at least one artifact identity');
  const [first] = identities;
  for (const identity of identities.slice(1)) {
    if (identity.domain !== first.domain) throw new Error(`Cross-domain accounting aggregation is forbidden: ${first.domain} vs ${identity.domain}`);
    if (identity.evaluationProfile !== first.evaluationProfile)
      throw new Error(`Evaluation profiles are not aggregatable: ${first.evaluationProfile} vs ${identity.evaluationProfile}`);
    if (identity.domainAccountingVersion !== first.domainAccountingVersion)
      throw new Error(`Domain accounting versions are not aggregatable: ${first.domainAccountingVersion} vs ${identity.domainAccountingVersion}`);
  }
  return first;
}
