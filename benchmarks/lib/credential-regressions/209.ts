import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #209. Owned by that issue only; see docs/specs/beta8-evidence.md.
//
// Documented-stable hardening: seven registry detectors, no arrival families. Their
// contracts stay in benchmarks/lib/assessment.ts, where #209 adds per-field provenance
// (FIELDS_209), the provider-published Confluent CRC32 checksum (`validate`) and the
// documented 41-character HRKU-<uuid> Heroku OAuth generation. The bare-UUID Heroku
// generation is heroku-api-key-legacy's (owned by #207) and is recorded here only as a
// field of heroku-api-key's contract. Report: docs/reports/2026-09-24-beta8-209-first-run.md.
export const issue = 209;
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids). */
export const profiles: Record<string, FixtureProfile> = {
  'azure-devops-personal-access-token': 'documented-24',
  'datadog-application-key': 'documented-24',
  'google-api-key': 'documented-24',
  'heroku-api-key': 'documented-24',
  'notion-token': 'documented-24',
  'confluent-cloud-api-secret': 'documented-24',
  'anthropic-token': 'documented-24',
};
