import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #213, corpus key 213d. Owned by that key only; see docs/specs/beta8-evidence.md.
//
// Empirical-route fixture debt for the T2 families #207 did not author: the seven
// families below reach the `empirical-40` fixture profile (#206 `stable-empirical`
// cells) so that, once maintainer-issued #205 observation records land, no fixture
// cell still holds them. The same corpus closes the #206 positive/context debt #207
// left on atlassian-api-token and firebase-server-key (5/10) and supabase-token
// (5/6); those three stay declared by #207's module, which owns their profile.
// Every target maps to a registry detector, so no arrival family is declared and
// every contract stays in benchmarks/lib/assessment.ts. Nothing here records or
// implies an observation: the #205 gate stays the recorded blocker.
export const issue = '213d';
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this key owns is authored toward (registry detector ids). */
export const profiles: Record<string, FixtureProfile> = {
  'databricks-personal-access-token': 'empirical-40',
  'datadog-application-key-legacy': 'empirical-40',
  'mailchimp-api-key': 'empirical-40',
  'mailgun-api-key': 'empirical-40',
  'okta-api-token': 'empirical-40',
  'openai-token': 'empirical-40',
  'postman-api-key': 'empirical-40',
};
