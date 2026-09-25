import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, provider, field } from '../contract-sources.ts';

// Issue #208: Beta.8 evidence for the committed AI inference families
// (research #216 xAI, #217 Replicate, #218 Groq, #220 OpenRouter; routed in #208's
// handoff comment). First measured as arrival families; graduated to registry
// detector families when the product registry gained replicate-api-token,
// groq-api-key, xai-api-key and openrouter-api-key (redact-secret#727, PR #759;
// registry pinned at dad7868). The contracts below are unchanged by the
// graduation and stay owned here; benchmarks/lib/assessment.ts merges them into
// the registry contracts. Owned by that issue only; see docs/specs/beta8-evidence.md.
export const issue = 208;

const researched = '2026-09-24';
/** Families measured here that no registry detector targets. All four graduated to registry detectors. */
export const arrivalFamilies: ArrivalFamily[] = [];
/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {};

const REPLICATE_TOKENS = 'https://replicate.com/docs/topics/security/api-tokens';
const XAI_AUTH = 'https://docs.x.ai/developers/rest-api-reference/management/auth';
const OPENROUTER_FORMATS = 'https://openrouter.ai/docs/guides/features/guardrails/secret-formats';

/**
 * Contracts for this issue's families that graduated to registry detectors (each key is a
 * benchmarks/detectors.json id). Authored under #208 as arrival contracts; merged into the
 * registry contracts by benchmarks/lib/assessment.ts, never duplicated there.
 */
export const registryContracts: Record<string, FormatContract> = {
  'replicate-api-token': {
    tier: 'T1',
    // The body class is the union of every source's reading so that no control or twin asserts
    // silence on a '-' or '_' body byte the provider has not ruled out (#208 handoff).
    pattern: '^r8_[A-Za-z0-9_-]{37}$',
    providerSource: provider(REPLICATE_TOKENS, 'Replicate API tokens page ("40-character strings that always start with r8_")', 'Replicate states that API tokens are 40-character strings that always start with r8_, fixing the prefix and a 37-character body. The page states no body alphabet.', researched),
    references: ['https://replicate.com/docs/reference/http', 'https://replicate.com/changelog/2024-04-03-bearer-tokens', 'https://github.com/replicate/replicate-python/blob/main/replicate/client.py'],
    corroboration: [th('replicate/replicate', 'Replicate: \\b(r8_[0-9A-Za-z-_]{37})\\b')],
    review: 'Graduated arrival evidence (#208, registry detector since redact-secret#727; research #217). T1 because every frozen field a positive depends on (prefix, 40-character total) is provider-stated. Positives use an alphanumeric body, which every source admits; the body alphabet stays provisional and no fixture asserts silence on a - or _ body byte.',
    fields: [
      field({ field: 'prefix', claim: 'r8_', basis: 'provider-documentation', status: 'frozen', sources: [{ url: REPLICATE_TOKENS, observedAt: researched }] }),
      field({ field: 'total-length', claim: '40 characters (37-character body after r8_)', basis: 'provider-documentation', status: 'frozen', sources: [{ url: REPLICATE_TOKENS, observedAt: researched }] }),
      field({ field: 'body-alphabet', claim: '[A-Za-z0-9] in every positive; TruffleHog also admits - and _, flare-redact and agent-sweep admit alphanumerics only', basis: 'tool', status: 'provisional',
        sources: [{ url: 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/replicate/replicate.go', observedAt: researched, note: 'body class [0-9A-Za-z-_]{37}; its own test fixture is alphanumeric' },
          { url: 'https://github.com/flare-collection/flare-redact/blob/c652ea7946028b70527069d7c282752b8a0ccee3/spec/detectors.json#L1352', observedAt: researched, note: 'r8_[A-Za-z0-9]{30,45}' }],
        note: 'The provider does not state a charset. The contract pattern admits the union so only a non-word byte counts as an alphabet mutation.' }),
      field({ field: 'header-scheme', claim: 'Authorization: Bearer <token>; the legacy Authorization: Token <token> is still accepted', basis: 'provider-documentation', status: 'frozen',
        sources: [{ url: 'https://replicate.com/changelog/2024-04-03-bearer-tokens', observedAt: researched }, { url: 'https://replicate.com/docs/reference/http', observedAt: researched }] }),
      field({ field: 'sibling-tokens', claim: 'Whether the cog login token (replicate.com/auth/token) or org-owned and default tokens differ in shape from a created API token', basis: 'research-hypothesis', status: 'unresolved',
        sources: [{ url: 'https://github.com/replicate/cog/blob/main/pkg/cli/login.go', observedAt: researched }, { url: 'https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/replicate_user_access_token', observedAt: researched }] }),
    ],
  },
  'xai-api-key': {
    tier: 'T2',
    // '_' (TruffleHog) and '-' (betterleaks) stay admitted: #208 does not assert alphanumeric-only versus underscore.
    pattern: '^xai-[A-Za-z0-9_-]{80}$',
    references: [XAI_AUTH, 'https://docs.x.ai/developers/quickstart', 'https://github.com/BerriAI/litellm/issues/9291'],
    corroboration: [th('xai/xai', 'xAI: \\b(xai-[0-9a-zA-Z_]{80})\\b')],
    review: 'Graduated arrival evidence (#208, registry detector since redact-secret#727; research #216). T2: the xai- prefix is provider-documented, but the 80-character body rests on the provider\'s one example value and a third-party masked key, corroborated by tool rules; xAI states no length or alphabet in prose. Management keys are a separate credential and are not in this family.',
    fields: [
      field({ field: 'prefix', claim: 'xai-', basis: 'provider-documentation', status: 'frozen', sources: [{ url: XAI_AUTH, observedAt: researched }, { url: 'https://docs.x.ai/developers/quickstart', observedAt: researched }] }),
      field({ field: 'body-length', claim: '80 characters after xai-', basis: 'provider-example', status: 'frozen',
        sources: [{ url: XAI_AUTH, observedAt: researched, note: 'one example value in the API-key response schema; the prose states no length' },
          { url: 'https://github.com/BerriAI/litellm/issues/9291', observedAt: researched, note: 'community: a masked real key shows an 80-character body' },
          { url: 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/xai/xai.go', observedAt: researched, note: 'tool: {80}' }],
        note: 'Documented by example plus tool corroboration, not a provider-stated grammar; the contract is T2 for that reason.' }),
      field({ field: 'body-alphabet', claim: '[A-Za-z0-9] in every positive; TruffleHog admits _, betterleaks admits _ and -', basis: 'provider-example', status: 'provisional',
        sources: [{ url: XAI_AUTH, observedAt: researched, note: 'the example body is alphanumeric' }, { url: 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/xai/xai.go', observedAt: researched }],
        note: 'The contract pattern admits _ and - so no control asserts silence on them.' }),
      field({ field: 'right-boundary', claim: 'Behaviour on an 81st word character: TruffleHog \\b rejects, osv-scalibr truncates to 80, Kingfisher anchors exactly', basis: 'tool', status: 'unresolved',
        sources: [{ url: 'https://github.com/google/osv-scalibr/tree/main/veles/secrets/grokxaiapikey', observedAt: researched }] }),
      field({ field: 'management-key', claim: 'Management keys (XAI_MANAGEMENT_KEY) are a separate credential; tools report an xai-token- prefix', basis: 'tool', status: 'unresolved',
        sources: [{ url: 'https://docs.x.ai/developers/management-api-guide', observedAt: researched, note: 'provider: separate credential, no format' }, { url: 'https://github.com/google/osv-scalibr/tree/main/veles/secrets/grokxaiapikey', observedAt: researched, note: 'tool: xai-token-[A-Za-z0-9]{80}' }],
        note: 'Not a member of this family and never used as a benign control of it (a real secret).' }),
    ],
  },
  'groq-api-key': {
    tier: 'T2',
    pattern: '^gsk_[A-Za-z0-9]{52}$',
    references: ['https://console.groq.com/docs/production-readiness/security-onboarding', 'https://console.groq.com/docs/api-reference', 'https://github.com/secretlint/secretlint/tree/master/packages/@secretlint/secretlint-rule-groq'],
    corroboration: [th('groq/groq', 'Groq: \\b(gsk_[a-zA-Z0-9]{52})\\b')],
    review: 'Graduated arrival evidence (#208, registry detector since redact-secret#727; research #218). T2 tool-corroborated candidate: provider pages show the gsk_ prefix only in placeholders and state no length or alphabet; TruffleHog, secretlint, betterleaks and Nosey Parker agree on a 52-character alphanumeric body. The observed WGdyb3FY segment is not encoded, and the unsupported 48-character body proposal is not asserted either way.',
    fields: [
      field({ field: 'prefix', claim: 'gsk_', basis: 'provider-example', status: 'frozen',
        sources: [{ url: 'https://console.groq.com/docs/production-readiness/security-onboarding', observedAt: researched, note: 'placeholder gsk_your_secret_key_here' }, { url: 'https://console.groq.com/docs/echokit', observedAt: researched }] }),
      field({ field: 'body-length-and-alphabet', claim: '52 characters of [A-Za-z0-9] after gsk_', basis: 'tool', status: 'frozen',
        sources: [{ url: 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/groq/groq.go', observedAt: researched },
          { url: 'https://github.com/secretlint/secretlint/tree/master/packages/@secretlint/secretlint-rule-groq', observedAt: researched },
          { url: 'https://github.com/praetorian-inc/noseyparker/blob/main/crates/noseyparker/data/default/builtin/rules/groq.yml', observedAt: researched, note: '{50,54}' }],
        note: 'A four-sample maintainer observation (#218 row 17) agrees on 52 mixed-case alphanumerics; it is corroboration, not #205 intake.' }),
      field({ field: 'fixed-segment', claim: 'Body offsets 20–27 read WGdyb3FY in four observed keys', basis: 'maintainer-observation', status: 'unresolved',
        sources: [{ url: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/218', observedAt: researched }],
        note: 'n=4, undocumented and used by no tool. Not a grammar requirement: positives do not carry it and no fixture asserts silence on its absence.' }),
      field({ field: 'alternate-length', claim: '48-character body (gitleaks PR #2181)', basis: 'community', status: 'unresolved',
        sources: [{ url: 'https://github.com/gitleaks/gitleaks/pull/2181', observedAt: researched }],
        note: 'Contradicted by every tool rule and the observation above; no fixture uses a 48-character body.' }),
      field({ field: 'encoded-form', claim: 'GitHub secret scanning detects Base64-encoded Groq keys', basis: 'tool', status: 'unresolved',
        sources: [{ url: 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns', observedAt: researched }],
        note: 'Whether an encoded key is in family scope is a contract decision #208 has not made; no Base64-of-key fixture is authored.' }),
    ],
  },
  'openrouter-api-key': {
    tier: 'T1',
    pattern: '^sk-or-v1-[0-9a-f]{64}$',
    providerSource: provider(OPENROUTER_FORMATS, 'OpenRouter guardrails secret-formats page ("OpenRouter API key")', 'OpenRouter\'s own secret-formats guardrail describes its API key as sk-or-v1- followed by 64 lowercase hexadecimal characters.', researched),
    references: ['https://openrouter.ai/docs/api/api-reference/api-keys/create-keys', 'https://openrouter.ai/docs/api_reference/authentication', 'https://openrouter.ai/docs/guides/overview/auth/management-api-keys'],
    corroboration: [th('openrouter/openrouter', 'OpenRouter: \\b(sk-or-v1-[0-9a-f]{64})\\b (feature-gated in 3.97.4)')],
    review: 'Graduated arrival evidence (#208, registry detector since redact-secret#727; research #220). A mixed-evidence contract: the prefix and the 64-lowercase-hex body are provider-stated in a guardrail detection description and match the provider\'s create-key example, and every peer rule agrees. Management keys (sk-or-mgmt-) are openrouter:management-api-key, not members of this family, and are never used as benign controls. The public key hash shares the body shape without the prefix.',
    fields: [
      field({ field: 'prefix', claim: 'sk-or-v1-', basis: 'provider-documentation', status: 'frozen', sources: [{ url: OPENROUTER_FORMATS, observedAt: researched }, { url: 'https://openrouter.ai/docs/api/api-reference/api-keys/create-keys', observedAt: researched }] }),
      field({ field: 'body', claim: '64 lowercase hexadecimal characters (73 characters in total)', basis: 'provider-documentation', status: 'frozen',
        sources: [{ url: OPENROUTER_FORMATS, observedAt: researched, note: 'a guardrail detection description, not a key-issuance specification' },
          { url: 'https://openrouter.ai/docs/api/api-reference/api-keys/create-keys', observedAt: researched, note: 'create-key response example, hex-shaped' },
          { url: 'https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/openrouter/openrouter.go', observedAt: researched, note: 'tool: [0-9a-f]{64}' }] }),
      field({ field: 'body-case', claim: 'Whether OpenRouter accepts uppercase hex (betterleaks matches case-insensitively)', basis: 'tool', status: 'unresolved',
        sources: [{ url: 'https://github.com/betterleaks/betterleaks/blob/main/config/betterleaks.toml', observedAt: researched }],
        note: 'No uppercase-hex twin is authored.' }),
      field({ field: 'key-hash', claim: 'The public key hash (/api/v1/keys/{hash}) is 64 lowercase hex with no prefix; its relation to the key is undocumented', basis: 'provider-documentation', status: 'frozen',
        sources: [{ url: 'https://openrouter.ai/docs/api/api-reference/api-keys/create-keys', observedAt: researched }] }),
      field({ field: 'management-key', claim: 'Management keys start with sk-or-mgmt-; body length and alphabet are undocumented', basis: 'provider-documentation', status: 'unresolved',
        sources: [{ url: 'https://openrouter.ai/docs/guides/overview/auth/management-api-keys', observedAt: researched }, { url: 'https://github.com/OpenRouterTeam/terraform-provider-openrouter', observedAt: researched }],
        note: 'A separate family (openrouter:management-api-key), unsupported and unclaimed.' }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids). */
// groq-api-key, xai-api-key: profile declared by #263, which raised them to the empirical floors.
export const profiles: Record<string, FixtureProfile> = {
  'replicate-api-token': 'arrival-24',
  'openrouter-api-key': 'arrival-24',
};
