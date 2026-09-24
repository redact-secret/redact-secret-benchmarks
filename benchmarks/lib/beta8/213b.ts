import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #213, batch b (corpus `beta8-213b`). Owned by that batch only; see docs/specs/beta8-evidence.md.
//
// Documented-stable restoration: nine registry detectors that were stable at beta.7 and read
// provisional only on the #239 documented-profile floors. No arrival families and no contract
// change; the contracts stay in benchmarks/lib/assessment.ts. Portfolio:
// docs/reports/2026-09-24-beta8-213-portfolio.md.
export const issue = 213;
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this batch owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'cloudflare-token': 'documented-24',
  'gitlab-token': 'documented-24',
  'private-key': 'documented-24',
  'shopify-token': 'documented-24',
  'stripe-token': 'documented-24',
  'huggingface-token': 'documented-24',
  'pypi-token': 'documented-24',
  'datadog-api-key': 'documented-24',
  'grafana-cloud-access-policy-token': 'documented-24',
};
