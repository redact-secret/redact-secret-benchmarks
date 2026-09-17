// Classification is authored from input construction and pinned source contracts,
// never scanner outcomes. Unknown fixtures fail closed into the review queue.
export const cohorts = {
  'common-format': { title: 'Reviewed credential formats', description: 'Source-backed synthetic formats with required companion fields. Shared inputs, not a promise that every scanner supports them. Never issued; checksums, liveness and production representativeness are not established.' },
  masking: { title: 'Standalone values & masking policy', description: 'IDs without companion credentials, generic passwords, bearer values and password-only URI ranges. Scores describe this project’s masking policy, not universal provider detection.' },
  'malformed-example': { title: 'Malformed, examples & controls', description: 'Malformed provider shapes, documentation values, placeholders, references and benign controls. Historical expectations are retained as project policy; disagreements are not automatically scanner defects.' },
  unreviewed: { title: 'Format review pending', description: 'No adequate format or context evidence yet. Measurements remain inspectable but are excluded from comparative scores.' },
};

const th = path => `https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/${path}.go`;
const gl = 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml';
export const contracts = {
  'aws-access-key': { pattern: '^AKIA[A-Z2-7]{16}$', companion: 'A separate 40-character secret access key is required. ASIA additionally needs a session token and is not covered by this contract.', sources: [th('aws/access_keys/accesskey'), gl] },
  'github-token': { pattern: '^(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}$', sources: [th('github/v2/github'), gl] },
  'gitlab-token': { pattern: '^glpat-[A-Za-z0-9_-]{20}$', sources: [th('gitlab/v2/gitlab_v2'), gl] },
  'openai-token': { pattern: '^sk-(?:[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}|(?:proj|svcacct)-[A-Za-z0-9_-]{74}T3BlbkFJ[A-Za-z0-9_-]{74})$', sources: [th('openai/openai'), gl] },
  'anthropic-token': { pattern: '^sk-ant-api03-[A-Za-z0-9_-]{93}AA$', sources: [th('anthropic/anthropic'), gl] },
  'shopify-token': { pattern: '^shp(?:at|pa)_[a-f0-9]{32}$', companion: 'A myshopify.com shop domain must accompany the token.', sources: [th('shopify/shopify'), gl] },
  'vault-token': { pattern: '^hvs\\.[A-Za-z0-9_-]{90,120}$', companion: 'An explicit Vault endpoint is supplied. This is a service-token shape, not a validated encoded Vault payload.', sources: [th('hashicorpvault/hashicorpvaulttoken/hashicorpvaulttoken'), gl] },
  'stripe-token': { pattern: '^[rs]k_(?:live|test)_[A-Za-z0-9]{32}$', sources: [th('stripe/stripe'), gl] },
  'slack-token': { pattern: '^xoxb-[0-9]{12}-[0-9]{12}-[A-Za-z0-9]{24}$', sources: [th('slack/slack'), gl] },
  'pypi-token': { sources: [th('pypi/pypi'), gl], review: 'Existing pypi- plus 90 arbitrary characters lacks the encoded macaroon prefix and structure. A real serialized macaroon fixture is still required.' },
  'huggingface-token': { pattern: '^hf_[A-Za-z]{34}$', sources: [th('huggingface/huggingface'), gl] },
  'docker-token': { pattern: '^dckr_(?:pat_[A-Za-z0-9_-]{27}|oat_[A-Za-z0-9_-]{32})$', sources: [th('dockerhub/v2/dockerhub') ] },
  'cloudflare-token': { pattern: '^cfut_[A-Za-z0-9]{40}[a-f0-9]{8}$', sources: [th('cloudflareapitoken/v2/cloudflareapitoken')] },
  'digitalocean-token': { pattern: '^do[por]_v1_[a-f0-9]{64}$', sources: [th('digitaloceanv2/digitaloceanv2'), gl] },
  'linear-token': { pattern: '^lin_api_[A-Za-z0-9]{40}$', sources: [th('linearapi/linearapi'), gl] },
  'supabase-token': { sources: [th('supabasetoken/supabasetoken')], review: 'The inspected detector covers sbp_ management tokens; existing sb_secret_ project keys are a different credential class. Do not substitute one for the other.' },
  'vercel-token': { sources: [th('vercel/vercel')], review: 'The inspected detector uses contextual 24-character tokens, not the five vcp_/vci_/vca_/vcr_/vck_ shapes in the corpus. Those shapes require independent provider evidence.' },
  'npm-token': { pattern: '^npm_[A-Za-z0-9]{36}$', sources: [th('npmtokenv2/npmtokenv2'), gl] },
  'sendgrid-token': { pattern: '^SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}$', sources: [th('sendgrid/sendgrid'), gl] },
  'private-key': { sources: [th('privatekey/privatekey')], review: 'Old PEM bodies decode to public prose, not key material. The new Ed25519 PKCS#8 control is locally parseable and never deployed.' },
  jwt: { sources: [th('jwt/jwt')], review: 'Existing JWT is expired, fabricated and HS256. TruffleHog explicitly skips HMAC JWTs even without verification; this is a policy difference.' },
  'bearer-token': { sources: ['https://www.rfc-editor.org/rfc/rfc6750#section-2.1'], review: 'Bearer is a transport scheme, not a provider-specific credential format. Generic value masking is measured separately.' },
  'connection-string': { sources: [th('postgres/postgres')], review: 'Password-only expectations versus whole-URI findings measure range policy. Keep containment separate from exact masking.' },
  'otpauth-uri': { sources: ['https://github.com/google/google-authenticator/wiki/Key-Uri-Format'], review: 'Seed-only masking expectations do not assert dedicated OTP support in every scanner.' },
  'generic-token': { sources: [], review: 'An arbitrary literal in a sensitive field is a masking-policy case, not a provider-format ground truth.' },
};

const assessment = (cohort, reason, family) => ({ cohort, reason, ...(family ? { contract: family } : {}), sources: contracts[family]?.sources ?? [] });
const malformed = (reason, family) => assessment('malformed-example', reason, family);
const masking = (reason, family) => assessment('masking', reason, family);

export function classifyFixture(category, f) {
  if (category === 'common-formats') {
    const family = f.detectors?.[0];
    if (!contracts[family]) throw new Error(`Unknown format contract: ${f.id}`);
    return assessment('common-format', f.formatReason, family);
  }
  if (!f.expected.length) return malformed('Authored negative control: benign text, reference, placeholder, example or incomplete shape. Expected silence is project policy.', f.detectors?.[0]);
  if (category === 'accuracy') return malformed('Legacy SYNTHETIC/filler example; not an independently reviewed credential format. Original regression expectation retained.');
  if (category === 'reference-syntax') return masking('Literal value in a sensitive field; tests generic masking rather than a provider credential.');
  if (category === 'milestone-6-closed') {
    if ([254, 257, 263, 264, 280].includes(f.issue)) return malformed('Mutated documentation, placeholder, template, mask or reference. Expected masking follows a redact-secret issue decision, not a universal secret definition.');
    return masking('Issue-specific literal/password range; exact-match expectations are the project’s masking policy.');
  }
  if (category === 'detector-coverage') {
    const family = f.detectors[0];
    const value = new TextDecoder().decode(new TextEncoder().encode(f.content).slice(f.expected[0].start, f.expected[0].end));
    if (['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token'].includes(family)) return masking(contracts[family].review, family);
    if (family === 'aws-access-key') return masking('Standalone access-key ID without secret key/session token. Some legacy ASIA values also use digits outside the base32 alphabet.', family);
    if (family === 'shopify-token') return masking('Token shape is plausible, but the shop domain required by TruffleHog is absent.', family);
    if (family === 'private-key' || family === 'pypi-token') return malformed(contracts[family].review, family);
    if (family === 'jwt') return malformed(contracts.jwt.review, family);
    if (['supabase-token', 'vercel-token'].includes(family)) return assessment('unreviewed', contracts[family].review, family);
    if (family === 'huggingface-token' && /[0-9]/.test(value)) return assessment('unreviewed', 'Upstream rules disagree: TruffleHog allows alphanumeric bodies, Gitleaks allows letters only. Provider alphabet evidence is needed before treating this sample as valid or malformed.', family);
    // Variant support must not be inferred from a related family name.
    if ((family === 'vault-token' && value.startsWith('hvr.')) || (family === 'linear-token' && value.startsWith('lin_oauth_')) || (family === 'stripe-token' && /^(?:sk_org_|whsec_)/.test(value)) || (family === 'slack-token' && value.startsWith('xwfp-')))
      return assessment('unreviewed', 'This variant needs a separate provider format contract; related detector support is not evidence of parity.', family);
    if (!contracts[family]?.pattern || !new RegExp(contracts[family].pattern).test(value)) return malformed('Legacy prefix-plus-random-body does not meet the reviewed length, alphabet or internal structure. Historical positive expectation retained only as a regression.', family);
    return assessment('common-format', 'Synthetic value matches the pinned lexical format contract. Provider issuance, payload/checksum validity and liveness are not claimed.', family);
  }
  const family = category === 'sendgrid-regressions' ? 'sendgrid-token'
    : ['token-contexts', 'context-edges'].includes(category) ? 'github-token'
    : category === 'credential-formats' ? ({ ghp: 'github-token', gho: 'github-token', ghu: 'github-token', ghs: 'github-token', ghr: 'github-token', gitlab: 'gitlab-token', npm: 'npm-token', sendgrid: 'sendgrid-token', slack: 'slack-token' })[f.id.split('-')[0]] : null;
  if (family && f.expected.every(r => new RegExp(contracts[family].pattern).test(new TextDecoder().decode(new TextEncoder().encode(f.content).slice(r.start, r.end)))))
    return assessment('common-format', 'Source-backed lexical shape in an explicit context test; repeated shapes are not independent provider coverage.', family);
  return assessment('unreviewed', 'No reviewed classification rule. Excluded from comparative scores until input and expectation have been reviewed.');
}

export function validateAssessment(f) {
  const a = f.assessment;
  if (!a || !cohorts[a.cohort] || typeof a.reason !== 'string' || !a.reason.trim() || !Array.isArray(a.sources)) throw new Error(`Missing or invalid assessment: ${f.id}`);
  if (a.cohort === 'common-format' && (!contracts[a.contract] || !a.sources.length || !f.expected.length)) throw new Error(`Missing format evidence: ${f.id}`);
  if (a.cohort !== 'common-format') return;
  const contract = contracts[a.contract];
  if (!contract.pattern && !['private-key', 'jwt'].includes(a.contract)) throw new Error(`No reviewed format validator: ${f.id}`);
  const bytes = new TextEncoder().encode(f.content);
  const values = f.expected.map(r => new TextDecoder().decode(bytes.slice(r.start, r.end)));
  if (a.contract === 'aws-access-key') {
    if (values.length !== 2 || !new RegExp(contract.pattern).test(values[0]) || !/^[A-Za-z0-9/+]{40}$/.test(values[1])) throw new Error(`Incomplete AWS pair: ${f.id}`);
  } else if (contract.pattern && !values.every(v => new RegExp(contract.pattern).test(v))) throw new Error(`Format contract violation: ${f.id}`);
  if (a.contract === 'shopify-token' && !/[a-zA-Z0-9-]+\.myshopify\.com/.test(f.content)) throw new Error(`Missing shop domain: ${f.id}`);
  if (a.contract === 'vault-token' && !/https:\/\/[a-zA-Z0-9-]+\.hashicorp\.cloud/.test(f.content)) throw new Error(`Missing Vault endpoint: ${f.id}`);
}
