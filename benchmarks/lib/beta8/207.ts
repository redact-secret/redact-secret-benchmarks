import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #207. Owned by that issue only; see docs/specs/beta8-evidence.md.
// All twelve families already map to registry detectors (benchmarks/support/taxonomy.json),
// so no arrival family is declared; their contracts, with per-field provenance
// (`FIELDS_207`), stay in benchmarks/lib/assessment.ts.
export const issue = 207;
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/**
 * The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids).
 * - documented-24: supabase-token, re-reviewed on the sb_secret_ grammar Supabase now documents (#231).
 * - empirical-40: families with a value grammar corroborated by tools, community and provider code. #205's
 *   provider-issued observation gate does not exist yet, so the fixture structure is authored and that gate
 *   stays the recorded blocker; nothing here claims empirical stability.
 * - context-48: opaque or context-gated values (Twilio, generic bearer, heroku and confluent legacy). No
 *   bare-value claim; ten context-twin pairs each.
 */
export const profiles: Record<string, FixtureProfile> = {
  'supabase-token': 'documented-24',
  'atlassian-api-token': 'empirical-40',
  'firebase-server-key': 'empirical-40',
  'sentry-org-auth-token': 'empirical-40',
  'sentry-user-auth-token': 'empirical-40',
  'telegram-bot-token': 'empirical-40',
  'discord-bot-token': 'empirical-40',
  'twilio-auth-token': 'context-48',
  'twilio-api-key-secret': 'context-48',
  'heroku-api-key-legacy': 'context-48',
  'confluent-cloud-api-secret-legacy': 'context-48',
  'bearer-token': 'context-48',
};
