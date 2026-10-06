import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th, gl } from '../contract-sources.ts';
import { handoff, REGISTRY_PIN, HANDOFF_INDEX_583, researchTable, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered, TRUFFLEHOG_DETECTORS, GITLEAKS_CONFIG } from './583-sources.ts';

// Issue #583, slice h: Beta.14 contract for the Fly.io access token (macaroon members `fm1r_`, `fm1a_`, `fm2_`, optionally
// comma-joined with `fo1_`), detector `fly-token`, finding type `fly_access_token` (#1014 rank 20, READY conditional on ruling
// Q7; handoff docs/audits/evidence/1014/fly.md; product redact-secret#1109). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// Authored from the handoff and the provider sources it cites (superfly/macaroon format.go, Fly's own flyctl redaction rule,
// docs.fly.io/security/tokens), never from the product detector. T1 by provider wire-format code (R1) and provider-authored
// redaction rule (R2) for the prefixes, the comma bundle, the alphabet and the absence of an upper bound. The one number that
// is not a provider statement is the 64-character body floor, derived from the 48-byte minimum decoded macaroon: it holds only
// if ruling Q7 (a floor derived from provider wire-format code is T1) is accepted, so `policy-q7-floor` marks the dependency
// (research-hypothesis, provisional). A standalone `fo1_` (no provider-stated length; ruling question Q9) and the `=` padding
// count beyond two are unclaimed and recorded in DISPUTED_PROPERTIES (T0); the scheme (`FlyV1 `) is outside the span.
export const issue = '583h';

const HANDOFF = handoff('fly.md', REGISTRY_PIN);
const RESEARCH = researchTable('5900447016');
const FORMAT_GO = 'https://github.com/superfly/macaroon/blob/a0202e10fd947786884323dcbce46efbe8652171/format.go#L11-L60';
const FLYCTL_REDACT = 'https://github.com/superfly/flyctl/blob/fe73b7215a0ce2ed8e846d927446c1577cbcc217/agent/server/session.go#L685';
const DOCS_TOKENS = 'https://docs.fly.io/security/tokens/';
const FORK_ISSUE = 'https://github.com/Roshan931/flyctl/issues/8';
const GITLEAKS_FLY = 'https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/config/gitleaks.toml#L582-L590';
const TRUFFLEHOG_FLYIO = 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/flyio/flyio.go';
const Q7 = `${HANDOFF_INDEX_583}#ruling-questions-for-the-maintainer`;
const REFS = [HANDOFF, FORMAT_GO, FLYCTL_REDACT, DOCS_TOKENS, RESEARCH, HANDOFF_INDEX_583, Q7, R1014, RULINGS_R2_R8, product(1109), B583];

/** First member (`fm1r_`, `fm1a_` or `fm2_`) with at least 64 body bytes, then any comma-joined member (`fo1_` allowed). Unbounded above. */
export const FLY_TOKEN_PATTERN = '^(?:fm1r_|fm1a_|fm2_)[A-Za-z0-9+/_-]{64,}={0,2}(?:,(?:fm1r_|fm1a_|fm2_|fo1_)[A-Za-z0-9+/_-]+={0,2})*$';

const authored: Record<string, FormatContract> = {
  'fly-token': {
    tier: 'T1',
    pattern: FLY_TOKEN_PATTERN,
    providerSource: provider(FORMAT_GO, 'superfly/macaroon format.go at a0202e1 (labels fm1r, fm1a, fm2, fo1; scheme FlyV1; members split on "," and standard-Base64 decoded) and flyctl agent/server/session.go at fe73b72 (Fly\'s own redaction rule (fo1_|fm1[ar]_|fm2_)[a-zA-Z0-9/+_-]+=*), observed 2026-09-30; docs.fly.io/security/tokens states the fm2_ prefix and a 20-year default lifetime but no length or alphabet', 'first member fm1r_, fm1a_ or fm2_ + at least 64 [A-Za-z0-9+/_-] then up to two =; optional comma-joined members (fm1r_, fm1a_, fm2_, fo1_); no upper bound; no checksum', at),
    corroboration: [th('flyio/flyio', 'flyio'), gl],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1109; #1014 handoff fly.md, READY conditional on Q7). A Fly.io macaroon authorizes the Fly API and Machines API: a deploy, org or read-only token made by `fly tokens create` (20-year default lifetime) acts within its caveats, from one app to a whole organisation, and a `fly auth login` session bundle (fm2_ member, comma, fo1_ member) acts as the user. Tokens live in FLY_API_TOKEN, FLY_ACCESS_TOKEN and CI secrets, where the documented copy step includes the `FlyV1 ` scheme and a space. T1 by provider code: the prefix set, the comma bundle, the alphabet (standard Base64 plus the URL-safe pair) and the absence of an upper bound come from the wire-format code (R1) and Fly\'s own redaction rule (R2). The 64-character floor is derived (a macaroon decodes to at least a 16-byte nonce plus a 32-byte HMAC-SHA256 tail, 48 bytes, 64 Base64 characters) and is T1 only if Q7 is accepted; scanner floors (gitleaks 100, trufflehog 500) are not used. The span starts at the first member prefix; the FlyV1 scheme and its space stay outside it. Excluded: a standalone fo1_ (no provider-stated length, ruling question Q9, unclaimed), a body under 64, fm3_ and other future prefixes, a non-comma separator between members, and the `=` count beyond two. Pinned peers: gitleaks flyio-access-token reads fo1_ + 43 and fm1[ar]_/fm2_ + at least 100 over [a-zA-Z0-9+/] with up to three =; trufflehog 3.97.4 flyio reads `FlyV1 fm<digits>_` + 500 to 700 over [A-Za-z0-9+/=,_-] and so needs the scheme and a long run.',
    fields: [
      field({ field: 'prefix', claim: 'fm1r_, fm1a_ or fm2_ as the first member; fo1_ only as a later comma-joined member', basis: 'provider-code', status: 'frozen', sources: [src(FORMAT_GO, 'labels fm1r, fm1a, fm2, fo1'), src(FLYCTL_REDACT, '(fo1_|fm1[ar]_|fm2_)'), src(DOCS_TOKENS, 'scoped tokens start fm2_')], note: 'R1, R2: a provider-authored prefix set is T1. Matching is case-sensitive and a prefix is closed by _.' }),
      field({ field: 'alphabet', claim: '[A-Za-z0-9+/_-] then optional = padding, up to two', basis: 'provider-code', status: 'frozen', sources: [src(FLYCTL_REDACT, '[a-zA-Z0-9/+_-]+=*'), src(FORMAT_GO, 'base64.StdEncoding.DecodeString for fm* members')], note: 'R1, R2. Standard Base64 plus the URL-safe pair; the redaction rule allows any number of =, a 48-byte-or-longer standard encoding has at most two, so a third = is unclaimed.' }),
      field({ field: 'body-floor', claim: 'at least 64 body characters after the first member prefix', basis: 'provider-code', status: 'frozen', sources: [src(FORMAT_GO, 'Parse decodes fm* members'), src(HANDOFF, 'tier rationale: nonceRndSize 16 + HMAC-SHA256 32 = 48 decoded bytes = 64 Base64 characters')], note: 'Derived from provider code, not stated by the provider: conditional on Q7 (see policy-q7-floor).' }),
      field({ field: 'policy-q7-floor', claim: 'POLICY, not T1: a 64-character floor derived from the minimum decoded macaroon is supported (ruling question Q7, open; recommendation yes). A floor of 100 is the handoff\'s acceptable alternative', basis: 'research-hypothesis', status: 'provisional', sources: [src(Q7, 'Q7: a floor derived from provider wire-format code is T1'), src(HANDOFF, 'tier rationale')], note: 'If Q7 is refused the family drops to issuance-gated (#584) and the body-63 twin is dropped from the asserted set.' }),
      field({ field: 'upper-bound', claim: 'none: a body of 2000 or more characters is one member', basis: 'provider-code', status: 'frozen', sources: [src(FLYCTL_REDACT, '+ with no upper bound'), src(FORK_ISSUE, 'a deploy token measured at 691 characters'), src(HANDOFF, 'supported shape')], note: 'A user-truncated token of at least 64 is still claimed (an intended redaction).' }),
      field({ field: 'bundle', claim: 'members joined by a single comma; a later member is fm1r_, fm1a_, fm2_ or fo1_; a comma followed by anything else ends the run', basis: 'provider-code', status: 'frozen', sources: [src(FORMAT_GO, 'Parse splits on ,; encodeTokens joins with ,'), src(HANDOFF, 'implementation notes')], note: 'The span covers the whole bundle from the first fm member to the last body or = byte.' }),
      field({ field: 'scheme', claim: 'an optional FlyV1 scheme and space precede the first member and are outside the redacted span', basis: 'provider-code', status: 'frozen', sources: [src(FORMAT_GO, 'StripAuthorizationScheme'), src(HANDOFF, 'supported shape: scheme T1, not part of the redacted span')], note: 'The bundle-span fixture asserts exactly this: the span starts at fm.' }),
      field({ field: 'standalone-fo1', claim: 'a bare fo1_ token (43 URL-safe bytes rests on gitleaks) is not claimed', basis: 'tool', status: 'unresolved', sources: [src(GITLEAKS_FLY, 'fo1_[\\w-]{43}'), src(HANDOFF, 'excluded shapes; Q9')], note: 'Authored as an unclaimed twin (DISPUTED_PROPERTIES, T0): no fixture asserts detection or silence.' }),
      field({ field: 'padding-count', claim: 'three or more = after a member is unclaimed (the redaction rule allows any number, gitleaks allows three, a standard encoding of whole bytes has at most two)', basis: 'tool', status: 'unresolved', sources: [src(FLYCTL_REDACT, '=*'), src(GITLEAKS_FLY, '={0,3}')], note: 'Authored as an unclaimed twin (DISPUTED_PROPERTIES, T0).' }),
      field({ field: 'boundary', claim: 'a first prefix glued to an identifier byte ([A-Za-z0-9_-]) before it is not claimed', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'FLY_API_TOKEN / FLY_ACCESS_TOKEN (with the FlyV1 scheme or without), `fly auth token` output, Authorization: FlyV1 (a Bearer header with an fm2_ member is also claimed), CI secrets', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_TOKENS), src(FORK_ISSUE, 'FlyV1 fm2_…,fm2_… deploy token'), src(HANDOFF, 'role and blast radius; overlap and output policy')] }),
      field({ field: 'peer-lag', claim: 'both pinned peers have a Fly rule but with higher floors and, for trufflehog, a required FlyV1 scheme: lag is measured, not assumed', basis: 'tool', status: 'frozen', sources: [src(GITLEAKS_FLY), src(TRUFFLEHOG_FLYIO), src(TRUFFLEHOG_DETECTORS), src(GITLEAKS_CONFIG)] }),
    ],
  },
};

const split = splitRegistered(authored, ['fly-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1227). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only (none: one detector, one family). */
export const contracts: Record<string, FormatContract> = split.contracts;
export const arrivalFamilies: ArrivalFamily[] = [];

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'fly-token': 'documented-24' };
