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
  for (const [detector, prefixes, length, alphabet] of families) {
    prefixes.forEach((prefix, index) => {
      positive(detector, `shape-${index + 1}`, [
        { secret: prefix + synthetic(`detector-coverage:${detector}:${prefix}`, length, alphabet) },
      ]);
    });
    add(detector, "prefix-only", [prefixes.join("\n")]);
    add(detector, "short-body", [prefixes.map(prefix => prefix + "abc").join("\n")]);
  }

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
  add("new-relic-license-key", "missing-keyword", [newRelicLicenseKey]);
  add("new-relic-license-key", "short-key", ["newrelic " + newRelicLicenseKey.slice(0, 20)]);

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
  add("private-key", "public-block", [`-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`]);
  add("private-key", "label-prose", ["Documentation mentions BEGIN PRIVATE KEY without key material."]);

  // JWT JSON is intelligible, but the signature is fabricated, never signed.
  const encode = object => Buffer.from(JSON.stringify(object)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "benchmark-only", iss: "https://example.invalid", exp: 1 });
  positive("jwt", "expired-fabricated", [{ secret: `${header}.${payload}.${synthetic("coverage:jwt:signature", 43)}` }]);
  add("jwt", "missing-signature", [`${header}.${payload}.`]);
  add("jwt", "ordinary-dotted-name", ["com.example.benchmark"]);

  positive("bearer-token", "header", [{ secret: synthetic("coverage:bearer", 40), envelope: { before: "Authorization: Bearer ", after: "", reason: ENVELOPES.bearer } }]);
  add("bearer-token", "missing-value", ["Authorization: Bearer\n"]);
  add("bearer-token", "ordinary-prose", ["The bearer of this message is a benchmark runner."]);

  for (const scheme of ["postgres", "mysql", "mariadb", "redis", "mongodb"]) {
    positive("connection-string", scheme, [
      uri(`${scheme}://fixture:`, synthetic(`coverage:connection:${scheme}`, 24), "@db.example.invalid/benchmark"),
    ]);
  }
  add("connection-string", "no-password", ["postgres://fixture@db.example.invalid/benchmark"]);
  add("connection-string", "public-url", ["https://example.invalid/docs"]);

  for (const kind of ["totp", "hotp"]) {
    positive("otpauth-uri", kind, [{
      secret: synthetic(`coverage:otp:${kind}`, 32, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"),
      envelope: { before: `otpauth://${kind}/Benchmark:fixture?secret=`, after: "&issuer=Benchmark" + (kind === "hotp" ? "&counter=0" : ""), reason: ENVELOPES.otp },
    }]);
  }
  add("otpauth-uri", "missing-secret", ["otpauth://totp/Benchmark:fixture?issuer=Benchmark"]);
  add("otpauth-uri", "short-secret", ["otpauth://totp/Benchmark:fixture?secret=ABC"]);

  for (const field of ["api_key", "password", "client_secret"]) {
    positive("generic-token", field.replaceAll("_", "-"), [
      quoted(`${field}=`, synthetic(`coverage:generic:${field}`, 28)),
    ]);
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
