import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, RULINGS_R1_R3, B434, product, at, src, splitGraduated } from './434-sources.ts';

// Issue #434, slice c: Beta.11 contract for the E2B team API key (#860 Tier A, READY; handoff
// docs/audits/evidence/860/e2b.md; product redact-secret#905). Owned by this slice only; see
// docs/specs/beta8-evidence.md.
//
// T1 under ruling R1: the prefix, the 20-random-byte length and the lowercase-hex encoding come from
// the provider's own generator and test in e2b-dev/infra; the docs corroborate the prefix and name
// E2B_API_KEY / X-API-Key. The arrival id is the handoff's detector id, e2b-api-key.
export const issue = '434c';

const INFRA = 'https://github.com/e2b-dev/infra/tree/132dadd2ef55bbac301528500e8a4538caf4b163';
const CONSTANTS = 'https://github.com/e2b-dev/infra/blob/132dadd2ef55bbac301528500e8a4538caf4b163/packages/shared/pkg/keys/constants.go#L3';
const KEY_GO = 'https://github.com/e2b-dev/infra/blob/132dadd2ef55bbac301528500e8a4538caf4b163/packages/shared/pkg/keys/key.go#L15-L74';
const SEED_TEST = 'https://github.com/e2b-dev/infra/blob/132dadd2ef55bbac301528500e8a4538caf4b163/packages/local-dev/seed-local-database_test.go#L307';
const DOCS = 'https://docs.e2b.dev/api-key';
const DEPRECATION = 'https://docs.e2b.dev/migration/access-token-deprecation';
const HANDOFF = handoff('e2b.md');

/** No arrival family remains: the family graduated to a registry detector at the 1127bf9 re-pin (redact-secret PR #938). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'e2b-api-key': {
    tier: 'T1',
    pattern: '^e2b_[0-9a-f]{40}$',
    providerSource: provider(KEY_GO, 'e2b-dev/infra keys: ApiKeyPrefix = "e2b_", keyLength = 20 random bytes, hex.EncodeToString (re-checked 2026-09-28)', 'provider code (ruling R1): e2b_ + exactly 40 lowercase hex (20 random bytes, Go hex encoding), 44 in all, no separator or checksum; the local-dev seed test asserts len(prefix) + 2*20', at),
    corroboration: [],
    references: [DOCS, DEPRECATION, INFRA, CONSTANTS, KEY_GO, SEED_TEST, HANDOFF, HANDOFF_INDEX, R860, RULINGS_R1_R3, product(905), B434],
    review: 'Arrival evidence (#434, product redact-secret#905; #860 handoff e2b.md, READY). T1 under ruling R1 on every fact: the provider\'s generator draws 20 random bytes and hex-encodes them after the e2b_ prefix, and its seed test asserts the 44-byte total; the docs name E2B_API_KEY and show e2b_… placeholders. Without the prefix the body is SHA-1 shaped, so the prefix is load-bearing. Excluded: the retired sk_e2b_ user access token (generation stopped 2026-07-01, tokens stopped working 2026-08-01) is a twin because it is another credential class, uppercase-hex bodies (accepted by the verifier but never issued), 64-hex sandbox tokens (not lexically attributable) and e2b_ package names. Neither pinned peer has an E2B rule.',
    fields: [
      field({ field: 'prefix', claim: 'e2b_', basis: 'provider-code', status: 'frozen', sources: [src(CONSTANTS, 'ApiKeyPrefix = "e2b_"'), src(DOCS, 'e2b_… placeholders')] }),
      field({ field: 'transport', claim: 'the E2B_API_KEY environment variable, sent as X-API-Key', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS)] }),
      field({ field: 'body', claim: 'exactly 40 lowercase hex (20 random bytes); 44 in all', basis: 'provider-code', status: 'frozen', sources: [src(KEY_GO, 'keyLength = 20, hex.EncodeToString'), src(SEED_TEST, 'len(prefix) + 2*20'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'separators', claim: 'none; no checksum', basis: 'provider-code', status: 'frozen', sources: [src(KEY_GO)] }),
      field({ field: 'uppercase-hex', claim: 'the verifier accepts an uppercase-hex body the generator never issues', basis: 'provider-code', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'The contract follows the issued grammar; the uppercase twin records the accepted false negative.' }),
      field({ field: 'retired-user-token', claim: 'sk_e2b_ + 40 hex was the user access token, retired on 2026-08-01', basis: 'provider-documentation', status: 'frozen', sources: [src(DEPRECATION)], note: 'Another credential class: a prefix twin, never a benign control.' }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed; this keeps e2b_ inside sk_e2b_ unclaimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF)] }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no e2b detector directory'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no e2b rule')] }),
    ],
  },
};

const split = splitGraduated(authored, ['e2b-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 1127bf9 re-pin (redact-secret PR #938). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'e2b-api-key': 'documented-24' };
