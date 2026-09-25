import { crc32 } from 'node:zlib';
import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { th, gl, provider, field } from '../contract-sources.ts';

// Issue #212. Owned by that issue only; see docs/specs/beta8-evidence.md.
// Second-wave families, first measured as arrival families; four graduated to
// registry detectors at the f2082ab registry pin (redact-secret#730, PR #763).
// Research handoffs: #226 (Perplexity), #227 (Fireworks AI), #228 (Pinecone), #229 (Slack user token), #230 (GitLab runner
// authentication token); routing in #212's "Agent-processed research handoff"
// comment and #215. Every field below keeps the basis its evidence has: a peer
// rule is `tool`, a provider SDK/CLI/scanner-rule file is `provider-code`, and
// only a provider documentation page is `provider-documentation`.
export const issue = 212;

const at = '2026-09-24';
const src = (url: string, note?: string) => ({ url, observedAt: at, ...(note ? { note } : {}) });

// perplexity-api-key, fireworks-ai-api-key, pinecone-api-key and gitlab-runner-authentication-token graduated to
// registry detectors at f2082ab (redact-secret#730); their contracts are in `registryContracts` below.
/** Families measured here that no registry detector targets. Their ids are case targets, never detector ids. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'pinecone-api-key-legacy', taxonomy: 'pinecone:legacy-api-key', issue,
    reason: 'No product detector exists for Pinecone at the pinned registry revision 2b98027. The legacy key is a bare UUID, lexically identical to Pinecone\'s own project/key/service-account ids, so it is measured separately and only in context (#228). Since product main 2420e80 (redact-secret#766; its ADR docs/decisions/2026-09-24-claim-a-legacy-pinecone-uuid-key-only-under-its-api-key-name.md) the product pinecone-api-key detector (redact-secret#730) owns this family: it claims the legacy UUID at high confidence with the redact action when the UUID is assigned to a Pinecone API-key name (PINECONE_API_KEY, pinecone_api_key, PINECONE_KEY, or api_key/apiKey/Api-Key on a line naming pinecone), and a bare UUID stays unclaimed. It reports the UUID with the same pinecone_api_key finding type as the pcsk_ shape, so the adapter keeps the pinecone-api-key detector id for it (#251, #253), and at the registry pin 3144bb3 this stays a context-gated arrival family rather than a registry id.' },
  { id: 'slack-user-token', taxonomy: 'slack:user-token', issue,
    reason: 'The taxonomy maps slack:user-token to no detector, and the registry\'s slack-token contract is xoxb-only. The product slack-token detector at 2b98027 already accepts a frozen xoxp- grammar (redact-secret#512); that is product behaviour to measure here, not a contract this benchmark inherits. Re-checked at the registry pin f2082ab: redact-secret#730 gives xoxp- its own slack_user_token finding type, still inside the shared slack-token detector, so this stays an arrival family rather than a registry id.' },
];

// --- GitLab routable runner token checksum (provider code, #230 rows 9/10) ---
// lib/authn/token_field/generator/routable_token.rb: the token is
// `<prefix><base64url payload, no padding>.<2-char base36 version>.<2-char
// base36 payload length>` followed by the zero-padded 7-char base36 CRC32 of
// everything before it (prefix included). The generator (fixtures/generated/
// beta8/212.mjs) uses these same helpers over synthetic bytes; the contract's
// `validate` re-checks them so a checksum or length-holder failure twin is
// contract-invalid even though it satisfies the lexical pattern.
export const GITLAB_ROUTABLE_CRC_WIDTH = 7;
export const base36Crc = (text: string) => crc32(Buffer.from(text, 'latin1')).toString(36).padStart(GITLAB_ROUTABLE_CRC_WIDTH, '0');
export function gitlabRoutableValid(value: string): boolean {
  const m = /^(glrt-)([A-Za-z0-9_-]+)\.([0-9a-z]{2})\.([0-9a-z]{2})([0-9a-z]{7})$/.exec(value);
  if (!m) return true; // not the routable branch: the lexical pattern alone decides
  const [, , payload, , length, crc] = m;
  return Number.parseInt(length, 36) === payload.length && base36Crc(value.slice(0, -GITLAB_ROUTABLE_CRC_WIDTH)) === crc;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Contracts for `arrivalFamilies` ids only. A registry detector's contract stays in benchmarks/lib/assessment.ts or a module's `registryContracts`. */
export const contracts: Record<string, FormatContract> = {
  'pinecone-api-key-legacy': {
    tier: 'T3', contextGated: true,
    twinSource: provider('https://docs.pinecone.io/reference/api/authentication', 'Api-Key header and PINECONE_API_KEY', 'the provider documents the API key as sent in the Api-Key header and read from PINECONE_API_KEY; it states no key grammar. The context twins keep the UUID and replace that identifier with a Pinecone project/index/database/service-account id name, whose values the Admin API documents as UUIDs', at),
    review: 'Context-constrained arrival family (#228, #212): a legacy Pinecone API key is a bare 8-4-4-4-12 lowercase-hex UUID, lexically identical to the Pinecone key id, project id, service-account id and any other UUID, so no bare-value rule can separate it. It is recognised only beside a same-line Pinecone API-key identifier (PINECONE_API_KEY, pinecone.init(api_key=...), an Api-Key header to a pinecone.io host), scores as policy, and its twins keep the UUID byte-for-byte and change only that identifier. The UUID shape is corroborated by unpinned tools and community placeholders only (betterleaks pinecone-api-key.1 "version 1 (UUID format)" keyword-gated, GitGuardian "Pinecone API Key" v1); no provider source states it, and whether UUID keys still authenticate or can still be issued is unknown.',
    fields: [
      field({ field: 'value shape', claim: `bare UUID ${UUID}`, basis: 'tool', status: 'provisional', sources: [src('https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/pinecone.go', 'pinecone-api-key.1, keyword-gated, medium confidence'), src('https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/pinecone_api_key')] }),
      field({ field: 'supported context', claim: 'same-line Pinecone API-key identifier or Api-Key header to a pinecone.io host', basis: 'provider-documentation', status: 'frozen', sources: [src('https://docs.pinecone.io/reference/api/authentication', 'Api-Key header and PINECONE_API_KEY env var'), src('https://www.pinecone.io/blog/global-api/', 'legacy pinecone.init(api_key, environment) pairing')] }),
      field({ field: 'issuance status', claim: 'undated switch from UUID to pcsk_; current validity of UUID keys unknown', basis: 'research-hypothesis', status: 'unresolved', sources: [src('https://docs.pinecone.io/release-notes/2026')] }),
    ],
  },
  'slack-user-token': {
    tier: 'T1', pattern: '^xoxp-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]+$',
    providerSource: provider('https://docs.slack.dev/authentication/tokens', 'xoxp- user token, dash-separated sections, secret last', 'the provider states user tokens begin with xoxp-, that tokens are dash-separated sections with the secret last, and shows a three-numeric-section example; it states no section widths or secret alphabet, says pre-August-2016 user tokens may carry 6- or 10-character secrets, and the 2016 token-lengthening changelog warns against relying on perceived token semantics', at),
    references: ['https://docs.slack.dev/changelog/2016/08/23/token-lengthening', 'https://docs.slack.dev/authentication/using-token-rotation/'],
    corroboration: [gl, th('slack/slack')],
    review: 'Lexical separability decided before authoring (#212): the provider-documented xoxp- prefix and the provider example\'s three dash-separated numeric sections followed by a secret section separate a user token from the recorded confusables (public T/U/B ids, masked sections, references, placeholders). The pattern deliberately freezes no numeric width and no secret alphabet or width: those are tool claims (gitleaks slack-user-token 10-13 digits and 28-34 [a-zA-Z0-9-]; noseyparker exactly 12 digits and 32 lowercase hex; trufflehog two sections and an open tail) and Slack says tokens may reach 255 characters. Twins therefore mutate only provider-documented properties (the xox stem and the p letter, the dash separator, the secret section itself). Kept separate and not claimed: rotating xoxe.xoxp- user/config tokens (scope undecided), the Slack CLI service-token xoxp-1-... shape, and the xoxc- browser session token. All three are real secrets and none is a control. The registry\'s detector-coverage slack-token shape-2 fixtures already carry xoxp- positives built to the product\'s frozen grammar; they target slack-token and are not this family\'s evidence.',
    fields: [
      field({ field: 'prefix', claim: 'xoxp-', basis: 'provider-documentation', status: 'frozen', sources: [src('https://docs.slack.dev/authentication/tokens')] }),
      field({ field: 'section structure', claim: 'dash-separated sections, secret last', basis: 'provider-documentation', status: 'frozen', sources: [src('https://docs.slack.dev/authentication/tokens')] }),
      field({ field: 'numeric section count', claim: 'three numeric sections before the secret', basis: 'provider-example', status: 'frozen', sources: [src('https://docs.slack.dev/authentication/tokens', 'example with 3-digit placeholder sections; not copied into any fixture')] }),
      field({ field: 'numeric section widths', claim: '10-13 digits observed by tools (11/10/11, 12/12/12, 13/13/13)', basis: 'tool', status: 'provisional', sources: [src('https://github.com/gitleaks/gitleaks/blob/master/cmd/generate/config/rules/slack.go')], note: 'Not in the pattern; no fixture asserts silence on a width.' }),
      field({ field: 'secret width and alphabet', claim: '32 lowercase hex observed; pre-2016 6 or 10 characters documented', basis: 'provider-example', status: 'provisional', sources: [src('https://docs.slack.dev/authentication/tokens'), src('https://github.com/praetorian-inc/noseyparker/blob/main/crates/noseyparker/data/default/builtin/rules/slack.yml')], note: 'Tools disagree (hex vs [A-Za-z0-9] vs [A-Za-z0-9-]); not frozen.' }),
      field({ field: 'rotating xoxe.xoxp- tokens', claim: 'rotating user tokens and app-config tokens share xoxe.xoxp-', basis: 'provider-documentation', status: 'unresolved', sources: [src('https://docs.slack.dev/authentication/using-token-rotation/')], note: 'Outside this contract until scope is decided; never a benign control.' }),
      field({ field: 'service token', claim: 'truncated xoxp-1-<digits>... example', basis: 'provider-code', status: 'unresolved', sources: [src('https://github.com/slackapi/slack-cli/blob/main/docs/reference/commands/slack_auth_revoke.md')] }),
    ],
  },
};

/**
 * Contracts for this issue's families that graduated to registry detectors (each key is a
 * benchmarks/detectors.json id): perplexity-api-key, fireworks-ai-api-key, pinecone-api-key and
 * gitlab-runner-authentication-token, product detectors since redact-secret#730 (PR #763; registry
 * pinned at f2082ab). Authored under #212 as arrival contracts; merged into the registry contracts by
 * benchmarks/lib/assessment.ts, never duplicated there.
 */
export const registryContracts: Record<string, FormatContract> = {
  'perplexity-api-key': {
    tier: 'T2', pattern: '^pplx-[A-Za-z0-9]{48}$', corroboration: [gl],
    review: 'Graduated arrival contract (registry detector since redact-secret#730). Lexical separability decided before authoring (#212): the provider-documented pplx- prefix plus a fixed 48-character alphanumeric body separates a key from every recorded confusable (pplx- model ids such as pplx-embed-v1-0.6b, package/host names, docs placeholders, masked values), none of which carries a 48-character alphanumeric run after the dash. The prefix is provider-documented (docs.perplexity.ai admin api-key-management); the body width and alphabet are tool-corroborated only (gitleaks 8.30.1 perplexity-api-key, osv-scalibr perplexityapikey, likely one lineage), and flare-redact\'s 40-60 range contradicts the exact 48. The contract is therefore T2: the weakest frozen field its positives and length twins depend on is a peer rule. The gitleaks false-positive convention (pplx- followed by 48 repeated "x") satisfies this pattern and is not authored as a control. The org Analytics API key and MCP OAuth tokens are other Perplexity credentials of undocumented shape; neither is claimed, and neither is a control. An OpenRouter sk-or-v1- key stored in PERPLEXITY_API_KEY is a real secret of another family and is not a control either.',
    fields: [
      field({ field: 'prefix', claim: 'pplx- (lowercase, one dash)', basis: 'provider-documentation', status: 'frozen', sources: [src('https://docs.perplexity.ai/docs/admin/api-key-management', 'auth_token response field shown with a pplx- value; the example body is a shortened placeholder')] }),
      field({ field: 'body length', claim: 'exactly 48 characters after the prefix (53 total)', basis: 'tool', status: 'frozen', sources: [src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'perplexity-api-key: pplx-[a-zA-Z0-9]{48}'), src('https://github.com/google/osv-scalibr/blob/main/veles/secrets/perplexityapikey/detector.go', 'maxTokenLength 53; probably shares lineage with gitleaks')], note: 'Tool-corroborated, not provider-stated. flare-redact perplexity_key uses {40,60}; the 47/49 twins record the peer difference, not a provider exclusion.' }),
      field({ field: 'body alphabet', claim: '[A-Za-z0-9]', basis: 'tool', status: 'frozen', sources: [src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml')], note: 'No provider statement; the official pplx CLI accepts any printable ASCII.' }),
      field({ field: 'analytics-key and MCP OAuth token shapes', claim: 'undocumented; may or may not share pplx-', basis: 'provider-documentation', status: 'unresolved', sources: [src('https://docs.perplexity.ai/docs/admin/computer-analytics-api')] }),
      field({ field: 'checksum, embedded project id, historical versions', claim: 'none documented; pre-2025-04 and pre-2026-04 key shapes unknown', basis: 'research-hypothesis', status: 'unresolved', sources: [src('https://github.com/redact-secret/redact-secret-benchmarks/issues/226')] }),
    ],
  },
  'fireworks-ai-api-key': {
    tier: 'T1', pattern: '^fw_(?:[A-Za-z0-9]{22}|[A-Za-z0-9]{24})$',
    providerSource: provider('https://docs.fireworks.ai/tools-sdks/python-client/the-tutorial', 'fw_-prefixed API key', 'the provider documents only the fw_ prefix (examples are truncated); no body length or alphabet is stated', at),
    references: ['https://github.com/fw-ai/fireconnect', 'https://docs.fireworks.ai/firepass'],
    review: 'Graduated arrival contract (registry detector since redact-secret#730). Lexical separability decided before authoring (#212): the fw_ prefix plus a 22- or 24-character alphanumeric body separates a key from the recorded confusables (fw_version/fw_id/fw_spec identifiers, the console\'s short display prefix, placeholders), none of which carries a 22+ alphanumeric run after fw_. Frozen fields are the provider-documented fw_ prefix and the provider code\'s startsWith("fw_") check (fireconnect key-type.mjs); the body widths are the two widths seen in a small aggregate observation of public values (n=9, #227 row 17) and stay provisional, so the pattern admits exactly the observed widths and no twin or control asserts silence on any other width (23 is not a negative boundary) or on any body alphabet. No pinned peer has a Fireworks rule. Not claimed: an unprefixed legacy key (GitGuardian lists its detector as "Not prefixed"; unconfirmed) and the fpk_ Fire Pass key (a real, separately scoped secret with no public grammar), which is never a control.',
    fields: [
      field({ field: 'prefix', claim: 'fw_ (lowercase, underscore)', basis: 'provider-documentation', status: 'frozen', sources: [src('https://docs.fireworks.ai/tools-sdks/python-client/the-tutorial'), src('https://docs.fireworks.ai/llms-full.txt', 'fw_... in the credential table and 401 guidance')] }),
      field({ field: 'prefix validation', claim: 'provider tooling accepts a key only if it starts with fw_ or fpk_ (case-sensitive)', basis: 'provider-code', status: 'frozen', sources: [src('https://github.com/fw-ai/fireconnect/blob/main/packages/setup-cli/lib/keys/key-type.mjs')] }),
      field({ field: 'body length', claim: '22 or 24 characters (25 or 27 total)', basis: 'maintainer-observation', status: 'provisional', sources: [src('https://github.com/redact-secret/redact-secret-benchmarks/issues/227', 'aggregate prefix/length/charset counts of 9 public values; no value retained')], note: 'Separate observed hypotheses; not a negative boundary.' }),
      field({ field: 'body alphabet', claim: '[A-Za-z0-9]; observed values avoided 0/O/I/l (base58-consistent)', basis: 'maintainer-observation', status: 'provisional', sources: [src('https://github.com/redact-secret/redact-secret-benchmarks/issues/227')], note: 'The base58 reading is an inference; positives stay base58-consistent and no twin mutates the alphabet.' }),
      field({ field: 'fpk_ Fire Pass key', claim: 'documented second prefix under the same env var; body grammar unknown', basis: 'provider-documentation', status: 'unresolved', sources: [src('https://docs.fireworks.ai/firepass')] }),
      field({ field: 'unprefixed legacy key', claim: 'possible older unprefixed format (GitGuardian "Not prefixed")', basis: 'tool', status: 'unresolved', sources: [src('https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/fireworks_ai_api_key')] }),
    ],
  },
  'pinecone-api-key': {
    tier: 'T2', pattern: '^pcsk_[A-Za-z0-9]{5,6}_[A-Za-z0-9]{63}$', corroboration: [th('pinecone/pinecone', 'Pinecone')],
    references: ['https://docs.pinecone.io/reference/api/2026-04/admin/create_api_key'],
    review: 'Graduated arrival contract (registry detector since redact-secret#730). Lexical separability decided before authoring (#212): the pcsk_ prefix with a label segment and a 63-character secret segment separates a current key from every recorded confusable (UUID key/project/service-account ids, index hosts, environment names, masked pcsk*** values). The pcsk_ prefix and the <label>_<secret> segmenting come from provider code (Pinecone CLI help, Python SDK unit tests, the pinecone-io/skills guidance), not provider documentation; the 5-6 label width and 63-character secret come from peer rules (trufflehog 3.97.4 pinecone; betterleaks pinecone-api-key.2, which likely shares its grammar), hence T2. benchmarks/detector-inventory.json records the trufflehog detector as feature-gated (PineconeDetectorEnabled), yet the pinned 3.97.4 filesystem scan reported every pcsk_ positive in this corpus\'s first run (2026-09-24); that inventory contradiction is recorded, not resolved here. Contradiction kept open: Pinecone\'s Admin API documentation and generated SDK models describe new keys as pckey_<public-label>_<unique-key>, a prefix no tool, code sample or observation shows. No fixture asserts silence on pckey_. Legacy bare-UUID keys are the separate context-gated pinecone-api-key-legacy family; service-account client secrets are another credential class and are not controls.',
    fields: [
      field({ field: 'prefix', claim: 'pcsk_', basis: 'provider-code', status: 'frozen', sources: [src('https://github.com/pinecone-io/cli/blob/main/internal/pkg/cli/command/config/set.go'), src('https://github.com/pinecone-io/skills/blob/main/CLAUDE.md')] }),
      field({ field: 'segments', claim: 'pcsk_<label>_<secret>, underscore-separated', basis: 'provider-code', status: 'frozen', sources: [src('https://github.com/pinecone-io/python-sdk/tree/main/tests/unit', 'short stand-in values with a label segment')] }),
      field({ field: 'label width', claim: '5 or 6 alphanumeric characters', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/blob/main/pkg/detectors/pinecone/pinecone.go', 'PR #4917 "verified against real keys"; a 4-character label is rejected by its test')] }),
      field({ field: 'secret width', claim: 'exactly 63 alphanumeric characters (74-75 total)', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/blob/main/pkg/detectors/pinecone/pinecone.go'), src('https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/pinecone.go')], note: 'pleno-dlp\'s looser pcsk_[A-Za-z0-9_]{40,} is recorded as a peer difference.' }),
      field({ field: 'documented pckey_ prefix', claim: 'Admin API docs: new keys have the format pckey_<public-label>_<unique-key>', basis: 'provider-documentation', status: 'unresolved', sources: [src('https://docs.pinecone.io/reference/api/2026-04/admin/create_api_key')], note: 'Contradicts every pcsk_ observation; neither positive nor negative here.' }),
    ],
  },
  'gitlab-runner-authentication-token': {
    tier: 'T2',
    pattern: '^glrt-(?:(?:t[0-9a-f]+_)?[A-Za-z0-9_-]{20}|[A-Za-z0-9_-]{27,300}\\.[0-9a-z]{2}\\.[0-9a-z]{9})$',
    validate: gitlabRoutableValid,
    corroboration: [gl],
    references: ['https://docs.gitlab.com/security/tokens/', 'https://docs.gitlab.com/ci/runners/new_creation_workflow/', 'https://gitlab.com/gitlab-org/security-products/secret-detection/secret-detection-rules'],
    review: 'Graduated arrival contract (registry detector since redact-secret#730). Lexical separability decided before authoring (#212): the provider-documented glrt- prefix plus either a 20-character friendly-token body (optionally after the legacy t<hex>_ partition segment) or the routable <base64url>.<2 base36>.<2 base36 length><7 base36 CRC32> grammar separates a runner authentication token from the recorded confusables (s_<12 hex> system ids, 8-character short_sha values, runner ids, masked/REDACTED values, references). Only the glrt- prefix is provider-documented; the legacy body (Devise friendly_token, 20 chars) and the routable grammar and checksum come from GitLab\'s own code (routable_token.rb, runner.rb) and GitLab\'s provider-authored secret-detection rules, so the contract is T2. The routable checksum is recomputable offline: `validate` re-checks the base36 length holder and the CRC32, and the generator computes both over synthetic bytes. Not claimed: glrtr- tokens (documented prefix for runners registered with a registration token; current shape unverified), instance-prefixed <admin-prefix>-glrt- tokens (self-managed, feature-flagged), the unversioned single-dot routable design form, and exact issuance windows. glrtr- values, GR1348941 registration tokens and other gl-stem tokens are real secrets and are never controls. Pinned peers: gitleaks gitlab-runner-authentication-token matches the 20-character body (truncating longer tokens at 25 bytes) and its routable rule requires a t<d>_ segment and a single dot, so it matches neither GitLab\'s versioned routable shape; trufflehog 3.97.4 has no glrt- detector.',
    fields: [
      field({ field: 'prefix', claim: 'glrt- (glrtr- when created via a registration token)', basis: 'provider-documentation', status: 'frozen', sources: [src('https://docs.gitlab.com/security/tokens/'), src('https://docs.gitlab.com/ci/runners/new_creation_workflow/')], note: 'glrt- only in the pattern; glrtr- is documented but its current shape is unverified.' }),
      field({ field: 'legacy body', claim: '20 characters of [A-Za-z0-9_-] (Devise.friendly_token: urlsafe_base64(15) with lIO0 translated to sxyz)', basis: 'provider-code', status: 'frozen', sources: [src('https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/authn/token_field/base.rb'), src('https://github.com/heartcombo/devise/blob/main/lib/devise.rb')], note: 'The lIO0 exclusion is not in the pattern and no twin relies on it; positives respect it.' }),
      field({ field: 'legacy partition segment', claim: 'optional t<hex partition>_ after glrt- (runner type 1/2/3), stripped as "legacy" by runner.rb', basis: 'provider-code', status: 'provisional', sources: [src('https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/models/ci/runner.rb'), src('https://forum.gitlab.com/t/failure-to-register-runner/122890', 'community sighting of glrt-t3_<20>, 2025-03')], note: 'The minting window is unknown.' }),
      field({ field: 'routable grammar', claim: '<base64url payload>.<2 base36 version>.<2 base36 payload length><7 base36 CRC32>; payload = 16 random bytes + sorted k:v routing lines + 1 length byte', basis: 'provider-code', status: 'frozen', sources: [src('https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/authn/token_field/generator/routable_token.rb'), src('https://gitlab.com/gitlab-org/security-products/secret-detection/secret-detection-rules', 'gitlab_runner_auth_token_routable rule')] }),
      field({ field: 'routable checksum', claim: 'last 7 chars = base36(CRC32(everything before them)), zero-padded; offline-verifiable', basis: 'provider-code', status: 'frozen', sources: [src('https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/authn/token_field/generator/routable_token.rb'), src('https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/routable_tokens/', 'design document (status proposed) states the offline check')] }),
      field({ field: 'routable version', claim: 'TOKEN_VERSION 1, rendered 01; routable runner tokens since GitLab 18.0', basis: 'provider-code', status: 'provisional', sources: [src('https://gitlab.com/gitlab-org/gitlab/-/merge_requests/190340')], note: 'The pattern accepts any 2 base36 characters; positives use 01.' }),
      field({ field: 'glrtr-, instance prefix, unversioned routable form', claim: 'shapes unverified without a self-managed observation', basis: 'research-hypothesis', status: 'unresolved', sources: [src('https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/authn/token_field/prefix_helper.rb'), src('https://github.com/redact-secret/redact-secret-benchmarks/issues/230')] }),
    ],
  },
};

/** The Beta.8 profile each target this issue owns is authored toward (registry detector ids or arrival ids). */
export const profiles: Record<string, FixtureProfile> = {
  'perplexity-api-key': 'arrival-24',
  'fireworks-ai-api-key': 'arrival-24',
  'pinecone-api-key': 'arrival-24',
  'pinecone-api-key-legacy': 'context-48',
  'slack-user-token': 'arrival-24',
  'gitlab-runner-authentication-token': 'arrival-24',
};
