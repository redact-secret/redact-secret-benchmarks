import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, researchTable, HANDOFF_INDEX, RULING_QUESTIONS, R1014, RULINGS_R1_R3, RULINGS_R9_R10, B528, product, at, src, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG, scoredReason, splitGraduated } from './528-sources.ts';

// Issue #528, slice b: Beta.12 contracts for the Polar organization access token (polar_oat_) and the other Polar API
// credentials (#1014 rank 2, READY; handoff docs/audits/evidence/1014/polar.md; product redact-secret#1020). Owned by
// this slice only; see docs/specs/beta8-evidence.md.
//
// T1 under R1 and R9: prefixes, the 43-byte body, the alphabet and the 2025-01-02 era change are the provider's server
// code, dated by its commit history. polar_oat_ postdates the switch to 37 alphanumerics plus a 6-character base62
// CRC32, so its body is [A-Za-z0-9]; the other roles take the union of both eras ([A-Za-z0-9_-]). POLICY, not T1: the
// checksum corroborates only and never rejects a shape-valid polar_oat_ match (Q1 open; security-first standing
// decision), so positives are authored with and without a matching checksum.
export const issue = '528b';

const CRYPTO = 'https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/kit/crypto.py#L11-L32';
const ERA = 'https://github.com/polarsource/polar/commit/80fae7fc98';
const OAT_SERVICE = 'https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/organization_access_token/service.py#L42';
const OAT_ADDED = 'https://github.com/polarsource/polar/commit/4639cb7efd';
const PAT_SERVICE = 'https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/personal_access_token/service.py';
const OAUTH_CONSTANTS = 'https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/oauth2/constants.py#L5-L16';
const HANDOFF = handoff('polar.md');
const RESEARCH = researchTable('5900447820');
const REFS = [CRYPTO, ERA, OAT_SERVICE, OAT_ADDED, PAT_SERVICE, OAUTH_CONSTANTS, HANDOFF, RESEARCH, HANDOFF_INDEX, RULING_QUESTIONS, R1014, RULINGS_R1_R3, RULINGS_R9_R10, product(1020), B528];

export const POLAR_OAT_PATTERN = '^polar_oat_[A-Za-z0-9]{43}$';
export const POLAR_API_CREDENTIAL_PATTERN = '^polar_(?:pat|at_u|at_o|rt_u|rt_o|cs|crt)_[A-Za-z0-9_-]{43}$';

/** Sibling types the product reports inside a shared detector under their own finding type: arrival families scored by finding type since the 4fb7882 re-pin. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'polar-api-credential', taxonomy: 'polar:api-credential', issue, reason: scoredReason('polar-token', 'polar_api_credential', 1020) },
];

const shared = [
  field({ field: 'body-length', claim: 'exactly 43 characters after the prefix', basis: 'provider-code', status: 'frozen', sources: [src(CRYPTO, 'era 2: 37 + 6; era 1: token_urlsafe() of 32 bytes, 43 unpadded')] }),
  field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
  field({ field: 'transport', claim: 'POLAR_ACCESS_TOKEN sent as Authorization: Bearer; Polar(access_token=...) and new Polar({ accessToken })', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius; test axes')] }),
  field({ field: 'webhook-secret', claim: 'Polar webhook secrets are whsec_ + 43 from the same generator; stripe-token already reports whsec_ as a Stripe webhook signing secret', basis: 'provider-code', status: 'frozen', sources: [src(CRYPTO), src(HANDOFF, 'excluded shapes')], note: 'Not this family: Polar cannot claim a prefix Stripe owns (misattributed, still redacted). A whsec_ value is authored neither as a positive nor as a control.' }),
  field({ field: 'public-and-short-lived-siblings', claim: 'polar_ci_ is a public OAuth client id (Q5); polar_c_/polar_cl_ checkout client secrets are handed to the browser; session, authorization-code and verification tokens are short-lived', basis: 'provider-code', status: 'frozen', sources: [src(OAUTH_CONSTANTS), src(RULING_QUESTIONS, 'Q5'), src(HANDOFF, 'excluded shapes')], note: 'polar_ci_ and polar_c_ values are benign controls; the short-lived credential prefixes are authored neither way (a later extension may claim them).' }),
  field({ field: 'peer-lag', claim: 'no Polar rule in trufflehog 3.97.4 or gitleaks 8.30.1: both lag on every positive. betterleaks (unpinned, not measured here) uses polar_(oat|pat|at)_[A-Za-z0-9_-]{20,100}, which is wider on length and misses polar_rt_, polar_cs_ and polar_crt_', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_DETECTORS, 'no polar detector directory at the pinned version'), src(GITLEAKS_CONFIG, 'no polar rule'), src(HANDOFF, 'tier rationale: betterleaks is looser and not used')] }),
];

/** Every contract this slice authored; split at the re-pin below. */
const authored: Record<string, FormatContract> = {
  'polar-token': {
    tier: 'T1',
    pattern: POLAR_OAT_PATTERN,
    providerSource: provider(CRYPTO, 'polarsource/polar server/polar/kit/crypto.py (6a4f2f6; current since 80fae7f, 2025-01-02): 37 characters of ascii_letters + digits, then the CRC32 of those 37 bytes in base62 (0-9A-Za-z digit order) zero-padded to 6; organization_access_token/service.py (polar_oat_, added 2025-02-05 in 4639cb7, after the checksum era began); re-checked 2026-09-29', 'polar_oat_ + exactly 43 [A-Za-z0-9] (37 random + 6 checksum), 53 in all; one era', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1020; #1014 handoff polar.md, READY). An organization access token acts on the organization\'s products, checkouts, customers, subscriptions and orders within its scopes. T1 under R1 and R9: the prefix constant, the 43-byte alphanumeric body and its CRC32 base62 checksum are the provider\'s server code, and the service was added after the checksum era began, so there is one era. POLICY, not T1: the checksum corroborates only; a shape-valid body whose last six bytes are not the checksum is still claimed (ruling Q1 is open and the security-first standing decision applies), so positives are authored both with a matching and with a mismatching checksum and no fixture asserts silence on a checksum failure. Excluded: polar_ci_ (public client id), checkout client secrets, short-lived session and verification tokens, and whsec_ webhook secrets (stripe-token owns the prefix). Neither pinned peer has a Polar rule.',
    fields: [
      field({ field: 'prefix', claim: 'polar_oat_', basis: 'provider-code', status: 'frozen', sources: [src(OAT_SERVICE)] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9] (ascii_letters + digits, and a base62 checksum)', basis: 'provider-code', status: 'frozen', sources: [src(CRYPTO), src(OAT_ADDED, 'added 2025-02-05, after the 2025-01-02 checksum era began'), src(RULINGS_R9_R10, 'R9: provider code dated by its history')] }),
      ...shared,
      field({ field: 'checksum', claim: 'the last 6 body bytes are the CRC32 of the first 37 in base62 (0-9A-Za-z digit order), zero-padded', basis: 'provider-code', status: 'frozen', sources: [src(CRYPTO)] }),
      field({ field: 'policy-checksum', claim: 'POLICY, not T1: the checksum is corroboration only and never rejects a shape-valid match', basis: 'research-hypothesis', status: 'frozen', sources: [src(RULING_QUESTIONS, 'Q1: checksum post-checks, open'), src(HANDOFF, 'overlap and output policy: without Q1 the lexical grammar alone is the contract')], note: 'Positives carry both a matching and a mismatching checksum; no twin or control asserts silence on a checksum failure.' }),
    ],
  },
  'polar-api-credential': {
    tier: 'T1',
    pattern: POLAR_API_CREDENTIAL_PATTERN,
    providerSource: provider(CRYPTO, 'polarsource/polar server/polar/kit/crypto.py (6a4f2f6): before 2025-01-02 prefix + secrets.token_urlsafe() (43 unpadded URL-safe Base64), since then 37 alphanumerics + a 6-character base62 CRC32; the prefix constants in personal_access_token/service.py and oauth2/constants.py; re-checked 2026-09-29', 'polar_pat_, polar_at_u_, polar_at_o_, polar_rt_u_, polar_rt_o_, polar_cs_ or polar_crt_ + exactly 43 [A-Za-z0-9_-] (the union of both eras)', at),
    corroboration: [],
    references: REFS,
    review: 'Arrival evidence (#528, product redact-secret#1020; #1014 handoff polar.md, READY). Personal access tokens, OAuth access and refresh tokens, the OAuth client secret and the client registration token act for a user or an organization, or let an integration mint tokens. T1 under R1 and R9: the prefix constants and both eras are the provider\'s server code. The grammar is the union of the two issued grammars: an era-1 body is 43 URL-safe bytes, an era-2 body is 43 alphanumerics (a subset), and no checksum applies to these roles because an era-1 body is all-alphanumeric about a quarter of the time. polar_pat_ is no longer minted but existing tokens are accepted. polar_at_ without its u_/o_ sub-type is not a prefix. The body class contains _ and -, so a trailing byte lengthens the run and no trailing-glue twin is authored (#84). Neither pinned peer has a Polar rule.',
    fields: [
      field({ field: 'prefix', claim: 'polar_pat_, polar_at_u_, polar_at_o_, polar_rt_u_, polar_rt_o_, polar_cs_ or polar_crt_', basis: 'provider-code', status: 'frozen', sources: [src(PAT_SERVICE, 'polar_pat_'), src(OAUTH_CONSTANTS, 'OAuth prefixes')] }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9_-]: era-1 URL-safe Base64, era-2 alphanumerics', basis: 'provider-code', status: 'frozen', sources: [src(CRYPTO), src(ERA, 'the 2025-01-02 switch'), src(RULINGS_R9_R10, 'R9')], note: 'Positives include era-1 bodies with - and _ and era-2 alphanumeric bodies.' }),
      ...shared,
    ],
  },
};

const split = splitGraduated(authored, ['polar-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 4fb7882 re-pin (redact-secret PR #1039). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'polar-token': 'documented-24', 'polar-api-credential': 'documented-24' };
