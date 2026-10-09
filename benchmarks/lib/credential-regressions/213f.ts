import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #213, corpus key 213f. Owned by that key only; see docs/specs/beta8-evidence.md.
//
// Replacement fixtures for docs/decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md:
// the fixtures that asserted a provider-undecided property stay as unscored T0 history,
// and this key re-fills mailgun-api-key, openai-token, databricks-personal-access-token
// and mailchimp-api-key's stable-empirical cells on undisputed properties. Their
// profiles stay declared by 213d; this key only adds fixtures, so it declares no
// profile, arrival family or contract.
export const issue = '213f';
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this key owns is authored toward (registry detector ids). */
export const profiles: Record<string, FixtureProfile> = {};
