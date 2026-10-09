import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, REGISTRY_PIN, HANDOFF_INDEX_583, Q8, researchTable, R1014, RULINGS_R2_R8, B583, product, at, src, splitRegistered } from './583-sources.ts';

// Issue #583, slice f: Beta.14 contract for the Pydantic Logfire token namespace `pylf_v<n>_<region>_` (write and read
// tokens, organization and project API keys, the AI Gateway key: one namespace, one finding type; #1014 ranks 17 and 18,
// READY with the Q7 floor ruling open and non-blocking; handoff docs/audits/evidence/1014/pydantic-logfire.md at the
// registry re-pin; product redact-secret#1106). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 is the lexical grammar the provider's two SDK parsers and its own scrubber state: the literal `pylf_v`, digits, `_`, a
// lowercase region, `_`, an optional lowercase-or-uppercase-hex 8-4-4-4-12 organization id and `_`, then an alphanumeric
// body. No provider source states a body width (fixtures and one third-party rule use 44; the provider regex is `+`), so
// the body FLOOR is POLICY (ruling Q7, open, non-blocking): the contract pattern carries the floor of 20 only as the
// narrowing policy the handoff describes, it is recorded in `policy-body-floor` and never as T1, and nothing here asserts
// silence on any value below it (a 19-byte body, the sub-floor placeholders, a body broken by a non-alphanumeric byte
// inside the first 20). Those twins are authored UNCLAIMED (DISPUTED_PROPERTIES, scored T0).
export const issue = '583f';

const AUTH = 'https://github.com/pydantic/logfire/blob/a413dc789002d35cbc3b1a281e0d936c0930762e/logfire-sdk/logfire/_internal/auth.py#L36-L41';
const GATEWAY = 'https://github.com/pydantic/pydantic-ai/blob/b2e37b94a275084716c820065e8c912809daed7c/pydantic_ai_slim/pydantic_ai/providers/gateway.py#L407-L418';
const HANDOFF = handoff('pydantic-logfire.md', REGISTRY_PIN);
const RESEARCH = researchTable('5900446812');
const POLTERGEIST = 'https://github.com/ghostsecurity/poltergeist/blob/main/pkg/rules/logfire.yaml';

/** T1 lexical grammar plus the policy floor of 20 (Q7); the region and version have no policy cap in the pattern. */
export const PYDANTIC_LOGFIRE_PATTERN = '^pylf_v[0-9]+_[a-z]+_(?:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}_)?[A-Za-z0-9]{20,}$';

/** No arrival family: write, read, API and gateway keys share one finding type (pydantic_logfire_token). */
export const arrivalFamilies: ArrivalFamily[] = [];

/** Every contract this slice authored; split at the registry boundary below. */
const authored: Record<string, FormatContract> = {
  'pydantic-logfire-token': {
    tier: 'T1',
    pattern: PYDANTIC_LOGFIRE_PATTERN,
    providerSource: provider(AUTH, 'pydantic/logfire auth.py at a413dc7: ^pylf_v<digits>_<[a-z]+>_ then an optional lowercase-hex 8-4-4-4-12 organization id and _, then [a-zA-Z0-9]+; pydantic-ai gateway.py at b2e37b9 parses ^pylf_v<digits>_<[a-z]+>_[a-zA-Z0-9-_]+$; the provider scrubber lists pylf_v\\d+_ (R1, R2); observed 2026-09-30', 'pylf_v + digits + _ + lowercase region + _ + an optional org UUID + _ + alphanumeric body; no checksum; body width unstated by the provider (floor of 20 is policy, Q7)', at),
    corroboration: [{ tool: 'poltergeist (unpinned)', label: 'pylf_v<digit>_<[a-z]{2}>_<uuid>_[a-z0-9]{44}, case-insensitive (tool-only, T2)', url: POLTERGEIST }],
    references: [AUTH, GATEWAY, HANDOFF, RESEARCH, HANDOFF_INDEX_583, Q8, R1014, RULINGS_R2_R8, product(1106), B583],
    review: 'Arrival evidence (#583, product redact-secret#1106; #1014 handoff pydantic-logfire.md, READY, Q7 non-blocking). A Logfire write token (LOGFIRE_TOKEN) lets the holder send telemetry into a project (pollution, spoofing, quota burn); a read token or API key (LOGFIRE_READ_TOKEN, LOGFIRE_API_KEY, Authorization: Bearer) reads traces that may hold sensitive data and, with scopes, manages projects, tokens and variables; an AI Gateway key (PYDANTIC_AI_GATEWAY_API_KEY) proxies paid LLM inference under the organization\'s spend limits. All four share the pylf_v<n>_<region>_ namespace and no text feature separates them, so there is one family and one finding type. T1 for the lexical grammar under R1 (two provider SDK parsers) and R2 (the provider scrubber\'s own pylf_v\\d+_ rule): the prefix, the version digits, the lowercase region, the optional organization UUID (v2 keys, lower or upper hex) and the alphanumeric body class. The body WIDTH is not a provider statement (the parsers use +; provider test fixtures and one third-party rule agree on 44), so positives are 44 or longer and the floor of 20 is POLICY (Q7), recorded apart and never as T1. Excluded and unclaimed: a body under 20 (placeholders and stubs in provider docs; the provider scrubber still redacts the bare prefix, a stronger posture than this detector takes), bodies containing - or _ that are not a UUID segment (the gateway regex admits them, no provider source issues them; accepted false negative), legacy tokens with no pylf_ prefix, and the v3/v4 80-byte shapes that only a scanner fixture shows. Peers: the handoff records no trufflehog or gitleaks rule for pylf_; lag is measured, not assumed.',
    fields: [
      field({ field: 'prefix', claim: 'pylf_v, one or more digits, _ (the version: v1 write and read tokens, v2 API keys with an organization UUID)', basis: 'provider-code', status: 'frozen', sources: [src(AUTH, 'the anchored pylf_v<digits>_ parser'), src(GATEWAY, 'the second parser, same prefix'), src(HANDOFF, 'supported shape')], note: 'R1 and R2: a provider-parsed, provider-scrubbed prefix is T1. Case-sensitive.' }),
      field({ field: 'region', claim: 'a lowercase [a-z]+ region then _ (us, eu, stagingus, stagingeu, ap in provider code and tests)', basis: 'provider-code', status: 'frozen', sources: [src(AUTH, 'the [a-z]+ region'), src(GATEWAY, 'test_gateway.py regions ap and stagingus'), src(HANDOFF, 'supported shape')], note: 'The provider regex has no cap; the product\'s 2-to-16 cap is a policy and is not asserted (region over 16 letters is unclaimed).' }),
      field({ field: 'organization-id', claim: 'optional 8-4-4-4-12 hex UUID (lower or upper case) followed by _, present on v2 API keys', basis: 'provider-code', status: 'frozen', sources: [src(AUTH, 'the optional UUID segment, new since the step-1 table'), src(HANDOFF, 'staging fixtures use uppercase hex')], note: 'A UUID with a wrong group width is not an organization id; the run then breaks at the first -.' }),
      field({ field: 'body-alphabet', claim: '[A-Za-z0-9]', basis: 'provider-code', status: 'frozen', sources: [src(AUTH, '[a-zA-Z0-9]+'), src(HANDOFF, 'the body class')], note: 'The gateway parser also admits - and _ (the UUID contributes them); a - or _ body that is not a UUID segment is an accepted false negative and is not asserted either way.' }),
      field({ field: 'policy-body-floor', claim: 'POLICY, not T1: a body of at least 20 alphanumerics (ruling question Q7, open, non-blocking; recommendation yes)', basis: 'research-hypothesis', status: 'provisional', sources: [src(Q8, 'Q7: may a narrowing policy floor serve as the T1 floor when no alphabet is narrowed'), src(HANDOFF, 'tier rationale: floor of 20 is below every observed token (44) and removes the documented placeholders')], note: 'If Q7 is refused the floor falls to {1,}. Positives use 44 or longer; no twin or control asserts silence on a body under 20, so the 19-byte twins are unclaimed.' }),
      field({ field: 'observed-width', claim: 'provider fixtures (write, read, v2 with UUID) and one third-party rule use a 44-byte body', basis: 'provider-example', status: 'provisional', sources: [src(HANDOFF, 'provider fixtures (length)'), src(POLTERGEIST, '[a-z0-9]{44}, tool-only')], note: 'Fixtures are synthetic public-test placeholders; only the shape is used. Default positives carry 44, a few carry 64; no exact width is claimed.' }),
      field({ field: 'conflicting-shapes', claim: 'bodies of 19 or fewer, a body broken by - or _ that is not a UUID, a region over 16 letters, a version over 3 digits, and the scanner-only v3/v4 80-byte shapes are unclaimed', basis: 'provider-code', status: 'unresolved', sources: [src(HANDOFF, 'excluded shapes and false-negative boundary'), src(GATEWAY, 'the wider - and _ body class')], note: 'Authored as unclaimed controls where useful (DISPUTED_PROPERTIES, T0): no fixture asserts silence or detection on them.' }),
      field({ field: 'boundary', claim: 'a token glued to an identifier on either side ([A-Za-z0-9_-]) is not claimed: a leading glue byte before pylf, or a trailing - or _ after the body, rejects the run whole', basis: 'research-hypothesis', status: 'frozen', sources: [src(HANDOFF, 'implementation notes: the usual [A-Za-z0-9_-] boundary consumed after the body')], note: 'Handoff boundary decision, not a provider statement.' }),
      field({ field: 'transport', claim: 'LOGFIRE_TOKEN, LOGFIRE_READ_TOKEN, LOGFIRE_API_KEY, PYDANTIC_AI_GATEWAY_API_KEY; logfire.configure(token=...); Authorization: Bearer; OTEL_EXPORTER_OTLP_HEADERS Authorization=', basis: 'provider-documentation', status: 'frozen', sources: [src(HANDOFF, 'role and blast radius; test axes')] }),
      field({ field: 'peer-lag', claim: 'no pinned-peer rule for pylf_ is recorded in the handoff (poltergeist and a dotfile filter are unpinned third-party rules): lag is measured, not assumed', basis: 'tool', status: 'provisional', sources: [src(HANDOFF, 'third-party scanner rules'), src(POLTERGEIST)] }),
    ],
  },
};

const split = splitRegistered(authored, ['pydantic-logfire-token']);
/** Contracts for this slice's detector-id family, a registry detector since the 3b1a5aa re-pin (redact-secret PR #1227). */
export const registryContracts: Record<string, FormatContract> = split.registryContracts;
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = split.contracts;

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'pydantic-logfire-token': 'documented-24' };
