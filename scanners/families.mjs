// Deliberately partial mapping of native labels from the pinned adapters.
// Unlisted labels remain unmapped, never guessed from fixture expectations.
export const familyMappingVersion = 2;
const families = ['github-token', 'gitlab-token', 'npm-token', 'sendgrid-token',
  'slack-token', 'aws-access-key', 'private-key', 'jwt', 'anthropic-token',
  'openai-token', 'shopify-token', 'stripe-token', 'generic-token', 'vault-token',
  'pypi-token', 'huggingface-token', 'docker-token', 'cloudflare-token',
  'digitalocean-token', 'linear-token', 'supabase-token', 'vercel-token',
  'bearer-token', 'connection-string', 'otpauth-uri',
  // #207: the two Confluent detector ids, so a twin scoped to the legacy family can tell
  // the product reporting a current cflt secret as its own sibling family (co-detection)
  // from a legacy-family finding; unmapped, every such finding fails the twin closed.
  'confluent-cloud-api-secret', 'confluent-cloud-api-secret-legacy',
  // #384: registry detectors since redact-secret#862-#868 (product PR #869, registry pin cfe2aec); each was measured
  // as an arrival family (benchmarks/lib/beta8/384b-384e) under the same id, except Together, whose arrival id was
  // renamed to the detector id.
  'aws-bedrock-long-term-api-key', 'aws-bedrock-short-term-api-key', 'elevenlabs-api-key', 'together-ai-api-key',
  'tavily-api-key', 'mistral-api-key', 'cohere-api-key', 'ai21-api-key', 'deepgram-api-key',
  // #434/#436: registry detectors since redact-secret#903-#909 and #912-#917 (product PR #938, registry pin 1127bf9); each
  // was measured as an arrival family (benchmarks/lib/beta8/434a-434g, 436a-436f) under the same id. Their sibling types
  // are labelled by finding type (arrivalFindingTypes below).
  'doppler-token', 'trigger-dev-token', 'e2b-api-key', 'posthog-token', 'helicone-api-key', 'firecrawl-api-key',
  'composio-api-key', 'convex-deployment-key', 'onepassword-service-account-token', 'inngest-signing-key',
  'resend-api-key', 'apify-api-token', 'wandb-api-key',
  // #464/#528: registry detectors since redact-secret#970-#975 (product PR #1037) and #1019-#1035 (product PR #1039),
  // registry pin 4fb7882; each was measured as an arrival family (benchmarks/lib/beta8/464a-464f, 528a-528j) under the
  // same id. Their sibling types are labelled by finding type (arrivalFindingTypes below).
  'daytona-api-key', 'clickhouse-cloud-api-secret', 'nvidia-api-key', 'browserbase-api-key', 'runpod-api-key',
  'cerebras-api-key', 'bitwarden-secrets-manager-access-token', 'polar-token', 'sonarqube-token', 'rubygems-api-key',
  'clojars-deploy-token', 'crates-io-token', 'dynatrace-token', 'paddle-api-key', 'honeycomb-api-key', 'axiom-token',
  // #1012 READY-T2 families, registry detectors since redact-secret#1028 and #1029 (product PR #1039, registry pin
  // 4fb7882); first measured at that pin (benchmarks/lib/beta8/1012a.ts, 1012b.ts).
  'aws-secret-access-key', 'google-oauth-client-secret'];
const gitleaks = {
  'github-pat': 'github-token', 'github-oauth': 'github-token',
  'github-app-token': 'github-token', 'github-refresh-token': 'github-token',
  'gitlab-pat': 'gitlab-token', 'npm-access-token': 'npm-token',
  'sendgrid-api-token': 'sendgrid-token', 'slack-bot-token': 'slack-token',
  'aws-access-token': 'aws-access-key', 'private-key': 'private-key', jwt: 'jwt',
  'anthropic-api-key': 'anthropic-token', 'openai-api-key': 'openai-token',
  'shopify-access-token': 'shopify-token', 'stripe-access-token': 'stripe-token',
  'generic-api-key': 'generic-token',
  // Beta.8 #212 families (benchmarks/lib/beta8/212.ts; perplexity and the runner token are
  // registry detectors since redact-secret#730). gitleaks'
  // gitlab-rrt (GR1348941 registration token) and slack-user-token stay
  // unmapped: the first is another credential class, and the second already
  // fires on detector-coverage's slack-token xoxp- fixtures, so mapping it
  // would re-attribute existing findings.
  'perplexity-api-key': 'perplexity-api-key',
  'gitlab-runner-authentication-token': 'gitlab-runner-authentication-token',
  'gitlab-runner-authentication-token-routable': 'gitlab-runner-authentication-token',
  // #259: registry detector travisci-api-token since the 3144bb3 pin (redact-secret#523),
  // and the prefix-less Mailgun triplet (the #259 context-gated arrival family).
  'travisci-access-token': 'travisci-api-token',
  'mailgun-signing-key': 'mailgun-api-key-triplet',
  // #384: gitleaks 8.30.1 has one rule per Bedrock key kind (registry detectors since redact-secret#864) and a Cohere rule
  // (registry detector since redact-secret#868). anthropic-admin-api-key stays unmapped: the product types sk-ant-admin01-
  // inside anthropic-token, so mapping it would re-attribute the api03 family's findings.
  'aws-amazon-bedrock-api-key-long-lived': 'aws-bedrock-long-term-api-key',
  'aws-amazon-bedrock-api-key-short-lived': 'aws-bedrock-short-term-api-key',
  'cohere-api-token': 'cohere-api-key',
  // #434: gitleaks 8.30.1 doppler-api-token is dp\.pt\.(?i)[a-z0-9]{43}, the personal token only (one width of the
  // documented 40-44 band), so it maps to that arrival family and to no other Doppler type.
  'doppler-api-token': 'doppler-personal-token',
  // #464: gitleaks 8.30.1 clickhouse-cloud-api-secret-key is \b(4b1d[A-Za-z0-9]{38})\b with entropy 3, the T1 grammar of the
  // ClickHouse Cloud key secret (benchmarks/lib/beta8/464b.ts), so it maps to that arrival family.
  'clickhouse-cloud-api-secret-key': 'clickhouse-cloud-api-secret',
  // #528 arrival families (benchmarks/lib/beta8/528c-528g.ts). gitleaks 8.30.1 rubygems-api-token is the RubyGems grammar
  // with a trailing delimiter; clojars-api-token ((?i)CLOJARS_[a-z0-9]{60}) and dynatrace-api-token (dt0c01 only,
  // (?i)[a-z0-9]) read the credential over a wider class; sonar-api-token is keyword-gated and reads squ_/sqa_/sqp_ under
  // one label, so it maps to the detector-id family sonarqube-token and an analysis-token finding reads as co-detection.
  'rubygems-api-token': 'rubygems-api-key', 'clojars-api-token': 'clojars-deploy-token',
  'dynatrace-api-token': 'dynatrace-token', 'sonar-api-token': 'sonarqube-token',
  // #436 (deferred to graduation): gitleaks 8.30.1 1password-service-account-token is ops_eyJ + standard Base64, the same
  // credential as the onepassword-service-account-token family over a different alphabet (it misses the Base64url
  // positives; peer lag, not a family difference). 1password-secret-key is the account Secret Key, never this family,
  // and stays unmapped.
  '1password-service-account-token': 'onepassword-service-account-token',
};
const trufflehog = {
  Github: 'github-token', Gitlab: 'gitlab-token', Npm: 'npm-token',
  SendGrid: 'sendgrid-token', Slack: 'slack-token', AWS: 'aws-access-key',
  PrivateKey: 'private-key', JWT: 'jwt', Anthropic: 'anthropic-token',
  OpenAI: 'openai-token', Shopify: 'shopify-token', Stripe: 'stripe-token',
  // Beta.8 #208 families (benchmarks/lib/beta8/208.ts; registry detectors since
  // redact-secret#727, graduated from arrival families): each detector
  // matches exactly that provider's inference key (`\b`-bounded prefix + fixed
  // body); OpenRouter is `sk-or-v1-` only, never the `sk-or-mgmt-` management key.
  Replicate: 'replicate-api-token', Groq: 'groq-api-key', XAI: 'xai-api-key',
  OpenRouter: 'openrouter-api-key',
  // Beta.8 #210 families (registry detectors since redact-secret#728): trufflehog 3.97.4's langsmith detector
  // (lsv2_(pt|sk)_<32 hex>_<10 hex>) and langfuse detector (sk-lf-<uuid>,
  // keyword- and pk-gated) report exactly the credential those families measure.
  LangSmith: 'langsmith-api-key', Langfuse: 'langfuse-secret-key',
  // Beta.8 #212: pcsk_<5-6>_<63>, exactly the pinecone-api-key contract's shape (registry detector since redact-secret#730).
  Pinecone: 'pinecone-api-key',
  // #259: travis keyword + 22 characters, the travisci-api-token contract's shape (redact-secret#523).
  TravisCI: 'travisci-api-token',
  // #384: trufflehog 3.97.4's elevenlabs/v2 (sk_ + 48 hex, keyword-gated) and deepgram (keyword + 40 [0-9a-z]) detectors
  // (registry detectors since redact-secret#865 and #868). elevenlabs/v1 (a bare 32-hex legacy shape) reports under the same label.
  ElevenLabs: 'elevenlabs-api-key', Deepgram: 'deepgram-api-key',
  // #434 arrival families (benchmarks/lib/beta8/434a.ts, 434d.ts): trufflehog 3.97.4's doppler detector reads
  // dp.(ct|pt|st[.segment]|sa|scim|audit). + 40-44 alphanumerics under one label, so it maps to the detector-level
  // family doppler-token (as Github maps to github-token) and a sibling-type finding reads as co-detection; its
  // posthog detector (label PosthogApp) reads phx_ + 43-48 of [a-zA-Z0-9_] only, the personal key.
  Doppler: 'doppler-token', PosthogApp: 'posthog-token',
  // #464 arrival family (benchmarks/lib/beta8/464c.ts): trufflehog 3.97.4's nvapi detector (label NVAPI) reads an exact 64
  // [a-zA-Z0-9_-] body after nvapi-, one width of the provider's open-ended grammar, so a finding maps to nvidia-api-key.
  NVAPI: 'nvidia-api-key',
  // #528 arrival family (benchmarks/lib/beta8/528d.ts): trufflehog 3.97.4's rubygems detector (label RubyGems) reads
  // rubygems_ + 48 of [a-zA0-9] (a class typo), the RubyGems credential over a wider class. Its SonarCloud (legacy bare
  // 40 near "sonar", sqco_) and Honeycomb (32-hex or 22-alphanumeric near "Honeycomb") labels read no #528 family's
  // shape and stay unmapped.
  RubyGems: 'rubygems-api-key',
  // #436 (deferred to graduation): trufflehog 3.97.4's apify detector reads apify_api_ + exactly 36 alphanumerics, the
  // apify-api-token credential over a narrower width (it misses the 20- and 128-byte positives). Its weightsandbiases
  // detectors report under one label: v2 (wandb_v1_ keys, the wandb-api-key family) and v1 (the legacy keyword-gated
  // 40-hex key, which the family does not claim) -- the same one-label, two-shape case as ElevenLabs above.
  Apify: 'apify-api-token', WeightsAndBiases: 'wandb-api-key',
  // redact-secret#1013: trufflehog 3.97.4's openaiadmin detector (label OpenAIAdmin, PR #4689) reads exactly
  // sk-admin- + 58 [A-Za-z0-9_-] + T3BlbkFJ + 58, the openai-admin-api-key arrival family's corroborated width. The
  // generic OpenAI detector skips sk-admin- because of this move, so an admin key is attributed here, not to openai-token.
  OpenAIAdmin: 'openai-admin-api-key',
};
// flare-redact 1.6.1 (FRS-1 spec) detector ids. Only ids whose matched format
// is genuinely the same credential type as an existing family are mapped;
// providers with no family in this corpus (Sentry, Airtable, Figma,
// Notion, Doppler, Square, Azure, Discord, Telegram, New Relic, GCP,
// Google, Twilio, Stripe webhook secrets) stay unmapped rather than guessed.
// `groq_key`, `xai_key`, `openrouter_key` and `replicate_token` name the same
// inference-key credentials as #208's families (over looser widths for
// Groq, xAI and Replicate), so they map to those family ids.
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
  // key-[a-f0-9]{32}: the private API key `mailgun-api-key` scores, over
  // gitleaks's narrower hex-only body (redact-secret#314).
  mailgun_key: 'mailgun-api-key',
  groq_key: 'groq-api-key', xai_key: 'xai-api-key', openrouter_key: 'openrouter-api-key',
  replicate_token: 'replicate-api-token',
  // pplx-[A-Za-z0-9]{40,60}: the Beta.8 #212 perplexity-api-key family (registry detector since redact-secret#730), over a wider width.
  perplexity_key: 'perplexity-api-key',
};
// #251: arrival families the product types inside a shared detector, keyed by
// product detector id, then by product finding type. A finding whose (detector,
// type) pair is listed here is labelled with the arrival family; every other
// redact-secret finding keeps its detector id. Built only from recorded
// sources, never from scanner output:
// - each target's recorded `reason` in benchmarks/lib/beta8/*.ts, which names
//   the shared detector and the finding type;
// - the product's documented finding types per detector, redact-secret
//   docs/reference/detection.md at main 10263e5 (github-token L53,
//   stripe-token L59, slack-token L60).
// A coarser type for the same shape (the published 0.1.0-beta.7 reports whsec_
// as `stripe_credential` and xoxp-/xapp- as `slack_token`) is not listed, so it
// keeps the detector id and still shows up as a classification disagreement.
// A shared detector that gives the arrival shape the same type as its registry
// shape is not listed either: notion-token (`notion_integration_token` for
// secret_ and ntn_), pinecone-api-key (`pinecone_api_key` for pcsk_ and the
// legacy UUID, redact-secret#766) and mailgun-api-key (`mailgun_api_key` for
// key- and the triplet, redact-secret#773). tests/evaluation-methods.test.mjs checks the
// table against the arrival families and their reasons.
export const arrivalFindingTypes = Object.freeze({
  'github-token': Object.freeze({ github_fine_grained_personal_access_token: 'github-fine-grained-pat' }),
  'stripe-token': Object.freeze({ stripe_webhook_signing_secret: 'stripe-webhook-signing-secret' }),
  'slack-token': Object.freeze({ slack_app_level_token: 'slack-app-level-token', slack_user_token: 'slack-user-token' }),
  // #384/#774: product PR #882 splits sk-ant-api01- and sk-ant-admin01- out of the shared
  // anthropic_api_key type into their own types; sk-ant-api03- keeps anthropic_api_key.
  'anthropic-token': Object.freeze({ anthropic_enterprise_api_key: 'anthropic-api01-key', anthropic_admin_api_key: 'anthropic-admin01-key' }),
  // #384/#774: the same PR splits sk-admin- out of the shared openai_api_key type; the
  // sk-/sk-proj-/sk-svcacct- widths keep openai_api_key.
  'openai-token': Object.freeze({ openai_admin_api_key: 'openai-admin-api-key' }),
  // #434: product PR #938 (redact-secret#903, #904, #906, #907, #909) gives each sibling type its own finding type
  // inside the new shared detector (redact-secret docs/reference/detection.md at 1127bf9); the detector-id family keeps
  // the detector id (doppler_service_token, trigger_dev_secret_api_key, posthog_personal_api_key, helicone_api_key,
  // composio_project_api_key).
  'doppler-token': Object.freeze({
    doppler_personal_token: 'doppler-personal-token', doppler_cli_token: 'doppler-cli-token',
    doppler_service_account_token: 'doppler-service-account-token',
    doppler_service_account_identity_token: 'doppler-service-account-identity-token',
    doppler_scim_token: 'doppler-scim-token', doppler_audit_token: 'doppler-audit-token',
  }),
  'trigger-dev-token': Object.freeze({ trigger_dev_personal_access_token: 'trigger-dev-personal-access-token' }),
  'posthog-token': Object.freeze({ posthog_project_secret_api_key: 'posthog-project-secret-api-key' }),
  'helicone-api-key': Object.freeze({ helicone_write_api_key: 'helicone-write-api-key' }),
  'composio-api-key': Object.freeze({ composio_org_api_key: 'composio-org-api-key', composio_user_api_key: 'composio-user-api-key' }),
  // #528: product PR #1039 (redact-secret#1020, #1021, #1031, #1035) gives each sibling type its own finding type inside
  // the new shared detector (redact-secret docs/reference/detection.md at 4fb7882); the detector-id family keeps the
  // detector id (polar_organization_access_token, sonarqube_user_token, crates_io_api_token, axiom_api_token).
  'polar-token': Object.freeze({ polar_api_credential: 'polar-api-credential' }),
  'sonarqube-token': Object.freeze({ sonarqube_analysis_token: 'sonarqube-analysis-token' }),
  'crates-io-token': Object.freeze({ crates_io_trusted_publishing_token: 'crates-io-trusted-publishing-token' }),
  'axiom-token': Object.freeze({ axiom_personal_token: 'axiom-personal-token' }),
});
// The arrival families with a recorded finding-type mapping. eval:classify scores
// these like registry families, each on its own contract, profile and ledger rows
// (docs/decisions/2026-09-24-score-arrival-families-by-finding-type.md). Every
// other arrival id stays unscored.
export const scoredArrivalFamilies = Object.freeze(
  [...new Set(Object.values(arrivalFindingTypes).flatMap(types => Object.values(types)))].sort());
const nativeTables = { gitleaks, trufflehog, 'flare-redact': flareRedact };
/**
 * The benchmark family of one scanner finding. `label` is the scanner's native
 * rule label (the product detector id for redact-secret); `findingType` is the
 * product finding type and is read only for redact-secret.
 */
export function findingFamily(scanner, label, findingType) {
  if (scanner === 'redact-secret') {
    const arrival = Object.hasOwn(arrivalFindingTypes, label) && typeof findingType === 'string'
      && Object.hasOwn(arrivalFindingTypes[label], findingType) ? arrivalFindingTypes[label][findingType] : undefined;
    if (arrival) return { family: arrival };
    return families.includes(label) ? { family: label } : {};
  }
  const table = nativeTables[scanner];
  if (!table) return {};
  return Object.hasOwn(table, label) ? { family: table[label] } : {};
}
