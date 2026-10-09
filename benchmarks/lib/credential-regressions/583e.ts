import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field, th } from '../contract-sources.ts';
import { handoff, HANDOFF_INDEX_583, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered, TRUFFLEHOG_DETECTORS, REGISTRY_PIN, researchTable } from './583-sources.ts';

// Issue #583, slice e: Beta.14 contract for the Buildkite token detector `buildkite-token` (#1014 rank 16, READY under R2 with
// the Q7 floor question open; handoff docs/audits/evidence/1014/buildkite.md; product redact-secret#1105). Owned by this slice
// only; see docs/specs/beta8-evidence.md.
//
// T1 under R2: the prefix list, the body alphabet, the redaction floor (24) and the cap (2048) are one provider-authored rule
// (buildkite/agent internal/redact/redact.go, merged 2026-09-29), with nine of the prefixes cross-checked against the provider's
// token documentation. No per-type exact length is claimed anywhere (the provider states none), so the contract is the provider's
// own floor-and-cap grammar, not a tighter one. That the floor serves as the T1 floor at all is ruling Q7 (open):
// `policy-q7-floor` marks the dependency, and a refusal changes the floor constant, never the prefix or alphabet claims.
//
// One contract, no arrival families. The product reports seven finding types by role (buildkite_api_access_token, _oauth_token,
// _agent_token, _job_token, _packages_token, _pipeline_token, _portal_token) but every role shares one grammar and differs only
// by prefix, and the handoff lets the maintainer collapse the roles without changing the grammar. A sibling is an arrival family
// only when its grammar or evidence differs from the detector's contract (Square's OAuth secret); here splitting would repeat the
// same claim seven times, so the roles stay on the detector contract and are exercised by one positive per prefix.
export const issue = '583e';

const HANDOFF = handoff('buildkite.md', REGISTRY_PIN);
const REDACT_GO = 'https://github.com/buildkite/agent/blob/4b52e509c730797c2a97487972fdf99477fd07e6/internal/redact/redact.go#L30-L69';
const REDACT_TEST = 'https://github.com/buildkite/agent/blob/4b52e509c730797c2a97487972fdf99477fd07e6/internal/redact/redact_test.go#L128-L190';
const PR_4425 = 'https://github.com/buildkite/agent/pull/4425';
const DOCS = 'https://buildkite.com/docs/platform/security/tokens';
const DOCS_SRC = 'https://github.com/buildkite/docs/blob/0d9908248f21aa3beec6e417de99c6164360e25f/pages/platform/security/tokens.md#L18-L21';
const TRUFFLEHOG_BUILDKITE = 'https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/buildkite/v2/buildkite.go#L27';
/** Q7 (floors for open-ended segments) is asked in the same ruling-questions section of the #1014 roll-up as Q8. */
const Q7 = `${HANDOFF_INDEX_583}#ruling-questions-for-the-maintainer`;
const RESEARCH =researchTable('5900447016');
const REFS = [REDACT_GO, REDACT_TEST, PR_4425, DOCS, DOCS_SRC, HANDOFF, RESEARCH, HANDOFF_INDEX_583, Q7, R1014, RULINGS_R2_R8, product(1105), B583];

/** The 15 provider-listed prefixes (redact.go tokenPrefixes), longer ones first so alternation never shadows. */
export const BUILDKITE_PREFIXES = ['bkjat', 'bkpat', 'bkcqt', 'bkua', 'bkur', 'bktx', 'bkaa', 'bkar', 'bkct', 'bkaj', 'bkpt', 'bkrt', 'bktr', 'bkat', 'bkps'] as const;
export const BUILDKITE_TOKEN_PATTERN = `^(?:${BUILDKITE_PREFIXES.join('|')})_[A-Za-z0-9_.-]{24,2048}$`;

/** No arrival family: the seven finding types share the detector's one grammar (see the header). */
export const arrivalFamilies: ArrivalFamily[] = [];

const shared = [
  field({ field: 'boundary', claim: 'a token glued to an identifier byte ([A-Za-z0-9_-]) on its left is not claimed; the match stops at the first non-body byte', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes')], note: 'Handoff boundary decision, not a provider statement.' }),
  field({ field: 'case', claim: 'prefixes are lowercase and matched case-sensitively; bkua- and bkua. separators are not the prefix', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_GO, 'tokenPrefixes are lowercase with an underscore'), src(HANDOFF, 'test axes')], note: 'The provider rule lists the prefixes with the underscore; case handling is the handoff decision.' }),
  field({ field: 'transport', claim: 'Authorization: Bearer bkua_…; BUILDKITE_API_ACCESS_TOKEN / BUILDKITE_API_TOKEN and BUILDKITE_AGENT_TOKEN in .env, CI config and the MCP server env; buildkite-agent start --token; a ps line with --acquire-job bkjat_…', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS), src(HANDOFF, 'role and blast radius')] }),
  field({ field: 'closed-prefix-list', claim: 'the provider list is closed: an unlisted bk??_ prefix (bkzz_) is not claimed, and the provider test treats it as benign', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_GO, 'tokenPrefixes'), src(HANDOFF, 'excluded shapes')], note: 'A prefix Buildkite adds later is an accepted false negative.' }),
  field({ field: 'placeholders', claim: 'short placeholders (bkjat_encoded-token, bkua_xxx) and the docs mask (bkua_ + 53 *) are below the floor or outside the alphabet and stay unredacted', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_GO, 'floor chosen to leave placeholders like bkjat_encoded-token alone'), src(REDACT_TEST, 'bodies of 23 are not redacted')] }),
];

/** Every contract this slice authored; split at the registry boundary below. */
const authored: Record<string, FormatContract> = {
  'buildkite-token': {
    tier: 'T1',
    pattern: BUILDKITE_TOKEN_PATTERN,
    providerSource: provider(REDACT_GO, 'buildkite/agent internal/redact/redact.go at 4b52e50 (PR #4425, merged 2026-09-29, "Redact Buildkite tokens by prefix in job logs"), observed 2026-09-30, cross-checked against the Buildkite token documentation page', 'one of 15 listed prefixes + _ + 24 to 2048 bytes over [A-Za-z0-9_.-]; no checksum, no per-type length', at),
    corroboration: [th('buildkite/v2/buildkite', 'buildkite')],
    references: REFS,
    review: 'Arrival evidence (#583, product redact-secret#1105; #1014 handoff buildkite.md, READY under R2, Q7 open). Buildkite is a hosted CI/CD platform. An API access token (bkua_) reads and controls pipelines and builds within its scopes; agent, cluster and registration tokens let a machine join a cluster and pull jobs, and with them the secrets and source of every pipeline the queue serves; a job acquisition token (bkjat_) and a job token (bkaj_) are JWTs that let a process act as one job; package registry tokens read or write a private registry; portal tokens and secrets mint ephemeral portal tokens. They appear in CI logs, ps output and agent command lines. T1 under R2: the provider\'s own redactor lists the 15 prefixes, the body alphabet (base64url plus ".", which separates the org-id and JWT parts), the floor 24 (below the provider\'s stated real-token minimum of 38 so truncated ps fragments are still caught, above placeholders such as bkjat_encoded-token) and the cap 2048 (job acquisition tokens are JWTs of several hundred bytes). The documentation lists nine of the prefixes by role (bkua_, bkaa_, bkaj_, bkar_, bkct_, bkpt_, bkpat_, bkps_, bkjat_); bkur_, bktx_, bkcqt_, bkrt_, bktr_ and bkat_ rest on the provider rule and its code comments alone (the same single source, R2). Per-type exact lengths are stated nowhere, so none is claimed: the contract is the provider grammar and no tighter one, which is also the only grammar that stays correct across the org-id.base58, org-id_hex, bare-hex and JWT layouts. The seven product finding types (api access, oauth, agent, job, packages, pipeline, portal) share this grammar and are scored on the detector. Excluded: the legacy unprefixed 40-hex API token and the unprefixed agent token (no distinctive shape), bka_ + 40 alphanumerics (one third-party rule), unlisted bk??_ prefixes, bodies of 23 bytes or fewer. The existing peer rule (trufflehog buildkite/v2) knows only bkua_ + 40 lowercase hex, so every other role and the JWT-body bkjat_/bkaj_ layout is outside it; that lag is measured, not assumed.',
    fields: [
      field({ field: 'prefix', claim: 'one of bkua_, bkur_, bktx_, bkaa_, bkar_, bkct_, bkcqt_, bkaj_, bkjat_, bkpt_, bkrt_, bktr_, bkat_, bkpat_, bkps_', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_GO, 'tokenPrefixes: 15 prefixes, "Keep in sync with app/models/token_prefixes.rb"'), src(DOCS_SRC, 'bkua_, bkaa_, bkaj_, bkar_, bkct_, bkpt_, bkpat_, bkps_, bkjat_ by type'), src(HANDOFF, 'supported shape')], note: 'R2: a provider-authored redaction rule, cross-checked against the docs for nine prefixes; the other six rest on the rule and its comments.' }),
      field({ field: 'body-alphabet', claim: '[A-Za-z0-9_.-] (base64url plus ".")', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_GO, 'the base64url alphabet, plus "." which separates the parts of tokens that embed an organization ID or are JWTs')], note: 'No tighter per-role alphabet is claimed (fixtures show hex, base58 and base64url parts).' }),
      field({ field: 'body-length', claim: '24 to 2048 bytes after the prefix and underscore', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_GO, 'TokenBodyLengthMin = 24, TokenBodyLengthMax = 2048'), src(REDACT_TEST, 'bodies of 23 bytes are not redacted, 24 are')], note: 'The provider\'s own constants. The bound is a provider choice, not a measured token length (real tokens are at least 38).' }),
      field({ field: 'policy-q7-floor', claim: 'POLICY, not T1: the provider redactor\'s floor of 24 serves as the detection floor although real tokens are at least 38 and no alphabet is narrowed (ruling question Q7, open; recommendation yes). A floor of 38 would drop truncated fragments and still keep every placeholder out', basis: 'research-hypothesis', status: 'provisional', sources: [src(Q7, 'Q7: may a derived or narrowing policy floor serve as the T1 floor'), src(HANDOFF, 'implementation notes: floor choice')], note: 'A one-constant change either way. Bodies of 24 to 37 bytes are positives only under this policy; the 23-byte twin is the provider\'s own boundary.' }),
      field({ field: 'jwt-body', claim: 'bkjat_ and bkaj_ bodies are three-part dot-joined JWTs (eyJ header); the whole prefixed JWT is one match, and the prefixed form wins over the jwt detector (R7)', basis: 'provider-code', status: 'frozen', sources: [src(REDACT_TEST, 'bkjat_ is a three-part dot-joined JWT with an eyJ header'), src(HANDOFF, 'overlap and output policy')], note: 'The case the existing bkua_-only peer rule does not know. Co-detection by jwt on the same span is not evidence about this family.' }),
      field({ field: 'trailing-dot-and-cap', claim: 'a trailing "." is a body byte in the provider rule but the detector may trim one trailing run so sentence punctuation is not swallowed; a body of 2049 bytes matches up to the cap and the tail is not part of the finding', basis: 'provider-code', status: 'unresolved', sources: [src(REDACT_GO, 'TokenBodyLengthMax = 2048'), src(HANDOFF, 'implementation notes')], note: 'Authored as unclaimed controls (DISPUTED_PROPERTIES, T0): the span, not the presence, is what differs.' }),
      field({ field: 'unprefixed-and-third-party', claim: 'the legacy bare 40-hex API token, the unprefixed agent token and bka_ + 40 alphanumerics (plenoai only) are not claimed', basis: 'tool', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes')], note: 'Unclaimed.' }),
      field({ field: 'role-per-prefix', claim: 'the role of bkur_, bktx_, bkcqt_, bkrt_, bktr_ and bkat_ (oauth refresh, token exchange, cluster queue, packages registry, pipeline trigger, pipeline access) comes from code comments only', basis: 'provider-code', status: 'unresolved', sources: [src(REDACT_GO, 'prefix comments'), src(HANDOFF, 'supported shape')], note: 'The prefix is claimed; the role label is not.' }),
      ...shared,
      field({ field: 'peer-lag', claim: 'trufflehog buildkite/v2 reads only bkua_ + 40 lowercase hex; every other prefix, any non-hex bkua_ body and the JWT-body layouts are outside it. No gitleaks Buildkite rule is relied on', basis: 'tool', status: 'frozen', sources: [src(TRUFFLEHOG_BUILDKITE, 'bkua_[a-z0-9]{40}'), src(TRUFFLEHOG_DETECTORS)] }),
    ],
  },
};

const split = splitRegistered(authored, ['buildkite-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1214). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only (none). */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'buildkite-token': 'documented-24' };
