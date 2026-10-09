import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #213, corpus key 213e. Owned by that key only; see docs/specs/beta8-evidence.md.
//
// Context-twin debt for datadog-application-key-legacy under the
// `context-constrained-empirical` profile the #177 amendment records it in
// (48 fixtures, 10 twin pairs, 10 context-twin pairs). The family's profile stays
// declared by 213d, which authored its first 40 fixtures; this key only adds
// fixtures, so it declares no profile, arrival family or contract.
export const issue = '213e';
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this key owns is authored toward (registry detector ids). */
export const profiles: Record<string, FixtureProfile> = {};
