import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #213, corpus key 213c (category `beta8-213c`). Owned by that work item only; see
// docs/specs/beta8-evidence.md. Nine T1 documented registry families that were stable at
// beta.7 and read provisional under the Beta.8 criteria only for fixture-profile debt
// (docs/reports/2026-09-24-beta8-213-portfolio.md). Their contracts stay in
// benchmarks/lib/assessment.ts; no arrival family is declared. The same corpus also adds
// #206 untwinned positives for six #209 families, whose profiles #209's module declares.
export const issue = 213;
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this work item owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'grafana-service-account-token': 'documented-24',
  jwt: 'documented-24',
  'netlify-token': 'documented-24',
  'new-relic-license-key': 'documented-24',
  'new-relic-user-api-key': 'documented-24',
  'pulumi-access-token': 'documented-24',
  'supabase-management-token': 'documented-24',
  'terraform-cloud-token': 'documented-24',
  'vault-token': 'documented-24',
};
