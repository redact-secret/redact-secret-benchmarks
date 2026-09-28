import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, RULINGS_R2_R8, RULINGS_R1_R3, B434, product, at, src, scoredReason, splitGraduated } from './434-sources.ts';

// Issue #434, slice e: Beta.11 contracts for the Helicone read-write (sk-) and write-only (pk-)
// keys (#860 Tier A, READY; handoff docs/audits/evidence/860/helicone.md; product
// redact-secret#907). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// The provider's worker validation regexes state the prefixes, optional -eu/-rl segments and the
// four 7-byte [a-z0-9] groups, and the server generator builds the proxy key (ruling R1). Ruling R8
// keeps the alphabet at the provider's [a-z0-9]: the base32 narrowing of the third-party library is
// not part of the contract. pk- is a credential (write permission, never documented as public), so
// it is its own finding type and redacted. The read-write key takes the handoff's detector id,
// helicone-api-key, as its arrival id; pk- is its own arrival family scored by finding type.
export const issue = '434e';

const TREE = 'https://github.com/Helicone/helicone/tree/067d9290acb4f1fc9320e902fc67b4b399b50363';
const REGEX = 'https://github.com/Helicone/helicone/blob/067d9290acb4f1fc9320e902fc67b4b399b50363/worker/src/lib/util/apiKeyRegex.ts';
const WEB_GEN = 'https://github.com/Helicone/helicone/blob/067d9290acb4f1fc9320e902fc67b4b399b50363/web/utils/generateAPIKeyHelper.ts';
const KEY_MANAGER = 'https://github.com/Helicone/helicone/blob/067d9290acb4f1fc9320e902fc67b4b399b50363/valhalla/jawn/src/managers/apiKeys/KeyManager.ts';
const DOCS_AUTH = 'https://docs.helicone.ai/helicone-headers/helicone-auth';
const HANDOFF = handoff('helicone.md');
const REFS = [DOCS_AUTH, TREE, REGEX, WEB_GEN, KEY_MANAGER, HANDOFF, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R2_R8, product(907), B434];

/** Sibling types the product reports inside a shared detector under their own finding type: arrival families scored by finding type since the 1127bf9 re-pin. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'helicone-write-api-key', taxonomy: 'helicone:write-api-key', issue,
    reason: scoredReason('helicone-api-key', 'helicone_write_api_key', 907) },
];

const GROUPS = '[a-z0-9]{7}(?:-[a-z0-9]{7}){3}';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const shared = (role: 'sk' | 'pk') => [
  field({ field: 'role-prefix', claim: `${role}- (${role === 'sk' ? 'read-write' : 'write-only'})`, basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_AUTH), src(REGEX)] }),
  field({ field: 'provider-segment', claim: '-helicone', basis: 'provider-code', status: 'frozen', sources: [src(REGEX), src(WEB_GEN)] }),
  field({ field: 'optional-segments', claim: '-eu then -rl, each optional, in that order', basis: 'provider-code', status: 'frozen', sources: [src(REGEX, '-rl added 2025-04-29; re-checked 2026-09-28'), src(DOCS_AUTH, 'eu role')] }),
  field({ field: 'groups', claim: '- + four groups of exactly 7 [a-z0-9], joined by -', basis: 'provider-code', status: 'frozen', sources: [src(REGEX), src(WEB_GEN, 'base32, lowercased'), src(RULINGS_R1_R3, 'R1')] }),
  field({ field: 'alphabet-narrowing', claim: 'the generator library emits RFC 4648 base32 ([a-z2-7], last byte of each group in {a,i,q,y})', basis: 'tool', status: 'unresolved', sources: [src(RULINGS_R2_R8, 'R8: no alphabet narrowing from a third-party library')], note: 'Not enforced and not asserted by any twin: positives stay inside base32 as a generator hint only.' }),
  field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed, so a fifth group or glued suffix is rejected; / delimits the gateway URL-path form', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes, URL path')] }),
  field({ field: 'exact-width-placeholder', claim: `${role}-helicone-xxxxxxx-xxxxxxx-xxxxxxx-xxxxxxx has the exact shape and is claimed (the #867 placeholder precedent)`, basis: 'research-hypothesis', status: 'unresolved', sources: [src(HANDOFF, 'benign list: accepted behavior, not benign')], note: 'An accepted false positive: authored neither as a positive nor as a benign control.' }),
  field({ field: 'unattributable-shapes', claim: 'the legacy bare sk- + 4x7, customer-portal -cp- keys and -gov combinations carry no helicone token or are unresolved', basis: 'provider-code', status: 'frozen', sources: [src(REGEX), src(WEB_GEN, '-gov produced but matched by no worker regex')], note: 'Helicone credentials outside the contract: authored as twins, never as benign controls. -gov is not authored.' }),
  field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no helicone detector directory'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no helicone rule')] }),
];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'helicone-api-key': {
    tier: 'T1',
    pattern: `^sk-helicone-(?:(?:eu-)?(?:rl-)?${GROUPS}|proxy-${GROUPS}-${UUID})$`,
    providerSource: provider(REGEX, 'worker apiKeyRegex.ts (last changed 2025-04-29, re-checked 2026-09-28) and KeyManager.ts proxy-key builder', 'provider validator regexes (ruling R1): sk-helicone- with optional -eu and -rl, then four 7-byte [a-z0-9] groups (43/46/49 in all); the server generator builds sk-helicone-proxy- + the same groups + - + a lowercase UUID (86 in all)', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#907; #860 handoff helicone.md, READY). The read-write key reads every logged prompt and response and administers the org. The provider validator regexes (R1) fix the prefix, segments and four 7-byte groups, the docs name the sk/pk/eu roles, and the server generator builds the proxy key. The alphabet is the provider\'s [a-z0-9] (R8). Excluded: the unattributable legacy bare sk- and -cp- forms (twins, since they are Helicone credentials outside the contract), -gov (unresolved, not authored) and the exact-width all-x placeholder (claimed by the contract, so neither positive nor control). Neither pinned peer has a Helicone rule.',
    fields: [
      ...shared('sk'),
      field({ field: 'proxy-key', claim: 'sk-helicone-proxy- + the four groups + - + a lowercase 8-4-4-4-12 UUID', basis: 'provider-code', status: 'frozen', sources: [src(KEY_MANAGER), src(RULINGS_R1_R3, 'R1')] }),
    ],
  },
  'helicone-write-api-key': {
    tier: 'T1',
    pattern: `^pk-helicone-(?:eu-)?(?:rl-)?${GROUPS}$`,
    providerSource: provider(REGEX, 'worker apiKeyRegex.ts pk- alternatives (re-checked 2026-09-28)', 'provider validator regexes (ruling R1): pk-helicone- with optional -eu and -rl, then four 7-byte [a-z0-9] groups; the docs name pk- as a write-only key', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#907; #860 handoff helicone.md, READY). The write-only key can send requests and logs into the org; no provider source says it is safe to publish (unlike PostHog phc_ or Stripe pk_), so the handoff detects and redacts it under its own type, which a user policy can downgrade. It may appear in the gateway URL path (https://gateway.helicone.ai/<key>/v1/), where / delimits it. Neither pinned peer has a Helicone rule.',
    fields: [
      ...shared('pk'),
      field({ field: 'pk-policy', claim: 'pk- is a credential with write permission, not a public identifier; placing it in a URL path is a transport convenience', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_AUTH), src(HANDOFF, 'decision: pk- policy')] }),
    ],
  },
};

const split = splitGraduated(authored, ['helicone-api-key']);
/** Contracts for this slice's detector-id family, a registry detector since the 1127bf9 re-pin (redact-secret PR #938). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'helicone-api-key': 'documented-24',
  'helicone-write-api-key': 'documented-24',
};
