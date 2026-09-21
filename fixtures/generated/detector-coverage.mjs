// Authored against the beta.3 format contracts, never scanner output.
// Prefix variants are structural examples, not issued/valid credentials.
const families = [
  ["aws-access-key", ["AKIA", "ASIA"], 16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"],
  ["github-token", ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"], 36],
  ["gitlab-token", ["glpat-"], 20],
  ["openai-token", ["sk-", "sk-proj-", "sk-svcacct-"], 48],
  ["anthropic-token", ["sk-ant-api03-"], 80],
  ["shopify-token", ["shpat_", "shppa_"], 32, "0123456789abcdef"],
  ["vault-token", ["hvs.", "hvb.", "hvr."], 32],
  ["stripe-token", ["sk_test_", "sk_live_", "rk_test_", "rk_live_", "sk_org_", "whsec_"], 32],
  ["slack-token", ["xoxb-", "xoxp-", "xapp-", "xwfp-", "xoxe-", "xoxe.xoxb-", "xoxe.xoxp-"], 48],
  ["pypi-token", ["pypi-"], 90],
  ["huggingface-token", ["hf_"], 34],
  ["docker-token", ["dckr_pat_", "dckr_oat_"], 32],
  ["cloudflare-token", ["cfut_"], 40],
  ["digitalocean-token", ["dop_v1_", "doo_v1_", "dor_v1_"], 64, "0123456789abcdef"],
  ["linear-token", ["lin_api_", "lin_oauth_"], 40],
  ["supabase-token", ["sb_secret_"], 40],
  ["vercel-token", ["vcp_", "vci_", "vca_", "vcr_", "vck_"], 32],
  ["npm-token", ["npm_"], 36],
  ["google-api-key", ["AIza"], 35, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"],
  ["notion-token", ["secret_"], 43],
  ["atlassian-api-token", ["ATAT"], 100, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"],
  ["telegram-bot-token", ["123456:"], 34, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"],
  ["sentry-user-auth-token", ["sntryu_"], 64, "0123456789abcdef"],
  ["grafana-cloud-access-policy-token", ["glc_"], 32, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"],
  ["new-relic-user-api-key", ["NRAK-"], 27, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"],
];

export function buildDetectorCoverage({ fixture, synthetic, wrap, quoted, uri, ENVELOPES }) {
  const fixtures = [];
  const add = (detector, suffix, parts) => {
    fixtures.push({
      ...fixture(`${detector}-${suffix}`, detector, parts),
      detectors: [detector],
    });
  };
  const positive = (detector, variant, parts) => {
    add(detector, `${variant}-bare`, parts);
    add(detector, `${variant}-quoted`, ['value="', ...parts, '"\n']);
    add(detector, `${variant}-unicode-crlf`, ["# 🔑 密钥 café\r\n", ...parts, "\r\n"]);
  };
  // Negative twin (§2.5): the positive's three contexts with exactly one
  // property mutated. `parts` is the mutated literal, never a secret span.
  // Every mutation is authored from the documentation cited on the family's
  // contract (providerSource / twinSource), never from scanner output.
  const addTwin = (detector, variant, parts, mutation, mutationKind = "length") => {
    const twin = (suffix, body) => fixtures.push({
      ...fixture(`${detector}-${variant}-${suffix}-twin`, detector, body),
      detectors: [detector],
      twinOf: `${detector}-${variant}-${suffix}`,
      mutation,
      mutationKind,
    });
    twin("bare", parts);
    twin("quoted", ['value="', ...parts, '"\n']);
    twin("unicode-crlf", ["# 🔑 密钥 café\r\n", ...parts, "\r\n"]);
  };
  // (detector, prefix index) pairs currently dark for must-redact/T2 twin
  // coverage (docker-token, linear-token, google-api-key, notion-token,
  // atlassian-api-token); one representative shape each is enough to move
  // the corpus-wide floor without inventing coverage for every shape.
  const twinTargets = { "docker-token": 1, "linear-token": 0, "google-api-key": 0, "notion-token": 0, "atlassian-api-token": 0 };
  for (const [detector, prefixes, length, alphabet] of families) {
    prefixes.forEach((prefix, index) => {
      const value = prefix + synthetic(`detector-coverage:${detector}:${prefix}`, length, alphabet);
      positive(detector, `shape-${index + 1}`, [{ secret: value }]);
      if (twinTargets[detector] === index)
        addTwin(detector, `shape-${index + 1}`, [value.slice(0, -1)], `length: ${value.length - 1} vs contracted ${value.length}`);
      // #36: the IAM prefix table documents AIDA as an IAM-user unique ID, not
      // an access key. The common-formats ID/secret pair stays untwinned: any
      // single mutation leaves its other credential component intact.
      if (detector === "aws-access-key")
        addTwin(detector, `shape-${index + 1}`, ["AIDA" + value.slice(prefix.length)], `prefix namespace: AIDA (provider-documented IAM user unique ID) vs ${prefix} access key`, "prefix");
      // #36: PyPI documents the pypi- prefix as part of the token value.
      if (detector === "pypi-token")
        addTwin(detector, `shape-${index + 1}`, ["pypx-" + value.slice(prefix.length)], "prefix namespace: pypx- vs provider-documented pypi-", "prefix");
    });
    add(detector, "prefix-only", [prefixes.join("\n")]);
    add(detector, "short-body", [prefixes.map(prefix => prefix + "abc").join("\n")]);
    // #62: a fifth aws-access-key benign control (masked/placeholder body) to
    // clear the stable floor of 5 benign cases; prefix-only and short-body
    // above account for the other two.
    if (detector === "aws-access-key") add(detector, "mask", ["AKIA" + "*".repeat(16)]);
  }

  // #65: additional detector-coverage benign controls for the eight T1
  // families short of the stable floor of 5 benign cases
  // (redact-secret-benchmarks#65). mask/reference/label-prose join each
  // family's existing prefix-only and short-body controls from the loop
  // above.
  add("vault-token", "mask", ["hvs." + "*".repeat(24)]);
  add("vault-token", "reference", ["VAULT_TOKEN=${VAULT_TOKEN}\n"]);
  add("vault-token", "label-prose", ["Documentation mentions a Vault service token (hvs. prefix) without embedding the token value."]);
  add("shopify-token", "mask", ["shpat_" + "*".repeat(32)]);
  add("shopify-token", "reference", ["SHOPIFY_ACCESS_TOKEN=${SHOPIFY_TOKEN}\n"]);
  add("shopify-token", "label-prose", ["Documentation mentions a Shopify access token (shpat_ prefix) without embedding the token value."]);
  add("cloudflare-token", "mask", ["cfut_" + "*".repeat(48)]);
  add("cloudflare-token", "reference", ["CLOUDFLARE_API_TOKEN=${CF_API_TOKEN}\n"]);
  add("cloudflare-token", "label-prose", ["Documentation mentions a Cloudflare API token (cfut_ prefix) without embedding the token value."]);
  add("stripe-token", "mask", ["sk_live_" + "*".repeat(32)]);
  add("stripe-token", "reference", ["STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}\n"]);
  add("stripe-token", "label-prose", ["Documentation mentions a Stripe secret key (sk_ prefix) without embedding the key value."]);
  add("slack-token", "mask", ["xoxb-" + "*".repeat(12) + "-" + "*".repeat(12) + "-" + "*".repeat(24)]);
  add("gitlab-token", "mask", ["glpat-" + "*".repeat(20)]);
  add("npm-token", "mask", ["npm_" + "*".repeat(36)]);
  add("github-token", "mask", ["ghp_" + "*".repeat(36)]);

  // beta.4 additions: 17 detectors with no dedicated-prefix-plus-run shape
  // simple enough for the families loop above, added when detectors.json
  // was refreshed to the beta.4 registry snapshot.
  const ALNUM_DASH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const BASE64_BODY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const LOWER_HEX = "0123456789abcdef";

  const entraPrefix = synthetic("coverage:entra:prefix", 3, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~");
  const entraSuffix = synthetic("coverage:entra:suffix", 33, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~-");
  positive("microsoft-entra-client-secret", "digit-q-tilde", [{ secret: `${entraPrefix}8Q~${entraSuffix}` }]);
  add("microsoft-entra-client-secret", "missing-marker", [`${entraPrefix}8${entraSuffix}`]);
  add("microsoft-entra-client-secret", "short-suffix", [`${entraPrefix}8Q~${entraSuffix.slice(0, 28)}`]);

  const azdoPrefix = synthetic("coverage:azdo:prefix", 76);
  const azdoSuffix = synthetic("coverage:azdo:suffix", 4);
  positive("azure-devops-personal-access-token", "azdo-marker", [{ secret: `${azdoPrefix}AZDO${azdoSuffix}` }]);
  addTwin("azure-devops-personal-access-token", "azdo-marker", [`${azdoPrefix}AZDO${azdoSuffix}`.slice(0, -1)], "length: 83 vs provider-documented 84 characters; AZDO signature position unchanged");
  add("azure-devops-personal-access-token", "missing-marker", [azdoPrefix + azdoSuffix + "XXXX"]);
  add("azure-devops-personal-access-token", "short-body", [`${azdoPrefix.slice(0, 70)}AZDO${azdoSuffix}`]);

  const twilioSid = synthetic("coverage:twilio:sid", 32, LOWER_HEX);
  const twilioAuthToken = synthetic("coverage:twilio:auth-token", 32, LOWER_HEX);
  positive("twilio-auth-token", "paired-account-sid", [`AC${twilioSid} `, { secret: twilioAuthToken }]);
  add("twilio-auth-token", "missing-identifier", [twilioAuthToken]);
  add("twilio-auth-token", "short-token", [`AC${twilioSid} ${twilioAuthToken.slice(0, 30)}`]);

  const twilioApiKeySid = synthetic("coverage:twilio:api-key-sid", 32);
  const twilioApiKeySecret = synthetic("coverage:twilio:api-key-secret", 32);
  positive("twilio-api-key-secret", "paired-api-key-sid", [`SK${twilioApiKeySid} `, { secret: twilioApiKeySecret }]);
  add("twilio-api-key-secret", "missing-identifier", [twilioApiKeySecret]);
  add("twilio-api-key-secret", "short-secret", [`SK${twilioApiKeySid} ${twilioApiKeySecret.slice(0, 30)}`]);

  const discordDigits = synthetic("coverage:discord:snowflake-digits", 18, "0123456789");
  const discordSeg1 = Buffer.from(discordDigits).toString("base64url");
  const discordSeg2 = synthetic("coverage:discord:seg2", 6, ALNUM_DASH);
  const discordSeg3 = synthetic("coverage:discord:seg3", 27, ALNUM_DASH);
  positive("discord-bot-token", "three-segments", [{ secret: `${discordSeg1}.${discordSeg2}.${discordSeg3}` }]);
  add("discord-bot-token", "missing-segment", [`${discordSeg1}.${discordSeg3}`]);
  add("discord-bot-token", "short-final-segment", [`${discordSeg1}.${discordSeg2}.${discordSeg3.slice(0, 20)}`]);

  const sentryOrgPayload = synthetic("coverage:sentry-org:payload", 26, BASE64_BODY);
  const sentryOrgSignature = synthetic("coverage:sentry-org:signature", 43, BASE64_BODY);
  positive("sentry-org-auth-token", "org-token", [{ secret: `sntrys_eyJ${sentryOrgPayload}_${sentryOrgSignature}` }]);
  add("sentry-org-auth-token", "missing-json-marker", [`sntrys_${sentryOrgPayload}_${sentryOrgSignature}`]);
  add("sentry-org-auth-token", "short-signature", [`sntrys_eyJ${sentryOrgPayload}_${sentryOrgSignature.slice(0, 30)}`]);

  const datadogApiKey = synthetic("coverage:datadog:api-key", 32, LOWER_HEX);
  positive("datadog-api-key", "env-marker", ["DD_API_KEY=", { secret: datadogApiKey }]);
  add("datadog-api-key", "missing-marker", [datadogApiKey]);
  add("datadog-api-key", "short-key", ["DD_API_KEY=" + datadogApiKey.slice(0, 20)]);

  const datadogAppKey = synthetic("coverage:datadog:application-key", 40, LOWER_HEX);
  positive("datadog-application-key", "env-marker", ["DD_APPLICATION_KEY=", { secret: datadogAppKey }]);
  add("datadog-application-key", "missing-marker", [datadogAppKey]);
  add("datadog-application-key", "short-key", ["DD_APPLICATION_KEY=" + datadogAppKey.slice(0, 20)]);

  const grafanaSaBody = synthetic("coverage:grafana-sa:body", 32);
  const grafanaSaChecksum = synthetic("coverage:grafana-sa:checksum", 8, LOWER_HEX);
  positive("grafana-service-account-token", "checksum-segment", [{ secret: `glsa_${grafanaSaBody}_${grafanaSaChecksum}` }]);
  add("grafana-service-account-token", "missing-separator", [`glsa_${grafanaSaBody}${grafanaSaChecksum}`]);
  add("grafana-service-account-token", "short-checksum", [`glsa_${grafanaSaBody}_${grafanaSaChecksum.slice(0, 6)}`]);

  const newRelicLicenseKey = synthetic("coverage:new-relic:license-key", 40, LOWER_HEX);
  positive("new-relic-license-key", "keyword-context", ["newrelic ", { secret: newRelicLicenseKey }]);
  addTwin("new-relic-license-key", "keyword-context", ["newrelic " + newRelicLicenseKey.slice(0, -1)], "length: 39 vs provider-documented 40-character hexadecimal string");
  add("new-relic-license-key", "missing-keyword", [newRelicLicenseKey]);
  add("new-relic-license-key", "short-key", ["newrelic " + newRelicLicenseKey.slice(0, 20)]);

  // #67: HashiCorp's own documentation shows one identical grammar for user,
  // organization and team tokens, so shapes vary the synthetic body, not a
  // kind-specific prefix or structure, since the provider draws no
  // kind-specific distinction (docs/decisions/2026-09-21-add-terraform-
  // cloud-enterprise-token-detection.md).
  const terraformShapes = {};
  for (const kind of ["user", "organization", "team"]) {
    const prefix = synthetic(`coverage:terraform:${kind}:prefix`, 14);
    const suffix = synthetic(`coverage:terraform:${kind}:suffix`, 67);
    terraformShapes[kind] = { prefix, suffix, value: `${prefix}.atlasv1.${suffix}` };
    positive("terraform-cloud-token", `${kind}-shape`, [{ secret: terraformShapes[kind].value }]);
  }
  addTwin("terraform-cloud-token", "user-shape", [terraformShapes.user.value.slice(0, -1)], `length: 66-byte suffix segment vs the provider-documented 67`, "length");
  // The mirrored Terraform Enterprise page confirms .atlasv1. is the only
  // documented version marker; .atlasv2. is malformed by construction.
  addTwin("terraform-cloud-token", "organization-shape", [`${terraformShapes.organization.prefix}.atlasv2.${terraformShapes.organization.suffix}`], "boundary: .atlasv2. marker vs the only documented .atlasv1. version marker", "boundary");
  add("terraform-cloud-token", "missing-marker", [terraformShapes.team.prefix + terraformShapes.team.suffix]);
  add("terraform-cloud-token", "short-suffix", [`${terraformShapes.team.prefix}.atlasv1.${terraformShapes.team.suffix.slice(0, 40)}`]);
  add("terraform-cloud-token", "short-body", [`${terraformShapes.team.prefix.slice(0, 7)}.atlasv1.${terraformShapes.team.suffix.slice(0, 30)}`]);
  add("terraform-cloud-token", "invalid-alphabet", [`${terraformShapes.team.prefix.slice(0, 13)}-.atlasv1.${terraformShapes.team.suffix}`]);
  // HashiCorp's own CLI-configuration documentation shows this doc-style
  // placeholder: a 6-byte prefix and 13-byte suffix, both far short of the
  // documented 14/67 widths.
  add("terraform-cloud-token", "mask", ["xxxxxx.atlasv1.zzzzzzzzzzzzz"]);
  add("terraform-cloud-token", "reference", ["TF_TOKEN_app_terraform_io=${TF_CLOUD_TOKEN}"]);

  // #67: Pulumi's own REST API reference documents no kind-specific prefix
  // for personal, organization or team tokens, so shapes vary the synthetic
  // body under the one documented pul- prefix (docs/decisions/2026-09-21-
  // freeze-pulumi-access-token-grammar.md).
  const pulumiShapes = {};
  for (const kind of ["personal", "organization", "team"]) {
    const body = synthetic(`coverage:pulumi:${kind}:body`, 40, LOWER_HEX);
    pulumiShapes[kind] = `pul-${body}`;
    positive("pulumi-access-token", `${kind}-shape`, [{ secret: pulumiShapes[kind] }]);
  }
  addTwin("pulumi-access-token", "personal-shape", [pulumiShapes.personal.slice(0, -1)], "length: 39-byte body vs the tool-corroborated exact 40", "length");
  // A conditional .toUpperCase() on a synthetic byte is a no-op when that
  // byte lands on a digit; "A" is never a member of the lowercase-hex
  // alphabet, so substituting it always produces a real mutation.
  addTwin("pulumi-access-token", "organization-shape", [pulumiShapes.organization.slice(0, 5) + "A" + pulumiShapes.organization.slice(6)], "alphabet: one uppercase hex byte vs the tool-corroborated lowercase-only body", "alphabet");
  add("pulumi-access-token", "prefix-only", ["pul-"]);
  add("pulumi-access-token", "short-body", [`pul-${pulumiShapes.team.slice(4, 14)}`]);
  add("pulumi-access-token", "invalid-alphabet", [`pul-${pulumiShapes.team.slice(4, 5)}g${pulumiShapes.team.slice(6)}`]);
  add("pulumi-access-token", "trailing-identifier-embedding", [`${pulumiShapes.team}_backup`]);
  add("pulumi-access-token", "mask", [`pul-${"*".repeat(40)}`]);
  add("pulumi-access-token", "reference", ["stack: myorg/myproject/prod"]);

  // #515/#81: docs.supabase.com/guides/platform/personal-access-tokens
  // documents exactly two prefixes (classic sbp_, versioned sbp_v0_), each
  // sharing the identical tool-corroborated 40-byte lowercase-alnum body
  // (docs/decisions/2026-09-20-scope-supabase-management-token-and-secret-
  // key-independence.md). Never mixed with supabase-token's sb_secret_
  // fixtures above; the two credential classes stay evidence-independent.
  const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
  const supabasePatShapes = {};
  for (const [kind, prefix] of [["classic", "sbp_"], ["versioned", "sbp_v0_"]]) {
    const body = synthetic(`coverage:supabase-pat:${kind}:body`, 40, LOWER_ALNUM);
    supabasePatShapes[kind] = `${prefix}${body}`;
    positive("supabase-management-token", `${kind}-shape`, [{ secret: supabasePatShapes[kind] }]);
  }
  addTwin("supabase-management-token", "classic-shape", [supabasePatShapes.classic.slice(0, -1)], "length: 39-byte body vs the tool-corroborated exact 40", "length");
  // The versioned prefix's body shares the classic shape's alphabet; an
  // uppercase byte falls outside is_lower_alnum's [a-z0-9] regardless of
  // which body byte is substituted.
  addTwin("supabase-management-token", "versioned-shape", [supabasePatShapes.versioned.slice(0, 8) + "A" + supabasePatShapes.versioned.slice(9)], "alphabet: one uppercase byte vs the tool-corroborated lowercase-only [a-z0-9] body", "alphabet");
  add("supabase-management-token", "prefix-only", ["sbp_"]);
  add("supabase-management-token", "short-body", [`sbp_${supabasePatShapes.classic.slice(4, 14)}`]);
  add("supabase-management-token", "invalid-alphabet", [`sbp_${supabasePatShapes.classic.slice(4, 5).toUpperCase()}${supabasePatShapes.classic.slice(5)}`]);
  add("supabase-management-token", "mask", [`sbp_${"*".repeat(40)}`]);
  add("supabase-management-token", "reference", ["SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN}"]);

  // #520/#81: projectdiscovery/nuclei-templates's firebase-fcm-server-key-
  // disclosure.yaml is the only corroboration source for the exact width;
  // the literal AAAA prefix and ":" separator are the only structural
  // markers it documents (docs/decisions/2026-09-20-add-firebase-server-
  // key-detection-and-client-config-discrimination.md).
  const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const firebaseServerKey = `AAAA${synthetic("coverage:firebase:segment1", 7, URL_SAFE)}:${synthetic("coverage:firebase:segment2", 140, URL_SAFE)}`;
  positive("firebase-server-key", "server-key", [{ secret: firebaseServerKey }]);
  addTwin("firebase-server-key", "server-key", [firebaseServerKey.replace(":", "-")], "boundary: \"-\" separator vs the corroborated literal \":\" marker", "boundary");
  add("firebase-server-key", "prefix-only", ["AAAA"]);
  add("firebase-server-key", "missing-separator", [firebaseServerKey.replace(":", "")]);
  add("firebase-server-key", "short-body", [firebaseServerKey.slice(0, 40)]);
  add("firebase-server-key", "mask", [`AAAA${"*".repeat(7)}:${"*".repeat(140)}`]);
  add("firebase-server-key", "reference", ["FIREBASE_SERVER_KEY=${FCM_LEGACY_SERVER_KEY}"]);

  // Issue #369: keep these independently authored boundary cases in the
  // expanded corpus. The fixed common-formats snapshot above remains
  // unchanged so historical before/after evidence stays comparable.
  const digitalOceanBody = synthetic(
    "detector-coverage:digitalocean-token:dop_v1_",
    64,
    "0123456789abcdef",
  );
  const digitalOceanToken = `dop_v1_${digitalOceanBody}`;
  add("digitalocean-token", "invalid-alphabet", [
    `dop_v1_${digitalOceanBody.slice(0, 8)}g${digitalOceanBody.slice(9)}`,
  ]);
  add("digitalocean-token", "leading-identifier-embedding", [
    `legacy${digitalOceanToken}`,
  ]);
  add("digitalocean-token", "trailing-identifier-embedding", [
    `${digitalOceanToken}_backup`,
  ]);
  add("digitalocean-token", "dash-identifier-embedding", [
    `${digitalOceanToken}-1`,
  ]);
  add("digitalocean-token", "punctuation-boundary", [
    { secret: digitalOceanToken },
    ",\n",
  ]);
  add("digitalocean-token", "query-boundary", [
    "https://example.invalid/?token=",
    { secret: digitalOceanToken },
    "&x=1\n",
  ]);
  add("digitalocean-token", "repeated", [
    { secret: digitalOceanToken },
    " ",
    { secret: digitalOceanToken },
    "\n",
  ]);

  // #64: the leading/trailing/dash identifier-embedding boundary shape above
  // was applied to digitalocean-token only and never generalised, even
  // though the ledger's `confirmed-boundary-false-positive/<family>` class
  // (redact-secret/redact-secret#551) reproduces the same over-detection —
  // a fully-formed, contracted token concatenated directly into a longer
  // identifier, with no delimiter marking where it starts or ends — on six
  // more families. Each token reuses its shape-1 seed key from the `families`
  // loop above, so the embedded value is identical to that positive fixture.
  const identifierEmbeddingFamilies = [
    ["openai-token", "sk-", 48],
    ["slack-token", "xoxb-", 48],
    ["huggingface-token", "hf_", 34],
    ["docker-token", "dckr_pat_", 32],
    ["cloudflare-token", "cfut_", 40],
    ["linear-token", "lin_api_", 40],
  ];
  for (const [detector, prefix, length] of identifierEmbeddingFamilies) {
    const token = prefix + synthetic(`detector-coverage:${detector}:${prefix}`, length);
    add(detector, "leading-identifier-embedding", [`legacy${token}`]);
    add(detector, "trailing-identifier-embedding", [`${token}_backup`]);
    add(detector, "dash-identifier-embedding", [`${token}-1`]);
  }

  // #66: the loop above covers each family's exact-length primary shape
  // (`lin_api_`, `xoxb-`), which the ledger's confirmed entries for these
  // two families never actually exercised — `linear-token`'s `lin_oauth_`
  // and `slack-token`'s `xoxe-`/`xoxe.xoxb-`/`xoxe.xoxp-`/`xapp-`/`xwfp-`
  // interim guards were still `RunLength::AtLeast` (an open floor over the
  // same alphabet the boundary check itself uses) when redact-secret#551
  // was filed, so a directly-glued wider identifier was silently absorbed
  // into the match instead of tripping the boundary rule. Both guards were
  // turned into an exact 20-byte length by redact-secret#551's fix
  // (docs/decisions/2026-09-20-freeze-slack-user-and-rotation-token-grammar.md's
  // guards, and linear-token's `lin_oauth_`); `xoxe-` here stands in for
  // all five now-identical Slack guards.
  const openFloorIdentifierEmbeddingFamilies = [
    ["linear-token", "oauth", "lin_oauth_", 20],
    ["slack-token", "rotation", "xoxe-", 20],
  ];
  for (const [detector, shape, prefix, length] of openFloorIdentifierEmbeddingFamilies) {
    const token = prefix + synthetic(`detector-coverage:${detector}:${prefix}:open-floor`, length);
    add(detector, `${shape}-leading-identifier-embedding`, [`legacy${token}`]);
    add(detector, `${shape}-trailing-identifier-embedding`, [`${token}_backup`]);
    add(detector, `${shape}-dash-identifier-embedding`, [`${token}-1`]);
  }

  const sendgrid = `SG.${synthetic("coverage:sg:id", 22)}.${synthetic("coverage:sg:secret", 43)}`;
  positive("sendgrid-token", "segmented", [{ secret: sendgrid }]);
  add("sendgrid-token", "prefix-only", ["SG."]);
  add("sendgrid-token", "short-body", ["SG.abc.def"]);

  // Encodes public prose, not DER, OpenSSH key bytes, or a usable private key.
  const pemBody = Buffer.from("Public benchmark text. This is not cryptographic key material.").toString("base64");
  for (const label of ["PRIVATE KEY", "RSA PRIVATE KEY", "DSA PRIVATE KEY", "EC PRIVATE KEY", "OPENSSH PRIVATE KEY", "ENCRYPTED PRIVATE KEY"]) {
    positive("private-key", label.toLowerCase().replaceAll(" ", "-"), [
      { secret: `-----BEGIN ${label}-----\n${pemBody}\n-----END ${label}-----` },
    ]);
  }
  // #62: prefix twin off the generic PRIVATE KEY positive, to clear the
  // stable floor of 5 twin pairs. RFC 7468 §4 documents CERTIFICATE as a
  // distinct textual-encoding label, structurally discriminated from
  // PRIVATE KEY by the redact-secret scanner (empirically verified, since
  // this detector is label-structural, not body-validating: a body-only
  // mutation such as length or alphabet is not discriminated here).
  addTwin("private-key", "private-key", [`-----BEGIN CERTIFICATE-----\n${pemBody}\n-----END CERTIFICATE-----`], "prefix namespace: CERTIFICATE (RFC 7468 §4 distinct textual-encoding label) vs PRIVATE KEY", "prefix");
  add("private-key", "public-block", [`-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`]);
  add("private-key", "label-prose", ["Documentation mentions BEGIN PRIVATE KEY without key material."]);
  // #62: two more benign controls to clear the stable floor of 5.
  add("private-key", "prefix-only", ["-----BEGIN PRIVATE KEY-----"]);
  add("private-key", "reference", ["id_rsa is stored in ~/.ssh/id_rsa on this machine.\n"]);

  // JWT JSON is intelligible, but the signature is fabricated, never signed.
  const encode = object => Buffer.from(JSON.stringify(object)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "benchmark-only", iss: "https://example.invalid", exp: 1 });
  const jwtSignature = synthetic("coverage:jwt:signature", 43);
  positive("jwt", "expired-fabricated", [{ secret: `${header}.${payload}.${jwtSignature}` }]);
  // #62: alphabet twin off the fabricated-but-well-formed positive, to clear
  // the stable floor of 5 twin pairs. RFC 7519 §3 requires base64url
  // encoding for every segment; base64url never uses "+". Mutated in the
  // payload segment, matching jwt-eddsa's precedent (common-formats.mjs): the
  // redact-secret detector validates header/payload charset structurally but
  // not the signature segment's, so a signature-only mutation is not
  // discriminated here (empirically verified).
  addTwin("jwt", "expired-fabricated", [`${header}.${payload.slice(0, 20)}+${payload.slice(21)}.${jwtSignature}`], 'alphabet: one character (+) outside the RFC 7519 base64url alphabet', "alphabet");
  add("jwt", "missing-signature", [`${header}.${payload}.`]);
  add("jwt", "ordinary-dotted-name", ["com.example.benchmark"]);
  // #62: three more benign controls to clear the stable floor of 5.
  add("jwt", "prefix-only", [header]);
  add("jwt", "reference", ["Authorization: Bearer ${JWT_TOKEN}\n"]);
  add("jwt", "mask", [`${header}.${payload}.${"*".repeat(43)}`]);

  const bearer = synthetic("coverage:bearer", 40);
  positive("bearer-token", "header", [{ secret: bearer, envelope: { before: "Authorization: Bearer ", after: "", reason: ENVELOPES.bearer } }]);
  // RFC 6750 §2.1: "!" is outside the b64token alphabet. The detector anchors
  // on "Bearer" 1*SP and greedily consumes a b64token-alphabet run from that
  // fixed position, checking only that head run against the MIN_TOKEN_LEN=16
  // floor; it does not rescan past the first invalid byte for a second run
  // (redact-secret/redact-secret#553, redact-secret-benchmarks#78). Mutating
  // at index 20 of this 40-byte value left the anchored head run at 20 bytes
  // — still over the floor, so the detector matched anyway. The mutation
  // must land inside the first 16 bytes so the anchored run itself falls
  // under the floor; the 31-byte tail past the invalid byte is never an
  // independent match candidate.
  addTwin("bearer-token", "header", [`Authorization: Bearer ${bearer.slice(0, 8)}!${bearer.slice(9)}`], "alphabet: one character (!) outside the RFC 6750 b64token alphabet, inside the 16-byte MIN_TOKEN_LEN floor", "alphabet");
  add("bearer-token", "missing-value", ["Authorization: Bearer\n"]);
  add("bearer-token", "ordinary-prose", ["The bearer of this message is a benchmark runner."]);

  for (const scheme of ["postgres", "mysql", "mariadb", "redis", "mongodb"]) {
    const password = synthetic(`coverage:connection:${scheme}`, 24);
    positive("connection-string", scheme, [
      uri(`${scheme}://fixture:`, password, "@db.example.invalid/benchmark"),
    ]);
    // Context twin (#36): the value has no grammar, so the value is kept and
    // the userinfo ":" delimiter is the one property removed. Without it
    // RFC 3986 §3.2.1 assigns no password subcomponent; the run is a user name.
    addTwin("connection-string", scheme, [`${scheme}://fixture${password}@db.example.invalid/benchmark`], 'context: userinfo has no ":" delimiter, so RFC 3986 assigns no password subcomponent; value unchanged', "context");
  }
  add("connection-string", "no-password", ["postgres://fixture@db.example.invalid/benchmark"]);
  add("connection-string", "public-url", ["https://example.invalid/docs"]);

  for (const kind of ["totp", "hotp"]) {
    const seed = synthetic(`coverage:otp:${kind}`, 32, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
    const before = `otpauth://${kind}/Benchmark:fixture?secret=`, after = "&issuer=Benchmark" + (kind === "hotp" ? "&counter=0" : "");
    positive("otpauth-uri", kind, [{ secret: seed, envelope: { before, after, reason: ENVELOPES.otp } }]);
    // The Key URI format requires an RFC 3548 Base32 secret; "1" is outside that alphabet.
    addTwin("otpauth-uri", kind, [before + seed.slice(0, 16) + "1" + seed.slice(17) + after], "alphabet: one character (1) outside the RFC 3548 Base32 alphabet the Key URI format requires", "alphabet");
  }
  add("otpauth-uri", "missing-secret", ["otpauth://totp/Benchmark:fixture?issuer=Benchmark"]);
  add("otpauth-uri", "short-secret", ["otpauth://totp/Benchmark:fixture?secret=ABC"]);

  for (const field of ["api_key", "password", "client_secret"]) {
    const literal = synthetic(`coverage:generic:${field}`, 28);
    positive("generic-token", field.replaceAll("_", "-"), [quoted(`${field}=`, literal)]);
    // Context twin (#36): same literal, delimiter and quoting; only the field
    // name changes, to one with no credential meaning. The name comes from
    // ordinary usage, never from the product's keyword list.
    addTwin("generic-token", field.replaceAll("_", "-"), [`build_id="${literal}"`], `context: field name build_id carries no credential meaning vs sensitive ${field}; value, delimiter and quoting unchanged`, "context");
    // #66/redact-secret#552: the metamorphic method's `context.markdown`
    // operator wraps this exact positive in a matching pair of backticks
    // (Markdown inline code) with no other change. A backtick sits directly
    // against the key name and against the value's closing quote — neither
    // was in `is_prefix_boundary_char`/`is_quoted_value_boundary`, so the
    // whole assignment went unrecognized (not merely mis-spanned) until
    // redact-secret#552's fix. This static fixture pins that exact shape,
    // independent of a fresh metamorphic run.
    add("generic-token", `${field.replaceAll("_", "-")}-markdown-inline-code-boundary`, ["`", quoted(`${field}=`, literal), "`"]);
  }
  add("generic-token", "reference", ["api_key=process.env.BENCHMARK_KEY"]);
  add("generic-token", "mask", ["password=********"]);

  return {
    "detector-coverage": {
      ...wrap(fixtures),
      scope: "Structural synthetic coverage for all 42 beta.4 detector families. Provider variants reflect the pinned source contracts, not credential validity. PEM bodies are encoded public prose and JWT signatures are fabricated. Connection strings, OTP URIs, Bearer headers, quoted generic assignments, and the context-gated Twilio/Datadog/New Relic license-key bare values label only the secret bytes, with the enclosing URI/header/assignment/identifier as the authored envelope. Expectations are authored before scanning; every mismatch remains scored. No cryptographic validity, live verification, streaming, or cross-surface parity claims.",
      references: ["https://github.com/redact-secret/redact-secret/tree/dade2d69ea0d346cbc331f49eb1b4d4005c6ed34/crates/secret-scan-core/src/detectors"],
    },
  };
}
