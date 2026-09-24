import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { field, th } from '../contract-sources.ts';

// Issue #210. Owned by that issue only; see docs/specs/beta8-evidence.md.
// Research: #219 (langsmith:api-key) and #221 (langfuse:secret-key), both
// Broad-discovery passes observed 2026-09-24. Product counterpart
// redact-secret/redact-secret#728 (blocked by #726); the pinned product
// registry (2b98027) has no detector for either family.
export const issue = 210;

const AT = '2026-09-24';
const LS_DOCS = 'https://docs.langchain.com/langsmith/create-account-api-key';
const LS_OTEL = 'https://docs.langchain.com/langsmith/trace-with-opentelemetry';
const LS_OPENAPI = 'https://api.smith.langchain.com/openapi.json';
const LS_SDK_ANON = 'https://github.com/langchain-ai/langsmith-sdk/blob/main/js/src/anonymizer/index.ts';
const LS_SDK_PROFILES = 'https://github.com/langchain-ai/langsmith-sdk/blob/main/python/langsmith/_internal/_profiles.py';
const LS_TH = 'https://github.com/trufflesecurity/trufflehog/blob/363923b901c911a9164f50b6c423f47c15372b1c/pkg/detectors/langsmith/langsmith.go';
const LS_TITUS = 'https://github.com/praetorian-inc/titus/blob/main/pkg/rule/rules/langchain.yml';
const LS_POLTERGEIST = 'https://github.com/ghostsecurity/poltergeist/blob/main/pkg/rules/langsmith.yaml';
const LS_GH_PATTERNS = 'https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns';
const LS_HELM = 'https://raw.githubusercontent.com/langchain-ai/helm/main/charts/langsmith/values.yaml';
const LS_FORUM = 'https://forum.langchain.com/t/langgraph-deployment-with-langchain-api-key/226';
const LS_CTBB = 'https://lab.ctbb.show/writeups/chaining-service-key-leakage-and-path-confusion-in-langsmith';
const LS_RESEARCH = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/219';

const LF_KEYS = 'https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/packages/shared/src/server/auth/apiKeys.ts';
const LF_KEYS_2023 = 'https://github.com/langfuse/langfuse/blob/763147beed6e/src/features/publicApi/lib/apiKeys.ts';
const LF_AUTH_TEST = 'https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/web/src/__tests__/server/api-auth.servertest.ts';
const LF_INIT = 'https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/web/src/initialize.ts';
const LF_ADMIN = 'https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/web/src/ee/features/admin-api/server/projects/projectById/apiKeys/index.ts';
const LF_GATEWAY = 'https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/web/src/features/ai-gateway/server/apiKey/gatewayApiKeyService.ts';
const LF_GATEWAY_HTTP = 'https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/ai-gateway/src/http.rs';
const LF_PR_17478 = 'https://github.com/langfuse/langfuse/pull/17478';
const LF_SDK = 'https://langfuse.com/docs/observability/sdk/overview';
const LF_PUBLIC_API = 'https://langfuse.com/docs/api-and-data-platform/features/public-api';
const LF_OTEL = 'https://langfuse.com/integrations/native/opentelemetry';
const LF_RBAC = 'https://langfuse.com/docs/administration/rbac';
const LF_WEB_SDK = 'https://langfuse.com/docs/observability/sdk/typescript/guide-web';
const LF_HEADLESS = 'https://langfuse.com/self-hosting/administration/headless-initialization';
const LF_BETTERLEAKS = 'https://github.com/betterleaks/betterleaks/blob/main/config/betterleaks.toml';
const LF_MASKGO = 'https://github.com/koki-develop/mask-go/pull/179';
const LF_RESEARCH = 'https://github.com/redact-secret/redact-secret-benchmarks/issues/221';

/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'langsmith-api-key', taxonomy: 'langsmith:api-key', issue, reason: 'No LangSmith detector exists in the product registry at the pinned sourceRevision (2b98027); redact-secret/redact-secret#728 (blocked by #726) is the open implementation issue.' },
  { id: 'langfuse-secret-key', taxonomy: 'langfuse:secret-key', issue, reason: 'No Langfuse detector exists in the product registry at the pinned sourceRevision (2b98027); redact-secret/redact-secret#728 (blocked by #726) is the open implementation issue.' },
];

/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts. */
export const contracts: Record<string, FormatContract> = {
  'langsmith-api-key': {
    tier: 'T2',
    pattern: '^lsv2_(?:pt|sk)_[0-9a-f]{32}_[0-9a-f]{10}$',
    corroboration: [
      th('langsmith/langsmith'),
      { tool: 'titus (kingfisher.langchain.1/.2)', label: 'langchain.yml', url: LS_TITUS },
      { tool: 'poltergeist', label: 'langsmith.yaml', url: LS_POLTERGEIST },
    ],
    references: [LS_DOCS, LS_OPENAPI, LS_SDK_ANON, LS_RESEARCH],
    review: 'Arrival contract (#210, research #219 observed 2026-09-24). LangSmith\'s own documentation establishes two API-key roles — Personal Access Tokens and workspace/org service keys — their issuance under Settings → API Keys, one-time display and the LANGSMITH_API_KEY / X-API-Key contexts, but states no prefix, length or alphabet. The docs render only masked lsv2_pt_…/lsv2_sk_… forms. The segment grammar lsv2_(pt|sk)_<32 lowercase hex>_<10 lowercase hex> is tool-corroborated: trufflehog 3.97.4\'s langsmith detector matches exactly that (lowercase only), while Titus/Kingfisher and Poltergeist match the same widths case-insensitively. The provider\'s own SDK redactor (provider code) is looser — [A-Za-z0-9]{32,} plus any number of _ tails — and is a redaction heuristic, not a format spec. Uppercase hex is therefore neither claimed nor twinned. The legacy ls__ form, LangSmith license keys, SCIM bearer tokens, OAuth access/refresh tokens, the internal X-Service-Key JWT and the uncorroborated deployment keys (sk-*/dep-srv-*) are separate credentials this contract does not claim; none is used as a benign control. gitleaks 8.30.1 has no LangSmith rule, so a gitleaks miss is the expected peer result.',
    fields: [
      field({ field: 'roles', claim: 'Two API-key roles: Personal Access Token (inherits the creating user\'s permissions) and service key (workspace- or org-scoped). Shown once at creation.', basis: 'provider-documentation', status: 'frozen', sources: [{ url: LS_DOCS, observedAt: AT }] }),
      field({ field: 'contexts', claim: 'LANGSMITH_API_KEY env (legacy LANGCHAIN_API_KEY), X-API-Key header, OTEL_EXPORTER_OTLP_HEADERS x-api-key=<key>; LANGSMITH_WORKSPACE_ID and LANGSMITH_ENDPOINT are non-secret neighbours.', basis: 'provider-documentation', status: 'frozen', sources: [{ url: LS_DOCS, observedAt: AT }, { url: LS_OTEL, observedAt: AT }] }),
      field({ field: 'profile-file', claim: 'SDK profiles in ~/.langsmith/config.json carry api_key; workspace id goes to X-Tenant-Id and is not itself a credential; the env lookup checks LANGSMITH_ then legacy LANGCHAIN_.', basis: 'provider-code', status: 'provisional', sources: [{ url: LS_SDK_PROFILES, observedAt: AT }] }),
      field({ field: 'prefix', claim: 'lsv2_ followed by a role code pt (PAT) or sk (service key) and _.', basis: 'tool', status: 'frozen', sources: [{ url: LS_TH, observedAt: AT }, { url: LS_TITUS, observedAt: AT }, { url: LS_POLTERGEIST, observedAt: AT }], note: 'The docs render masked lsv2_pt_/lsv2_sk_ displays (seen only indirectly, in a search snippet), which agrees but is not a grammar statement. The SDK redactor also keys on lsv2_(pt|sk)_ (provider code).' }),
      field({ field: 'segment-widths', claim: 'Exactly 32 characters, then _, then exactly 10 characters (51 total).', basis: 'tool', status: 'provisional', sources: [{ url: LS_TH, observedAt: AT }, { url: LS_TITUS, observedAt: AT }], note: 'The provider SDK redactor accepts 32+ and any number of tails, and its own test fixture uses a 36-character first segment. Pending the hands-on checklist in #219.' }),
      field({ field: 'alphabet', claim: 'Lowercase hex in both segments.', basis: 'tool', status: 'provisional', sources: [{ url: LS_TH, observedAt: AT }], note: 'trufflehog is lowercase-only; Titus and Poltergeist are case-insensitive; the provider redactor is alphanumeric. Uppercase acceptance is not claimed and no uppercase twin is authored.' }),
      field({ field: 'tail-semantics', claim: 'Whether the 10-character tail is a checksum, key-id fragment or random is not documented.', basis: 'research-hypothesis', status: 'unresolved', sources: [{ url: LS_RESEARCH, observedAt: AT }, { url: LS_HELM, observedAt: AT, note: 'config.apiKeySalt hints at server-side derivation' }] }),
      field({ field: 'legacy-ls__', claim: 'A legacy ls__ key form exists (provider SDK still redacts ls__[A-Za-z0-9]{16,}); its real length and alphabet are not established. Not claimed; only the ls__... placeholder appears, as a placeholder control.', basis: 'provider-code', status: 'unresolved', sources: [{ url: LS_SDK_ANON, observedAt: AT }] }),
      field({ field: 'sibling-credentials', claim: 'License key, SCIM bearer token, OAuth access/refresh tokens, internal X-Service-Key JWT and deployment keys are distinct LangSmith credentials outside this family. Their shapes are unknown or uncorroborated; none is fixtured as a control (they are secrets).', basis: 'provider-documentation', status: 'unresolved', sources: [{ url: 'https://docs.langchain.com/langsmith/smith-api/scim-tokens/create-a-scim-token', observedAt: AT, note: 'SCIM bearer token, shown once; no prefix or example' }, { url: LS_GH_PATTERNS, observedAt: AT, note: 'tool listing: PAT, service key, license key and SCIM bearer token are four distinct types' }, { url: LS_OPENAPI, observedAt: AT }, { url: LS_FORUM, observedAt: AT, note: 'community, uncorroborated sk-*/dep-srv-*' }, { url: LS_CTBB, observedAt: AT, note: 'community write-up of the X-Service-Key JWT' }] }),
    ],
  },
  'langfuse-secret-key': {
    tier: 'T2',
    pattern: '^sk-lf-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    corroboration: [
      th('langfuse/langfuse'),
      { tool: 'betterleaks', label: 'langfuse-secret-key.1', url: LF_BETTERLEAKS },
    ],
    references: [LF_KEYS, LF_SDK, LF_PUBLIC_API, LF_RESEARCH],
    review: 'Arrival contract (#210, research #221 observed 2026-09-24). Covers only issuer-minted keys: Langfuse\'s own key generator (provider code, unchanged from 2023-06 to 2026-09) builds sk-lf-${randomUUID()}, i.e. sk-lf- plus a lowercase RFC 4122 version-4 UUID (42 characters; version nibble 4, variant nibble 8/9/a/b), and uses the same generator for project, organization and AI-gateway keys. Langfuse documentation shows the sk-lf-/pk-lf- prefixes and the contexts (LANGFUSE_SECRET_KEY, SDK constructors, Basic auth public-key:secret-key, OTLP Authorization=Basic) but states no body grammar, so the tier stays T2: the body is provider code corroborated by trufflehog 3.97.4 (which also requires a langfuse keyword and the paired pk) and betterleaks. The public key pk-lf-<uuid> is documented as safe for browser code and is this family\'s public-prefix twin and public-id control. Self-hosted operator-defined keys (headless init accepts any string; the admin API enforces only the sk-lf- prefix) are simply outside the minted-shape claim: none is fixtured, and none is asserted silent. The sk-lf-gw- form appears only in a PR description, Storybook stories and a unit-test fixture; it is recorded, neither claimed nor asserted silent. A base64 Basic-auth blob carries the secret only in encoded form; this contract makes no claim on it and it is not fixtured as a control. gitleaks 8.30.1 has no Langfuse rule.',
    fields: [
      field({ field: 'prefix', claim: 'Secret keys start sk-lf-; the public sibling starts pk-lf-.', basis: 'provider-documentation', status: 'frozen', sources: [{ url: LF_SDK, observedAt: AT }, { url: LF_PUBLIC_API, observedAt: AT }, { url: LF_RBAC, observedAt: AT }] }),
      field({ field: 'public-sibling', claim: 'pk-lf- is the public key; browser SDKs need only it, and Langfuse says never to expose the secret key in frontend code.', basis: 'provider-documentation', status: 'frozen', sources: [{ url: LF_WEB_SDK, observedAt: AT }] }),
      field({ field: 'contexts', claim: 'LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY / LANGFUSE_BASE_URL env; secret_key / secretKey SDK args; Basic auth public-key:secret-key (curl -u); OTLP Authorization=Basic <base64 pk:sk>.', basis: 'provider-documentation', status: 'frozen', sources: [{ url: LF_SDK, observedAt: AT }, { url: LF_PUBLIC_API, observedAt: AT }, { url: LF_OTEL, observedAt: AT }] }),
      field({ field: 'body', claim: 'Lowercase RFC 4122 UUIDv4 (8-4-4-4-12 hex with hyphens; version nibble 4; variant nibble 8/9/a/b), minted by crypto.randomUUID(); 42 characters total.', basis: 'provider-code', status: 'frozen', sources: [{ url: LF_KEYS, observedAt: AT }, { url: LF_KEYS_2023, observedAt: AT, note: 'earliest generator, same shape' }, { url: LF_AUTH_TEST, observedAt: AT, note: 'test comment: UUIDs only use hex digits and hyphens' }] }),
      field({ field: 'body-corroboration', claim: 'Peers match sk-lf- + 8-4-4-4-12 lowercase hex without checking the v4 nibbles; trufflehog also requires a langfuse keyword within 40 characters before and a pk-lf- key.', basis: 'tool', status: 'provisional', sources: [{ url: 'https://github.com/trufflesecurity/trufflehog/blob/main/pkg/detectors/langfuse/langfuse.go', observedAt: AT }, { url: LF_BETTERLEAKS, observedAt: AT }, { url: LF_MASKGO, observedAt: AT, note: 'community; treats uppercase as equivalent' }] }),
      field({ field: 'masked-display', claim: 'Display form is the first 6 characters + "..." + the last 4 (sk-lf-...<4 hex>).', basis: 'provider-code', status: 'provisional', sources: [{ url: LF_KEYS, observedAt: AT }] }),
      field({ field: 'gateway-bearer', claim: 'The AI gateway accepts the secret alone as Authorization: Bearer or x-api-key, with no pk-lf- beside it.', basis: 'provider-code', status: 'provisional', sources: [{ url: LF_GATEWAY_HTTP, observedAt: AT }, { url: LF_GATEWAY, observedAt: AT }] }),
      field({ field: 'self-hosted-values', claim: 'Self-hosted operator-defined keys can be any string (headless init) or any sk-lf- string (admin API). Outside the minted-shape claim; not fixtured and not asserted silent.', basis: 'provider-code', status: 'unresolved', sources: [{ url: LF_INIT, observedAt: AT }, { url: LF_ADMIN, observedAt: AT }, { url: LF_HEADLESS, observedAt: AT }] }),
      field({ field: 'sk-lf-gw-', claim: 'A possible sk-lf-gw- gateway-key shape is mentioned in a PR description and UI stories only; gateway keys on main use the same sk-lf-<uuid> generator. Recorded, not claimed, not asserted silent.', basis: 'provider-code', status: 'unresolved', sources: [{ url: LF_PR_17478, observedAt: AT }, { url: LF_GATEWAY, observedAt: AT }] }),
      field({ field: 'basic-auth-base64', claim: 'In an Authorization: Basic header the secret appears only base64-encoded with its pk. No bare-value claim is made on the encoded form; product handling is reported separately if unsupported.', basis: 'provider-documentation', status: 'unresolved', sources: [{ url: LF_OTEL, observedAt: AT }, { url: LF_PUBLIC_API, observedAt: AT }] }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids). */
export const profiles: Record<string, FixtureProfile> = {
  'langsmith-api-key': 'arrival-24',
  'langfuse-secret-key': 'arrival-24',
};
