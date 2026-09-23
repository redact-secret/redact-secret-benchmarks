// Authored against the beta.3 format contracts, never scanner output.
// Prefix variants are structural examples, not issued/valid credentials.
import { createHash } from "node:crypto";

// docs/decisions/2026-09-21-author-pypi-macaroon-positives-synthetically.md's
// verified construction: a well-formed libmacaroons v2 body (VERSION,
// LOCATION("pypi.org"), a reserved Nil-UUID IDENTIFIER, one self-naming
// caveat, and a SIGNATURE that is deterministic hash filler, never an HMAC or
// anything key-derived) rather than an arbitrary random run. Every byte that
// decodes to plain text says "synthetic" or "never-issued".
const pypiMacaroonField = (type, content) => Buffer.concat([Buffer.from([type, content.length]), content]);
const PYPI_MACAROON_BODY = (() => {
  const identifier = Buffer.from("00000000-0000-0000-0000-000000000000", "ascii");
  const caveat = Buffer.from("permission=synthetic-benchmark-fixture", "ascii");
  const signature = createHash("sha256").update("secret-benchmark:never-issued:v2:pypi-token:e0-candidate:signature:0").digest();
  const body = Buffer.concat([
    Buffer.from([0x02]), // VERSION
    pypiMacaroonField(1, Buffer.from("pypi.org", "ascii")), // LOCATION
    pypiMacaroonField(2, identifier), // IDENTIFIER
    Buffer.from([0x00]), // EOS (header)
    pypiMacaroonField(2, caveat), // caveat cid
    Buffer.from([0x00, 0x00]), // EOS, EOS
    pypiMacaroonField(6, signature), // SIGNATURE
  ]);
  return body.toString("base64url").replace(/=+$/, "");
})();

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

// #112 re-check (2026-09-22): five of the families #36 recorded un-probeable
// now have a source on the provider's own domain establishing one mutable
// property (research: redact-secret/redact-secret#644, #655, and the
// benchmarks decision 2026-09-22-lift-five-families-out-of-un-probeable.md).
// Each entry maps a contract-valid value to its single-property twin; shared
// by detector-coverage and context-edges so both suites mutate identically.
// Sentry's two families and twilio-auth-token stay un-probeable: their only
// sources are provider-authored but hosted on github.com, which #658/#659/#662
// leave to a maintainer decision.
export const documentedTwins = {
  // Datadog's OpenAPI ApiKey schema (renders docs.datadoghq.com's Key
  // Management reference): key minLength/maxLength 32.
  "datadog-api-key": value => ({ value: value.slice(0, -1), mutationKind: "length",
    mutation: `length: ${value.length - 1} vs the 32 characters Datadog's own OpenAPI ApiKey schema fixes (minLength/maxLength 32)` }),
  // learn.microsoft.com's Purview Entra client secret definition: "a
  // combination of up to 40 characters". "." and "~" are in that alphabet but
  // end an identifier, so one of them at bytes 37-40 would leave a
  // contract-length prefix standing on its own: the value keeps its first 37
  // bytes and runs to 41 on "Z" (inside the alphabet), never containing the
  // positive.
  "microsoft-entra-client-secret": value => {
    const twin = value.slice(0, 37) + "ZZZZ";
    if (twin.includes(value)) throw new Error("Entra length twin contains its positive");
    return { value: twin, mutationKind: "length", mutation: "length: 41 vs the provider-documented maximum of 40 characters" };
  },
  // docs.newrelic.com terraform-intro: "Most user keys begin with the prefix NRAK-".
  "new-relic-user-api-key": value => ({ value: `NRAX-${value.slice(5)}`, mutationKind: "prefix",
    mutation: "prefix namespace: NRAX- vs the provider-documented NRAK- user-key prefix" }),
  // grafana.com's Grafana 9.1 service-accounts GA post: tokens carry "a 'glsa' prefix".
  "grafana-service-account-token": value => ({ value: `glsx_${value.slice(5)}`, mutationKind: "prefix",
    mutation: "prefix namespace: glsx_ vs the provider-documented glsa service-account prefix" }),
  // grafana.com's Cloud access-policy token instructions: "Tokens start with glc_".
  "grafana-cloud-access-policy-token": value => ({ value: `glx_${value.slice(4)}`, mutationKind: "prefix",
    mutation: "prefix namespace: glx_ vs the provider-documented glc_ access-policy token prefix" }),
};

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
  const addTwin = (detector, variant, parts, mutation, mutationKind = "length", twinVariant = variant) => {
    const twin = (suffix, body) => fixtures.push({
      ...fixture(`${detector}-${twinVariant}-${suffix}-twin`, detector, body),
      detectors: [detector],
      twinOf: `${detector}-${variant}-${suffix}`,
      mutation,
      mutationKind,
    });
    twin("bare", parts);
    twin("quoted", ['value="', ...parts, '"\n']);
    twin("unicode-crlf", ["# 🔑 密钥 café\r\n", ...parts, "\r\n"]);
  };
  // A `documentedTwins` mutation of `value`, `before` held constant.
  const documentedTwin = (detector, variant, value, before = "") => {
    const twin = documentedTwins[detector](value);
    addTwin(detector, variant, [before + twin.value], twin.mutation, twin.mutationKind);
  };
  // (detector, prefix index) pairs currently dark for must-redact/T2 twin
  // coverage (docker-token, linear-token, google-api-key, notion-token,
  // atlassian-api-token); one representative shape each is enough to move
  // the corpus-wide floor without inventing coverage for every shape.
  // #128: docker-token's target stays index 1 (dckr_oat_/shape-2), not
  // shape-1 too, once shape-1 is promoted to a scored positive at its own
  // frozen 27-byte length. A length twin on shape-1 would be well-founded
  // (the core's own comment on the frozen grammar documents a 26-byte PAT
  // suffix as an intentional false negative), but this comment's own "one
  // representative shape is enough" rule already covers the family's floor
  // via shape-2's existing twin, so adding a second one is unclaimed scope,
  // not a shape-1 requirement.
  const twinTargets = { "docker-token": 1, "linear-token": 0, "google-api-key": 0, "notion-token": 0, "atlassian-api-token": 0 };
  const SLACK_TAIL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-", HEX_ALPHABET = "0123456789abcdef";
  // #569: `slack-token`'s section grammar (#371/#512) and `cloudflare-token`'s
  // trailing checksum (#367) cannot be expressed by the shared "prefix +
  // one flat run" formula every other family in `families` uses — both were
  // still generating that flat shape after their contracts froze structure,
  // which is why every reviewed prefix here (all but `xapp-`/`xwfp-`,
  // deliberately left pending per #512/#45, tracked in redact-secret#569)
  // silently stopped matching its own detector. Digit-section and tail
  // widths mirror the frozen grammars exactly (see slack.rs's module doc /
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-17-freeze-slack-bot-token-segment-grammar.md
  // and https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-20-freeze-slack-user-and-rotation-token-grammar.md
  // and docs/audits/evidence/367/precision-contracts.json's cloudflare-token
  // entry), not invented here.
  const structuralShapeValue = {
    "slack-token": prefix => {
      const seed = `detector-coverage:slack-token:${prefix}`;
      const digits = (label, n) => synthetic(`${seed}:${label}`, n, "0123456789");
      if (prefix === "xoxb-") return prefix + digits("section-1", 12) + "-" + digits("section-2", 12) + "-" + synthetic(`${seed}:secret`, 24);
      if (prefix === "xoxp-") return prefix + digits("section-1", 12) + "-" + digits("section-2", 12) + "-" + digits("section-3", 12) + "-" + synthetic(`${seed}:secret`, 32);
      if (["xoxe-", "xoxe.xoxb-", "xoxe.xoxp-"].includes(prefix)) return prefix + digits("version", 1) + "-" + synthetic(`${seed}:tail`, 20, SLACK_TAIL_ALPHABET);
      return null; // xapp-/xwfp-: unchanged flat interim shape, exact 20 bytes (redact-secret#551)
    },
    "cloudflare-token": prefix => prefix + synthetic(`detector-coverage:cloudflare-token:${prefix}`, 40) + synthetic(`detector-coverage:cloudflare-token:${prefix}:checksum`, 8, HEX_ALPHABET),
    // #104/#107: a flat "pypi-" + random run is not a serialized macaroon (the
    // gap the ADR closed); PYPI_MACAROON_BODY is the verified construction.
    "pypi-token": prefix => prefix + PYPI_MACAROON_BODY,
    // #128: redact-secret#370 froze two separately sized exact-length shapes
    // (dckr_pat_ 27 bytes, dckr_oat_ 32 bytes), not one shared length; the
    // `families` loop's single `length` column can't express that, so this
    // mirrors buildCommonFormats's already-correct per-prefix lengths.
    "docker-token": prefix => prefix + synthetic(`detector-coverage:docker-token:${prefix}`, prefix === "dckr_pat_" ? 27 : 32),
  };
  for (const [detector, prefixes, length, alphabet] of families) {
    prefixes.forEach((prefix, index) => {
      const structural = structuralShapeValue[detector]?.(prefix);
      const value = structural ?? prefix + synthetic(`detector-coverage:${detector}:${prefix}`,
        detector === "slack-token" ? 20 : length, detector === "slack-token" ? SLACK_TAIL_ALPHABET : alphabet);
      positive(detector, `shape-${index + 1}`, [{ secret: value }]);
      if (twinTargets[detector] === index)
        addTwin(detector, `shape-${index + 1}`, [value.slice(0, -1)], `length: ${value.length - 1} vs contracted ${value.length}`);
      // #36: the IAM prefix table documents AIDA as an IAM-user unique ID, not
      // an access key. The common-formats ID/secret pair stays untwinned: any
      // single mutation leaves its other credential component intact.
      if (detector === "aws-access-key")
        addTwin(detector, `shape-${index + 1}`, ["AIDA" + value.slice(prefix.length)], `prefix namespace: AIDA (provider-documented IAM user unique ID) vs ${prefix} access key`, "prefix");
      // #36/#107: PyPI documents the pypi- prefix as part of the token value.
      if (detector === "pypi-token") {
        addTwin(detector, `shape-${index + 1}`, ["pypx-" + value.slice(prefix.length)], "prefix namespace: pypx- vs provider-documented pypi-", "prefix");
        // docs.pypi.org/api/secrets's own regex is pypi-[A-Za-z0-9-_]{85,}; one
        // byte short of that documented floor, verified quiet against the
        // pinned product (docs/decisions/2026-09-21-author-pypi-macaroon-
        // positives-synthetically.md).
        addTwin(detector, `shape-${index + 1}`, [value.slice(0, prefix.length + 84)], "length: 84-byte body vs the provider's documented {85,} floor", "length", `shape-${index + 1}-length`);
        // Same page's character class is [A-Za-z0-9-_]; a byte outside it
        // immediately after the prefix breaks the same regex.
        addTwin(detector, `shape-${index + 1}`, [prefix + "!" + value.slice(prefix.length + 1)], "alphabet: a byte outside the provider-documented [A-Za-z0-9-_] class immediately after the prefix", "alphabet", `shape-${index + 1}-alphabet`);
      }
      if (documentedTwins[detector]) documentedTwin(detector, `shape-${index + 1}`, value);
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
  // #93: gitlab-token and npm-token were the only two families already
  // reading stable at the staged floor of 2 axes (near-miss, placeholder;
  // docs/decisions/2026-09-21-measure-benign-axis-diversity.md). Raising the
  // floor to 3 in this same change would otherwise regress both, which the
  // acceptance criteria forbid; one reference control each clears it without
  // adding a third near-miss shape.
  add("gitlab-token", "reference", ["GITLAB_TOKEN=${GITLAB_TOKEN}\n"]);
  add("npm-token", "mask", ["npm_" + "*".repeat(36)]);
  add("npm-token", "reference", ["NPM_TOKEN=${NPM_TOKEN}\n"]);
  add("github-token", "mask", ["ghp_" + "*".repeat(36)]);
  // #125: aws-access-key, github-token and slack-token each carried only the
  // near-miss and placeholder axes (benign.minimumAxes 2 < 3). One reference
  // control each — the provider's own documented environment-variable name
  // holding a shell reference, never a value — lands the third axis through
  // the same `reference` suffix rule #93/#105 used for gitlab/npm/DigitalOcean;
  // the axis is derived by controlAxis, not hand-labelled.
  add("aws-access-key", "reference", ["AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}\n"]);
  add("github-token", "reference", ["GITHUB_TOKEN=${GITHUB_TOKEN}\n"]);
  add("slack-token", "reference", ["SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}\n"]);

  // #129: docker-token, huggingface-token, linear-token and openai-token were
  // the last four registered families still reading benignAxes 1 — five
  // copies of the near-miss shape from the families-loop prefix-only/short-
  // body/*-identifier-embedding controls above, no placeholder or reference
  // control among them. Same template as #93/#105/#125: mask (axis
  // placeholder) and one reference control (axis reference), each family's
  // own frozen prefix/length (redact-secret#370, see #128, for docker-token's
  // 27-byte dckr_pat_ body; the other three lengths are `families`' own
  // per-detector column above). linear-token's two prefixes share one
  // detector's evidence (#105's DigitalOcean reasoning), so lin_api_ alone
  // carries both new controls.
  //
  // Reference control env-var names are each provider's own documented one,
  // not invented here: huggingface.co/docs/huggingface_hub/package_reference/
  // environment_variables (HF_TOKEN); linear's SDK reads LINEAR_API_KEY from
  // the environment by convention (@linear/sdk's LinearClient); platform.
  // openai.com's SDK/CLI docs (OPENAI_API_KEY). Docker's personal-access-
  // token page (docs.docker.com/security/access-tokens/personal-access-
  // tokens/) documents no env-var name for a PAT at all — docs.docker.com/
  // guides/gha/ does, for exactly this shell-reference use, naming the
  // secret DOCKER_PASSWORD ("create a new repository secret named
  // DOCKER_PASSWORD, containing your Docker access token"), so that name is
  // used here instead of guessing DOCKER_PAT.
  add("docker-token", "mask", [`dckr_pat_${"*".repeat(27)}`]);
  add("docker-token", "reference", ["DOCKER_PASSWORD=${DOCKER_PASSWORD}\n"]);
  add("huggingface-token", "mask", [`hf_${"*".repeat(34)}`]);
  add("huggingface-token", "reference", ["HF_TOKEN=${HF_TOKEN}\n"]);
  add("linear-token", "mask", [`lin_api_${"*".repeat(40)}`]);
  add("linear-token", "reference", ["LINEAR_API_KEY=${LINEAR_API_KEY}\n"]);
  add("openai-token", "mask", [`sk-${"*".repeat(48)}`]);
  add("openai-token", "reference", ["OPENAI_API_KEY=${OPENAI_API_KEY}\n"]);

  // beta.4 additions: 17 detectors with no dedicated-prefix-plus-run shape
  // simple enough for the families loop above, added when detectors.json
  // was refreshed to the beta.4 registry snapshot.
  const ALNUM_DASH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const BASE64_BODY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const LOWER_HEX = "0123456789abcdef";

  const entraPrefix = synthetic("coverage:entra:prefix", 3, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~");
  const entraSuffix = synthetic("coverage:entra:suffix", 33, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~-");
  positive("microsoft-entra-client-secret", "digit-q-tilde", [{ secret: `${entraPrefix}8Q~${entraSuffix}` }]);
  documentedTwin("microsoft-entra-client-secret", "digit-q-tilde", `${entraPrefix}8Q~${entraSuffix}`);
  add("microsoft-entra-client-secret", "missing-marker", [`${entraPrefix}8${entraSuffix}`]);
  add("microsoft-entra-client-secret", "short-suffix", [`${entraPrefix}8Q~${entraSuffix.slice(0, 28)}`]);
  // redact-secret-benchmarks#161 / redact-secret#655 (web-search pass): a
  // leading '-' in the 3-character lead is a real issued shape (TruffleHog
  // 3.97.4's azure_entra/serviceprincipal/v2 detector and microsoft/security-
  // utilities SEC101/156 both accept it there; four independent field
  // reports confirm it, one measured at 8Q~/40) that the product's
  // PREFIX_LEN=3 alphabet currently excludes — the false negative #161
  // files, not yet fixed in crates/secret-scan-core/src/detectors/
  // microsoft_entra.rs. Only the lead's first byte differs from the
  // digit-q-tilde positive above; its own twins repeat that positive's
  // marker/length structural properties so this shape has the same
  // near-miss coverage.
  const entraLeadingDashPrefix = "-" + synthetic("coverage:entra:leading-dash:prefix-rest", 2, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.~");
  positive("microsoft-entra-client-secret", "leading-dash", [{ secret: `${entraLeadingDashPrefix}8Q~${entraSuffix}` }]);
  documentedTwin("microsoft-entra-client-secret", "leading-dash", `${entraLeadingDashPrefix}8Q~${entraSuffix}`);
  add("microsoft-entra-client-secret", "leading-dash-missing-marker", [`${entraLeadingDashPrefix}8${entraSuffix}`]);
  add("microsoft-entra-client-secret", "leading-dash-short-suffix", [`${entraLeadingDashPrefix}8Q~${entraSuffix.slice(0, 28)}`]);

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
  documentedTwin("datadog-api-key", "env-marker", datadogApiKey, "DD_API_KEY=");
  add("datadog-api-key", "missing-marker", [datadogApiKey]);
  add("datadog-api-key", "short-key", ["DD_API_KEY=" + datadogApiKey.slice(0, 20)]);

  const datadogAppKey = synthetic("coverage:datadog:application-key", 40, LOWER_HEX);
  positive("datadog-application-key", "env-marker", ["DD_APPLICATION_KEY=", { secret: datadogAppKey }]);
  add("datadog-application-key", "missing-marker", [datadogAppKey]);
  add("datadog-application-key", "short-key", ["DD_APPLICATION_KEY=" + datadogAppKey.slice(0, 20)]);

  const grafanaSaBody = synthetic("coverage:grafana-sa:body", 32);
  const grafanaSaChecksum = synthetic("coverage:grafana-sa:checksum", 8, LOWER_HEX);
  positive("grafana-service-account-token", "checksum-segment", [{ secret: `glsa_${grafanaSaBody}_${grafanaSaChecksum}` }]);
  documentedTwin("grafana-service-account-token", "checksum-segment", `glsa_${grafanaSaBody}_${grafanaSaChecksum}`);
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
  // kind-specific distinction (product repo's
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-21-add-terraform-cloud-enterprise-token-detection.md).
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
  // body under the one documented pul- prefix (product repo's
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-21-freeze-pulumi-access-token-grammar.md).
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
  // (product repo's
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-20-scope-supabase-management-token-and-secret-key-independence.md).
  // Never mixed with supabase-token's sb_secret_ fixtures above; the two
  // credential classes stay evidence-independent.
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
  // #84: a conditional .toUpperCase() no-ops when the targeted byte lands on
  // a digit (the [a-z0-9] alphabet's digits have no case), which silently
  // left this control satisfying its own contract's frozen pattern. "A" is
  // never a member of [a-z0-9] regardless of which byte it replaces, matching
  // the unconditional-insertion technique already used for the versioned
  // shape's alphabet twin below.
  add("supabase-management-token", "invalid-alphabet", [`${supabasePatShapes.classic.slice(0, 4)}A${supabasePatShapes.classic.slice(5)}`]);
  add("supabase-management-token", "mask", [`sbp_${"*".repeat(40)}`]);
  add("supabase-management-token", "reference", ["SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN}"]);

  // #520/#81: projectdiscovery/nuclei-templates's firebase-fcm-server-key-
  // disclosure.yaml is the only corroboration source for the exact width;
  // the literal AAAA prefix and ":" separator are the only structural
  // markers it documents (product repo's
  // https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-20-add-firebase-server-key-detection-and-client-config-discrimination.md).
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

  // #105: every digitalocean-token benign control above is a malformed-by-
  // construction near-miss (one axis); stable.benign.minimumAxes = 3 needs
  // distinct reasons, not further truncations of the same shape
  // (docs/decisions/2026-09-21-measure-benign-axis-diversity.md). mask/
  // label-prose (axis: placeholder) and reference (axis: reference) mirror
  // the template #93 already applied to the other T1 families that shared
  // this gap. One design, instantiated across the three documented prefixes
  // rather than authored three times over dop_v1_ alone: the taxonomy's
  // three digitalocean:* families all read this one detector's evidence
  // (`familiesForDetector`), so the axis controls need not be triplicated
  // per prefix to clear every family's gate.
  add("digitalocean-token", "mask", [`doo_v1_${"*".repeat(64)}`]);
  add("digitalocean-token", "label-prose", [
    "Documentation mentions a DigitalOcean API token (dop_v1_/doo_v1_/dor_v1_ prefixes) without embedding the token value.",
  ]);
  add("digitalocean-token", "reference", ["DIGITALOCEAN_ACCESS_TOKEN=${DIGITALOCEAN_TOKEN}\n"]);

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
    ["docker-token", "dckr_pat_", 27],
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
  // (https://github.com/redact-secret/redact-secret/blob/de6add470321f40d7b1cb36808d9f4559e6c2e99/docs/decisions/2026-09-20-freeze-slack-user-and-rotation-token-grammar.md's
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

  // #93: the remaining 23 families sat at exactly two benign controls, both
  // the same malformed-by-construction near-miss axis (#90). mask/reference/
  // label-prose join each family's existing near-miss pair, reusing the same
  // three suffixes #65/#62 already registered in #91's axis table
  // (assessment.ts CONTROL_RULES) rather than a fourth near-miss shape, per
  // this issue's authoring rule against manufacturing more -short-*/-missing-*
  // controls to hit a number.
  add("anthropic-token", "mask", ["sk-ant-api03-" + "*".repeat(80)]);
  add("anthropic-token", "reference", ["ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}\n"]);
  add("anthropic-token", "label-prose", ["Documentation mentions an Anthropic API key (sk-ant-api03- prefix) without embedding the key value."]);

  add("atlassian-api-token", "mask", ["ATAT" + "*".repeat(100)]);
  add("atlassian-api-token", "reference", ["ATLASSIAN_API_TOKEN=${ATLASSIAN_API_TOKEN}\n"]);
  add("atlassian-api-token", "label-prose", ["Documentation mentions an Atlassian API token (ATAT prefix) without embedding the token value."]);

  add("azure-devops-personal-access-token", "mask", ["*".repeat(76) + "AZDO" + "*".repeat(4)]);
  add("azure-devops-personal-access-token", "reference", ["AZURE_DEVOPS_EXT_PAT=${AZURE_DEVOPS_PAT}\n"]);
  add("azure-devops-personal-access-token", "label-prose", ["Documentation mentions an Azure DevOps personal access token (84-character body with the AZDO marker) without embedding the token value."]);

  add("bearer-token", "mask", ["Authorization: Bearer " + "*".repeat(40)]);
  add("bearer-token", "reference", ["Authorization: Bearer ${API_TOKEN}\n"]);
  add("bearer-token", "label-prose", ["Documentation mentions an Authorization Bearer header without embedding the token value."]);

  add("datadog-api-key", "mask", ["DD_API_KEY=" + "*".repeat(32)]);
  add("datadog-api-key", "reference", ["DD_API_KEY=${DATADOG_API_KEY}\n"]);
  add("datadog-api-key", "label-prose", ["Documentation mentions a Datadog API key (DD_API_KEY marker) without embedding the key value."]);

  add("datadog-application-key", "mask", ["DD_APPLICATION_KEY=" + "*".repeat(40)]);
  add("datadog-application-key", "reference", ["DD_APPLICATION_KEY=${DATADOG_APPLICATION_KEY}\n"]);
  add("datadog-application-key", "label-prose", ["Documentation mentions a Datadog application key (DD_APPLICATION_KEY marker) without embedding the key value."]);

  add("discord-bot-token", "mask", [`${"*".repeat(24)}.${"*".repeat(6)}.${"*".repeat(27)}`]);
  add("discord-bot-token", "reference", ["DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}\n"]);
  add("discord-bot-token", "label-prose", ["Documentation mentions a Discord bot token (three-segment, dot-delimited shape) without embedding the token value."]);

  add("google-api-key", "mask", ["AIza" + "*".repeat(35)]);
  add("google-api-key", "reference", ["GOOGLE_API_KEY=${GOOGLE_API_KEY}\n"]);
  add("google-api-key", "label-prose", ["Documentation mentions a Google API key (AIza prefix) without embedding the key value."]);

  add("grafana-cloud-access-policy-token", "mask", ["glc_" + "*".repeat(32)]);
  add("grafana-cloud-access-policy-token", "reference", ["GRAFANA_CLOUD_TOKEN=${GRAFANA_CLOUD_TOKEN}\n"]);
  add("grafana-cloud-access-policy-token", "label-prose", ["Documentation mentions a Grafana Cloud access policy token (glc_ prefix) without embedding the token value."]);

  add("grafana-service-account-token", "mask", [`glsa_${"*".repeat(32)}_${"*".repeat(8)}`]);
  add("grafana-service-account-token", "reference", ["GRAFANA_SERVICE_ACCOUNT_TOKEN=${GRAFANA_SA_TOKEN}\n"]);
  add("grafana-service-account-token", "label-prose", ["Documentation mentions a Grafana service account token (glsa_ prefix) without embedding the token value."]);

  add("microsoft-entra-client-secret", "mask", [`${"*".repeat(3)}8Q~${"*".repeat(33)}`]);
  add("microsoft-entra-client-secret", "reference", ["AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}\n"]);
  add("microsoft-entra-client-secret", "label-prose", ["Documentation mentions a Microsoft Entra client secret without embedding the secret value."]);

  add("new-relic-license-key", "mask", ["newrelic " + "*".repeat(40)]);
  add("new-relic-license-key", "reference", ["NEW_RELIC_LICENSE_KEY=${NEW_RELIC_LICENSE_KEY}\n"]);
  add("new-relic-license-key", "label-prose", ["Documentation mentions a New Relic license key without embedding the key value."]);

  add("new-relic-user-api-key", "mask", ["NRAK-" + "*".repeat(27)]);
  add("new-relic-user-api-key", "reference", ["NEW_RELIC_API_KEY=${NEW_RELIC_API_KEY}\n"]);
  add("new-relic-user-api-key", "label-prose", ["Documentation mentions a New Relic user API key (NRAK- prefix) without embedding the key value."]);

  add("notion-token", "mask", ["secret_" + "*".repeat(43)]);
  add("notion-token", "reference", ["NOTION_TOKEN=${NOTION_TOKEN}\n"]);
  add("notion-token", "label-prose", ["Documentation mentions a Notion integration token (secret_ prefix) without embedding the token value."]);

  add("otpauth-uri", "mask", ["otpauth://totp/Benchmark:fixture?secret=" + "*".repeat(32) + "&issuer=Benchmark"]);
  add("otpauth-uri", "reference", ["TOTP_SECRET=${TOTP_SECRET}\n"]);
  add("otpauth-uri", "label-prose", ["Documentation mentions an otpauth Key URI secret parameter without embedding the seed value."]);

  add("pypi-token", "mask", ["pypi-" + "*".repeat(90)]);
  add("pypi-token", "reference", ["TWINE_PASSWORD=${PYPI_TOKEN}\n"]);
  add("pypi-token", "label-prose", ["Documentation mentions a PyPI API token (pypi- prefix) without embedding the token value."]);
  // #107: three genuinely distinct axes, not further near-miss truncations —
  // pypi.org/help/#apitoken's own "unique identifier displayed on PyPI" (a
  // public, non-secret UUID, never the pypi- prefix), ordinary prose with no
  // embedded value, and an unrelated base64-encoded value that merely looks
  // encoded. Each verified quiet against the pinned product.
  add("pypi-token", "public-id", ["PYPI_TOKEN_ID=3fa85f64-5717-4562-b3fc-2c963f66afa6\n"]);
  add("pypi-token", "ordinary-prose", ["We rotate our PyPI upload credentials every quarter as part of routine key hygiene.\n"]);
  add("pypi-token", "encoded-value", [`X-PyPI-Metadata: ${Buffer.from("release notes: nothing sensitive in this build").toString("base64")}\n`]);

  add("sentry-org-auth-token", "mask", [`sntrys_eyJ${"*".repeat(26)}_${"*".repeat(43)}`]);
  add("sentry-org-auth-token", "reference", ["SENTRY_ORG_AUTH_TOKEN=${SENTRY_ORG_AUTH_TOKEN}\n"]);
  add("sentry-org-auth-token", "label-prose", ["Documentation mentions a Sentry organization auth token (sntrys_ prefix) without embedding the token value."]);

  add("sentry-user-auth-token", "mask", ["sntryu_" + "*".repeat(64)]);
  add("sentry-user-auth-token", "reference", ["SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}\n"]);
  add("sentry-user-auth-token", "label-prose", ["Documentation mentions a Sentry user auth token (sntryu_ prefix) without embedding the token value."]);

  add("supabase-token", "mask", ["sb_secret_" + "*".repeat(40)]);
  add("supabase-token", "reference", ["SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY}\n"]);
  add("supabase-token", "label-prose", ["Documentation mentions a Supabase secret key (sb_secret_ prefix) without embedding the key value."]);

  add("telegram-bot-token", "mask", ["123456:" + "*".repeat(34)]);
  add("telegram-bot-token", "reference", ["TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}\n"]);
  add("telegram-bot-token", "label-prose", ["Documentation mentions a Telegram bot token (digits-colon-secret shape) without embedding the token value."]);

  add("twilio-api-key-secret", "mask", [`SK${"*".repeat(32)} ${"*".repeat(32)}`]);
  add("twilio-api-key-secret", "reference", ["TWILIO_API_KEY_SECRET=${TWILIO_API_KEY_SECRET}\n"]);
  add("twilio-api-key-secret", "label-prose", ["Documentation mentions a Twilio API Key Secret without embedding the secret value."]);

  add("twilio-auth-token", "mask", [`AC${"*".repeat(32)} ${"*".repeat(32)}`]);
  add("twilio-auth-token", "reference", ["TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}\n"]);
  add("twilio-auth-token", "label-prose", ["Documentation mentions a Twilio Auth Token without embedding the token value."]);

  add("vercel-token", "mask", ["vcp_" + "*".repeat(32)]);
  add("vercel-token", "reference", ["VERCEL_TOKEN=${VERCEL_TOKEN}\n"]);
  add("vercel-token", "label-prose", ["Documentation mentions a Vercel access token (vcp_/vci_/vca_/vcr_/vck_ prefixes) without embedding the token value."]);

  return {
    "detector-coverage": {
      ...wrap(fixtures),
      scope: "Structural synthetic coverage for all 42 beta.4 detector families. Provider variants reflect the pinned source contracts, not credential validity. PEM bodies are encoded public prose and JWT signatures are fabricated. Connection strings, OTP URIs, Bearer headers, quoted generic assignments, and the context-gated Twilio/Datadog/New Relic license-key bare values label only the secret bytes, with the enclosing URI/header/assignment/identifier as the authored envelope. Expectations are authored before scanning; every mismatch remains scored. No cryptographic validity, live verification, streaming, or cross-surface parity claims.",
      references: ["https://github.com/redact-secret/redact-secret/tree/dade2d69ea0d346cbc331f49eb1b4d4005c6ed34/crates/secret-scan-core/src/detectors"],
    },
  };
}
