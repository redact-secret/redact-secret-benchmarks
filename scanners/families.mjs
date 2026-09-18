// Deliberately partial mapping of native labels from the pinned adapters.
// Unlisted labels remain unmapped, never guessed from fixture expectations.
export const familyMappingVersion = 1;
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
export function findingFamily(scanner, label) {
  if (!['redact-secret', 'gitleaks', 'trufflehog'].includes(scanner)) return {};
  const family = scanner === 'redact-secret' ? (families.includes(label) ? label : undefined)
    : Object.hasOwn(scanner === 'gitleaks' ? gitleaks : trufflehog, label)
      ? (scanner === 'gitleaks' ? gitleaks : trufflehog)[label] : undefined;
  return family ? { family } : {};
}
