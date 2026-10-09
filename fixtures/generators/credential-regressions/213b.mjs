import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";

// Issue #213 corpus, batch b (category `beta8-213b`). See docs/specs/beta8-evidence.md.
//
// Restores nine T1 documented families that were stable at beta.7 and read
// provisional only on documented-profile debt (#239 floors, #206 cells):
// cloudflare-token, gitlab-token, private-key, shopify-token, stripe-token,
// huggingface-token, pypi-token, datadog-api-key and
// grafana-cloud-access-policy-token. Each positive sits on a context axis the
// family did not already carry; each control on a confusion axis named by its
// id suffix. No twin is authored: every family already carries at least five
// twin pairs. Expectations follow each contract in benchmarks/lib/assessment.ts
// (providerSource and review), never scanner output. Every value is synthetic
// (`synthetic()` seeds) or constructed here from the documented grammar (the
// PyPI macaroon per docs/decisions/2026-09-21-author-pypi-macaroon-positives-
// synthetically.md; an RFC 7468 / RFC 8410 PKCS#8 Ed25519 envelope around a
// synthetic seed), never provider-issued or scanner-reported.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BASE64 = `${ALNUM}+/`;
const HEX = "0123456789abcdef";
const DIGITS = "0123456789";
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";

// PyPI: docs.pypi.org/api/secrets — pypi- + base64 PyMacaroon serialization, {85,}.
const macaroonField = (type, content) => Buffer.concat([Buffer.from([type, content.length]), content]);
/** libmacaroons v2 body per the #104 decision: Nil-UUID identifier, one self-naming caveat, hash-filler signature. */
const pypiMacaroon = slug => {
  const caveat = Buffer.from(`permission=synthetic-fixture-213b-${slug.padEnd(4, "x").slice(0, 4)}`, "ascii");
  if (caveat.length !== 38) throw new Error(`beta8-213b: pypi caveat length ${caveat.length}`);
  const signature = createHash("sha256").update(`secret-benchmark:never-issued:v2:beta8:213b:pypi-token:${slug}:signature`).digest();
  const body = Buffer.concat([
    Buffer.from([0x02]),
    macaroonField(1, Buffer.from("pypi.org", "ascii")),
    macaroonField(2, Buffer.from("00000000-0000-0000-0000-000000000000", "ascii")),
    Buffer.from([0x00]),
    macaroonField(2, caveat),
    Buffer.from([0x00, 0x00]),
    macaroonField(6, signature),
  ]);
  return `pypi-${body.toString("base64url").replace(/=+$/, "")}`;
};

// private-key: RFC 8410 §7 PKCS#8 Ed25519 (OneAsymmetricKey, version 0, id-Ed25519, 32-byte seed)
// in an RFC 7468 PRIVATE KEY block. The seed is synthetic hash filler; no key is issued or used.
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ed25519Pem = seedLabel => {
  const seed = createHash("sha256").update(`secret-benchmark:never-issued:v2:${seedLabel}`).digest();
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
  return `-----BEGIN PRIVATE KEY-----\n${der.toString("base64")}\n-----END PRIVATE KEY-----`;
};

export function build213b({ fixture, synthetic }) {
  const c = beta8Corpus("213b", { fixture, synthetic });
  const seed = (target, slug) => `beta8:213b:${target}:${slug}`;
  const uuid = label => { const h = synthetic(label, 32, HEX); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

  // ---------------------------------------------------------------- cloudflare cfut_
  {
    const T = "cloudflare-token";
    // developers.cloudflare.com documents cfut_ as the scannable format; 40 [A-Za-z0-9] + 8 hex is tool-corroborated.
    const token = slug => `cfut_${synthetic(seed(T, slug), 40)}${synthetic(seed(T, `${slug}:checksum`), 8, HEX)}`;
    c.positive(T, "header", "verify-bearer-header", ["GET /client/v4/user/tokens/verify HTTP/1.1\nHost: api.cloudflare.com\n", { secret: token("header"), envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\nContent-Type: application/json\n"], "http");
    c.positive(T, "ci-config", "wrangler-action", ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: cloudflare/wrangler-action@v3\n        with:\n          apiToken: ", { secret: token("ci") }, "\n          command: deploy\n"], "yml");
    c.positive(T, "sdk-config", "terraform-provider", ['provider "cloudflare" {\n  api_token = "', { secret: token("terraform") }, '"\n}\n'], "tf");
    c.control(T, "public-id", "account-and-zone-ids", [`CLOUDFLARE_ACCOUNT_ID=${synthetic(seed(T, "account-id"), 32, HEX)}\nCLOUDFLARE_ZONE_ID=${synthetic(seed(T, "zone-id"), 32, HEX)}\n`], "env");
    c.control(T, "prose", "token-scope-note", ["Give each deploy pipeline its own Cloudflare API token, scoped to one zone, and roll it from the dashboard when someone leaves the team.\n"]);
  }

  // ---------------------------------------------------------------- gitlab glpat-
  {
    const T = "gitlab-token";
    // docs.gitlab.com documents glpat-; the 20-character [A-Za-z0-9_-] legacy body is tool-corroborated.
    const token = slug => `glpat-${synthetic(seed(T, slug), 20, `${ALNUM}_-`)}`;
    c.positive(T, "header", "private-token-header", ["GET /api/v4/projects/4821/merge_requests HTTP/1.1\nHost: gitlab.com\nPRIVATE-TOKEN: ", { secret: token("header") }, "\n"], "http");
    // GitLab's REST API docs accept the token as the private_token query parameter.
    c.positive(T, "url", "private-token-query", ['curl "https://gitlab.com/api/v4/projects/4821/pipelines?status=failed&private_token=', { secret: token("url") }, '"\n'], "sh");
    c.positive(T, "cli", "glab-auth-login", ["$ glab auth login --hostname gitlab.com --token ", { secret: token("cli") }, "\n"], "sh");
    c.control(T, "public-id", "ci-predefined-ids", [`CI_PROJECT_ID=4821\nCI_PIPELINE_ID=1307554219\nCI_COMMIT_SHA=${synthetic(seed(T, "commit-sha"), 40, HEX)}\nCI_SERVER_URL=https://gitlab.com\n`], "env");
    c.control(T, "prose", "expiry-note", ["GitLab personal access tokens now expire after a year at most. Put the renewal date in the team calendar so the release job does not fail on a Monday.\n"]);
  }

  // ---------------------------------------------------------------- private-key (RFC 7468)
  {
    const T = "private-key";
    c.positive(T, "container-config", "k8s-tls-secret", ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: ingress-tls\ntype: kubernetes.io/tls\nstringData:\n  tls.key: |\n    ", { secret: ed25519Pem(seed(T, "k8s")).replaceAll("\n", "\n    ") }, "\n"], "yaml");
    c.positive(T, "tool-output", "openssl-genpkey-stdout", ["$ openssl genpkey -algorithm ed25519\n", { secret: ed25519Pem(seed(T, "openssl")) }, "\n"]);
    c.positive(T, "source-code", "python-signing-key-literal", ['from cryptography.hazmat.primitives import serialization\n\nSIGNING_KEY_PEM = b"""', { secret: ed25519Pem(seed(T, "python")) }, '\n"""\nkey = serialization.load_pem_private_key(SIGNING_KEY_PEM, password=None)\n'], "py");
    const publicKey = Buffer.concat([Buffer.from("0000000b7373682d6564323535313900000020", "hex"), createHash("sha256").update(`secret-benchmark:never-issued:v2:${seed(T, "ssh-public")}`).digest()]).toString("base64");
    c.control(T, "public-id", "authorized-keys-line", [`ssh-ed25519 ${publicKey} deploy@build-01\n`]);
    c.control(T, "encoded-value", "ssh-fingerprint", [`$ ssh-keygen -lf ~/.ssh/id_ed25519.pub\n256 SHA256:${synthetic(seed(T, "fingerprint"), 43, BASE64)} deploy@build-01 (ED25519)\n`]);
    c.control(T, "prose", "rotation-note", ["When a laptop is lost, remove its public key from every authorized_keys file and generate a fresh key pair on the replacement machine.\n"]);
  }

  // ---------------------------------------------------------------- shopify shpat_/shppa_
  {
    const T = "shopify-token";
    // shopify.dev documents shpat_/shppa_; the 32-hex body is tool-corroborated; the contract needs a myshopify.com domain.
    const token = (prefix, slug) => `${prefix}${synthetic(seed(T, slug), 32, HEX)}`;
    c.positive(T, "header", "admin-graphql-header", ["POST /admin/api/2025-07/graphql.json HTTP/1.1\nHost: north-wind-outfitters.myshopify.com\nContent-Type: application/json\nX-Shopify-Access-Token: ", { secret: token("shpat_", "header") }, "\n"], "http");
    c.positive(T, "env", "admin-env", ["SHOPIFY_STORE_DOMAIN=north-wind-outfitters.myshopify.com\nSHOPIFY_ADMIN_ACCESS_TOKEN=", { secret: token("shpat_", "env") }, "\n"], "env");
    c.positive(T, "source-code", "private-app-client", ['const client = new AdminApiClient({\n  storeDomain: "harbor-goods.myshopify.com",\n  apiVersion: "2025-07",\n  accessToken: "', { secret: token("shppa_", "source") }, '",\n});\n'], "js");
    c.control(T, "public-id", "app-toml-client-id", [`client_id = "${synthetic(seed(T, "client-id"), 32, HEX)}"\nname = "inventory-sync"\napplication_url = "https://inventory-sync.example.com"\nembedded = true\n`], "toml");
    c.control(T, "encoded-value", "webhook-hmac-header", [`POST /webhooks/orders-create HTTP/1.1\nX-Shopify-Topic: orders/create\nX-Shopify-Shop-Domain: north-wind-outfitters.myshopify.com\nX-Shopify-Hmac-Sha256: ${Buffer.from(createHash("sha256").update(seed(T, "hmac")).digest()).toString("base64")}\n`], "http");
    c.control(T, "prose", "reinstall-note", ["If the store owner uninstalls the app, its Admin API access token stops working; reinstalling issues a new one.\n"]);
  }

  // ---------------------------------------------------------------- stripe sk_/rk_
  {
    const T = "stripe-token";
    // docs.stripe.com/keys documents sk_live_/sk_test_/rk_live_/rk_test_; the 32-character body is tool-corroborated.
    const key = (prefix, slug) => `${prefix}${synthetic(seed(T, slug), 32)}`;
    c.positive(T, "cli", "curl-basic-user", ["$ curl https://api.stripe.com/v1/customers -u ", { secret: key("sk_test_", "curl") }, ": -d email=ops@example.com\n"], "sh");
    c.positive(T, "sdk-config", "stripe-cli-config", ['[default]\n  device_name = "build-01"\n  display_name = "Acme Payments"\n  test_mode_api_key = "', { secret: key("rk_test_", "cli-config") }, '"\n'], "toml");
    c.positive(T, "source-code", "ruby-api-key", ['require "stripe"\n\nStripe.api_key = "', { secret: key("sk_live_", "ruby") }, '"\n'], "rb");
    c.control(T, "public-id", "publishable-key-and-account", [`STRIPE_PUBLISHABLE_KEY=pk_live_${synthetic(seed(T, "publishable"), 32)}\nSTRIPE_ACCOUNT=acct_${synthetic(seed(T, "account"), 16)}\n`], "env");
    c.control(T, "encoded-value", "signature-header", [`Stripe-Signature: t=1758700800,v1=${synthetic(seed(T, "signature"), 64, HEX)}\n`], "http");
    c.control(T, "prose", "restricted-key-note", ["Prefer a restricted key for the reporting job: it only needs read access to charges and payouts, never write access.\n"]);
  }

  // ---------------------------------------------------------------- huggingface hf_
  {
    const T = "huggingface-token";
    // huggingface.co SDK reference types hf_${string}; 34-character body is example-strength; [A-Za-z0-9] is tool policy.
    const token = slug => `hf_${synthetic(seed(T, slug), 34)}`;
    c.positive(T, "env", "hf-token-env", ["HF_TOKEN=", { secret: token("env") }, "\nHF_HUB_ENABLE_HF_TRANSFER=1\n"], "env");
    c.positive(T, "header", "inference-bearer-header", ["POST /v1/chat/completions HTTP/1.1\nHost: router.huggingface.co\n", { secret: token("header"), envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\nContent-Type: application/json\n"], "http");
    c.positive(T, "cli", "hf-auth-login", ["$ hf auth login --token ", { secret: token("cli") }, " --add-to-git-credential\n"], "sh");
    c.positive(T, "source-code", "inference-client", ['from huggingface_hub import InferenceClient\n\nclient = InferenceClient(provider="auto", api_key="', { secret: token("source") }, '")\n'], "py");
    // huggingface_hub keeps named tokens in ~/.cache/huggingface/stored_tokens (INI, one section per token name).
    c.positive(T, "structured-file", "stored-tokens-ini", ["[ci-uploads]\nhf_token = ", { secret: token("stored") }, "\n"], "ini");
    c.positive(T, "ci-config", "actions-sync-to-hub", ["jobs:\n  sync-to-hub:\n    runs-on: ubuntu-latest\n    env:\n      HF_TOKEN: ", { secret: token("ci") }, "\n    steps:\n      - run: git push https://ml-team:$HF_TOKEN@huggingface.co/spaces/acme/demo-chat main\n"], "yml");
    c.control(T, "public-id", "model-repo-and-revision", [`MODEL_ID=acme/sentiment-distilbert-base\nMODEL_REVISION=${synthetic(seed(T, "revision"), 40, HEX)}\n`], "env");
  }

  // ---------------------------------------------------------------- pypi pypi- macaroon
  {
    const T = "pypi-token";
    c.positive(T, "structured-file", "pypirc", ["[distutils]\nindex-servers =\n    pypi\n\n[pypi]\nusername = __token__\npassword = ", { secret: pypiMacaroon("rc") }, "\n"], "pypirc");
    c.positive(T, "env", "twine-env", ["TWINE_USERNAME=__token__\nTWINE_PASSWORD=", { secret: pypiMacaroon("env") }, "\n"], "env");
    c.positive(T, "cli", "twine-upload-flag", ["$ twine upload --username __token__ --password ", { secret: pypiMacaroon("cli") }, " dist/*\n"], "sh");
    c.positive(T, "shell-export", "uv-publish-token", ["export UV_PUBLISH_TOKEN=", { secret: pypiMacaroon("uv") }, "\nuv publish\n"], "sh");
    c.positive(T, "ci-config", "gitlab-ci-variables", ["release:\n  stage: deploy\n  variables:\n    TWINE_USERNAME: __token__\n    TWINE_PASSWORD: ", { secret: pypiMacaroon("ci") }, "\n  script:\n    - python -m twine upload dist/*\n"], "yml");
    c.positive(T, "source-code", "noxfile-publish", ['import nox\n\n\n@nox.session\ndef publish(session):\n    session.install("twine")\n    session.run("twine", "upload", "-u", "__token__", "-p", "', { secret: pypiMacaroon("nox") }, '", "dist/*")\n'], "py");
  }

  // ---------------------------------------------------------------- datadog API key (context-gated)
  {
    const T = "datadog-api-key";
    // docs.datadoghq.com v1 spec: exactly 32 characters, DD-API-KEY header, DD_API_KEY variable; lowercase hex is tool/code-corroborated.
    // Context-gated: every positive keeps a same-line datadog/dd marker.
    const key = slug => synthetic(seed(T, slug), 32, HEX);
    c.positive(T, "header", "dd-api-key-header", ["POST /api/v2/series HTTP/1.1\nHost: api.datadoghq.com\nContent-Type: application/json\nDD-API-KEY: ", { secret: key("header") }, "\n"], "http");
    c.positive(T, "shell-export", "export-dd-api-key", ["export DD_SITE=datadoghq.eu\nexport DD_API_KEY=", { secret: key("export") }, "\n"], "sh");
    c.positive(T, "container-config", "docker-run-agent", ["docker run -d --name dd-agent \\\n  -e DD_API_KEY=", { secret: key("docker") }, " \\\n  -e DD_SITE=datadoghq.com \\\n  gcr.io/datadoghq/agent:7\n"], "sh");
    c.positive(T, "ci-config", "actions-env", ["jobs:\n  upload-sourcemaps:\n    runs-on: ubuntu-latest\n    env:\n      DD_API_KEY: ", { secret: key("ci") }, "\n    steps:\n      - run: npx @datadog/datadog-ci sourcemaps upload ./dist --service=web\n"], "yml");
    c.positive(T, "cli", "datadog-ci-inline", ["$ DATADOG_API_KEY=", { secret: key("cli") }, " npx @datadog/datadog-ci junit upload --service api ./reports\n"], "sh");
    c.positive(T, "source-code", "python-environ-default", ['import os\n\nos.environ.setdefault("DD_API_KEY", "', { secret: key("source") }, '")\n'], "py");
    c.control(T, "public-id", "api-key-listing", [`API key "ci-uploads"\n  Key ID:  ${uuid(seed(T, "key-id"))}\n  Last 4:  ${synthetic(seed(T, "last4"), 4, HEX)}\n  Created: 2026-08-14\n`]);
    c.control(T, "encoded-value", "audit-fingerprint", [`2026-09-20T12:00:00Z audit api_key.revoked name=ci-uploads fingerprint_sha256=${synthetic(seed(T, "fingerprint"), 64, HEX)}\n`], "log");
    c.control(T, "prose", "agent-note", ["The Datadog Agent on each host reads its API key from the secrets backend at start-up; nobody should paste it into a dashboard or a ticket.\n"]);
  }

  // ---------------------------------------------------------------- grafana cloud glc_
  {
    const T = "grafana-cloud-access-policy-token";
    // grafana.com states access-policy tokens start with glc_; body length and alphabet are gitleaks-corroborated ([A-Za-z0-9+/]{32,}).
    const token = (slug, length) => `glc_${synthetic(seed(T, slug), length, BASE64)}`;
    const instance = synthetic(seed(T, "instance"), 7, DIGITS).replace(/^0/, "1");
    c.positive(T, "env", "access-policy-env", ["GRAFANA_CLOUD_ACCESS_POLICY_TOKEN=", { secret: token("env", 32) }, "\n"], "env");
    c.positive(T, "header", "cloud-api-bearer", ["GET /api/instances HTTP/1.1\nHost: grafana.com\n", { secret: token("header", 64), envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\n"], "http");
    c.positive(T, "sdk-config", "terraform-provider", ['provider "grafana" {\n  alias                     = "cloud"\n  cloud_access_policy_token = "', { secret: token("terraform", 48) }, '"\n}\n'], "tf");
    c.positive(T, "structured-file", "alloy-remote-write", [`prometheus.remote_write "grafana_cloud" {\n  endpoint {\n    url = "https://prometheus-prod-13-prod-us-east-0.grafana.net/api/prom/push"\n    basic_auth {\n      username = "${instance}"\n      password = "`, { secret: token("alloy", 88) }, '"\n    }\n  }\n}\n'], "alloy");
    c.positive(T, "container-config", "compose-otel-env", ["services:\n  otel-collector:\n    image: otel/opentelemetry-collector-contrib:0.110.0\n    environment:\n      GRAFANA_CLOUD_INSTANCE_ID: \"", instance, "\"\n      GRAFANA_CLOUD_API_KEY: ", { secret: token("compose", 40) }, "\n"], "yml");
    c.positive(T, "ci-config", "actions-env", ["jobs:\n  list-stacks:\n    runs-on: ubuntu-latest\n    env:\n      GRAFANA_CLOUD_ACCESS_POLICY_TOKEN: ", { secret: token("ci", 56) }, "\n    steps:\n      - run: curl -sf -H \"Authorization: Bearer $GRAFANA_CLOUD_ACCESS_POLICY_TOKEN\" https://grafana.com/api/orgs/acme/instances\n"], "yml");
    c.control(T, "public-id", "stack-identifiers", [`GRAFANA_CLOUD_STACK=acme-observability\nGRAFANA_CLOUD_INSTANCE_ID=${instance}\nOTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-east-0.grafana.net/otlp\n`], "env");
    c.control(T, "encoded-value", "audit-fingerprint", [`2026-09-20T12:00:00Z audit accesspolicy.token.deleted name=alloy-remote-write fingerprint_sha256=${synthetic(seed(T, "fingerprint"), 64, HEX)}\n`], "log");
    c.control(T, "prose", "scope-note", ["Create a separate Grafana Cloud access policy for each collector with only the metrics:write scope, and delete its token when the collector is retired.\n"]);
  }

  return c.fixtures;
}
