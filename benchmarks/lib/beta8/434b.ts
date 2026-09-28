import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX, R860, RULINGS_R1_R3, RULINGS_R2_R8, B434, product, at, src, reason } from './434-sources.ts';

// Issue #434, slice b: Beta.11 contracts for the Trigger.dev environment secret key and personal
// access token (#860 Tier A, READY; handoff docs/audits/evidence/860/trigger-dev.md; product
// redact-secret#904). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 under ruling R1: the additional-key grammar is a regex in the published SDK, and the root and
// PAT grammars are provider generator code; the docs corroborate the prefixes. The handoff routes
// both to one new detector, trigger-dev-token: the environment secret key (root and additional,
// one type) takes the detector id as its arrival id, and the PAT is its own arrival family scored
// by finding type once the product types it.
export const issue = '434b';

const TREE = 'https://github.com/triggerdotdev/trigger.dev/tree/c2b7a72180bbb2dcbc31caa8539e0ca8f8e9e9b8';
const SDK_KEYS = 'https://github.com/triggerdotdev/trigger.dev/blob/c2b7a72180bbb2dcbc31caa8539e0ca8f8e9e9b8/packages/core/src/v3/apiKeys.ts';
const GEN = 'https://github.com/triggerdotdev/trigger.dev/blob/c2b7a72180bbb2dcbc31caa8539e0ca8f8e9e9b8/apps/webapp/app/utils/apiKeys.ts';
const LEGACY_GEN = 'https://github.com/triggerdotdev/trigger.dev/blob/0b35cc35e053bc4a38cbe80ff4d7d543e8cca7d3/apps/webapp/app/models/api-key.server.ts';
const PAT_GEN = 'https://github.com/triggerdotdev/trigger.dev/blob/c2b7a72180bbb2dcbc31caa8539e0ca8f8e9e9b8/apps/webapp/app/services/personalAccessToken.server.ts';
const DOCS_KEYS = 'https://trigger.dev/docs/apikeys';
const HANDOFF = handoff('trigger-dev.md');
const REFS = [DOCS_KEYS, TREE, SDK_KEYS, GEN, LEGACY_GEN, PAT_GEN, HANDOFF, HANDOFF_INDEX, R860, RULINGS_R1_R3, product(904), B434];

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'trigger-dev-token', taxonomy: 'trigger-dev:secret-api-key', issue,
    reason: reason('trigger-dev-token', 'trigger_dev_secret_api_key', 904, 'Root and additional environment keys are one type; the detector id is also this family\'s arrival id, so it graduates when the registry is re-pinned.') },
  { id: 'trigger-dev-personal-access-token', taxonomy: 'trigger-dev:personal-access-token', issue,
    reason: reason('trigger-dev-token', 'trigger_dev_personal_access_token', 904, 'The PAT shares the trigger-dev-token detector, so after the re-pin it stays an arrival family scored by finding type.') },
];

const noPeer = field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no trigger detector directory'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no trigger rule')], note: 'Both pinned peers are silent on the whole family.' });

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'trigger-dev-token': {
    tier: 'T1',
    pattern: '^tr_(?:dev|stg|prod|preview)_(?:sk_[0-9A-Za-z]{24}|[0-9A-Za-z]{24}|[0-9A-Za-z]{20})$',
    providerSource: provider(SDK_KEYS, 'ADDITIONAL_API_KEY_PATTERN in the published SDK core, the webapp customAlphabet([0-9a-zA-Z], 24) generator and the legacy 20-byte root generator at trigger.dev@4.0.0 (re-checked 2026-09-28)', 'provider code (ruling R1): tr_ + one of dev|stg|prod|preview + _sk_ + exactly 24 [0-9A-Za-z] for an additional key, tr_<env>_ + 24 for a current root key and tr_<env>_ + 20 for a legacy root key; the docs corroborate the prefixes', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#904; #860 handoff trigger-dev.md, READY). T1 under ruling R1: the additional-key regex is in the published SDK core, the 24-byte alphanumeric root and the legacy 20-byte root come from the provider\'s generators, and the docs name the prefixes. Root and additional keys are one finding type. Legacy 20-byte roots stay in contract because the research found no statement that they stopped authenticating. Excluded: pk_<env>_ public keys (public by design, benign controls), tr_oat_ organization tokens (no generator found, T0), tr_uat_ and public-access JWTs (the jwt family keeps them, ruling R7), tr_proj_ refs and env slugs outside the four. Neither pinned peer has a Trigger.dev rule.',
    fields: [
      field({ field: 'prefix', claim: 'tr_ + dev|stg|prod|preview + _ (root) or + _sk_ (additional)', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_KEYS), src(SDK_KEYS, 'ADDITIONAL_API_KEY_PATTERN'), src(HANDOFF)] }),
      field({ field: 'env-slugs', claim: 'exactly dev, stg, prod and preview (the EnvSlug union)', basis: 'provider-code', status: 'frozen', sources: [src(SDK_KEYS)], note: 'tr_test_ and tr_staging_ are outside the union and back a prefix twin.' }),
      field({ field: 'body', claim: 'exactly 24 [0-9A-Za-z] (additional and current root); exactly 20 for a legacy root', basis: 'provider-code', status: 'frozen', sources: [src(GEN, 'customAlphabet, length 24'), src(LEGACY_GEN, 'legacy root, length 20'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'separators', claim: '_ only, at the fixed positions; none inside the body; no checksum', basis: 'provider-code', status: 'frozen', sources: [src(SDK_KEYS)] }),
      field({ field: 'boundary', claim: 'a key glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Backs the glue twins.' }),
      field({ field: 'public-key', claim: 'pk_<env>_ + 20 is the public key; the server classifies pk_ as public', basis: 'provider-code', status: 'frozen', sources: [src(HANDOFF, 'excluded shapes')], note: 'Benign controls outside a credential-named assignment; a pk_ value in the secret-key position is a prefix twin.' }),
      field({ field: 'organization-token', claim: 'tr_oat_ organization access tokens exist, with no found generator', basis: 'provider-documentation', status: 'unresolved', sources: [src(HANDOFF, 'T0: length and alphabet unknown')], note: 'Not claimed; no fixture asserts silence on tr_oat_.' }),
      field({ field: 'jwt-siblings', claim: 'tr_uat_ delegated tokens and public access tokens are JWTs that stay with the jwt family', basis: 'provider-documentation', status: 'frozen', sources: [src(RULINGS_R2_R8, 'R7'), src(HANDOFF)], note: 'No fixture of this family carries a JWT.' }),
      noPeer,
    ],
  },
  'trigger-dev-personal-access-token': {
    tier: 'T1',
    pattern: '^tr_pat_[1-9a-km-z]{40}$',
    providerSource: provider(PAT_GEN, 'personalAccessToken.server.ts generator (tr_pat_ + 40 of [1-9a-km-z]); docs name the tr_pat_ prefix', 'provider code (ruling R1): tr_pat_ + exactly 40 lowercase alphanumerics without 0 and l; the docs corroborate the prefix', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#434, product redact-secret#904; #860 handoff trigger-dev.md, READY). T1 under ruling R1: the provider\'s PAT generator emits tr_pat_ plus 40 characters of [1-9a-km-z] (lowercase, no 0, no l), and the docs name the prefix. The PAT acts for a user across projects, so it is its own finding type. Neither pinned peer has a rule.',
    fields: [
      field({ field: 'prefix', claim: 'tr_pat_', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_KEYS), src(PAT_GEN)] }),
      field({ field: 'body', claim: 'exactly 40 of [1-9a-km-z]: lowercase letters and digits without 0 and l', basis: 'provider-code', status: 'frozen', sources: [src(PAT_GEN), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'separators', claim: 'none inside the body; no checksum', basis: 'provider-code', status: 'frozen', sources: [src(PAT_GEN)] }),
      field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF)] }),
      noPeer,
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'trigger-dev-token': 'documented-24',
  'trigger-dev-personal-access-token': 'documented-24',
};
