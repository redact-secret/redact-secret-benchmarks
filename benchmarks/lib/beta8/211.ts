import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #211. Owned by that issue only; see docs/specs/beta8-evidence.md.
export const issue = 211;
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids). */
export const profiles: Record<string, FixtureProfile> = {};
