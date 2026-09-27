import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, gl, provider, field } from '../contract-sources.ts';

// Issue #384, slice e: Beta.10 contracts for five unprefixed providers whose research concluded
// "generic coverage sufficient" (research redact-secret#781 Mistral, #782 Cohere, #784 AI21,
// #787 Exa, #789 Deepgram; product redact-secret#868). Owned by that issue only; see
// docs/specs/beta8-evidence.md.
//
// None of the five has a provider-documented key format, so none reaches T1. Each is a
// context-gated family in the Twilio and travisci-api-token mold: the value has no grammar of its
// own, a value is recognised only beside a same-line provider keyword, environment-variable
// name, SDK constructor or host, and its positives score as project policy. There is no bare-value
// claim: a bare 32- or 40-character run is indistinguishable from a hash or another provider's key.
//
//   - Mistral, Cohere, Deepgram: T2, because at least one scanner rule (gitleaks 8.30.1 for
//     Cohere; trufflehog 3.97.4 and betterleaks for Deepgram; osv-scalibr, betterleaks and pleno-dlp
//     for Mistral) fixes the length and the keyword gate.
//   - AI21 and Exa: T0. AI21 has no scanner rule and a single ten-sample maintainer observation
//     of a 32-character mixed alphanumeric shape; Exa has no identifying shape at all (only its key
//     id, team id and user id are documented, as UUIDs). Their contracts record uncertainty and
//     claim nothing more than the keyword gate, which the product issue asks for.
export const issue = '384e';

const at = '2026-09-26';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

const GH_PATTERNS = 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns';
const R867_868 = 'https://github.com/redact-secret/redact-secret/issues/868';
const R781 = 'https://github.com/redact-secret/redact-secret/issues/781';
const R782 = 'https://github.com/redact-secret/redact-secret/issues/782';
const R784 = 'https://github.com/redact-secret/redact-secret/issues/784';
const R787 = 'https://github.com/redact-secret/redact-secret/issues/787';
const R789 = 'https://github.com/redact-secret/redact-secret/issues/789';

const MISTRAL_QUICKSTART = 'https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key';
const MISTRAL_ADMIN = 'https://docs.mistral.ai/admin/identity-access/api-keys';
const MISTRAL_PY = 'https://github.com/mistralai/client-python';
const MISTRAL_SCALIBR = 'https://github.com/google/osv-scalibr/blob/main/veles/secrets/mistralapikey/detector.go';
const MISTRAL_BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/mistral.go';
const MISTRAL_PLENO = 'https://pkg.go.dev/github.com/plenoai/pleno-dlp/pkg/detectors/mistral';

const COHERE_RATE_LIMITS = 'https://docs.cohere.com/docs/rate-limits';
const COHERE_CHECK = 'https://docs.cohere.com/reference/check-api-key';
const COHERE_PY = 'https://github.com/cohere-ai/cohere-python';
const COHERE_GITGUARDIAN = 'https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/cohere_apikey';

const DG_CREATE = 'https://developers.deepgram.com/reference/manage/keys/create';
const DG_AUTH = 'https://developers.deepgram.com/guides/fundamentals/authenticating';
const DG_PY = 'https://github.com/deepgram/deepgram-python-sdk';
const DG_BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/deepgram.go';
const DG_DISCUSSION = 'https://github.com/orgs/deepgram/discussions/577';

const AI21_CREATE = 'https://docs.ai21.com/docs/create-api-key';
const AI21_ENV = 'https://raw.githubusercontent.com/AI21Labs/ai21-python/main/ai21/ai21_env_config.py';
const AI21_HTTP = 'https://raw.githubusercontent.com/AI21Labs/ai21-python/main/ai21/http_client/base_http_client.py';
const AI21_LITELLM = 'https://docs.litellm.ai/docs/providers/ai21';

const EXA_GET_KEY = 'https://exa.ai/docs/reference/team-management/get-api-key';
const EXA_UPDATE_KEY = 'https://exa.ai/docs/reference/team-management/update-api-key';
const EXA_QUICKSTART = 'https://exa.ai/docs/get-started/quickstart';
const EXA_PY = 'https://github.com/exa-labs/exa-py';
const EXA_MCP = 'https://github.com/exa-labs/exa-mcp-server';

const reason = (name: string, note: string) => `No registry detector covers the ${name} key at the pinned product revision: ${note} redact-secret#868 adds keyword-gated contextual coverage where the evidence supports it; until that lands the family is measured as an unscored arrival family.`;

/**
 * Only Exa remains an arrival family: redact-secret#868 (product PR #869, merge cfe2aec) registered mistral-api-key, cohere-api-key,
 * deepgram-api-key and ai21-api-key as detectors, which graduated at that re-pin, but gave Exa no detector of its own.
 */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'exa-api-key', taxonomy: 'exa:api-key', issue, reason: reason('Exa', 'keyword-anchored env, JSON, YAML and header forms are redacted today under generic types by name, while SDK-call arguments (Exa(api_key="..."), new Exa("...")) are missed, and no identifying shape is evidenced.') },
];

/** Contracts for this issue's families that are registry detectors since redact-secret#868 (registry pinned at cfe2aec). */
export const registryContracts: Record<string, FormatContract> = {
  'mistral-api-key': {
    tier: 'T2', contextGated: true,
    pattern: '^[A-Za-z0-9]{32}$',
    corroboration: [{ tool: 'osv-scalibr', label: 'mistralapikey: \\b[A-Za-z0-9]{32}\\b beside a mistral context within 200 characters', url: MISTRAL_SCALIBR }, { tool: 'betterleaks', label: 'mistral-api-key: mistral keyword + [A-Z0-9]{32}, case-insensitive (Kingfisher aliases it)', url: MISTRAL_BETTERLEAKS }, { tool: 'pleno-dlp', label: 'mistral detector: 32-character base62, keyword gate mandatory', url: MISTRAL_PLENO }],
    references: [MISTRAL_QUICKSTART, MISTRAL_ADMIN, MISTRAL_PY, GH_PATTERNS, R781, R867_868],
    review: 'Context-gated arrival family (#384, product redact-secret#868; research #781). No Mistral page or SDK code states a prefix, length or alphabet (the SDK does no validation), so nothing reaches T1. Three tool rules that read as one assertion (osv-scalibr, betterleaks, pleno-dlp) agree on exactly 32 alphanumeric characters with a mandatory Mistral context, and none is a pinned peer. GitHub lists a partner pattern without publishing its shape. The value is recognised only beside a same-line mistral or codestral name, an api.mistral.ai host or a Mistral SDK constructor, so its positives score as project policy and its twins keep the value and change only the context. A bare 32-character run is indistinguishable from an MD5, a request id or another provider\'s key, so no bare-value claim is made. The realtime token (#780, an rt_ shape) and the Codestral key shape are not members of this family.',
    fields: [
      field({ field: 'shape', claim: '32 alphanumeric characters, no prefix', basis: 'tool', status: 'frozen', sources: [src(MISTRAL_SCALIBR), src(MISTRAL_BETTERLEAKS), src(MISTRAL_PLENO)], note: 'Three rules from one assertion; nothing is a measurement of a real key.' }),
      field({ field: 'context', claim: 'a same-line mistral/codestral name, api.mistral.ai host or Mistral constructor', basis: 'tool', status: 'frozen', sources: [src(MISTRAL_SCALIBR, 'context regex within 200 characters'), src(MISTRAL_BETTERLEAKS, 'mistral keyword')] }),
      field({ field: 'body-case', claim: 'upper- and lower-case letters both occur', basis: 'tool', status: 'provisional', sources: [src(MISTRAL_SCALIBR, '[A-Za-z0-9]'), src(MISTRAL_BETTERLEAKS, '[A-Z0-9], case-insensitive')], note: 'The rules agree once case is folded; positives are mixed case.' }),
      field({ field: 'transport', claim: 'MISTRAL_API_KEY, the api_key constructor argument, Authorization: Bearer', basis: 'provider-code', status: 'frozen', sources: [src(MISTRAL_PY, 'api_key=os.getenv("MISTRAL_API_KEY", "")'), src(MISTRAL_QUICKSTART)] }),
      field({ field: 'sibling-shapes', claim: 'the Codestral key and the realtime rt_ token (research #780) are separate credentials whose shape is undecided', basis: 'community', status: 'unresolved', sources: [src(R781, 'Codestral: separate console tab, undocumented shape'), src('https://github.com/redact-secret/redact-secret/issues/780')], note: 'Not claimed; never a control.' }),
    ],
  },
  'cohere-api-key': {
    tier: 'T2', contextGated: true,
    pattern: '^[A-Za-z0-9]{40}$',
    corroboration: [gl],
    references: [COHERE_RATE_LIMITS, COHERE_CHECK, COHERE_PY, COHERE_GITGUARDIAN, GH_PATTERNS, R782, R867_868],
    review: 'Context-gated arrival family (#384, product redact-secret#868; research #782). No Cohere page or SDK code states a prefix, length or alphabet, and no source describes a shape difference between trial and production keys. The 40-alphanumeric shape is one pinned scanner rule: gitleaks 8.30.1 cohere-api-token, which needs a cohere or CO_API_KEY name before an assignment and calls the length an inference. TruffleHog 3.97.4 has no Cohere detector in the file tree checked. GitGuardian reports the detector as not prefixed. The value is recognised only beside a same-line cohere or CO_API_KEY name, a Cohere host or SDK constructor, so its positives score as project policy. A single blog says keys begin co-; it contradicts the two sources above and is not adopted, so no co- twin is authored (a co- key would still contain a valid 40-character run).',
    fields: [
      field({ field: 'shape', claim: '40 alphanumeric characters, no prefix', basis: 'tool', status: 'frozen', sources: [src(gl.url, 'cohere-api-token: [a-zA-Z0-9]{40}, entropy 4')], note: 'One scanner rule; the length is the rule author\'s inference, not provider-stated.' }),
      field({ field: 'context', claim: 'a same-line cohere or CO_API_KEY name before the value', basis: 'tool', status: 'frozen', sources: [src(gl.url)] }),
      field({ field: 'trial-vs-production', claim: 'trial and production keys are one credential family; the difference is entitlement, not shape', basis: 'provider-documentation', status: 'frozen', sources: [src(COHERE_RATE_LIMITS)], note: 'The candidate id premise of a distinct production shape is unsupported.' }),
      field({ field: 'transport', claim: 'CO_API_KEY (documented), COHERE_API_KEY (accepted), Authorization: Bearer', basis: 'provider-code', status: 'frozen', sources: [src(COHERE_PY), src(COHERE_CHECK)] }),
      field({ field: 'co-prefix', claim: 'a co- prefix', basis: 'community', status: 'unresolved', sources: [src('https://getbifrost.ai/guides/api-keys/how-to-get-a-cohere-api-key', 'one vendor blog; contradicts the gitleaks rule and GitGuardian')], note: 'Not adopted and not asserted either way.' }),
      field({ field: 'public-ids', claim: 'organization_id (org_...) and owner_id (user_...) from the check-api-key response are public identifiers', basis: 'provider-documentation', status: 'provisional', sources: [src(COHERE_CHECK)], note: 'Illustrative examples only; backs the public-id controls.' }),
    ],
  },
  'deepgram-api-key': {
    tier: 'T2', contextGated: true,
    // The intersection of trufflehog ([0-9a-z]{40}) and betterleaks ([a-f0-9]{40}); positives are lowercase hex, which both admit.
    pattern: '^[0-9a-f]{40}$',
    corroboration: [th('deepgram/deepgram', 'Deepgram: deepgram keyword + \\b([0-9a-z]{40})\\b'), { tool: 'betterleaks', label: 'deepgram-api-key: deepgram keyword + [a-f0-9]{40}, entropy filter', url: DG_BETTERLEAKS }],
    references: [DG_CREATE, DG_AUTH, DG_PY, DG_DISCUSSION, 'https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/deepgram_api_key', R789, R867_868],
    review: 'Context-gated arrival family (#384, product redact-secret#868; research #789). No Deepgram page or SDK code states a prefix, length or alphabet: the docs\' 32-hex example is an ascending-digit placeholder (1234567890abcdef twice) that the create-key reference gives to both the key and its id. TruffleHog 3.97.4 (keyword deepgram, [0-9a-z]{40}) and betterleaks ([a-f0-9]{40}) agree on 40 characters, and one community post reports a working key of length 40; the tools disagree on whether the alphabet is hex or base36. The contract freezes the hex intersection and asserts nothing on any other letter, so no alphabet or case twin is authored. The value is recognised only beside a same-line deepgram name, host or SDK constructor, so its positives score as project policy. A bare 40-hex run is indistinguishable from a Git SHA-1. The api_key_id shares the key\'s shape in the docs and is a public lookalike; the temporary-key JWT from /auth/grant is a bearer-path credential, not this family.',
    fields: [
      field({ field: 'shape', claim: '40 lowercase hexadecimal characters, no prefix', basis: 'tool', status: 'frozen', sources: [src(th('deepgram/deepgram').url), src(DG_BETTERLEAKS), src(DG_DISCUSSION, 'a user reports a 40-character working key')], note: 'The pinned tool and betterleaks agree on the length; the alphabet is the intersection of two tools.' }),
      field({ field: 'alphabet', claim: 'hex (betterleaks [a-f0-9]) versus base36 (trufflehog [0-9a-z])', basis: 'tool', status: 'unresolved', sources: [src(th('deepgram/deepgram').url), src(DG_BETTERLEAKS)], note: 'The tools disagree and no provider source decides it, so no fixture asserts silence on a non-hex letter or on upper case (docs/decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md).' }),
      field({ field: 'docs-example-length', claim: 'the 32-hex documentation example is a placeholder, not a length statement', basis: 'provider-example', status: 'unresolved', sources: [src(DG_CREATE)], note: 'Whether keys were ever 32 characters is untested; not claimed.' }),
      field({ field: 'context', claim: 'a same-line deepgram name, host or SDK constructor', basis: 'tool', status: 'frozen', sources: [src(th('deepgram/deepgram').url, 'deepgram keyword'), src(DG_BETTERLEAKS)] }),
      field({ field: 'header-scheme', claim: 'Authorization: Token <key> (not Bearer); temporary access tokens are JWTs sent as Bearer', basis: 'provider-documentation', status: 'frozen', sources: [src(DG_AUTH), src('https://developers.deepgram.com/reference/auth/tokens/grant')] }),
      field({ field: 'transport', claim: 'DEEPGRAM_API_KEY, DeepgramClient(api_key=...), createClient(key)', basis: 'provider-code', status: 'frozen', sources: [src(DG_PY)] }),
      field({ field: 'public-ids', claim: 'api_key_id, project ids and dg-request-id values are public identifiers', basis: 'provider-documentation', status: 'provisional', sources: [src(DG_CREATE, 'api_key_id and key share one example shape')], note: 'api_key_id is authored only as a context twin (the value kept, the assignment renamed), never as a benign control.' }),
    ],
  },
  'ai21-api-key': {
    tier: 'T0', contextGated: true,
    pattern: '^[A-Za-z0-9]{32}$',
    candidateSource: provider(AI21_CREATE, 'AI21 Studio "Create new key" (Settings, API Keys)', 'AI21 documents key creation, that a key is shown once and that only its last characters are visible afterwards. It states no prefix, length, alphabet or example. The AI21 SDK sends Authorization: Bearer and does no validation. The 32-alphanumeric shape rests on one maintainer observation of ten distinct AI21Client(api_key="...") literals, not on a provider or scanner source', at),
    references: [AI21_ENV, AI21_HTTP, AI21_LITELLM, R784, R867_868],
    review: 'Context-gated arrival family with a pending contract (#384, product redact-secret#868; research #784). T0: there is no provider statement of any shape and no scanner rule (trufflehog, gitleaks, betterleaks, noseyparker, secretlint and Kingfisher have none; GitHub lists no AI21 row). The only shape evidence is a ten-sample maintainer observation of 32-character mixed-case alphanumeric bodies drawn from AI21Client(api_key="...") fragments in ten repositories, which is n=10 and provider-unconfirmed. It is recorded and used to author positives; it is not corroboration. The value is recognised only beside a same-line AI21_API_KEY name, an api.ai21.com host or an AI21 SDK constructor, so its positives score as project policy; no bare-value claim is made, since a bare 32-character run collides with hashes, UUID fragments and other providers\' keys.',
    fields: [
      field({ field: 'shape', claim: '32 alphanumeric characters, no prefix', basis: 'maintainer-observation', status: 'provisional', sources: [src(R784, 'row 8: ten distinct literals, all 32 characters, [A-Za-z0-9], upper, lower and digit present; values withheld')], note: 'Used to author positives only; no provider or scanner source.' }),
      field({ field: 'context', claim: 'a same-line AI21_API_KEY name, api.ai21.com host or AI21 SDK constructor', basis: 'provider-code', status: 'frozen', sources: [src(AI21_ENV, '_ENV_API_KEY = "AI21_API_KEY"'), src(AI21_HTTP, 'Authorization: Bearer {api_key}')] }),
      field({ field: 'prefix-and-checksum', claim: 'no prefix or checksum was observed or documented', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R784)] }),
      field({ field: 'non-secrets', claim: 'AI21_API_HOST, AI21_API_VERSION, AI21_AWS_REGION and the console\'s masked suffix are not credentials', basis: 'provider-code', status: 'frozen', sources: [src(AI21_ENV)] }),
    ],
  },
};

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'exa-api-key': {
    tier: 'T0', contextGated: true,
    twinSource: provider(EXA_UPDATE_KEY, 'Team Management API key id, teamId and userId (format: uuid)', 'Exa documents the key id, the team id and the user id as UUIDs, and lists a key\'s id, name, rate limit and budget in its response with no field for the secret value. Context twins keep the UUID-shaped value and rename the assignment to one of those identifier names (EXA_KEY_ID, EXA_API_KEY_ID, EXA_TEAM_ID) or a request id, so silence follows from the documented identifier role', at),
    references: [EXA_GET_KEY, EXA_QUICKSTART, EXA_PY, EXA_MCP, R787, R867_868],
    review: 'Context-gated arrival family with a pending contract and no value grammar (#384, product redact-secret#868; research #787). T0: no Exa page, SDK code, scanner rule or observation states the secret\'s prefix, length or alphabet. The only documented UUIDs are the key id, team id and user id; that the secret is itself a UUID is one weak inference from a single code-search fragment, and a claimed exa- prefix from a search-engine summary is untraceable and contradicted by the provider docs. The contract therefore asserts only the keyword gate: a value beside a same-line EXA_API_KEY name, an api.exa.ai host or an Exa SDK constructor scores as project policy, whatever its shape. Positives are UUID-shaped synthetic values used as a carrier for that gate, not as a format claim. A bare UUID is never a positive, since every Exa response carries UUIDs. This family exists so the SDK-call-argument forms, which every generic path misses, are measured; it does not fabricate a contract for the remainder.',
    fields: [
      field({ field: 'secret-shape', claim: 'no identifying prefix, length or alphabet is evidenced', basis: 'research-hypothesis', status: 'unresolved', sources: [src(R787, 'no provider, tool or community source states a shape'), src(EXA_PY, 'the SDK does no validation')], note: 'Not claimed. A UUID-shaped carrier value is used only because one weak fragment suggests it.' }),
      field({ field: 'identifier-fields', claim: 'key id, teamId and userId are UUIDs and public identifiers', basis: 'provider-documentation', status: 'frozen', sources: [src(EXA_UPDATE_KEY, 'format: uuid'), src(EXA_GET_KEY)], note: 'Backs the id-like sibling twins.' }),
      field({ field: 'context', claim: 'EXA_API_KEY, the api_key constructor argument, x-api-key or Authorization: Bearer, and the hosted-MCP exaApiKey query parameter', basis: 'provider-code', status: 'frozen', sources: [src(EXA_PY, 'reads EXA_API_KEY, sends x-api-key'), src(EXA_MCP, 'exaApiKey query, Bearer or x-api-key')] }),
      field({ field: 'service-keys', claim: 'service keys created through the Team Management API are a second credential class of unknown shape', basis: 'provider-documentation', status: 'unresolved', sources: [src(EXA_GET_KEY)], note: 'Not claimed.' }),
      field({ field: 'exa-prefix', claim: 'an exa- prefix', basis: 'community', status: 'unresolved', sources: [src(R787, 'row 8: an untraceable search-summary claim, contradicted by the provider docs')], note: 'Not evidence; not asserted either way.' }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = {
  'mistral-api-key': 'context-48',
  'cohere-api-key': 'context-48',
  'deepgram-api-key': 'context-48',
  'ai21-api-key': 'arrival-24',
  'exa-api-key': 'arrival-24',
};
