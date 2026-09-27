import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, provider, field } from '../contract-sources.ts';

// Issue #384, slice c: Beta.10 contract for the ElevenLabs API key (research
// redact-secret#788; product redact-secret#865). Owned by that issue only; see
// docs/specs/beta8-evidence.md.
//
// Tier. No ElevenLabs page or staff statement states a prefix, length or alphabet. The sk_
// prefix and the _residency_<region> suffix appear only in ElevenLabs' own SDK code
// (elevenlabs-python and elevenlabs-js), which the maintainers may rule T1 on the
// huggingface:api-token precedent. Until redact-secret#865 records that ruling the contract is
// T2, with the SDK code recorded as a candidate source; the 48-lowercase-hex body is T2 either
// way (trufflehog v2, betterleaks, about 35 code-search fragments).
export const issue = '384c';

const at = '2026-09-26';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

const EL_SERVER = 'https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/speech_engine/server.py';
const EL_RESOURCE = 'https://github.com/elevenlabs/elevenlabs-python/blob/main/src/elevenlabs/speech_engine/resource.py';
const EL_JS = 'https://github.com/elevenlabs/elevenlabs-js/blob/main/src/wrapper/speech-engine/SpeechEngineResource.ts';
const EL_AUTH = 'https://elevenlabs.io/docs/api-reference/authentication';
const EL_KEYS = 'https://elevenlabs.io/docs/overview/administration/workspaces/api-keys';
const EL_RESIDENCY = 'https://elevenlabs.io/docs/overview/administration/data-residency';
const EL_SA_KEYS = 'https://elevenlabs.io/docs/api-reference/service-accounts/api-keys/create';
const BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/elevenlabs.go';
const STRIPE_KEYS = 'https://docs.stripe.com/keys';
const POLLINATIONS = 'https://github.com/pollinations/pollinations/issues/13183';
const R788 = 'https://github.com/redact-secret/redact-secret/issues/788';
const R865 = 'https://github.com/redact-secret/redact-secret/issues/865';

/** Families measured here that no registry detector targets. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'elevenlabs-api-key', taxonomy: 'elevenlabs:api-key', issue,
    reason: 'No registry detector covers the ElevenLabs key at the pinned product revision: a bare sk_ + 48 hex value and the single-line SDK-argument form are missed today, and only marker-adjacent shapes are caught, under a generic type. redact-secret#865 adds a dedicated detector; until that lands the family is measured as an unscored arrival family.' },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'elevenlabs-api-key': {
    tier: 'T2',
    // The secret span is the sk_ + 48 hex base. The optional provider-code-evidenced suffix _residency_<[a-z0-9]+> is authored as
    // an envelope around it (a region label that may be redacted with the key at no collateral cost), because whether the finding
    // span includes it is redact-secret#865's spec decision and no fixture asserts either reading.
    pattern: '^sk_[0-9a-f]{48}$',
    candidateSource: provider(EL_SERVER, 'SpeechEngineServer docstring api_key="sk_..." and the _residency_ suffix regex in elevenlabs-python and elevenlabs-js', 'ElevenLabs\' own SDK source shows keys written sk_... and parses a data-residency suffix with _residency_[a-z0-9]+$ (elevenlabs-python speech_engine/resource.py, elevenlabs-js SpeechEngineResource.ts). No documentation page states the prefix, a length or an alphabet. Provider code is not documentation, so T1 on it is a maintainer ruling (redact-secret#865, huggingface:api-token precedent)', at),
    corroboration: [th('elevenlabs/v2/elevenlabs', 'ElevenLabs v2: \\b((?:sk)_[a-f0-9]{48})\\b, keyword-gated'), { tool: 'betterleaks', label: 'elevenlabs-api-key: sk_[0-9a-f]{48} beside an elevenlabs keyword (matched case-insensitively)', url: BETTERLEAKS }],
    references: [EL_AUTH, EL_KEYS, EL_RESIDENCY, EL_SA_KEYS, EL_RESOURCE, EL_JS, STRIPE_KEYS, POLLINATIONS, R788, R865],
    review: 'Arrival evidence (#384, product redact-secret#865; research #788). T2 while the T1 ruling on provider SDK code is open: the sk_ prefix and the _residency_<region> suffix rest on ElevenLabs\' own SDK source, the 48-lowercase-hex body on trufflehog\'s v2 detector, betterleaks and about 35 code-search fragments (each fully formed body was 48 hex characters), and no ElevenLabs page states any of it. Both tool rules are keyword-gated on elevenlabs, xi-api-key or xi_api_key; the contract claims the bare shape, as the product issue does, on the strength of the sk_ prefix, so nothing here relies on the gate. sk_ is shared with Stripe (sk_live_, sk_test_, sk_org_) and, by plan, Pollinations (sk_ + 32 characters): the Stripe shape is a prefix twin and a bare sk_ prefix cannot attribute a value. A legacy bare 32-hex form has trufflehog v1 evidence only and stays unasserted either way. Uppercase hex is disputed between the tools (betterleaks matches case-insensitively, trufflehog v2 does not), so no fixture asserts silence on it.',
    fields: [
      field({ field: 'prefix', claim: 'sk_', basis: 'provider-code', status: 'frozen', sources: [src(EL_SERVER, 'docstring api_key="sk_..."'), src(EL_RESOURCE)] }),
      field({ field: 'body', claim: '48 lowercase hexadecimal characters (51 in all)', basis: 'tool', status: 'frozen', sources: [src(th('elevenlabs/v2/elevenlabs').url), src(BETTERLEAKS), src(R788, 'measured fragments, all 48 hex')], note: 'Two tools (Kingfisher aliases betterleaks) and measured samples; no provider statement.' }),
      field({ field: 'body-case', claim: 'uppercase hexadecimal', basis: 'tool', status: 'unresolved', sources: [src(th('elevenlabs/v2/elevenlabs').url, 'case-sensitive [a-f0-9]'), src(BETTERLEAKS, 'semi-generic rule, case-insensitive')], note: 'The tools disagree and no provider source decides it, so no uppercase twin is authored (docs/decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md).' }),
      field({ field: 'residency-suffix', claim: 'an optional _residency_<[a-z0-9]+> suffix for isolated environments (EU, India, Singapore)', basis: 'provider-code', status: 'provisional', sources: [src(EL_RESOURCE, '_RESIDENCY_KEY_SUFFIX = re.compile(r"_residency_[a-z0-9]+$")'), src(EL_JS), src(EL_RESIDENCY, 'a different API URL with a different API key')], note: 'Authored as an envelope beside the secret span; whether the finding includes it is the product\'s decision. No code-search fragment showed the suffix.' }),
      field({ field: 'legacy-form', claim: 'a bare 32-hex key from before the sk_ prefix', basis: 'tool', status: 'unresolved', sources: [src('https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/elevenlabs/v1/elevenlabs.go', 'v1: keyword-context [a-f0-9]{32}')], note: 'No provider source documents a 32-hex key. Not claimed, never a control.' }),
      field({ field: 'header', claim: 'sent in the xi-api-key HTTP header', basis: 'provider-documentation', status: 'frozen', sources: [src(EL_AUTH)] }),
      field({ field: 'sibling-prefixes', claim: 'sk_live_, sk_test_ and sk_org_ are Stripe key types; Pollinations plans sk_ + 32 characters', basis: 'provider-documentation', status: 'frozen', sources: [src(STRIPE_KEYS), src(POLLINATIONS, 'community: a plan, not a shipped format')], note: 'The Stripe shape is a scoped prefix twin (co-detected by stripe-token); it is never a benign control.' }),
      field({ field: 'public-identifiers', claim: 'key_id, hint and hashed_xi_api_key are non-secret listing fields; single-use tokens are a separate credential', basis: 'provider-documentation', status: 'frozen', sources: [src(EL_SA_KEYS), src(EL_AUTH)], note: 'The listing examples are the literal word string, so no shape is claimed for them beyond what the controls construct.' }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'elevenlabs-api-key': 'arrival-24',
};
