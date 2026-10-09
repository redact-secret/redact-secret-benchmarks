import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';

// Issue #263. Owned by that issue only; see docs/specs/beta8-evidence.md.
//
// Empirical fixture-floor raise for ten T2 registry families that candidate mode
// at product 3144bb3 held at provisional only on the fixture-profile cells
// (#206's stable-empirical 40/10/8 and context-constrained-empirical 48/10/10).
// No contract is authored or changed here: every fixture is built against the
// family's existing registry contract (#208, #210, #212, #259). The fixtures
// live in their own corpus, so the 208/210/212/259 source hashes, and with them
// every existing ledger id, are unchanged. This module takes over the profile
// declaration of the ten targets from those modules, because the raise is what
// makes the higher profile the one they are authored toward.
export const issue = 263;
/** No arrival families: all ten targets are registry detectors at the 3144bb3 pin. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {};
/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'gitlab-runner-authentication-token': 'empirical-40',
  'groq-api-key': 'empirical-40',
  'langfuse-secret-key': 'empirical-40',
  'langsmith-api-key': 'empirical-40',
  'neon-api-key': 'empirical-40',
  'perplexity-api-key': 'empirical-40',
  'pinecone-api-key': 'empirical-40',
  'postman-collection-access-key': 'empirical-40',
  'xai-api-key': 'empirical-40',
  'travisci-api-token': 'context-48',
};
