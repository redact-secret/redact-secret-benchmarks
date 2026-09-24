import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";

// Issue #213, corpus key 213d (category `beta8-213d`). See docs/specs/beta8-evidence.md.
//
// Empirical-route fixture debt, nothing else. The seven T2 families #207 did not
// author (databricks, datadog legacy app key, mailchimp, mailgun, okta, openai,
// postman) are raised to #206's `stable-empirical` cells (40 fixtures, 10 untwinned
// positive/context cases on distinct axes, 14 non-twin controls on 5+ axes, 8 twin
// pairs); atlassian-api-token and firebase-server-key get the five untwinned
// positives #207 left short (5/10) and supabase-token the one it left short (5/6).
// No observation is recorded or implied: the #205 gate stays the blocker.
//
// Every value is built here from a `synthetic()` seed (or, for Atlassian and
// Supabase, a checksum recomputed over a synthetic body with the algorithm #207
// already uses). Nothing is copied from a provider example, an issued credential or
// scanner output. Expectations follow the contracts in benchmarks/lib/assessment.ts.
//
// Grammar disputes are respected (redact-secret#694, #697–#701): no fixture here
// asserts silence on uppercase hex (Databricks, Mailchimp), on a multi-digit
// rotation or data-center suffix beyond the contracted range, on a 31-byte
// Mailchimp body, on a Postman PMAT- collection key, on a Mailgun 32-8-8 triplet,
// on "=" in an Okta body or on a lower-case SSWS scheme. Those properties stay
// recorded uncertainty, never negative expectations; the twins below mutate only
// undisputed properties.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const B64URL = `${ALNUM}_-`;
const LOWER_HEX = "0123456789abcdef";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const DIGITS = "0123456789";
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";
const URI = "URI scheme, user and host are not secret, but redacting the whole connection URI is acceptable; only the password must be covered.";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
/** IEEE CRC32, the same table construction #207 uses for the Atlassian tail. */
function crc32(text) {
  let c = 0xffffffff;
  for (const byte of Buffer.from(text, "ascii")) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * One family's helpers. `pos` records each positive's context so a value twin keeps
 * the context byte-for-byte and a context twin keeps the value byte-for-byte.
 */
function family(c, synthetic, target) {
  const s = (slug, length, chars) => synthetic(`beta8:213d:${target}:${slug}`, length, chars);
  const positives = new Map();
  return {
    s,
    pos(axis, slug, before, value, after = "\n", extension) {
      positives.set(slug, { before, value, after, extension, envelope: null });
      c.positive(target, axis, slug, [before, { secret: value }, after], extension);
    },
    /** A positive whose secret sits in a Bearer header or URI envelope. */
    posEnvelope(axis, slug, before, envelope, value, after = "\n", extension) {
      positives.set(slug, { before: before + envelope.before, value, after: envelope.after + after, extension, envelope });
      c.positive(target, axis, slug, [before, { secret: value, envelope }, after], extension);
    },
    /** A value twin: one documented property of the value differs, the context is unchanged. */
    vtwin(positiveSlug, slug, value, mutation, kind) {
      const p = positives.get(positiveSlug);
      if (!p) throw new Error(`#213d ${target}: no positive ${positiveSlug}`);
      if (value === p.value || value.includes(p.value)) throw new Error(`#213d ${target}: twin ${slug} keeps its positive's value`);
      c.twin(target, positiveSlug, slug, [p.before + value + p.after], mutation, kind, p.extension);
    },
    /** A context twin (context-gated contracts only): the value is kept byte-for-byte, one contiguous edit of its surroundings. */
    ctwin(positiveSlug, slug, { before, after }, mutation) {
      const p = positives.get(positiveSlug);
      if (!p) throw new Error(`#213d ${target}: no positive ${positiveSlug}`);
      c.twin(target, positiveSlug, slug, [(before ?? p.before) + p.value + (after ?? p.after)], mutation, "context", p.extension);
    },
    ctl(axis, slug, content, extension) {
      c.control(target, axis, slug, [content], extension);
    },
  };
}

const uuid = hex => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;

// ---------------------------------------------------------------------------
// databricks-personal-access-token (T2): dapi + 32 lowercase hex, optional "-" + one
// rotation digit (tool-corroborated; redact-secret#697/#698 keep uppercase hex and
// multi-digit suffixes as recorded uncertainty, so neither appears as a negative).
// Existing: 6 twin-anchored detector-coverage positives, 9 twins, 6 controls on 4 axes.
function databricks(c, synthetic) {
  const f = family(c, synthetic, "databricks-personal-access-token");
  const pat = (slug, rotation) => `dapi${f.s(`pat:${slug}`, 32, LOWER_HEX)}${rotation ? `-${rotation}` : ""}`;
  const host = "https://adb-4417902378212305.5.azuredatabricks.net";
  f.pos("env", "env", `DATABRICKS_HOST=${host}\nDATABRICKS_TOKEN=`, pat("env"), "\n", "env");
  f.pos("shell-export", "shell-export", `export DATABRICKS_HOST=${host}\nexport DATABRICKS_TOKEN=`, pat("export"), "\n", "sh");
  f.posEnvelope("header", "rest-bearer", `GET /api/2.0/clusters/list HTTP/1.1\nHost: adb-4417902378212305.5.azuredatabricks.net\n`,
    { before: "Authorization: Bearer ", after: "", reason: BEARER }, pat("header"), "\n", "http");
  f.pos("structured-file", "databrickscfg", `[DEFAULT]\nhost  = ${host}\ntoken = `, pat("cfg"), "\n", "cfg");
  f.pos("sdk-config", "terraform-provider", `provider "databricks" {\n  host  = "${host}"\n  token = "`, pat("terraform"), "\"\n}\n", "tf");
  f.pos("source-code", "sdk-workspace-client", `from databricks.sdk import WorkspaceClient\n\nw = WorkspaceClient(host="${host}", token="`, pat("python"), "\")\n", "py");
  f.pos("ci-config", "actions-env", `jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    env:\n      DATABRICKS_HOST: ${host}\n      DATABRICKS_TOKEN: `, pat("actions", 2), "\n", "yml");
  f.pos("cli", "cli-env-prefix", "$ DATABRICKS_TOKEN=", pat("cli"), ` databricks clusters list --output json\n`, "sh");
  f.pos("tool-output", "tokens-create-json", `$ databricks tokens create --comment "ci deploy" --lifetime-seconds 7776000\n{\n  "token_info": {\n    "comment": "ci deploy",\n    "creation_time": 1758700800000,\n    "expiry_time": 1766476800000\n  },\n  "token_value": "`, pat("create"), "\"\n}\n");
  f.pos("url", "jdbc-url", "spark.datasource.url=jdbc:databricks://adb-4417902378212305.5.azuredatabricks.net:443/default;transportMode=http;ssl=1;httpPath=sql/protocolv1/o/4417902378212305/0923-164208-abcde123;AuthMech=3;UID=token;PWD=",
    pat("jdbc"), "\n", "properties");

  f.ctl("public-id", "workspace-ids", `DATABRICKS_HOST=${host}\nDATABRICKS_WAREHOUSE_ID=${f.s("warehouse", 16, LOWER_HEX)}\nDATABRICKS_WORKSPACE_ID=4417902378212305\n`, "env");
  f.ctl("public-id", "job-run-url", `Run 81236 finished: ${host}/?o=4417902378212305#job/734012/run/81236 (cluster 0923-164208-abcde123)\n`, "log");
  f.ctl("encoded-value", "wheel-checksum", `${f.s("wheel", 64, LOWER_HEX)}  databricks_sdk-0.34.0-py3-none-any.whl\n`);
  f.ctl("near-miss", "identifier-prefix", "const dapiClient = createDapiClient({ retries: 3 });\nexport default dapiClient;\n", "js");
  f.ctl("near-miss", "truncated-audit", `2026-09-24T10:00:00Z audit token.used prefix=dapi${f.s("audit", 8, LOWER_HEX)} user=svc-deploy\n`, "log");
  f.ctl("reference", "secret-scope", "spark.hadoop.fs.azure.account.key={{secrets/ci-scope/storage-key}}\ntoken = {{secrets/ci-scope/databricks-token}}\n", "conf");
  f.ctl("reference", "actions-secret", "env:\n  DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}\n", "yml");
  f.ctl("placeholder", "cfg-template", `[DEFAULT]\nhost  = ${host}\ntoken = <personal-access-token>\n`, "cfg");
  f.ctl("prose", "oauth-note", "Databricks recommends OAuth machine-to-machine credentials over personal access tokens for unattended jobs; revoke a token from User Settings when a pipeline no longer needs it.\n", "md");
}

// ---------------------------------------------------------------------------
// datadog-application-key-legacy (T2, context-gated): bare 40 lowercase hex, scored as
// policy beside a same-line DD_APPLICATION_KEY / datadog marker. Existing: 11 positives
// (3 twin-anchored), 3 length twins, 5 controls on 3 axes.
function datadogLegacy(c, synthetic) {
  const f = family(c, synthetic, "datadog-application-key-legacy");
  const key = slug => f.s(`key:${slug}`, 40, LOWER_HEX);
  f.pos("shell-export", "shell-export", "export DD_APPLICATION_KEY=", key("export"), "\n", "sh");
  f.pos("cli", "curl-validate", `curl -s "https://api.datadoghq.com/api/v1/validate" -H "DD-API-KEY: \${DD_API_KEY}" -H "DD-APPLICATION-KEY: `, key("curl"), "\"\n", "sh");
  f.pos("sdk-config", "tfvars", "datadog_app_key = \"", key("tfvars"), "\"\n", "tfvars");
  f.pos("ci-config", "actions-env", "jobs:\n  monitors:\n    runs-on: ubuntu-latest\n    env:\n      DD_APPLICATION_KEY: ", key("actions"), "\n", "yml");
  f.pos("container-config", "compose-env", "services:\n  reporter:\n    environment:\n      - DD_APPLICATION_KEY=", key("compose"), "\n", "yml");
  f.pos("structured-file", "settings-json", "{\n  \"datadogAppKey\": \"", key("json"), "\"\n}\n", "json");
  f.pos("log", "debug-log", "2026-09-24T10:00:00Z DEBUG monitor-sync datadog client configured app_key=", key("log"), "\n", "log");

  // Twins: two context twins (same value, the Datadog marker replaced by an ordinary
  // 40-hex companion), and three value twins on width and alphabet.
  f.ctwin("shell-export", "commit-sha-context", { before: "export GIT_COMMIT_SHA=" },
    "context: the same-line DD_APPLICATION_KEY marker replaced by GIT_COMMIT_SHA, an ordinary 40-hex companion; the value is unchanged");
  f.ctwin("actions-env", "commit-sha-ci-context", { before: "jobs:\n  monitors:\n    runs-on: ubuntu-latest\n    env:\n      BUILD_COMMIT: " },
    "context: the DD_APPLICATION_KEY marker replaced by BUILD_COMMIT; the value is unchanged");
  f.vtwin("tfvars", "long", (() => { const v = key("tfvars"); return `${v.slice(0, 20)}${f.s("tf-extra", 1, LOWER_HEX)}${v.slice(20)}`; })(),
    "length: 41 hex characters (one extra hex byte at offset 20) vs the 40 both pinned tools and Datadog's validators corroborate", "length");
  f.vtwin("compose-env", "short", key("compose").slice(0, 39), "length: 39 hex characters vs the corroborated 40", "length");
  f.vtwin("settings-json", "alphabet", (() => { const v = key("json"); return `${v.slice(0, 20)}g${v.slice(21)}`; })(),
    "alphabet: one \"g\" at offset 20, outside the corroborated [a-f0-9] body; width unchanged", "alphabet");

  f.ctl("public-id", "key-id-and-site", `DD_SITE=datadoghq.eu\nDD_APP_KEY_ID=${uuid(f.s("key-id", 32, LOWER_HEX))}\n`, "env");
  f.ctl("public-id", "git-commit-sha", `DD_GIT_REPOSITORY_URL=https://github.com/example-benchmark/reporter\nDD_GIT_COMMIT_SHA=${f.s("commit", 40, LOWER_HEX)}\n`, "env");
  f.ctl("encoded-value", "agent-image-digest", `image: gcr.io/datadoghq/agent@sha256:${f.s("digest", 64, LOWER_HEX)}\n`, "yml");
  f.ctl("near-miss", "short-hex", `DD_APPLICATION_KEY=${f.s("short", 32, LOWER_HEX)}\n`, "env");
  f.ctl("near-miss", "dashed-uuid", `DD_APPLICATION_KEY=${uuid(f.s("uuid", 32, LOWER_HEX))}\n`, "env");
  f.ctl("reference", "actions-secret", "env:\n  DD_APPLICATION_KEY: ${{ secrets.DD_APPLICATION_KEY }}\n", "yml");
  f.ctl("reference", "vault-lookup", "export DD_APPLICATION_KEY=\"$(vault kv get -field=app_key secret/datadog)\"\n", "sh");
  f.ctl("placeholder", "template", "DD_APPLICATION_KEY=<YOUR_DATADOG_APPLICATION_KEY>\n", "env");
  f.ctl("prose", "migration-note", "Datadog application keys created before the ddapp_ prefix are 40 hexadecimal characters; rotate them from Organization Settings and scope the replacements.\n", "md");
}

// ---------------------------------------------------------------------------
// mailchimp-api-key (T2): 32 lowercase hex + "-us" + one or two digits, with the
// same-line mailchimp keyword the product and gitleaks require. #697–#699 keep
// uppercase hex, a 3-digit data center and the 31-byte provider example as recorded
// uncertainty: no twin here uses them. Existing: 6 twin-anchored positives, 6 twins
// (length, boundary), 6 controls on 4 axes.
function mailchimp(c, synthetic) {
  const f = family(c, synthetic, "mailchimp-api-key");
  const key = (slug, dc) => `${f.s(`key:${slug}`, 32, LOWER_HEX)}-us${dc}`;
  f.pos("env", "env", "MAILCHIMP_API_KEY=", key("env", 6), "\n", "env");
  f.pos("shell-export", "shell-export", "export MAILCHIMP_API_KEY=", key("export", 21), "\n", "sh");
  f.pos("basic-auth", "curl-user", "curl -sS 'https://us14.api.mailchimp.com/3.0/ping' --user \"anystring:", key("curl", 14), "\"\n", "sh");
  f.pos("tool-output", "heroku-config", "$ heroku config --app newsletter-worker | grep MAILCHIMP\nMAILCHIMP_API_KEY:        ", key("tool", 8), "\nMAILCHIMP_SERVER_PREFIX:  us8\n");
  f.pos("source-code", "marketing-client", "mailchimp.setConfig({ apiKey: \"", key("node", 19), "\", server: \"us19\" });\n", "js");
  f.pos("sdk-config", "tfvars", "mailchimp_api_key = \"", key("tfvars", 2), "\"\n", "tfvars");
  f.pos("structured-file", "settings-json", "{\n  \"mailchimpApiKey\": \"", key("json", 10), "\",\n  \"audienceId\": \"a1b2c3d4e5\"\n}\n", "json");
  f.pos("ci-config", "actions-env", "jobs:\n  newsletter:\n    runs-on: ubuntu-latest\n    env:\n      MAILCHIMP_API_KEY: ", key("actions", 13), "\n", "yml");
  f.pos("container-config", "compose-env", "services:\n  newsletter:\n    environment:\n      - MAILCHIMP_API_KEY=", key("compose", 4), "\n", "yml");
  f.pos("prose", "handoff-note", "Mailchimp key for the weekly digest job: ", key("prose", 20), "\n", "md");
  // Twin anchors.
  f.pos("log", "client-log", "2026-09-24T10:00:00Z INFO mailchimp client init api_key=", key("log", 6), "\n", "log");
  f.pos("header", "curl-bearer", "curl -sS https://us21.api.mailchimp.com/3.0/lists -H \"Authorization: Bearer ", key("header", 21), "\"\n", "sh");
  f.vtwin("client-log", "separator", key("log", 6).replace("-us", "_us"), "boundary: \"_\" instead of the documented \"-\" before the us<N> data-center suffix; body and suffix unchanged", "boundary");
  f.vtwin("curl-bearer", "alphabet", (() => { const v = key("header", 21); return `${v.slice(0, 16)}z${v.slice(17)}`; })(),
    "alphabet: one lowercase \"z\" at offset 16, outside the hex body of every pinned tool and both Mailchimp examples (the 2009 staff regex and keyhacks admit g-z, so this is not asserted: docs/decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md); width and suffix unchanged", "alphabet");

  f.ctl("public-id", "audience-and-campaign", "MAILCHIMP_SERVER_PREFIX=us21\nMAILCHIMP_AUDIENCE_ID=4f2a91c07e\nMAILCHIMP_CAMPAIGN_ID=b03d7e1f52\n", "env");
  f.ctl("public-id", "list-webhook-url", "Webhook: https://us21.api.mailchimp.com/3.0/lists/4f2a91c07e/webhooks/7c1e04ab9d\n", "md");
  f.ctl("encoded-value", "subscriber-hash", `PUT https://us21.api.mailchimp.com/3.0/lists/4f2a91c07e/members/${createHash("md5").update("fixture@example.invalid").digest("hex")}\n`, "http");
  f.ctl("near-miss", "short-body-suffix", `MAILCHIMP_API_KEY=${f.s("short", 24, LOWER_HEX)}-us6\n`, "env");
  f.ctl("reference", "vault-lookup", "export MAILCHIMP_API_KEY=\"$(vault kv get -field=api_key secret/mailchimp)\"\n", "sh");
  f.ctl("placeholder", "docs-template", "mailchimp.setConfig({ apiKey: \"YOUR_API_KEY\", server: \"YOUR_SERVER_PREFIX\" });\n", "js");
  f.ctl("prose", "datacenter-note", "Mailchimp API keys end in a data-center suffix such as us6; the same suffix is the subdomain every Marketing API call goes to.\n", "md");
  f.ctl("reference", "process-env", "mailchimp.setConfig({ apiKey: process.env.MAILCHIMP_API_KEY, server: process.env.MAILCHIMP_SERVER_PREFIX });\n", "js");
}

// ---------------------------------------------------------------------------
// mailgun-api-key (T2): key- + 32 [a-z0-9], with the same-line mailgun keyword.
// #701 keeps the prefix-less 32-8-8 triplet as recorded uncertainty: it appears
// nowhere here. Existing: 6 positives (3 twin-anchored), 9 twins, 6 controls on 4 axes.
function mailgun(c, synthetic) {
  const f = family(c, synthetic, "mailgun-api-key");
  const key = slug => `key-${f.s(`key:${slug}`, 32, LOWER_ALNUM)}`;
  f.pos("env", "env", "MAILGUN_DOMAIN=mg.example.invalid\nMAILGUN_API_KEY=", key("env"), "\n", "env");
  f.pos("shell-export", "shell-export", "export MAILGUN_API_KEY=", key("export"), "\n", "sh");
  f.pos("basic-auth", "curl-user", "curl -s --user 'api:", key("curl"), "' https://api.mailgun.net/v3/mg.example.invalid/messages -F to=fixture@example.invalid -F subject=Hello\n", "sh");
  f.pos("tool-output", "heroku-config", "$ heroku config --app notify-worker | grep MAILGUN\nMAILGUN_API_KEY:  ", key("tool"), "\nMAILGUN_DOMAIN:   mg.example.invalid\n");
  f.pos("source-code", "node-client", "const mg = mailgun.client({ username: 'api', key: '", key("node"), "' });\n", "js");
  f.pos("sdk-config", "anymail-settings", "ANYMAIL = {\"MAILGUN_API_KEY\": \"", key("anymail"), "\", \"MAILGUN_SENDER_DOMAIN\": \"mg.example.invalid\"}\n", "py");
  f.pos("structured-file", "settings-json", "{\n  \"mailgunApiKey\": \"", key("json"), "\"\n}\n", "json");
  f.pos("ci-config", "actions-env", "jobs:\n  notify:\n    runs-on: ubuntu-latest\n    env:\n      MAILGUN_API_KEY: ", key("actions"), "\n", "yml");
  f.pos("log", "debug-log", "2026-09-24T10:00:00Z DEBUG mailgun transport ready api_key=", key("log"), "\n", "log");

  f.ctl("public-id", "domain-and-message-id", "MAILGUN_DOMAIN=mg.example.invalid\nMAILGUN_REGION=eu\nLast message: <20260924100000.1.A1B2C3D4E5F60718@mg.example.invalid>\n", "env");
  f.ctl("public-id", "public-validation-key", `const validator = mailgunValidator({ publicKey: "pubkey-${f.s("pubkey", 32, LOWER_HEX)}" });\n`, "js");
  f.ctl("encoded-value", "package-checksum", `${f.s("checksum", 64, LOWER_HEX)}  mailgun.js-10.2.3.tgz\n`);
  f.ctl("near-miss", "short-body", `MAILGUN_API_KEY=key-${f.s("short", 16, LOWER_ALNUM)}\n`, "env");
  f.ctl("near-miss", "setting-name", "MAILGUN_KEY_ROTATION_DAYS=90\nMAILGUN_KEY_OWNER=platform-team\n", "env");
  f.ctl("reference", "actions-secret", "env:\n  MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}\n", "yml");
  f.ctl("reference", "django-env", "ANYMAIL = {\"MAILGUN_API_KEY\": os.environ[\"MAILGUN_API_KEY\"]}\n", "py");
  f.ctl("placeholder", "docs-template", "curl -s --user 'api:YOUR_API_KEY' https://api.mailgun.net/v3/YOUR_DOMAIN_NAME/messages\n", "sh");
  f.ctl("prose", "key-types-note", "Mailgun issues account API keys, domain sending keys and a webhook signing key; store each in the secret manager and rotate it when a teammate leaves.\n", "md");
  f.ctl("placeholder", "masked-dashboard", "Mailgun API key: key-••••••••••••••••••••••••••••a4f1 (hidden)\n", "md");
}

// ---------------------------------------------------------------------------
// okta-api-token (T2): 00 + 40 [A-Za-z0-9_-], in an SSWS header or beside a same-line
// okta keyword. redact-secret#694 keeps "=" in the body and the SSWS scheme's case
// as recorded uncertainty: no fixture here asserts silence on either. Existing: 6
// twin-anchored positives, 9 twins, 6 controls on 4 axes.
function okta(c, synthetic) {
  const f = family(c, synthetic, "okta-api-token");
  const token = slug => `00${f.s(`token:${slug}`, 40, B64URL)}`;
  const org = "https://dev-31415926.okta.com";
  f.pos("header", "raw-request", "GET /api/v1/users?limit=25 HTTP/1.1\nHost: dev-31415926.okta.com\nAccept: application/json\nAuthorization: SSWS ", token("header"), "\n", "http");
  f.pos("env", "env", `OKTA_ORG_URL=${org}\nOKTA_API_TOKEN=`, token("env"), "\n", "env");
  f.pos("shell-export", "shell-export", "export OKTA_CLIENT_TOKEN=", token("export"), "\n", "sh");
  f.pos("sdk-config", "tfvars", "okta_api_token = \"", token("tfvars"), "\"\n", "tfvars");
  f.pos("source-code", "node-client", `const client = new okta.Client({ orgUrl: '${org}', token: '`, token("node"), "' });\n", "js");
  f.pos("cli", "curl-ssws", `curl -s ${org}/api/v1/groups -H "Accept: application/json" -H "Authorization: SSWS `, token("curl"), "\"\n", "sh");
  f.pos("structured-file", "settings-json", "{\n  \"oktaApiToken\": \"", token("json"), "\"\n}\n", "json");
  f.pos("ci-config", "actions-env", "jobs:\n  scim-sync:\n    runs-on: ubuntu-latest\n    env:\n      OKTA_API_TOKEN: ", token("actions"), "\n", "yml");
  f.pos("container-config", "compose-env", "services:\n  scim-bridge:\n    environment:\n      - OKTA_CLIENT_TOKEN=", token("compose"), "\n", "yml");
  f.pos("log", "request-log", "2026-09-24T10:00:00Z DEBUG okta-sync request headers {\"Authorization\": \"SSWS ", token("log"), "\"}\n", "log");

  f.ctl("public-id", "user-and-group-ids", `{"id": "00u${f.s("user", 17, ALNUM)}", "status": "ACTIVE", "groups": ["00g${f.s("group", 17, ALNUM)}"]}\n`, "json");
  f.ctl("public-id", "api-token-listing", `$ okta api-tokens list\nID                    NAME         CLIENT       LAST USED\n00T${f.s("token-id", 17, ALNUM)}  scim-bridge  Okta API     2026-09-20\n`);
  f.ctl("encoded-value", "cli-checksum", `${f.s("checksum", 64, LOWER_HEX)}  okta-cli-0.10.0-linux-x86_64.tar.gz\n`);
  f.ctl("near-miss", "short-token", `Authorization: SSWS 00${f.s("short", 24, B64URL)}\n`, "http");
  f.ctl("reference", "postman-variable", "Authorization: SSWS {{apiKey}}\nHost: {{url}}\n", "http");
  f.ctl("reference", "actions-secret", "env:\n  OKTA_API_TOKEN: ${{ secrets.OKTA_API_TOKEN }}\n", "yml");
  f.ctl("placeholder", "docs-template", `curl -s ${org}/api/v1/users -H "Authorization: SSWS \${api_token}"\n`, "sh");
  f.ctl("prose", "rotation-note", "Okta API tokens inherit the permissions of the admin who created them and expire after 30 days without use; create them from a dedicated service account.\n", "md");
  f.ctl("placeholder", "masked-console", "OKTA_API_TOKEN=00••••••••••••••••••••••••••••••••••••••••\n", "env");
}

// ---------------------------------------------------------------------------
// openai-token (T2): sk- + 20 + T3BlbkFJ + 20 (legacy), or sk-proj-/sk-svcacct- + 74 +
// T3BlbkFJ + 74 over [A-Za-z0-9_-] (tool-corroborated). Existing: 15 positives (6
// twin-anchored in common-formats), 6 twins (boundary, length), 7 controls on 3 axes.
function openai(c, synthetic) {
  const f = family(c, synthetic, "openai-token");
  const proj = (slug, kind = "proj") => `sk-${kind}-${f.s(`${kind}:${slug}:a`, 74, B64URL)}T3BlbkFJ${f.s(`${kind}:${slug}:b`, 74, B64URL)}`;
  const legacy = slug => `sk-${f.s(`legacy:${slug}:a`, 20, ALNUM)}T3BlbkFJ${f.s(`legacy:${slug}:b`, 20, ALNUM)}`;
  f.pos("env", "env", "OPENAI_API_KEY=", proj("env"), "\n", "env");
  f.pos("source-code", "python-client", "from openai import OpenAI\n\nclient = OpenAI(api_key=\"", proj("python", "svcacct"), "\")\n", "py");
  f.pos("shell-export", "shell-export", "export OPENAI_API_KEY=", proj("export"), "\n", "sh");
  f.pos("ci-config", "actions-env", "jobs:\n  evals:\n    runs-on: ubuntu-latest\n    env:\n      OPENAI_API_KEY: ", legacy("actions"), "\n", "yml");
  // Twin anchors.
  const headerKey = proj("header"), sdkKey = proj("sdk");
  f.posEnvelope("header", "raw-request", "POST /v1/responses HTTP/1.1\nHost: api.openai.com\nContent-Type: application/json\n",
    { before: "Authorization: Bearer ", after: "", reason: BEARER }, headerKey, "\n", "http");
  f.pos("sdk-config", "mcp-server-env", "{\n  \"mcpServers\": {\n    \"evals\": {\n      \"command\": \"npx\",\n      \"env\": { \"OPENAI_API_KEY\": \"", sdkKey, "\" }\n    }\n  }\n}\n", "json");
  f.vtwin("raw-request", "prefix", `xk-${headerKey.slice(3)}`,
    "prefix: the sk- stem of sk-proj- broken (xk-proj-, not an OpenAI prefix); marker, widths and alphabet unchanged", "prefix");
  f.vtwin("mcp-server-env", "alphabet", `${sdkKey.slice(0, 40)}.${sdkKey.slice(41)}`,
    "alphabet: one \".\" in the first 74-character run, outside [A-Za-z0-9_-]; prefix, marker and width unchanged", "alphabet");

  f.ctl("public-id", "org-and-project-ids", `OPENAI_ORG_ID=org-${f.s("org", 24, ALNUM)}\nOPENAI_PROJECT_ID=proj_${f.s("project", 24, ALNUM)}\n`, "env");
  f.ctl("public-id", "response-ids", `HTTP/1.1 200 OK\nx-request-id: req_${f.s("request", 32, LOWER_HEX)}\nopenai-processing-ms: 412\n\n{"id": "resp_${f.s("response", 48, LOWER_HEX)}", "model": "gpt-4.1-mini"}\n`, "http");
  f.ctl("encoded-value", "wheel-checksum", `${f.s("wheel", 64, LOWER_HEX)}  openai-1.51.0-py3-none-any.whl\n`);
  f.ctl("near-miss", "truncated-log", `2026-09-24T10:00:00Z WARN evals invalid key sk-proj-${f.s("truncated", 12, ALNUM)} (401)\n`, "log");
  f.ctl("reference", "python-env", "client = OpenAI(api_key=os.environ[\"OPENAI_API_KEY\"])\n", "py");
  f.ctl("placeholder", "docs-template", "OPENAI_API_KEY=sk-proj-...\n", "env");
  f.ctl("prose", "project-keys-note", "OpenAI project keys are scoped to one project; create a service account key for CI rather than sharing a personal key.\n", "md");
  f.ctl("reference", "actions-secret", "env:\n  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}\n", "yml");
}

// ---------------------------------------------------------------------------
// postman-api-key (T2): PMAK- + 24 hex + "-" + 34 hex (gitleaks-corroborated
// structure). redact-secret#700 keeps the PMAT- collection access key undecided: it
// appears nowhere here. Existing: 3 twin-anchored positives, 9 twins, 6 controls.
function postman(c, synthetic) {
  const f = family(c, synthetic, "postman-api-key");
  const key = slug => `PMAK-${f.s(`key:${slug}:a`, 24, LOWER_HEX)}-${f.s(`key:${slug}:b`, 34, LOWER_HEX)}`;
  f.pos("header", "raw-request", "GET /collections HTTP/1.1\nHost: api.getpostman.com\nX-API-Key: ", key("header"), "\n", "http");
  f.pos("env", "env", "POSTMAN_API_KEY=", key("env"), "\n", "env");
  f.pos("shell-export", "shell-export", "export POSTMAN_API_KEY=", key("export"), "\n", "sh");
  f.pos("cli", "postman-login", "$ postman login --with-api-key ", key("cli"), "\n", "sh");
  f.pos("url", "apikey-query", "curl -s \"https://api.getpostman.com/workspaces?apikey=", key("url"), "\"\n", "sh");
  f.pos("source-code", "axios-client", "const postman = axios.create({ baseURL: 'https://api.getpostman.com', headers: { 'X-API-Key': '", key("node"), "' } });\n", "js");
  f.pos("structured-file", "settings-json", "{\n  \"postmanApiKey\": \"", key("json"), "\"\n}\n", "json");
  f.pos("ci-config", "actions-env", "jobs:\n  api-tests:\n    runs-on: ubuntu-latest\n    env:\n      POSTMAN_API_KEY: ", key("actions"), "\n", "yml");
  f.pos("container-config", "compose-env", "services:\n  contract-tests:\n    environment:\n      - POSTMAN_API_KEY=", key("compose"), "\n", "yml");
  f.pos("log", "debug-log", "2026-09-24T10:00:00Z DEBUG sync-collections GET https://api.getpostman.com/collections x-api-key=", key("log"), "\n", "log");
  f.pos("sdk-config", "newman-env-json", "{\n  \"name\": \"ci\",\n  \"values\": [\n    { \"key\": \"postman_api_key\", \"value\": \"", key("newman"), "\", \"enabled\": true }\n  ]\n}\n", "json");

  f.ctl("public-id", "collection-and-workspace", `POSTMAN_COLLECTION_UID=${f.s("owner", 8, DIGITS)}-${uuid(f.s("collection", 32, LOWER_HEX))}\nPOSTMAN_WORKSPACE_ID=${uuid(f.s("workspace", 32, LOWER_HEX))}\n`, "env");
  f.ctl("public-id", "run-summary", `newman run ${uuid(f.s("run-collection", 32, LOWER_HEX))} finished: 42 requests, 0 failures (environment ${uuid(f.s("run-env", 32, LOWER_HEX))})\n`, "log");
  f.ctl("encoded-value", "package-checksum", `${f.s("checksum", 64, LOWER_HEX)}  postman-cli-1.8.0-linux-x64.tar.gz\n`);
  f.ctl("near-miss", "short-key", `POSTMAN_API_KEY=PMAK-${f.s("short", 24, LOWER_HEX)}\n`, "env");
  f.ctl("near-miss", "identifier", "const PMAKE_TARGET = 'release';\nconst pmakeVersion = '4.4.1';\n", "js");
  f.ctl("reference", "postman-variable", "X-API-Key: {{postman_api_key}}\n", "http");
  f.ctl("reference", "actions-secret", "- run: postman login --with-api-key ${{ secrets.POSTMAN_API_KEY }}\n", "yml");
  f.ctl("placeholder", "docs-template", "POSTMAN_API_KEY=PMAK-<your-api-key>\n", "env");
  f.ctl("placeholder", "masked-settings", "POSTMAN_API_KEY=PMAK-************************-**********************************\n", "env");
  f.ctl("reference", "shell-lookup", "export POSTMAN_API_KEY=\"$(op read 'op://CI/postman/api-key')\"\n", "sh");
  f.ctl("prose", "vault-note", "Generate a Postman API key from Settings > API keys, and store it in Postman Vault or the CI secret store rather than in a shared environment.\n", "md");
}

// ---------------------------------------------------------------------------
// #206 debt #207 left: five untwinned positives each for atlassian-api-token and
// firebase-server-key (5/10), one for supabase-token (5/6). Same value construction
// as #207, new contexts; seeds are this corpus's own.
function atlassian(c, synthetic) {
  const f = family(c, synthetic, "atlassian-api-token");
  // Observed 192-character layout (redact-secret#643): ATATT3xFfGF0 + 171 base64url + "=" + 8 uppercase-hex CRC32.
  const token = slug => { const head = `ATATT3xFfGF0${f.s(`body:${slug}`, 171, B64URL)}=`; return head + crc32(head).toString(16).toUpperCase().padStart(8, "0"); };
  f.pos("shell-export", "shell-export", "export JIRA_API_TOKEN=", token("export"), "\n", "sh");
  f.posEnvelope("url", "bitbucket-remote", "git remote set-url origin ",
    { before: "https://x-bitbucket-api-token-auth:", after: "@bitbucket.org/example-benchmark/deploy-scripts.git", reason: URI }, token("url"), "\n", "sh");
  f.pos("tool-output", "op-item-get", "$ op item get \"Jira API token\" --fields credential --reveal\n", token("tool"), "\n");
  f.pos("structured-file", "netrc", "machine example-benchmark.atlassian.net\n  login fixture@example.invalid\n  password ", token("netrc"), "\n", "netrc");
  f.pos("sdk-config", "airflow-connection", "{\n  \"conn_type\": \"jira\",\n  \"host\": \"https://example-benchmark.atlassian.net\",\n  \"login\": \"fixture@example.invalid\",\n  \"password\": \"", token("airflow"), "\"\n}\n", "json");
}

function firebase(c, synthetic) {
  const f = family(c, synthetic, "firebase-server-key");
  // Head: base64url of the 8-byte big-endian project number (< 2^40, so AAAA); body: APA91b + 134 base64url.
  const head = slug => {
    const number = BigInt(`1${f.s(`project:${slug}`, 11, DIGITS)}`);
    const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(number);
    return buffer.toString("base64url");
  };
  const key = slug => `${head(slug)}:APA91b${f.s(`body:${slug}`, 134, B64URL)}`;
  f.pos("shell-export", "shell-export", "export FCM_SERVER_KEY=", key("export"), "\n", "sh");
  f.pos("tool-output", "functions-config-get", "$ firebase functions:config:get\n{\n  \"fcm\": {\n    \"server_key\": \"", key("tool"), "\"\n  }\n}\n");
  f.pos("sdk-config", "laravel-fcm-config", "<?php\n\nreturn [\n    'http' => [\n        'server_key' => env('FCM_SERVER_KEY', '", key("laravel"), "'),\n    ],\n];\n", "php");
  f.pos("source-code", "fcm-node", "const FCM = require('fcm-node');\nconst fcm = new FCM('", key("node"), "');\n", "js");
  f.pos("container-config", "k8s-secret", "apiVersion: v1\nkind: Secret\nmetadata:\n  name: push-notifier\nstringData:\n  FCM_SERVER_KEY: ", key("k8s"), "\n", "yml");
}

function supabase(c, synthetic) {
  const f = family(c, synthetic, "supabase-token");
  // sb_secret_ + 22 base64url + "_" + first 8 base64url of sha256("<project ref>|" + prefix + random) (#231).
  const ref = f.s("ref:export", 20, "abcdefghijklmnopqrstuvwxyz");
  const random = f.s("random:export", 22, B64URL);
  const checksum = createHash("sha256").update(`${ref}|sb_secret_${random}`).digest("base64url").slice(0, 8);
  f.pos("shell-export", "shell-export", `export SUPABASE_URL=https://${ref}.supabase.co\nexport SUPABASE_SECRET_KEY=`, `sb_secret_${random}_${checksum}`, "\n", "sh");
}

export function build213d({ fixture, synthetic }) {
  const c = beta8Corpus("213d", { fixture, synthetic });
  databricks(c, synthetic);
  datadogLegacy(c, synthetic);
  mailchimp(c, synthetic);
  mailgun(c, synthetic);
  okta(c, synthetic);
  openai(c, synthetic);
  postman(c, synthetic);
  atlassian(c, synthetic);
  firebase(c, synthetic);
  supabase(c, synthetic);
  return c.fixtures;
}
