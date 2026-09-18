// Classification is authored from input construction and provider evidence,
// never scanner outcomes. Unknown fixtures fail closed into T0 (pending).
// Protocol: docs/measurement-v4.md §2.1, §2.6, §6.
import { KINDS, TIERS } from './lattice.mjs';

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
const th = (path, label) => ({ tool: 'trufflehog 3.97.4', label: label ?? path, url: `https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/${path}.go` });
const gl = { tool: 'gitleaks 8.30.1', label: 'gitleaks.toml', url: 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml' };
const provider = (url, formatVersion, covers) => ({ url, observedAt, formatVersion, covers });

/**
 * Format contracts. `tier` is the evidence tier a format-correct positive
 * earns. T1 requires `providerSource`; tool sources are never sufficient.
 * `covers` records what the provider document actually establishes so a
 * contract cannot quietly claim more than its evidence.
 */
export const contracts = {
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
  'sendgrid-token': { tier: 'T2', pattern: '^SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}$', corroboration: [th('sendgrid/sendgrid'), gl], review: 'SendGrid documentation mentions key length only in passing and does not describe the SG. segment structure. Shape is tool-corroborated only.' },
  'private-key': { tier: 'T1', providerSource: provider('https://www.rfc-editor.org/rfc/rfc7468', 'RFC 7468 textual encodings', 'BEGIN/END PRIVATE KEY labels and base64 body; the reviewed control is additionally parsed as PKCS#8 offline'), corroboration: [th('privatekey/privatekey')], structural: true, review: 'Legacy PEM bodies decode to public prose, not key material. Only the locally parseable Ed25519 PKCS#8 control is a positive.' },
  jwt: { tier: 'T1', providerSource: provider('https://www.rfc-editor.org/rfc/rfc7519', 'RFC 7519 compact serialization', 'three base64url segments; the reviewed control is additionally signature-verified offline'), corroboration: [th('jwt/jwt')], structural: true, review: 'Legacy JWT is expired, fabricated and HS256. TruffleHog explicitly skips HMAC JWTs; that is a policy difference.' },
  'bearer-token': { tier: 'T3', references: ['https://www.rfc-editor.org/rfc/rfc6750#section-2.1'], review: 'Bearer is a transport scheme, not a provider-specific credential format. Generic value masking is project policy.' },
  'connection-string': { tier: 'T3', references: ['https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1'], review: 'The password is the inner span; the whole URI is the authored envelope, so a whole-URI finding is covered with measured collateral instead of a footnote.' },
  'otpauth-uri': { tier: 'T3', references: ['https://github.com/google/google-authenticator/wiki/Key-Uri-Format'], review: 'The seed is the inner span; the whole otpauth URI is the authored envelope.' },
  'generic-token': { tier: 'T3', references: [], review: 'An arbitrary literal in a sensitive field is a masking-policy case, not a provider-format ground truth.' },
};

export const evidence = family => {
  const c = contracts[family];
  if (!c) return [];
  return [...(c.providerSource ? [c.providerSource.url] : []), ...(c.corroboration ?? []).map(s => s.url), ...(c.references ?? [])];
};

const decide = (kind, tier, reason, family) => ({ kind, tier, reason, ...(family ? { contract: family } : {}), sources: evidence(family) });
const policy = (reason, family) => decide('policy', 'T3', reason, family);
const pending = (reason, family, kind = 'must-redact') => decide(kind, 'T0', reason, family);
const control = (tier, reason, family) => decide('must-not-flag', tier, reason, family);
const NEAR_MISS = 'Malformed-by-construction control: prefix-only, truncated, mis-delimited or public-material shape of a contracted family. Expected silence follows from construction.';
const PLACEHOLDER = 'Placeholder, reference, template, mask, documentation or ordinary text. Expected silence is project policy.';
const bytesOf = (f, r) => new TextDecoder().decode(new TextEncoder().encode(f.content).slice(r.start, r.end));
const matches = (family, value) => Boolean(contracts[family]?.pattern) && new RegExp(contracts[family].pattern).test(value);

function classifyControl(category, f) {
  if (f.twinOf) {
    const family = f.detectors?.[0];
    if (!contracts[family]) throw new Error(`Unknown twin contract: ${f.id}`);
    if (!f.mutation || !f.mutationKind) throw new Error(`Twin without mutation: ${f.id}`);
    const documented = f.mutationKind === 'public-prefix' && contracts[family].tier === 'T1';
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

export function classifyFixture(category, f) {
  if (!f.expected.some(r => (r.role ?? 'secret') === 'secret')) return classifyControl(category, f);
  if (category === 'common-formats') {
    const family = f.detectors?.[0];
    if (!contracts[family]) throw new Error(`Unknown format contract: ${f.id}`);
    return decide('must-redact', contracts[family].tier, f.formatReason, family);
  }
  if (category === 'accuracy') return policy('Legacy SYNTHETIC/filler example; not an independently reviewed credential format. Original regression expectation retained.');
  if (category === 'reference-syntax') return policy('Literal value in a sensitive field; tests generic masking rather than a provider credential.');
  if (category === 'milestone-6-closed') {
    if ([254, 257, 263, 264, 280].includes(f.issue)) return policy('Mutated documentation, placeholder, template, mask or reference. Expected masking follows a redact-secret issue decision, not a universal secret definition.');
    return policy('Issue-specific literal/password range; expectations are the project’s masking policy.');
  }
  if (category === 'detector-coverage') {
    const family = f.detectors[0];
    const value = bytesOf(f, f.expected[0]);
    if (['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token'].includes(family)) return policy(contracts[family].review, family);
    if (family === 'aws-access-key') return policy('Standalone access-key ID without secret key/session token. Some legacy ASIA values also use digits outside the base32 alphabet.', family);
    if (family === 'shopify-token') return policy('Token shape is plausible, but the shop domain the contract requires is absent.', family);
    if (family === 'vault-token' && matches(family, value)) return policy('Token shape meets the provider’s prefix and minimum-length documentation, but the Vault endpoint the contract requires is absent.', family);
    if (family === 'private-key' || family === 'pypi-token' || family === 'jwt') return policy(contracts[family].review, family);
    if (contracts[family].tier === 'T0') return pending(contracts[family].review, family);
    if (family === 'huggingface-token' && /[0-9]/.test(value)) return pending('Pinned tool rules disagree on the alphabet and the provider documents none. Evidence is needed before treating this sample as valid or malformed.', family);
    // Variant support must not be inferred from a related family name.
    if ((family === 'linear-token' && value.startsWith('lin_oauth_')) || (family === 'stripe-token' && /^(?:sk_org_|whsec_)/.test(value)) || (family === 'slack-token' && value.startsWith('xwfp-')))
      return pending('This variant needs a separate format contract; related detector support is not evidence of parity.', family);
    if (!matches(family, value)) return policy('Legacy prefix-plus-random-body does not meet the reviewed length, alphabet or internal structure. Historical positive expectation retained only as a regression.', family);
    return decide('must-redact', contracts[family].tier, 'Synthetic value matches the pinned lexical format contract. Provider issuance, payload/checksum validity and liveness are not claimed.', family);
  }
  const family = category === 'sendgrid-regressions' ? 'sendgrid-token'
    : ['token-contexts', 'context-edges'].includes(category) ? 'github-token'
    : category === 'credential-formats' ? ({ ghp: 'github-token', gho: 'github-token', ghu: 'github-token', ghs: 'github-token', ghr: 'github-token', gitlab: 'gitlab-token', npm: 'npm-token', sendgrid: 'sendgrid-token', slack: 'slack-token' })[f.id.split('-')[0]] : null;
  if (family && f.expected.every(r => matches(family, bytesOf(f, r))))
    return decide('must-redact', contracts[family].tier, 'Source-backed lexical shape in an explicit context test; repeated shapes are not independent provider coverage.', family);
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

export function validateAssessment(f) {
  const a = f.assessment;
  if (!a || !KINDS.includes(a.kind) || !TIERS.includes(a.tier) || typeof a.reason !== 'string' || !a.reason.trim() || !Array.isArray(a.sources)) throw new Error(`Missing or invalid assessment: ${f.id}`);
  const secrets = f.expected.filter(r => (r.role ?? 'secret') === 'secret');
  if (a.kind === 'must-not-flag') {
    if (secrets.length) throw new Error(`Control with secret spans: ${f.id}`);
    if (f.twinOf && (typeof f.mutation !== 'string' || !f.mutation.trim() || !['length', 'alphabet', 'prefix', 'boundary', 'public-prefix'].includes(f.mutationKind))) throw new Error(`Invalid twin metadata: ${f.id}`);
    if (!f.twinOf && (f.mutation || f.mutationKind)) throw new Error(`Mutation without twin: ${f.id}`);
    if (a.tier === 'T1' && !(f.twinOf && contracts[a.contract]?.providerSource)) throw new Error(`T1 control without provider evidence: ${f.id}`);
    return;
  }
  if (f.twinOf) throw new Error(`Positive fixture cannot be a twin: ${f.id}`);
  if (!secrets.length) throw new Error(`Positive fixture without secret span: ${f.id}`);
  if (a.tier === 'T0') return;
  if (a.kind === 'policy') { if (a.tier !== 'T3') throw new Error(`Policy rows are T3: ${f.id}`); return; }
  if (a.tier === 'T3') throw new Error(`must-redact cannot be T3: ${f.id}`);
  const contract = contracts[a.contract];
  if (!contract || contract.tier !== a.tier || !a.sources.length) throw new Error(`Missing format evidence: ${f.id}`);
  if (!contract.pattern && !contract.structural) throw new Error(`No reviewed format validator: ${f.id}`);
  const values = secrets.map(r => bytesOf(f, r));
  if (a.contract === 'aws-access-key') {
    if (values.length !== 2 || !new RegExp(contract.pattern).test(values[0]) || !/^[A-Za-z0-9/+]{40}$/.test(values[1])) throw new Error(`Incomplete AWS pair: ${f.id}`);
  } else if (contract.pattern && !values.every(v => new RegExp(contract.pattern).test(v))) throw new Error(`Format contract violation: ${f.id}`);
  if (a.contract === 'shopify-token' && !/[a-zA-Z0-9-]+\.myshopify\.com/.test(f.content)) throw new Error(`Missing shop domain: ${f.id}`);
  if (a.contract === 'vault-token' && !/https:\/\/[a-zA-Z0-9-]+\.hashicorp\.cloud/.test(f.content)) throw new Error(`Missing Vault endpoint: ${f.id}`);
}
