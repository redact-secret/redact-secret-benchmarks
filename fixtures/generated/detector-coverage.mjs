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
];

export function buildDetectorCoverage({ fixture, synthetic, wrap }) {
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

  positive("bearer-token", "header", ["Authorization: Bearer ", { secret: synthetic("coverage:bearer", 40) }]);
  add("bearer-token", "missing-value", ["Authorization: Bearer\n"]);
  add("bearer-token", "ordinary-prose", ["The bearer of this message is a benchmark runner."]);

  for (const scheme of ["postgres", "mysql", "mariadb", "redis", "mongodb"]) {
    positive("connection-string", scheme, [
      `${scheme}://fixture:`, { secret: synthetic(`coverage:connection:${scheme}`, 24) }, "@db.example.invalid/benchmark",
    ]);
  }
  add("connection-string", "no-password", ["postgres://fixture@db.example.invalid/benchmark"]);
  add("connection-string", "public-url", ["https://example.invalid/docs"]);

  for (const kind of ["totp", "hotp"]) {
    positive("otpauth-uri", kind, [
      `otpauth://${kind}/Benchmark:fixture?secret=`,
      { secret: synthetic(`coverage:otp:${kind}`, 32, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567") },
      "&issuer=Benchmark" + (kind === "hotp" ? "&counter=0" : ""),
    ]);
  }
  add("otpauth-uri", "missing-secret", ["otpauth://totp/Benchmark:fixture?issuer=Benchmark"]);
  add("otpauth-uri", "short-secret", ["otpauth://totp/Benchmark:fixture?secret=ABC"]);

  for (const field of ["api_key", "password", "client_secret"]) {
    positive("generic-token", field.replaceAll("_", "-"), [
      `${field}="`, { secret: synthetic(`coverage:generic:${field}`, 28) }, '"',
    ]);
  }
  add("generic-token", "reference", ["api_key=process.env.BENCHMARK_KEY"]);
  add("generic-token", "mask", ["password=********"]);

  return {
    "detector-coverage": {
      ...wrap(fixtures),
      scope: "Structural synthetic coverage for all 25 beta.3 detector families. Provider variants reflect the pinned source contracts, not credential validity. PEM bodies are encoded public prose and JWT signatures are fabricated. Connection strings and OTP URIs label only password/seed bytes. Expectations are authored before scanning; every mismatch remains scored. No cryptographic validity, live verification, streaming, or cross-surface parity claims.",
      references: ["https://github.com/redact-secret/redact-secret/tree/34ea9b92ed8879082e99f56f8f4715ee4e4f1f35/crates/secret-scan-core/src/detectors"],
    },
  };
}
