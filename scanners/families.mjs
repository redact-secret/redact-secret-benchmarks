// Deliberately partial mapping of native labels from the pinned adapters.
// Unlisted labels remain unmapped, never guessed from fixture expectations.
export const familyMappingVersion = 2;
const families = ['github-token', 'gitlab-token', 'npm-token', 'sendgrid-token',
  'slack-token', 'aws-access-key', 'private-key', 'jwt', 'anthropic-token',
  'openai-token', 'shopify-token', 'stripe-token', 'generic-token', 'vault-token',
  'pypi-token', 'huggingface-token', 'docker-token', 'cloudflare-token',
  'digitalocean-token', 'linear-token', 'supabase-token', 'vercel-token',
  'bearer-token', 'connection-string', 'otpauth-uri'];
const gitleaks = {
  'github-pat': 'github-token', 'github-oauth': 'github-token',
  'github-app-token': 'github-token', 'github-refresh-token': 'github-token',
  'gitlab-pat': 'gitlab-token', 'npm-access-token': 'npm-token',
  'sendgrid-api-token': 'sendgrid-token', 'slack-bot-token': 'slack-token',
  'aws-access-token': 'aws-access-key', 'private-key': 'private-key', jwt: 'jwt',
  'anthropic-api-key': 'anthropic-token', 'openai-api-key': 'openai-token',
  'shopify-access-token': 'shopify-token', 'stripe-access-token': 'stripe-token',
  'generic-api-key': 'generic-token',
};
const trufflehog = {
  Github: 'github-token', Gitlab: 'gitlab-token', Npm: 'npm-token',
  SendGrid: 'sendgrid-token', Slack: 'slack-token', AWS: 'aws-access-key',
  PrivateKey: 'private-key', JWT: 'jwt', Anthropic: 'anthropic-token',
  OpenAI: 'openai-token', Shopify: 'shopify-token', Stripe: 'stripe-token',
};
// flare-redact 1.6.1 (FRS-1 spec) detector ids. Only ids whose matched format
// is genuinely the same credential type as an existing family are mapped;
// providers with no family in this corpus (Sentry, Airtable, Figma,
// Notion, Doppler, Square, Azure, Discord, Telegram, New Relic, Groq, xAI,
// Perplexity, OpenRouter, Replicate, GCP, Mailgun,
// Google, Twilio, Stripe webhook secrets) stay unmapped rather than guessed.
// `databricks_token` (dapi + 32 hex, optional rotation digit) is the same
// credential the post-beta.6 `databricks-personal-access-token` family
// scores (redact-secret#308); `postman_key` (PMAK- + 24 hex + "-" + 34 hex)
// is exactly `postman-api-key`'s contracted shape (redact-secret#310);
// `netlify_token` (nfp_ + a 36–60-byte alphanumeric body) is the same
// personal-access-token credential `netlify-token` scores, over a looser
// width and without the "_" body byte (redact-secret#311).
// `aws_secret_key` shares `aws-access-key` with `aws_access_key`, matching
// how the TruffleHog adapter already families both halves of an AWS pair
// under one label. `basic_auth` (an HTTP Basic-Auth header) has no family
// of its own and stays unmapped, unlike `url_credentials` (a URI's embedded
// user:pass), which is the same artifact this corpus calls `connection-string`.
const flareRedact = {
  github_token: 'github-token', gitlab_token: 'gitlab-token', npm_token: 'npm-token',
  sendgrid_key: 'sendgrid-token', slack_token: 'slack-token',
  aws_access_key: 'aws-access-key', aws_secret_key: 'aws-access-key',
  private_key: 'private-key', jwt: 'jwt', anthropic_key: 'anthropic-token',
  openai_key: 'openai-token', shopify_token: 'shopify-token', stripe_key: 'stripe-token',
  generic_assignment: 'generic-token', vault_token: 'vault-token',
  huggingface_token: 'huggingface-token', digitalocean_token: 'digitalocean-token',
  linear_key: 'linear-token', supabase_key: 'supabase-token', bearer_token: 'bearer-token',
  url_credentials: 'connection-string', databricks_token: 'databricks-personal-access-token',
  postman_key: 'postman-api-key', netlify_token: 'netlify-token',
};
const nativeTables = { gitleaks, trufflehog, 'flare-redact': flareRedact };
export function findingFamily(scanner, label) {
  if (scanner === 'redact-secret') return families.includes(label) ? { family: label } : {};
  const table = nativeTables[scanner];
  if (!table) return {};
  return Object.hasOwn(table, label) ? { family: table[label] } : {};
}
