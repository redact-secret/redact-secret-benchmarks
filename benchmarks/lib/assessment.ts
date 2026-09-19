import type { Fixture, Range, Kind, Tier, Assessment, FormatContract } from '../types.ts';
// Classification is authored from input construction and provider evidence,
// never scanner outcomes. Unknown fixtures fail closed into T0 (pending).
// Protocol: docs/measurement-v4.md §2.1, §2.6, §6.
import { KINDS, TIERS } from './lattice.ts';

export const kinds = {
  'must-redact': { title: 'Must redact', description: 'Authored secret spans with an evidence tier. Leaked span rate, leaked byte rate and collateral ratio are the headline numbers; twin discrimination measures whether a near-identical control stays clean.' },
  'must-not-flag': { title: 'Must not flag', description: 'Controls that assert silence: malformed shapes, near misses, public identifiers, placeholders, references and prose. False alarm rate is the headline number.' },
  policy: { title: 'Policy', description: 'Spans that follow this project’s masking policy rather than a provider format: standalone IDs, generic literals, bearer values, URI passwords, OTP seeds and retained legacy expectations. Never merged with must-redact.' },
};
export const tiers = {
  T1: { title: 'Provider-documented', description: 'The provider (or an RFC) documents the lexical shape the contract requires. Tool sources are corroboration only.' },
  T2: { title: 'Tool-corroborated', description: 'No usable provider documentation; at least one pinned scanner registration or a structural argument supports the shape.' },
  T3: { title: 'Project policy', description: 'This project’s masking policy. Honest, and never compared with provider-documented formats.' },
  T0: { title: 'Pending', description: 'No adequate evidence yet. Observations are inspectable but unscored.' },
};

const observedAt = '2026-09-17';
const th = (path: string, label?: string) => ({ tool: 'trufflehog 3.97.4', label: label ?? path, url: `https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/${path}.go` });
const gl = { tool: 'gitleaks 8.30.1', label: 'gitleaks.toml', url: 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml' };
const provider = (url: string, formatVersion: string, covers: string) => ({ url, observedAt, formatVersion, covers });

/**
 * Format contracts. `tier` is the evidence tier a format-correct positive
 * earns. T1 requires `providerSource`; tool sources are never sufficient.
 * `covers` records what the provider document actually establishes so a
 * contract cannot quietly claim more than its evidence.
 */
export const contracts: Record<string, FormatContract> = {
  'aws-access-key': { tier: 'T1', pattern: '^AKIA[A-Z2-7]{16}$', providerSource: provider('https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes', 'IAM unique-ID prefix table', 'AKIA/ASIA/ABIA/ACCA prefixes; 16-character base32 body and 40-character secret are tool-corroborated'), corroboration: [th('aws/access_keys/accesskey'), gl], companion: 'A separate 40-character secret access key is required. ASIA additionally needs a session token and is not covered by this contract.' },
  'github-token': { tier: 'T1', pattern: '^(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}$', providerSource: provider('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats', '2021-04 prefix scheme', 'ghp_/gho_/ghu_/ghs_/ghr_ prefixes and underscore separator; 36-character body is tool-corroborated (checksum in the last six characters per github.blog/2021-04-05)'), corroboration: [th('github/v2/github'), gl] },
  'gitlab-token': { tier: 'T1', pattern: '^glpat-[A-Za-z0-9_-]{20}$', providerSource: provider('https://docs.gitlab.com/security/tokens/', 'token prefix table', 'glpat- prefix; 20-character legacy body is tool-corroborated, routable tokens are not covered'), corroboration: [th('gitlab/v2/gitlab_v2'), gl] },
  'openai-token': { tier: 'T2', pattern: '^sk-(?:[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}|(?:proj|svcacct)-[A-Za-z0-9_-]{74}T3BlbkFJ[A-Za-z0-9_-]{74})$', corroboration: [th('openai/openai'), gl], review: 'OpenAI publishes no key-format documentation (platform docs require authentication). Marker and lengths are tool-corroborated only.' },
  'anthropic-token': { tier: 'T2', pattern: '^sk-ant-api03-[A-Za-z0-9_-]{93}AA$', corroboration: [th('anthropic/anthropic'), gl], review: 'Anthropic API documentation describes authentication headers but not the key format. Shape is tool-corroborated only.' },
  'shopify-token': { tier: 'T1', pattern: '^shp(?:at|pa)_[a-f0-9]{32}$', providerSource: provider('https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens', 'shpat_/shppa_ opaque tokens', 'shpat_ and shppa_ prefixes; 32-hex body is tool-corroborated'), corroboration: [th('shopify/shopify'), gl], companion: 'A myshopify.com shop domain must accompany the token.' },
  'vault-token': { tier: 'T1', pattern: '^hv[sbr]\\.[A-Za-z0-9_-]{24,}$', providerSource: provider('https://developer.hashicorp.com/vault/docs/concepts/tokens', 'hvs./hvb./hvr. prefixes, 24+ random characters', 'prefixes and minimum length; the provider states the structure is opaque, so the 90–120-character rule the pinned tools use is corroboration, not contract'), corroboration: [th('hashicorpvault/hashicorpvaulttoken/hashicorpvaulttoken'), gl], companion: 'An explicit Vault endpoint is supplied. This is a service-token shape, not a validated encoded Vault payload.' },
  'stripe-token': { tier: 'T1', pattern: '^[rs]k_(?:live|test)_[A-Za-z0-9]{32}$', providerSource: provider('https://docs.stripe.com/keys', 'sk_/rk_/pk_ key types', 'sk_live_/sk_test_/rk_live_/rk_test_ secret and restricted keys, pk_ publishable keys documented as safe to expose, sk_org_ organization keys; 32-character body is tool-corroborated'), corroboration: [th('stripe/stripe'), gl] },
  'slack-token': { tier: 'T1', pattern: '^xoxb-[0-9]{12}-[0-9]{12}-[A-Za-z0-9]{24}$', providerSource: provider('https://docs.slack.dev/authentication/tokens', 'xoxb-/xoxp-/xapp-/xwfp- prefixes, dash-separated sections', 'prefixes and section structure with the secret last; numeric section widths and 24-character secret are tool-corroborated'), corroboration: [th('slack/slack'), gl] },
  'pypi-token': { tier: 'T1', providerSource: provider('https://pypi.org/help/#apitoken', 'pypi- prefixed base64 macaroon', 'pypi- prefix and base64 macaroon body; no lexical length contract'), corroboration: [th('pypi/pypi'), gl], review: 'Existing pypi- plus 90 arbitrary characters lacks the encoded macaroon prefix and structure. A real serialized macaroon fixture is still required before any positive can be scored.' },
  'huggingface-token': { tier: 'T2', pattern: '^hf_[A-Za-z]{34}$', corroboration: [th('huggingface/huggingface'), gl], review: 'Hugging Face documentation shows only an hf_ placeholder. Pinned tools disagree on the alphabet (letters-only versus alphanumeric); the letters-only intersection is tool-corroborated.' },
  'docker-token': { tier: 'T2', pattern: '^dckr_(?:pat_[A-Za-z0-9_-]{27}|oat_[A-Za-z0-9_-]{32})$', corroboration: [th('dockerhub/v2/dockerhub')], review: 'Docker access-token documentation does not describe the dckr_pat_/dckr_oat_ format. Shape is tool-corroborated only.' },
  'cloudflare-token': { tier: 'T1', pattern: '^cfut_[A-Za-z0-9]{40}[a-f0-9]{8}$', providerSource: provider('https://developers.cloudflare.com/fundamentals/api/get-started/create-token/', 'cfut_ scannable format', 'cfut_ prefix documented as the scannable token format; 40+8 body structure is tool-corroborated'), corroboration: [th('cloudflareapitoken/v2/cloudflareapitoken')] },
  'digitalocean-token': { tier: 'T1', pattern: '^do[por]_v1_[a-f0-9]{64}$', providerSource: provider('https://docs.digitalocean.com/release-notes/api/', '2022-03-29 token prefixes', 'dop_v1_/doo_v1_/dor_v1_ prefixes; 64-hex body is tool-corroborated'), corroboration: [th('digitaloceanv2/digitaloceanv2'), gl] },
  'linear-token': { tier: 'T2', pattern: '^lin_api_[A-Za-z0-9]{40}$', corroboration: [th('linearapi/linearapi'), gl], review: 'Linear API documentation does not describe the lin_api_ format. Shape is tool-corroborated only; the OAuth variant has no contract.' },
  'supabase-token': { tier: 'T0', corroboration: [th('supabasetoken/supabasetoken')], candidateSource: provider('https://supabase.com/docs/guides/api/api-keys', 'sb_secret_/sb_publishable_ short strings', 'prefixes only; body length and alphabet are undocumented'), review: 'Supabase documents the sb_secret_ prefix but not the body shape, and the pinned TruffleHog detector covers sbp_ management tokens instead. Pending until body evidence exists; never substitute credential classes.' },
  'vercel-token': { tier: 'T0', corroboration: [th('vercel/vercel')], review: 'Vercel REST API documentation does not describe token prefixes. The pinned detector uses contextual 24-character tokens, not the five vcp_/vci_/vca_/vcr_/vck_ shapes in the corpus. Pending.' },
  'npm-token': { tier: 'T1', pattern: '^npm_[A-Za-z0-9]{36}$', providerSource: provider('https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/', '2021-09 npm_ prefix scheme', 'npm_ prefix, underscore delimiter and six-character Base62 CRC32 checksum; 36-character body is tool-corroborated'), corroboration: [th('npmtokenv2/npmtokenv2'), gl] },
  'google-api-key': { tier: 'T2', pattern: '^AIza[A-Za-z0-9_-]{35}$', corroboration: [gl], review: 'Google publishes no API-key format documentation. The AIza prefix and 35-character suffix are gitleaks-corroborated only; the pinned TruffleHog detectors cover Gemini and OAuth2 credentials, not this generic API-key shape.' },
  'sendgrid-token': { tier: 'T2', pattern: '^SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}$', corroboration: [th('sendgrid/sendgrid'), gl], review: 'SendGrid documentation mentions key length only in passing and does not describe the SG. segment structure. Shape is tool-corroborated only.' },
  'microsoft-entra-client-secret': { tier: 'T2', pattern: '^[A-Za-z0-9_.~]{3}\\dQ~[A-Za-z0-9_.~-]{31,34}$', corroboration: [gl], review: 'Microsoft publishes no client-secret value grammar (only that it must be recorded immediately). The digit+Q~ marker converges with gitleaks\'s azure-ad-client-secret rule; no pinned TruffleHog rule covers this exact shape.' },
  'azure-devops-personal-access-token': { tier: 'T3', references: ['https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate#pat-format'], review: 'Azure DevOps documents an 84-character token with a fixed AZDO marker at bytes 76-80, but that citation is not independently verified here and no pinned scanner rule corroborates this exact shape: the pinned TruffleHog azuredevopspersonalaccesstoken detector instead matches an unrelated 52-character lowercase-alphanumeric, keyword-gated value. Treated as unevidenced pending a verified provider source or matching tool corroboration.' },
  'notion-token': { tier: 'T2', pattern: '^secret_[A-Za-z0-9]{43}$', corroboration: [th('notion/notion')], review: 'Covers only the legacy secret_ token shape; the current ntn_-prefixed format (Notion\'s 2024-09 rollout) has no contract here. The pinned gitleaks notion-api-token rule targets the newer ntn_ shape instead, so only TruffleHog\'s notion detector (which matches secret_ exactly) corroborates this contract.' },
  'atlassian-api-token': { tier: 'T2', pattern: '^ATAT[A-Za-z0-9_-]{100,}$', corroboration: [gl], review: 'Atlassian explicitly disclaims a fixed token length. Gitleaks\'s atlassian-api-token rule corroborates the ATAT-prefixed family with a narrower, more specific shape (literal ATATT3 prefix, exact 186-byte body) than this minimum-length contract. The pinned TruffleHog atlassian detector instead targets the distinct ATCT access-token family, not this API-token shape.' },
  'twilio-auth-token': { tier: 'T2', corroboration: [th('twilio/twilio')], review: 'Twilio documents the Auth Token\'s functional role but no character-class grammar. The bare 32-character lowercase-hex shape, gated on a same-line Account SID or the word "twilio", is corroborated by TruffleHog\'s twilio detector; no pinned gitleaks rule covers this bare value.' },
  'twilio-api-key-secret': { tier: 'T2', corroboration: [th('twilioapikey/twilioapikey')], review: 'Twilio documents the API Key Secret\'s functional role but no character-class grammar. The bare 32-character alphanumeric shape, gated on a same-line API Key SID or the word "twilio", is corroborated by TruffleHog\'s twilioapikey detector; gitleaks\'s twilio-api-key rule instead targets the SK-prefixed SID, not this bare secret.' },
  'telegram-bot-token': { tier: 'T2', pattern: '^[0-9]{5,}:[A-Za-z0-9_-]{34,}$', corroboration: [th('telegrambottoken/telegrambottoken')], review: 'Telegram\'s own documentation gives exactly one example token and no formal grammar. TruffleHog\'s telegrambottoken detector corroborates the general digits:secret shape; gitleaks\'s telegram-bot-api-token rule requires an additional literal uppercase "A" leading the secret segment that this contract does not require, so it is not cited.' },
  'discord-bot-token': { tier: 'T2', pattern: '^[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{27}$', corroboration: [th('discordbottoken/discordbottoken')], review: 'Discord\'s own single documented example matches this three-segment base64url shape exactly, corroborated by TruffleHog\'s discordbottoken detector. Gitleaks\'s discord-api-token and discord-client-secret rules target different, unrelated Discord credential shapes and are not cited.' },
  'sentry-user-auth-token': { tier: 'T2', pattern: '^sntryu_[0-9a-f]{64}$', corroboration: [gl], review: 'Sentry documents auth-token creation and scoping but no character-class grammar. Gitleaks\'s sentry-user-token rule matches this shape exactly; no pinned TruffleHog detector covers the user (non-organization) token.' },
  'sentry-org-auth-token': { tier: 'T2', pattern: '^sntrys_eyJ[A-Za-z0-9+/]{26,}={0,2}_[A-Za-z0-9+/]{43}$', corroboration: [th('sentryorgtoken/sentryorgtoken'), gl], review: 'Sentry documents no character-class grammar. Gitleaks\'s sentry-org-token rule anchors on a stricter literal marker (a base64-encoded "region_url" JSON key) than this contract requires; TruffleHog\'s sentryorgtoken detector matches a coarser fixed-length body. Both corroborate the same sntrys_eyJ...-prefixed, underscore-separated, 43-byte-signature family.' },
  'datadog-api-key': { tier: 'T2', corroboration: [th('datadogapikey/datadogapikey')], review: 'Datadog documents the DD-API-KEY header and DD_API_KEY environment variable but no character-class grammar. The bare 32-character shape, gated on a same-line datadog/dd marker, is corroborated by TruffleHog\'s datadogapikey detector; the pinned gitleaks datadog-access-token rule instead matches a 40-character body (the application-key length), not this one.' },
  'datadog-application-key': { tier: 'T2', corroboration: [th('datadogtoken/datadogtoken'), gl], review: 'Datadog documents the DD-APPLICATION-KEY header and DD_APPLICATION_KEY environment variable but no character-class grammar. The bare 40-character shape, gated on a same-line datadog/dd marker, is corroborated by both TruffleHog\'s datadogtoken detector and gitleaks\'s datadog-access-token rule.' },
  'grafana-service-account-token': { tier: 'T2', pattern: '^glsa_[A-Za-z0-9]{32}_[0-9A-Fa-f]{8}$', corroboration: [th('grafanaserviceaccount/grafanaserviceaccount'), gl], review: 'Grafana\'s own example request shows the glsa_ prefix but documents no full grammar. Gitleaks\'s grafana-service-account-token rule matches this two-segment shape exactly; TruffleHog\'s grafanaserviceaccount detector corroborates the same 41-byte total body length with a single wider character class that does not separately distinguish the hex checksum segment.' },
  'grafana-cloud-access-policy-token': { tier: 'T2', pattern: '^glc_[A-Za-z0-9+/]{32,}$', corroboration: [gl], review: 'Grafana documents no grammar for Cloud access policy tokens beyond the glc_ prefix. Gitleaks\'s grafana-cloud-api-token rule matches this shape; the pinned TruffleHog grafana detector instead requires an additional literal eyJ JSON marker immediately after the prefix that this contract does not require, so it is not cited.' },
  'new-relic-user-api-key': { tier: 'T2', pattern: '^NRAK-[A-Z0-9]{27}$', corroboration: [th('newrelicuserkey/newrelicuserkey'), gl], review: 'The NRAK- prefix comes from New Relic\'s own Terraform provider migration guide, not its API-keys documentation, so this is tool-corroborated rather than provider-documented here. Both gitleaks\'s new-relic-user-api-key rule and TruffleHog\'s newrelicuserkey detector match this shape exactly.' },
  'new-relic-license-key': { tier: 'T3', references: ['https://docs.newrelic.com/docs/apis/intro-apis/new-relic-api-keys/'], review: 'New Relic\'s own documentation describes the License Key as "a 40-character hexadecimal string," but that citation is not independently verified here and no pinned scanner rule corroborates a plain keyword-gated bare-hex shape: TruffleHog\'s newreliclicensekey detector instead requires a literal FFFFNRAL suffix marker this contract does not require, and no gitleaks rule targets the license key at all. Treated as unevidenced pending a verified provider source or matching tool corroboration.' },
  'private-key': { tier: 'T1', providerSource: provider('https://www.rfc-editor.org/rfc/rfc7468', 'RFC 7468 textual encodings', 'BEGIN/END PRIVATE KEY labels and base64 body; the reviewed control is additionally parsed as PKCS#8 offline'), corroboration: [th('privatekey/privatekey')], structural: true, review: 'Legacy PEM bodies decode to public prose, not key material. Only the locally parseable Ed25519 PKCS#8 control is a positive.' },
  jwt: { tier: 'T1', providerSource: provider('https://www.rfc-editor.org/rfc/rfc7519', 'RFC 7519 compact serialization', 'three base64url segments; the reviewed control is additionally signature-verified offline'), corroboration: [th('jwt/jwt')], structural: true, review: 'Legacy JWT is expired, fabricated and HS256. TruffleHog explicitly skips HMAC JWTs; that is a policy difference.' },
  'bearer-token': { tier: 'T3', references: ['https://www.rfc-editor.org/rfc/rfc6750#section-2.1'], review: 'Bearer is a transport scheme, not a provider-specific credential format. Generic value masking is project policy.' },
  'connection-string': { tier: 'T3', references: ['https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1'], review: 'The password is the inner span; the whole URI is the authored envelope, so a whole-URI finding is covered with measured collateral instead of a footnote.' },
  'otpauth-uri': { tier: 'T3', references: ['https://github.com/google/google-authenticator/wiki/Key-Uri-Format'], review: 'The seed is the inner span; the whole otpauth URI is the authored envelope.' },
  'generic-token': { tier: 'T3', references: [], review: 'An arbitrary literal in a sensitive field is a masking-policy case, not a provider-format ground truth.' },
};

export const evidence = (family?: string) => {
  const c = contracts[family ?? ''];
  if (!c) return [];
  return [...(c.providerSource ? [c.providerSource.url] : []), ...(c.corroboration ?? []).map(s => s.url), ...(c.references ?? [])];
};

const decide = (kind: Kind, tier: Tier, reason: string, family?: string): Assessment => ({ kind, tier, reason, ...(family ? { contract: family } : {}), sources: evidence(family) });
const policy = (reason: string, family?: string) => decide('policy', 'T3', reason, family);
const pending = (reason: string, family?: string, kind: Kind = 'must-redact') => decide(kind, 'T0', reason, family);
const control = (tier: Tier, reason: string, family?: string) => decide('must-not-flag', tier, reason, family);
const NEAR_MISS = 'Malformed-by-construction control: prefix-only, truncated, mis-delimited or public-material shape of a contracted family. Expected silence follows from construction.';
const PLACEHOLDER = 'Placeholder, reference, template, mask, documentation or ordinary text. Expected silence is project policy.';
const bytesOf = (f: Fixture, r: Range) => new TextDecoder().decode(new TextEncoder().encode(f.content).slice(r.start, r.end));
const matches = (family: string, value: string) => Boolean(contracts[family ?? '']?.pattern) && new RegExp(contracts[family ?? ''].pattern!).test(value);

function classifyControl(category: string, f: Fixture): Assessment {
  if (f.twinOf) {
    const family = f.detectors?.[0];
    if (!contracts[family ?? '']) throw new Error(`Unknown twin contract: ${f.id}`);
    if (!f.mutation || !f.mutationKind) throw new Error(`Twin without mutation: ${f.id}`);
    const documented = f.mutationKind === 'public-prefix' && contracts[family ?? ''].tier === 'T1';
    return control(documented ? 'T1' : 'T2', `Negative twin of ${f.twinOf}: ${f.mutation}. ${documented ? 'The provider documents this namespace as public, so silence is provider-evidenced.' : 'Exactly one structural property differs from the positive; silence follows from construction.'}`, family);
  }
  const family = f.detectors?.[0];
  if (category === 'detector-coverage') {
    if (/-(?:prefix-only|short-body|public-block|missing-signature|missing-value|no-password|missing-secret|short-secret)$/.test(f.id)) return control('T2', NEAR_MISS, family);
    if (/-(?:label-prose|ordinary-dotted-name|ordinary-prose|public-url|reference|mask)$/.test(f.id)) return control('T3', PLACEHOLDER, family);
  }
  if (category === 'sendgrid-regressions') {
    if (['short-id', 'short-secret', 'missing-separator', 'wrong-separator', 'wrong-prefix', 'prefix-only'].includes(f.id)) return control('T2', NEAR_MISS, 'sendgrid-token');
    if (['masked', 'documentation'].includes(f.id)) return control('T3', PLACEHOLDER, 'sendgrid-token');
  }
  if (category === 'negative-controls') {
    if (['Incomplete shapes', 'Public identifiers', 'Benign encoded text'].includes(f.group)) return control('T2', f.group === 'Incomplete shapes' ? NEAR_MISS : 'Public identifier or benign encoding constructed to contain no credential: silence follows from construction.');
    if (['Empty inputs', 'Placeholders', 'Ordinary text'].includes(f.group)) return control('T3', PLACEHOLDER);
  }
  if (category === 'accuracy') return f.id === 'public-id' ? control('T2', 'Public identifier constructed to contain no credential: silence follows from construction.') : control('T3', PLACEHOLDER);
  if (['token-contexts', 'reference-syntax', 'milestone-6-closed'].includes(category)) return control('T3', category === 'milestone-6-closed' ? 'Placeholder, tutorial, reference, template or mask control whose expected silence follows a closed redact-secret issue decision, not a universal secret definition.' : PLACEHOLDER);
  return pending('No reviewed control rule for this input. Excluded from comparative scores until reviewed.', undefined, 'must-not-flag');
}

export function classifyFixture(category: string, f: Fixture): Assessment {
  if (!f.expected.some(r => (r.role ?? 'secret') === 'secret')) return classifyControl(category, f);
  if (category === 'common-formats') {
    const family = f.detectors?.[0];
    if (!contracts[family ?? '']) throw new Error(`Unknown format contract: ${f.id}`);
    return decide('must-redact', contracts[family ?? ''].tier, f.formatReason!, family);
  }
  if (category === 'accuracy') return policy('Legacy SYNTHETIC/filler example; not an independently reviewed credential format. Original regression expectation retained.');
  if (category === 'reference-syntax') return policy('Literal value in a sensitive field; tests generic masking rather than a provider credential.');
  if (category === 'milestone-6-closed') {
    if ([254, 257, 263, 264, 280].includes(f.issue!)) return policy('Mutated documentation, placeholder, template, mask or reference. Expected masking follows a redact-secret issue decision, not a universal secret definition.');
    return policy('Issue-specific literal/password range; expectations are the project’s masking policy.');
  }
  if (category === 'detector-coverage') {
    const family = f.detectors![0];
    const value = bytesOf(f, f.expected[0]);
    if (['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token', 'twilio-auth-token', 'twilio-api-key-secret', 'datadog-api-key', 'datadog-application-key', 'azure-devops-personal-access-token', 'new-relic-license-key'].includes(family)) return policy(contracts[family ?? ''].review!, family);
    if (family === 'aws-access-key') return policy('Standalone access-key ID without secret key/session token. Some legacy ASIA values also use digits outside the base32 alphabet.', family);
    if (family === 'shopify-token') return policy('Token shape is plausible, but the shop domain the contract requires is absent.', family);
    if (family === 'vault-token' && matches(family, value)) return policy('Token shape meets the provider’s prefix and minimum-length documentation, but the Vault endpoint the contract requires is absent.', family);
    if (family === 'private-key' || family === 'pypi-token' || family === 'jwt') return policy(contracts[family ?? ''].review!, family);
    if (contracts[family ?? ''].tier === 'T0') return pending(contracts[family ?? ''].review!, family);
    if (family === 'huggingface-token' && /[0-9]/.test(value)) return pending('Pinned tool rules disagree on the alphabet and the provider documents none. Evidence is needed before treating this sample as valid or malformed.', family);
    // Variant support must not be inferred from a related family name.
    if ((family === 'linear-token' && value.startsWith('lin_oauth_')) || (family === 'stripe-token' && /^(?:sk_org_|whsec_)/.test(value)) || (family === 'slack-token' && value.startsWith('xwfp-')))
      return pending('This variant needs a separate format contract; related detector support is not evidence of parity.', family);
    if (!matches(family, value)) return policy('Legacy prefix-plus-random-body does not meet the reviewed length, alphabet or internal structure. Historical positive expectation retained only as a regression.', family);
    return decide('must-redact', contracts[family ?? ''].tier, 'Synthetic value matches the pinned lexical format contract. Provider issuance, payload/checksum validity and liveness are not claimed.', family);
  }
  const family = category === 'sendgrid-regressions' ? 'sendgrid-token'
    : ['token-contexts', 'context-edges'].includes(category) ? 'github-token'
    : category === 'credential-formats' ? ({ ghp: 'github-token', gho: 'github-token', ghu: 'github-token', ghs: 'github-token', ghr: 'github-token', gitlab: 'gitlab-token', npm: 'npm-token', sendgrid: 'sendgrid-token', slack: 'slack-token' } as Record<string, string>)[f.id.split('-')[0]] : null;
  if (family && f.expected.every(r => matches(family, bytesOf(f, r))))
    return decide('must-redact', contracts[family ?? ''].tier, 'Source-backed lexical shape in an explicit context test; repeated shapes are not independent provider coverage.', family);
  return pending('No reviewed classification rule. Excluded from comparative scores until input and expectation have been reviewed.');
}

export function validateContracts() {
  for (const [family, c] of Object.entries(contracts)) {
    if (!TIERS.includes(c.tier)) throw new Error(`Invalid contract tier: ${family}`);
    if (c.tier === 'T1' && !(c.providerSource?.url && c.providerSource.observedAt && c.providerSource.formatVersion)) throw new Error(`T1 contract without provider source: ${family}`);
    if (c.tier === 'T2' && !c.corroboration?.length) throw new Error(`T2 contract without corroboration: ${family}`);
    if (c.tier !== 'T1' && c.providerSource) throw new Error(`Provider source on non-T1 contract: ${family}`);
  }
}

export function validateAssessment(f: Fixture) {
  const a = f.assessment;
  if (!a || !KINDS.includes(a.kind) || !TIERS.includes(a.tier) || typeof a.reason !== 'string' || !a.reason.trim() || !Array.isArray(a.sources)) throw new Error(`Missing or invalid assessment: ${f.id}`);
  const secrets = f.expected.filter(r => (r.role ?? 'secret') === 'secret');
  if (a.kind === 'must-not-flag') {
    if (secrets.length) throw new Error(`Control with secret spans: ${f.id}`);
    if (f.twinOf && (typeof f.mutation !== 'string' || !f.mutation.trim() || !['length', 'alphabet', 'prefix', 'boundary', 'public-prefix'].includes(f.mutationKind!))) throw new Error(`Invalid twin metadata: ${f.id}`);
    if (!f.twinOf && (f.mutation || f.mutationKind)) throw new Error(`Mutation without twin: ${f.id}`);
    if (a.tier === 'T1' && !(f.twinOf && contracts[a.contract ?? '']?.providerSource)) throw new Error(`T1 control without provider evidence: ${f.id}`);
    return;
  }
  if (f.twinOf) throw new Error(`Positive fixture cannot be a twin: ${f.id}`);
  if (!secrets.length) throw new Error(`Positive fixture without secret span: ${f.id}`);
  if (a.tier === 'T0') return;
  if (a.kind === 'policy') { if (a.tier !== 'T3') throw new Error(`Policy rows are T3: ${f.id}`); return; }
  if (a.tier === 'T3') throw new Error(`must-redact cannot be T3: ${f.id}`);
  const contract = contracts[a.contract ?? ''];
  if (!contract || contract.tier !== a.tier || !a.sources.length) throw new Error(`Missing format evidence: ${f.id}`);
  if (!contract.pattern && !contract.structural) throw new Error(`No reviewed format validator: ${f.id}`);
  const values = secrets.map(r => bytesOf(f, r));
  if (a.contract === 'aws-access-key') {
    if (values.length !== 2 || !new RegExp(contract.pattern!).test(values[0]) || !/^[A-Za-z0-9/+]{40}$/.test(values[1])) throw new Error(`Incomplete AWS pair: ${f.id}`);
  } else if (contract.pattern && !values.every(v => new RegExp(contract.pattern!).test(v))) throw new Error(`Format contract violation: ${f.id}`);
  if (a.contract === 'shopify-token' && !/[a-zA-Z0-9-]+\.myshopify\.com/.test(f.content)) throw new Error(`Missing shop domain: ${f.id}`);
  if (a.contract === 'vault-token' && !/https:\/\/[a-zA-Z0-9-]+\.hashicorp\.cloud/.test(f.content)) throw new Error(`Missing Vault endpoint: ${f.id}`);
}
