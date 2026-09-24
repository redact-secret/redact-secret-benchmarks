import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";

// Issue #207 corpus (category `beta8-207`). See docs/specs/beta8-evidence.md.
//
// Raises the twelve highest-priority low-coverage registry families to the
// Beta.8 empirical (`empirical-40`), context-constrained (`context-48`) or
// documented (`documented-24`, supabase) profile. Every value is built here
// from a `synthetic()` seed or from code that recomputes a published
// checksum over a synthetic body (Supabase sha256, Atlassian CRC32, Confluent
// CRC32). Nothing is copied from a provider example, an issued credential or
// scanner output. Research: #215's index, #231/#232/#233 and
// redact-secret#643/#646/#649/#650/#658–#662; per-field provenance lives on
// each contract in benchmarks/lib/assessment.ts (`FIELDS_207`).

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const B64URL = `${ALNUM}_-`;
const B64 = `${ALNUM}+/`;
const LOWER_HEX = "0123456789abcdef";
const UPPER_HEX = "0123456789ABCDEF";
const DIGITS = "0123456789";
const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const B64TOKEN = `${ALNUM}-._~`;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
/** IEEE CRC32 (zlib.crc32), computed locally so the generator runs on any supported Node. */
function crc32(text) {
  let c = 0xffffffff;
  for (const byte of Buffer.from(text, "ascii")) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * One family's authoring helpers. `pos` records each positive's context so a
 * value twin keeps that context byte-for-byte and a context twin keeps the
 * value byte-for-byte (benchmarks/operators/authored-twin.ts).
 */
function family(c, synthetic, target) {
  const s = (slug, length, chars) => synthetic(`beta8:207:${target}:${slug}`, length, chars);
  const positives = new Map();
  return {
    s,
    /** 32 deterministic bytes, never issued: sha256 of a public seed. */
    bytes: slug => createHash("sha256").update(`secret-benchmark:never-issued:beta8:207:${target}:${slug}`).digest(),
    pos(axis, slug, before, value, after = "\n", extension) {
      positives.set(slug, { before, value, after, extension });
      c.positive(target, axis, slug, [before, { secret: value }, after], extension);
    },
    /** A value twin: one documented property of the value differs, the context is unchanged. */
    vtwin(positiveSlug, slug, value, mutation, kind) {
      const p = positives.get(positiveSlug);
      if (!p) throw new Error(`#207 ${target}: no positive ${positiveSlug}`);
      if (value === p.value || value.includes(p.value)) throw new Error(`#207 ${target}: twin ${slug} keeps its positive's value`);
      c.twin(target, positiveSlug, slug, [p.before + value + p.after], mutation, kind, p.extension);
    },
    /** A context twin: the value is kept byte-for-byte, one contiguous edit of its surroundings. */
    ctwin(positiveSlug, slug, { before, after }, mutation) {
      const p = positives.get(positiveSlug);
      if (!p) throw new Error(`#207 ${target}: no positive ${positiveSlug}`);
      c.twin(target, positiveSlug, slug, [(before ?? p.before) + p.value + (after ?? p.after)], mutation, "context", p.extension);
    },
    ctl(axis, slug, content, extension) {
      c.control(target, axis, slug, [content], extension);
    },
  };
}

// ---------------------------------------------------------------------------
// supabase:secret-key → supabase-token (documented-24; T1 on #231's grammar).
// sb_secret_ + 22 base64url + "_" + 8-character checksum, the checksum being the
// first 8 base64url characters of sha256("<project ref>|" + prefix + random)
// (supabase/supabase docker/utils/add-new-auth-keys.sh). The project refs are
// synthetic; "supabase-self-hosted" is the provider script's own constant.
function supabase(c, synthetic) {
  const f = family(c, synthetic, "supabase-token");
  const ref = slug => f.s(`ref:${slug}`, 20, "abcdefghijklmnopqrstuvwxyz");
  const key = (slug, projectRef, prefix = "sb_secret_") => {
    const random = f.s(`random:${slug}`, 22, B64URL);
    const checksum = createHash("sha256").update(`${projectRef}|${prefix}${random}`).digest("base64url").slice(0, 8);
    return { random, checksum, value: `${prefix}${random}_${checksum}` };
  };
  const env = key("env", ref("env"));
  f.pos("env", "env", "SUPABASE_SECRET_KEY=", env.value, "\n", "env");
  const statusRef = "supabase-local-benchmark";
  const status = key("status", statusRef), statusPublic = key("status-public", statusRef, "sb_publishable_");
  f.pos("tool-output", "status-env", `$ supabase status -o env\nAPI_URL="http://127.0.0.1:54321"\nPUBLISHABLE_KEY="${statusPublic.value}"\nSECRET_KEY="`, status.value, `"\n`);
  const sdkRef = ref("sdk");
  const sdk = key("sdk", sdkRef);
  f.pos("source-code", "create-client", `import { createClient } from '@supabase/supabase-js'\nconst supabase = createClient('https://${sdkRef}.supabase.co', '`, sdk.value, `')\n`, "js");
  const headerRef = ref("header");
  f.pos("header", "apikey-header", `curl 'https://${headerRef}.supabase.co/rest/v1/todos?select=*' -H "apikey: `, key("header", headerRef).value, `"\n`, "sh");
  f.pos("structured-file", "edge-keys-json", `{\n  "default": "`, key("edge", ref("edge")).value, `"\n}\n`, "json");
  f.pos("ci-config", "actions-env", "jobs:\n  migrate:\n    runs-on: ubuntu-latest\n    env:\n      SUPABASE_SECRET_KEY: ", key("actions", ref("actions")).value, "\n", "yml");
  f.pos("container-config", "self-hosted-compose", "services:\n  kong:\n    environment:\n      SUPABASE_SECRET_KEY: ", key("compose", "supabase-self-hosted").value, "\n", "yml");

  // Twins: only the documented public prefix, the documented 22/8 widths and the positional "_".
  f.vtwin("env", "publishable-prefix", `sb_publishable_${env.random}_${env.checksum}`,
    "public-prefix: sb_publishable_ (documented \"safe to expose online\", supabase.com/docs/guides/api/api-keys) replaces sb_secret_; the 31-character body is unchanged", "public-prefix");
  f.vtwin("create-client", "publishable-prefix-sdk", `sb_publishable_${sdk.random}_${sdk.checksum}`,
    "public-prefix: sb_publishable_ (documented safe to expose) replaces sb_secret_ in the same createClient call; body unchanged", "public-prefix");
  f.vtwin("status-env", "short-random", `sb_secret_${status.random.slice(0, 21)}_${status.checksum}`,
    "length: 21-character random segment vs the documented 22", "length");
  f.vtwin("apikey-header", "long-checksum", (() => { const h = key("header", headerRef); return `sb_secret_${h.random}_${h.checksum.slice(0, 4)}${f.s("extra", 1, ALNUM)}${h.checksum.slice(4)}`; })(),
    "length: 9-character checksum segment vs the documented 8", "length");
  f.vtwin("edge-keys-json", "dash-delimiter", (() => { const e = key("edge", ref("edge")); return `sb_secret_${e.random}-${e.checksum}`; })(),
    "boundary: \"-\" at body offset 22 where the documented layout places the \"_\" delimiter", "boundary");

  // Controls.
  f.ctl("public-id", "project-url", `SUPABASE_URL=https://${ref("url")}.supabase.co\n`, "env");
  f.ctl("public-id", "publishable-key", `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key("public", ref("public"), "sb_publishable_").value}\n`, "env");
  f.ctl("placeholder", "logged-six-characters", `2026-09-24T10:00:00Z edge-fn: using secret key sb_secret_${f.s("logged", 6, B64URL)}… (truncated per Supabase logging guidance)\n`, "log");
  f.ctl("placeholder", "docs-ellipsis", "createClient(SUPABASE_URL, 'sb_secret_...')\n", "js");
  f.ctl("reference", "actions-secret", "env:\n  SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}\n", "yml");
  f.ctl("near-miss", "plural-prefix", `sb_secrets_${f.s("plural", 22, B64URL)}_${f.s("plural-check", 8, B64URL)}\n`);
  f.ctl("near-miss", "unprefixed-body", `fingerprint: ${f.s("unprefixed", 22, ALNUM)}_${f.s("unprefixed-check", 8, ALNUM)}\n`, "yml");
  f.ctl("encoded-value", "key-hash", `{"name":"default","type":"secret","hash":"${f.s("hash", 64, LOWER_HEX)}"}\n`, "json");
  f.ctl("prose", "rotation-note", "Rotate the project's sb_secret_ key under Settings > API Keys and keep it out of browser bundles.\n", "md");
}

// ---------------------------------------------------------------------------
// atlassian:api-token → atlassian-api-token (empirical-40).
// Observed 192-character layout (redact-secret#643, maintainer-confirmed once):
// ATATT3xFfGF0 + 171 base64url + "=" + 8 uppercase-hex CRC32 of all before it.
function atlassian(c, synthetic) {
  const f = family(c, synthetic, "atlassian-api-token");
  const token = slug => { const head = `ATATT3xFfGF0${f.s(`body:${slug}`, 171, B64URL)}=`; return head + crc32(head).toString(16).toUpperCase().padStart(8, "0"); };
  const env = token("env"), basic = token("basic"), ci = token("ci"), json = token("json");
  f.pos("env", "env", "JIRA_API_TOKEN=", env, "\n", "env");
  f.pos("basic-auth", "curl-basic", "curl -u fixture@example.invalid:", basic, " https://example-benchmark.atlassian.net/rest/api/3/myself\n", "sh");
  f.pos("sdk-config", "python-client-yaml", "confluence:\n  url: https://example-benchmark.atlassian.net/wiki\n  username: fixture@example.invalid\n  token: ", token("sdk"), "\n", "yml");
  f.pos("source-code", "jira-client", "jira = JIRA(server=\"https://example-benchmark.atlassian.net\", basic_auth=(\"fixture@example.invalid\", \"", token("source"), "\"))\n", "py");
  f.pos("ci-config", "pipelines-variable", "pipelines:\n  default:\n    - step:\n        script:\n          - export ATLASSIAN_API_TOKEN=", ci, "\n", "yml");
  f.pos("structured-file", "settings-json", "{\n  \"site\": \"example-benchmark.atlassian.net\",\n  \"apiToken\": \"", json, "\"\n}\n", "json");
  f.pos("cli", "acli-login", "echo ", token("cli"), " | acli jira auth login --site example-benchmark.atlassian.net --email fixture@example.invalid --token\n", "sh");
  f.pos("container-config", "compose-env", "services:\n  worker:\n    environment:\n      - JIRA_API_TOKEN=", token("compose"), "\n", "yml");
  f.pos("log", "debug-log", "2026-09-24T10:00:00Z DEBUG jira.client auth user=fixture@example.invalid token=", token("log"), "\n", "log");
  f.pos("prose", "ticket-paste", "Here is the service account token for the import job: ", token("prose"), "\nPlease rotate it after the migration.\n", "md");

  // Twins. The 100-character body floor is the contract's (tool-corroborated); the prefix
  // mutation uses ATAQ, which no Atlassian source names (ATCT/ATBB are other token kinds).
  f.vtwin("env", "floor-length", `ATAT${env.slice(4, 103)}`, "length: 99 body characters after ATAT vs the contract's 100-character floor", "length");
  f.vtwin("settings-json", "floor-length-json", `ATAT${json.slice(4, 103)}`, "length: 99 body characters after ATAT vs the contract's 100-character floor", "length");
  f.vtwin("curl-basic", "prefix", `ATAQ${basic.slice(4)}`, "prefix: ATAQ vs ATAT, a namespace no Atlassian source names", "prefix");
  f.vtwin("pipelines-variable", "prefix-ci", `ATAQ${ci.slice(4)}`, "prefix: ATAQ vs ATAT, a namespace no Atlassian source names", "prefix");
  f.vtwin("debug-log", "alphabet", (() => { const v = token("log"); return `${v.slice(0, 24)}!${v.slice(25)}`; })(),
    "alphabet: \"!\" at byte 24, outside the [A-Za-z0-9_-] body alphabet, leaving under 100 contiguous body characters", "alphabet");

  f.ctl("public-id", "account-id", `{"accountId": "712020:${f.s("acct-a", 8, LOWER_HEX)}-${f.s("acct-b", 4, LOWER_HEX)}-4${f.s("acct-c", 3, LOWER_HEX)}-a${f.s("acct-d", 3, LOWER_HEX)}-${f.s("acct-e", 12, LOWER_HEX)}", "displayName": "Benchmark Fixture"}\n`, "json");
  f.ctl("public-id", "site-and-email", "JIRA_SITE=https://example-benchmark.atlassian.net\nJIRA_EMAIL=fixture@example.invalid\n", "env");
  f.ctl("public-id", "cloud-id", `cloudId: ${f.s("cloud-a", 8, LOWER_HEX)}-${f.s("cloud-b", 4, LOWER_HEX)}-4${f.s("cloud-c", 3, LOWER_HEX)}-b${f.s("cloud-d", 3, LOWER_HEX)}-${f.s("cloud-e", 12, LOWER_HEX)}\n`, "yml");
  f.ctl("encoded-value", "cli-digest", `${f.s("digest", 64, LOWER_HEX)}  atlassian-cli-1.3.0-linux-amd64.tar.gz\n`);
  f.ctl("near-miss", "header-only", `token prefix seen in audit log: ATATT3xFfGF0${f.s("short", 40, B64URL)}\n`, "log");
  f.ctl("near-miss", "unprefixed-random", `blob=${f.s("random", 171, B64URL)}\n`);
  f.ctl("placeholder", "masked", `JIRA_API_TOKEN=ATATT3xFfGF0${"*".repeat(171)}=********\n`, "env");
  f.ctl("placeholder", "your-token", "JIRA_API_TOKEN=<your-api-token>\n", "env");
  f.ctl("reference", "actions-secret", "env:\n  JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}\n", "yml");
  f.ctl("reference", "op-read", "export JIRA_API_TOKEN=\"$(op read 'op://Engineering/jira/token')\"\n", "sh");
  f.ctl("prose", "creation-note", "Create an API token at id.atlassian.com; new tokens start with ATATT3x and expire within a year.\n", "md");
  f.ctl("public-id", "issue-url", "Tracked in https://example-benchmark.atlassian.net/browse/BENCH-42 (reporter fixture@example.invalid)\n", "md");
  f.ctl("placeholder", "docs-ellipsis", "JIRA_API_TOKEN=ATATT3xFfGF0...\n", "env");
  f.ctl("reference", "netrc-variable", "machine example-benchmark.atlassian.net login fixture@example.invalid password ${JIRA_API_TOKEN}\n", "netrc");
}

// ---------------------------------------------------------------------------
// firebase:server-key → firebase-server-key (empirical-40).
// Head: base64url of the 8-byte big-endian project number (< 2^40, so AAAA);
// body: APA91b + 134 base64url (140), the dominant post-2017 width.
function firebase(c, synthetic) {
  const f = family(c, synthetic, "firebase-server-key");
  const head = slug => {
    const number = BigInt(`1${f.s(`project:${slug}`, 11, DIGITS)}`);
    const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(number);
    return buffer.toString("base64url");
  };
  const key = slug => `${head(slug)}:APA91b${f.s(`body:${slug}`, 134, B64URL)}`;
  const header = key("header"), cli = key("cli"), env = key("env"), java = key("java"), json = key("json");
  f.pos("header", "raw-request", "POST /fcm/send HTTP/1.1\nHost: fcm.googleapis.com\nContent-Type: application/json\nAuthorization: key=", header, "\n", "http");
  f.pos("cli", "curl-send", "curl https://fcm.googleapis.com/fcm/send -H \"Authorization: key=", cli, "\" -H \"Content-Type: application/json\" -d @message.json\n", "sh");
  f.pos("env", "env", "FCM_SERVER_KEY=", env, "\n", "env");
  f.pos("source-code", "java-constant", "public final class PushConfig {\n  static final String SERVER_KEY = \"", java, "\";\n}\n", "java");
  f.pos("structured-file", "settings-json", "{\n  \"fcm\": {\n    \"server_key\": \"", json, "\"\n  }\n}\n", "json");
  f.pos("sdk-config", "push-yaml", "push:\n  android:\n    provider: fcm\n    server_key: ", key("sdk"), "\n", "yml");
  f.pos("ci-config", "actions-env", "env:\n  FIREBASE_SERVER_KEY: ", key("ci"), "\n", "yml");
  f.pos("log", "request-log", "2026-09-24T10:00:00Z push-worker POST https://fcm.googleapis.com/fcm/send authorization=key=", key("log"), "\n", "log");
  f.pos("container-config", "compose-env", "services:\n  notifier:\n    environment:\n      FCM_SERVER_KEY: ", key("compose"), "\n", "yml");
  f.pos("prose", "handoff-note", "Legacy FCM server key for the archived Android app: ", key("prose"), "\n", "md");

  f.vtwin("env", "short-body", env.slice(0, -1), "length: 139-character body vs the contracted 140", "length");
  f.vtwin("settings-json", "short-body-json", json.slice(0, -1), "length: 139-character body vs the contracted 140", "length");
  f.vtwin("java-constant", "long-head", `${java.slice(0, 11)}${f.s("head-extra", 1, ALNUM)}${java.slice(11)}`, "length: 8 head characters after AAAA vs the contracted 7 (every observed head is 11 characters)", "length");
  f.vtwin("raw-request", "dotted-body", `${header.slice(0, 80)}.${header.slice(81)}`, "alphabet: \".\" at body offset 68, outside [A-Za-z0-9_-], splitting the 140-character body", "alphabet");
  f.vtwin("curl-send", "dotted-body-cli", `${cli.slice(0, 80)}.${cli.slice(81)}`, "alphabet: \".\" at body offset 68, outside [A-Za-z0-9_-], splitting the 140-character body", "alphabet");

  // FCM registration tokens share the <id>:APA91b<body> layout (redact-secret#649); they
  // are device identifiers, not server keys. Their 22-character ids are built never to start AAAA.
  const registration = slug => `Q${f.s(`reg-id:${slug}`, 21, B64URL)}:APA91b${f.s(`reg-body:${slug}`, 134, B64URL)}`;
  f.ctl("public-id", "registration-token", `{"to": "${registration("message")}", "notification": {"title": "Build finished"}}\n`, "json");
  f.ctl("public-id", "registration-log", `2026-09-24T10:00:00Z device registered registration_id=${registration("log")}\n`, "log");
  f.ctl("public-id", "sender-id", "const firebaseConfig = { projectId: \"benchmark-fixture\", messagingSenderId: \"123456789012\" };\n", "js");
  f.ctl("encoded-value", "vapid-public-key", `messaging.getToken({ vapidKey: "B${f.s("vapid", 86, B64URL)}" });\n`, "js");
  f.ctl("near-miss", "head-only", `sender head: ${head("head-only")}:\n`, "log");
  f.ctl("near-miss", "impossible-head", `key=Q${f.s("impossible", 10, B64URL)}:${f.s("impossible-body", 140, B64URL)}\n`);
  f.ctl("placeholder", "your-server-key", "Authorization: key=<YOUR_SERVER_KEY>\n", "http");
  f.ctl("placeholder", "masked", `FCM_SERVER_KEY=AAAA*******:APA91b${"*".repeat(134)}\n`, "env");
  f.ctl("reference", "actions-secret", "env:\n  FCM_SERVER_KEY: ${{ secrets.FCM_SERVER_KEY }}\n", "yml");
  f.ctl("prose", "migration-note", "The legacy FCM server key stopped working when Google shut down the legacy HTTP API; migrate to HTTP v1 with OAuth.\n", "md");
  f.ctl("reference", "config-lookup", "serverKey := os.Getenv(\"FCM_SERVER_KEY\")\n", "go");
  f.ctl("public-id", "project-number", "{\n  \"project_info\": {\n    \"project_number\": \"123456789012\",\n    \"project_id\": \"benchmark-fixture\"\n  }\n}\n", "json");
  f.ctl("public-id", "message-id", `{"multicast_id": ${f.s("multicast", 19, DIGITS)}, "success": 1, "results": [{"message_id": "0:1727172000000000%${f.s("message", 16, LOWER_HEX)}"}]}\n`, "json");
  f.ctl("placeholder", "docs-ellipsis", "curl -H \"Authorization: key=AAAA...:APA91b...\" https://fcm.googleapis.com/fcm/send\n", "sh");
}

// ---------------------------------------------------------------------------
// sentry:organization-auth-token → sentry-org-auth-token (empirical-40).
// sntrys_ + standard base64 of {"iat","url","region_url","org"} (padding kept)
// + "_" + base64 of 32 bytes with padding stripped (43), per Sentry's generator.
function sentryOrg(c, synthetic) {
  const f = family(c, synthetic, "sentry-org-auth-token");
  const facts = (slug, url = "https://sentry.io", region = "https://us.sentry.io") =>
    `{"iat":17${f.s(`iat:${slug}`, 8, DIGITS)}.${f.s(`frac:${slug}`, 6, DIGITS)},"url":${url === null ? "null" : JSON.stringify(url)},"region_url":${JSON.stringify(region)},"org":"${f.s(`org:${slug}`, 10, "abcdefghijklmnopqrstuvwxyz")}"}`;
  const secret = slug => f.bytes(`secret:${slug}`).toString("base64").replace(/=+$/, "");
  const token = (slug, ...args) => `sntrys_${Buffer.from(facts(slug, ...args)).toString("base64")}_${secret(slug)}`;
  const env = token("env"), ci = token("ci", "https://sentry.io", "https://de.sentry.io"), props = token("props", null, "http://sentry.example.invalid:9000");
  const next = token("next"), cli = token("cli", "https://sentry.example.invalid", "https://sentry.example.invalid");
  f.pos("env", "env", "SENTRY_AUTH_TOKEN=", env, "\n", "env");
  f.pos("ci-config", "actions-env", "      - uses: getsentry/action-release@v1\n        env:\n          SENTRY_AUTH_TOKEN: ", ci, "\n", "yml");
  f.pos("sdk-config", "sentry-properties", "defaults.org=benchmark\ndefaults.project=web\nauth.token=", props, "\n", "properties");
  f.pos("source-code", "next-config", "module.exports = withSentryConfig(nextConfig, {\n  org: 'benchmark',\n  authToken: '", next, "',\n});\n", "js");
  f.pos("cli", "sentry-cli", "sentry-cli --auth-token ", cli, " releases new 2026.09.24\n", "sh");
  f.pos("structured-file", "sentryclirc", "[auth]\ntoken=", token("rc"), "\n", "ini");
  f.pos("container-config", "dockerfile-env", "FROM node:22-alpine\nENV SENTRY_AUTH_TOKEN=", token("docker"), "\n", "dockerfile");

  const split = v => { const at = v.lastIndexOf("_"); return [v.slice(0, at), v.slice(at + 1)]; };
  const [envHead, envSecret] = split(env), [ciHead, ciSecret] = split(ci), [propsHead, propsSecret] = split(props);
  const [nextHead, nextSecret] = split(next), [cliHead, cliSecret] = split(cli);
  f.vtwin("env", "short-secret", `${envHead}_${envSecret.slice(0, 42)}`, "length: 42-character secret vs the 43 characters 32 base64-encoded bytes produce", "length");
  f.vtwin("actions-env", "short-secret-ci", `${ciHead}_${ciSecret.slice(0, 42)}`, "length: 42-character secret vs the 43 characters 32 base64-encoded bytes produce", "length");
  f.vtwin("sentry-properties", "urlsafe-secret", `${propsHead}_${propsSecret.slice(0, 10)}-${propsSecret.slice(11)}`, "alphabet: \"-\" (base64url) inside the secret, which Sentry's standard-base64 generator never emits", "alphabet");
  f.vtwin("next-config", "urlsafe-payload", `sntrys_eyJ${nextHead.slice(10, 20)}-${nextHead.slice(21)}_${nextSecret}`, "alphabet: \"-\" (base64url) inside the standard-base64 JSON payload", "alphabet");
  f.vtwin("sentry-cli", "missing-delimiter", `${cliHead}${cliSecret}`, "boundary: the \"_\" between the payload and the secret removed (exactly two _ are required)", "boundary");
  f.vtwin("env", "dotted-delimiter", `${envHead}.${envSecret}`, "boundary: \".\" in place of the \"_\" between the payload and the secret", "boundary");
  f.vtwin("actions-env", "prefix", `sntryx_${ciHead.slice(7)}_${ciSecret}`, "prefix: sntryx_ vs sntrys_; Sentry's token-type enum has no sntryx_", "prefix");
  f.vtwin("sentry-properties", "json-marker", `sntrys_eyK${propsHead.slice(10)}_${propsSecret}`, "prefix: eyK vs the eyJ marker every base64 JSON object starts with", "prefix");

  f.ctl("public-id", "dsn", `SENTRY_DSN=https://${f.s("dsn", 32, LOWER_HEX)}@o${f.s("org-id", 6, DIGITS)}.ingest.us.sentry.io/${f.s("project-id", 7, DIGITS)}\n`, "env");
  f.ctl("public-id", "org-project", "SENTRY_ORG=benchmark\nSENTRY_PROJECT=web\nSENTRY_URL=https://sentry.io/\n", "env");
  f.ctl("encoded-value", "decoded-facts", `# unsigned token facts (no secret): ${Buffer.from(facts("facts")).toString("base64")}\n`);
  f.ctl("near-miss", "missing-secret", `SENTRY_AUTH_TOKEN=sntrys_${Buffer.from(facts("no-secret")).toString("base64")}\n`, "env");
  f.ctl("near-miss", "missing-payload", `SENTRY_AUTH_TOKEN=sntrys_${secret("no-payload")}\n`, "env");
  f.ctl("placeholder", "your-token-here", "SENTRY_AUTH_TOKEN=sntrys_YOUR_TOKEN_HERE\n", "env");
  f.ctl("placeholder", "docs-ellipsis", "SENTRY_AUTH_TOKEN=sntrys_eyJ...\n", "env");
  f.ctl("reference", "actions-secret", "env:\n  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}\n", "yml");
  f.ctl("prose", "scope-note", "Organization tokens (sntrys_) default to the org:ci scope and embed the organization slug.\n", "md");
}

// ---------------------------------------------------------------------------
// sentry:user-auth-token → sentry-user-auth-token (empirical-40): sntryu_ + 64 lowercase hex.
function sentryUser(c, synthetic) {
  const f = family(c, synthetic, "sentry-user-auth-token");
  const token = slug => `sntryu_${f.s(`body:${slug}`, 64, LOWER_HEX)}`;
  const env = token("env"), ci = token("ci"), rc = token("rc"), cli = token("cli"), api = token("api"), docker = token("docker");
  f.pos("env", "env", "SENTRY_AUTH_TOKEN=", env, "\n", "env");
  f.pos("ci-config", "actions-env", "env:\n  SENTRY_AUTH_TOKEN: ", ci, "\n", "yml");
  f.pos("structured-file", "sentryclirc", "[defaults]\norg=benchmark\n[auth]\ntoken=", rc, "\n", "ini");
  f.pos("cli", "sentry-cli", "sentry-cli --auth-token ", cli, " info\n", "sh");
  f.pos("header", "api-curl", "curl https://sentry.io/api/0/projects/ -H \"Authorization: Bearer ", api, "\"\n", "sh");
  f.pos("container-config", "compose-env", "services:\n  uploader:\n    environment:\n      SENTRY_AUTH_TOKEN: ", docker, "\n", "yml");
  f.pos("source-code", "script-constant", "SENTRY_TOKEN = \"", token("script"), "\"\n", "py");

  f.vtwin("env", "short", env.slice(0, -1), "length: 63 hex characters vs the 64 secrets.token_hex(32) emits", "length");
  f.vtwin("actions-env", "short-ci", ci.slice(0, -1), "length: 63 hex characters vs the 64 secrets.token_hex(32) emits", "length");
  f.vtwin("sentryclirc", "non-hex", `${rc.slice(0, 20)}g${rc.slice(21)}`, "alphabet: \"g\" in the body, outside the lowercase hex Sentry's generator emits", "alphabet");
  f.vtwin("sentry-cli", "non-hex-cli", `${cli.slice(0, 40)}z${cli.slice(41)}`, "alphabet: \"z\" in the body, outside the lowercase hex Sentry's generator emits", "alphabet");
  f.vtwin("api-curl", "prefix", `sntryx_${api.slice(7)}`, "prefix: sntryx_ vs sntryu_; Sentry's token-type enum has no sntryx_", "prefix");
  f.vtwin("compose-env", "prefix-compose", `sntrzu_${docker.slice(7)}`, "prefix: sntrzu_ vs sntryu_, outside Sentry's sntry*_ token-type namespace", "prefix");
  f.vtwin("env", "dash-delimiter", `sntryu-${env.slice(7)}`, "boundary: \"-\" in place of the prefix's \"_\" delimiter", "boundary");
  f.vtwin("actions-env", "missing-delimiter", `sntryu${ci.slice(7)}`, "boundary: the prefix's \"_\" delimiter removed", "boundary");

  f.ctl("public-id", "dsn", `SENTRY_DSN=https://${f.s("dsn", 32, LOWER_HEX)}@o${f.s("org-id", 6, DIGITS)}.ingest.de.sentry.io/${f.s("project-id", 7, DIGITS)}\n`, "env");
  f.ctl("public-id", "org-slug", "sentry:\n  organization: benchmark\n  project: api\n", "yml");
  f.ctl("encoded-value", "tarball-digest", `${f.s("digest", 64, LOWER_HEX)}  release-2026.09.24.tar.gz\n`);
  f.ctl("near-miss", "half-body", `SENTRY_AUTH_TOKEN=sntryu_${f.s("half", 32, LOWER_HEX)}\n`, "env");
  f.ctl("near-miss", "org-prefix-hex", `SENTRY_AUTH_TOKEN=sntrys_${f.s("org-hex", 64, LOWER_HEX)}\n`, "env");
  f.ctl("placeholder", "last-four", `{"name": "ci-upload", "tokenLastCharacters": "${f.s("last4", 4, LOWER_HEX)}", "scopes": ["project:releases"]}\n`, "json");
  f.ctl("placeholder", "docs-ellipsis", "SENTRY_AUTH_TOKEN=sntryu_...\n", "env");
  f.ctl("reference", "actions-secret", "env:\n  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}\n", "yml");
  f.ctl("prose", "naming-note", "Personal tokens (formerly user auth tokens) start with sntryu_ and are created under Account > Personal Tokens.\n", "md");
}

// ---------------------------------------------------------------------------
// telegram:bot-token → telegram-bot-token (empirical-40). <10-digit id>:AA + 33
// base64url (35-character secret; one positive keeps the docs' 34-character width).
function telegram(c, synthetic) {
  const f = family(c, synthetic, "telegram-bot-token");
  const token = (slug, body = 35) => `${f.s(`lead:${slug}`, 1, "123456789")}${f.s(`id:${slug}`, 9, DIGITS)}:AA${f.s(`body:${slug}`, body - 2, B64URL)}`;
  const env = token("env"), code = token("code"), yaml = token("yaml"), ci = token("ci"), compose = token("compose"), father = token("father", 34);
  f.pos("env", "env", "TELEGRAM_BOT_TOKEN=", env, "\n", "env");
  f.pos("url", "bot-api-url", "curl -s https://api.telegram.org/bot", token("url"), "/getMe\n", "sh");
  f.pos("source-code", "ptb-builder", "application = Application.builder().token(\"", code, "\").build()\n", "py");
  f.pos("sdk-config", "bot-yaml", "telegram:\n  bot_token: ", yaml, "\n  chat_id: -1001234567890\n", "yml");
  f.pos("ci-config", "actions-env", "env:\n  TELEGRAM_TOKEN: ", ci, "\n", "yml");
  f.pos("container-config", "compose-env", "services:\n  bot:\n    environment:\n      - BOT_TOKEN=", compose, "\n", "yml");
  f.pos("tool-output", "botfather-reply", "Done! Congratulations on your new bot. Use this token to access the HTTP API:\n", father, "\nKeep your token secure and store it safely.\n");

  const [envId, envBody] = env.split(":"), [codeId, codeBody] = code.split(":"), [yamlId, yamlBody] = yaml.split(":");
  const [ciId, ciBody] = ci.split(":"), [composeId, composeBody] = compose.split(":"), [fatherId, fatherBody] = father.split(":");
  f.vtwin("env", "short-body", `${envId}:${envBody.slice(0, 33)}`, "length: 33-character secret vs the contract's 34-character floor", "length");
  f.vtwin("bot-yaml", "short-body-yaml", `${yamlId}:${yamlBody.slice(0, 33)}`, "length: 33-character secret vs the contract's 34-character floor", "length");
  f.vtwin("botfather-reply", "short-body-docs-width", `${fatherId}:${fatherBody.slice(0, 33)}`, "length: 33-character secret vs the contract's 34-character floor", "length");
  f.vtwin("ptb-builder", "underscore-delimiter", `${codeId}_${codeBody}`, "boundary: \"_\" in place of the \":\" delimiter Telegram's Bot API server requires", "boundary");
  f.vtwin("actions-env", "missing-delimiter", `${ciId}${ciBody}`, "boundary: the \":\" delimiter removed", "boundary");
  f.vtwin("compose-env", "slash-body", `${composeId}:${composeBody.slice(0, 17)}/${composeBody.slice(18)}`, "alphabet: \"/\" in the secret; the Bot API server rejects any token containing \"/\" (tdlib/telegram-bot-api ClientManager.cpp)", "alphabet");
  f.vtwin("env", "slash-body-env", `${envId}:${envBody.slice(0, 10)}/${envBody.slice(11)}`, "alphabet: \"/\" in the secret; the Bot API server rejects any token containing \"/\"", "alphabet");
  f.vtwin("bot-yaml", "plus-body", `${yamlId}:${yamlBody.slice(0, 12)}+${yamlBody.slice(13)}`, "alphabet: \"+\" in the secret, outside [A-Za-z0-9_-]", "alphabet");

  f.ctl("public-id", "chat-id", `TELEGRAM_CHAT_ID=-100${f.s("chat", 10, DIGITS)}\n`, "env");
  f.ctl("public-id", "bot-username", "TELEGRAM_BOT_USERNAME=benchmark_fixture_bot\n", "env");
  f.ctl("public-id", "update-json", `{"update_id": ${f.s("update", 9, DIGITS)}, "message": {"message_id": 42, "chat": {"id": ${f.s("chat-json", 10, DIGITS)}}, "date": 1727172000}}\n`, "json");
  f.ctl("near-miss", "short-secret", `TELEGRAM_BOT_TOKEN=${f.s("short-id", 10, DIGITS)}:AA${f.s("short-body", 8, B64URL)}\n`, "env");
  f.ctl("near-miss", "timestamp-colon", `1727172000:INFO:telegram.ext.Application:Application started with ${f.s("workers", 1, "12345678")} workers\n`, "log");
  f.ctl("placeholder", "angle-brackets", "TELEGRAM_BOT_TOKEN=<bot-id>:<secret>\n", "env");
  f.ctl("placeholder", "masked", `TELEGRAM_BOT_TOKEN=${f.s("mask-id", 10, DIGITS)}:AA${"*".repeat(33)}\n`, "env");
  f.ctl("placeholder", "url-template", "curl https://api.telegram.org/bot<TOKEN>/getUpdates\n", "sh");
  f.ctl("reference", "actions-secret", "env:\n  TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}\n", "yml");
  f.ctl("prose", "botfather-note", "Ask @BotFather for /token to regenerate a bot token, or /revoke to invalidate the current one.\n", "md");
}

// ---------------------------------------------------------------------------
// discord:bot-token → discord-bot-token (empirical-40). base64url(bot id) .
// 6-character timestamp . HMAC: 26/6/38 (19-digit id), 24/6/38 (older bot,
// reset token) and 24/6/27 (legacy token), per redact-secret#646.
function discord(c, synthetic) {
  const f = family(c, synthetic, "discord-bot-token");
  const id = (slug, digits) => `1${f.s(`id:${slug}`, digits - 1, DIGITS)}`;
  // Segment 2 starts G in every observed 38-character-HMAC token and X/Y in the older 27-character ones (#646).
  const token = (slug, digits = 19, hmac = 38) => `${Buffer.from(id(slug, digits)).toString("base64url")}.${hmac === 27 ? "Y" : "G"}${f.s(`ts:${slug}`, 5, B64URL)}.${f.s(`hmac:${slug}`, hmac, B64URL)}`;
  const header = token("header"), bot = token("bot"), json = token("json", 18), env = token("env"), ci = token("ci", 18, 27), log = token("log");
  f.pos("header", "bot-authorization", "curl https://discord.com/api/v10/users/@me -H \"Authorization: Bot ", header, "\"\n", "sh");
  f.pos("source-code", "client-run", "client.run(\"", bot, "\")\n", "py");
  f.pos("sdk-config", "config-json", "{\n  \"prefix\": \"!\",\n  \"token\": \"", json, "\"\n}\n", "json");
  f.pos("env", "env", "DISCORD_TOKEN=", env, "\n", "env");
  f.pos("ci-config", "actions-env", "env:\n  DISCORD_BOT_TOKEN: ", ci, "\n", "yml");
  f.pos("log", "startup-log", "2026-09-24T10:00:00Z bot starting with token ", log, "\n", "log");
  f.pos("container-config", "compose-env", "services:\n  bot:\n    environment:\n      DISCORD_TOKEN: ", token("compose"), "\n", "yml");

  const parts = v => v.split(".");
  const [h1, h2, h3] = parts(header), [b1, b2, b3] = parts(bot), [j1, j2, j3] = parts(json), [e1, e2, e3] = parts(env), [c1, c2, c3] = parts(ci), [l1, l2, l3] = parts(log);
  f.vtwin("bot-authorization", "short-hmac", `${h1}.${h2}.${h3.slice(0, 37)}`, "length: 37-character third segment vs the 27 or 38 observed", "length");
  f.vtwin("config-json", "short-hmac-json", `${j1}.${j2}.${j3.slice(0, 37)}`, "length: 37-character third segment vs the 27 or 38 observed", "length");
  f.vtwin("client-run", "short-id-segment", `${b1.slice(0, 25)}.${b2}.${b3}`, "length: 25-character first segment vs the 24 or 26 an 18- or 19-digit id encodes to", "length");
  f.vtwin("env", "underscore-delimiter", `${e1}_${e2}.${e3}`, "boundary: \"_\" in place of the first \".\" delimiter", "boundary");
  f.vtwin("actions-env", "dash-delimiter", `${c1}.${c2}-${c3}`, "boundary: \"-\" in place of the second \".\" delimiter", "boundary");
  f.vtwin("startup-log", "bang-hmac", `${l1}.${l2}.${l3.slice(0, 20)}!${l3.slice(21)}`, "alphabet: \"!\" in the third segment, outside base64url", "alphabet");
  f.vtwin("bot-authorization", "plus-timestamp", `${h1}.${h2.slice(0, 3)}+${h2.slice(4)}.${h3}`, "alphabet: \"+\" (standard base64) in the second segment, outside base64url", "alphabet");
  f.vtwin("config-json", "bang-id", `${j1.slice(0, 10)}!${j1.slice(11)}.${j2}.${j3}`, "alphabet: \"!\" in the first segment, outside base64url", "alphabet");

  f.ctl("public-id", "application-id", `DISCORD_APPLICATION_ID=${id("app", 19)}\n`, "env");
  f.ctl("public-id", "interactions-public-key", `DISCORD_PUBLIC_KEY=${f.s("public-key", 64, LOWER_HEX)}\n`, "env");
  f.ctl("public-id", "user-mention", `Deployed by <@${id("mention", 19)}> in <#${id("channel", 19)}>\n`, "md");
  f.ctl("encoded-value", "encoded-user-id", `user_b64=${Buffer.from(id("encoded", 19)).toString("base64url")}\n`);
  f.ctl("placeholder", "your-token-here", "DISCORD_TOKEN=your-bot-token-here\n", "env");
  f.ctl("reference", "actions-secret", "env:\n  DISCORD_BOT_TOKEN: ${{ secrets.DISCORD_BOT_TOKEN }}\n", "yml");
  f.ctl("prose", "reset-note", "Reset the bot token under Developer Portal > Bot; Discord shows the new token only once.\n", "md");
  f.ctl("near-miss", "two-segments", `DISCORD_TOKEN=${Buffer.from(id("two", 19)).toString("base64url")}.${f.s("two-hmac", 38, B64URL)}\n`, "env");
}

// ---------------------------------------------------------------------------
// Context-gated families (context-48): no bare-value claim; each context twin
// keeps the value and removes the one same-line marker the contract names.

// twilio:auth-token → twilio-auth-token. 32 lowercase hex; marker: "twilio" or an AC Account SID.
function twilioAuth(c, synthetic) {
  const f = family(c, synthetic, "twilio-auth-token");
  const v = slug => f.s(`value:${slug}`, 32, LOWER_HEX);
  const sid = slug => `AC${f.s(`sid:${slug}`, 32, LOWER_HEX)}`;
  const gone = "the same-line \"twilio\" keyword removed";
  f.pos("env", "env", "TWILIO_AUTH_TOKEN=", v("env"), "\n", "env");
  f.ctwin("env", "env-context", { before: "CACHE_DIGEST=" }, `context: ${gone} (TWILIO_AUTH_TOKEN renamed CACHE_DIGEST)`);
  f.pos("shell-export", "export", "export TWILIO_AUTH_TOKEN=\"", v("export"), "\"\n", "sh");
  f.ctwin("export", "export-context", { before: "export ASSET_CHECKSUM=\"" }, `context: ${gone} (TWILIO_AUTH_TOKEN renamed ASSET_CHECKSUM)`);
  f.pos("sdk-config", "yaml", "twilio_auth_token: ", v("yaml"), "\n", "yml");
  f.ctwin("yaml", "yaml-context", { before: "build_digest: " }, `context: ${gone} (twilio_auth_token renamed build_digest)`);
  f.pos("source-code", "client-sid", `client = Client("${sid("client")}", "`, v("client"), "\")\n", "py");
  f.ctwin("client-sid", "client-sid-context", { before: "client = Client(account_sid, \"" }, "context: the same-line AC Account SID replaced by a variable name");
  f.pos("structured-file", "json", "{\"twilioAuthToken\": \"", v("json"), "\"}\n", "json");
  f.ctwin("json", "json-context", { before: "{\"etag\": \"" }, `context: ${gone} (twilioAuthToken renamed etag)`);
  f.pos("ci-config", "actions-env", "env:\n  TWILIO_AUTH_TOKEN: ", v("ci"), "\n", "yml");
  f.ctwin("actions-env", "actions-context", { before: "env:\n  ARTIFACT_MD5: " }, `context: ${gone} (TWILIO_AUTH_TOKEN renamed ARTIFACT_MD5)`);
  f.pos("container-config", "compose-env", "services:\n  sms:\n    environment:\n      - TWILIO_AUTH_TOKEN=", v("compose"), "\n", "yml");
  f.ctwin("compose-env", "compose-context", { before: "services:\n  sms:\n    environment:\n      - RELEASE_MD5=" }, `context: ${gone} (TWILIO_AUTH_TOKEN renamed RELEASE_MD5)`);
  f.pos("cli", "config-set", "heroku config:set TWILIO_AUTH_TOKEN=", v("cli"), " -a example-app\n", "sh");
  f.ctwin("config-set", "config-set-context", { before: "heroku config:set CACHE_KEY=" }, `context: ${gone} (TWILIO_AUTH_TOKEN renamed CACHE_KEY)`);
  f.pos("log", "init-log", "2026-09-24T10:00:00Z twilio client init auth_token=", v("log"), "\n", "log");
  f.ctwin("init-log", "init-log-context", { before: "2026-09-24T10:00:00Z client init auth_token=" }, `context: ${gone} from the log line`);
  f.pos("prose", "support-note", "Your Twilio auth token is ", v("prose"), ".\n", "md");
  f.ctwin("support-note", "support-note-context", { before: "Your cache key is " }, `context: ${gone} from the sentence`);
  f.pos("basic-auth", "curl-basic", `curl -X POST https://api.twilio.com/2010-04-01/Accounts/${sid("basic")}/Messages.json -u ${sid("basic-user")}:`, v("basic"), "\n", "sh");

  f.ctl("public-id", "account-sid", `TWILIO_ACCOUNT_SID=${sid("public")}\n`, "env");
  f.ctl("public-id", "phone-number", "TWILIO_PHONE_NUMBER=+12025550143\n", "env");
  f.ctl("public-id", "messaging-service-sid", `TWILIO_MESSAGING_SERVICE_SID=MG${f.s("mg", 32, LOWER_HEX)}\n`, "env");
  f.ctl("encoded-value", "package-md5", `twilio-9.3.0.tar.gz md5=${f.s("md5", 32, LOWER_HEX)}\n`);
  f.ctl("near-miss", "long-value", `TWILIO_AUTH_TOKEN=${f.s("long", 33, LOWER_HEX)}\n`, "env");
  f.ctl("near-miss", "split-value", `TWILIO_AUTH_TOKEN=${f.s("split-a", 16, LOWER_HEX)}-${f.s("split-b", 16, LOWER_HEX)}\n`, "env");
  f.ctl("placeholder", "your-token", "TWILIO_AUTH_TOKEN=your_auth_token\n", "env");
  f.ctl("placeholder", "cli-hidden", "? The Auth Token for your Twilio Account: [hidden]\n");
  f.ctl("placeholder", "masked-console", `Auth Token ${"•".repeat(32)} Show\n`);
  f.ctl("reference", "actions-secret", "env:\n  TWILIO_AUTH_TOKEN: ${{ secrets.TWILIO_AUTH_TOKEN }}\n", "yml");
  f.ctl("reference", "process-env", "const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);\n", "js");
  f.ctl("prose", "rotation-note", "Rotate the Twilio auth token from the Console if it was ever committed; request a secondary token first.\n", "md");
}

// twilio:api-key-secret → twilio-api-key-secret. 32 alphanumeric; marker: "twilio" or an SK API Key SID.
function twilioKey(c, synthetic) {
  const f = family(c, synthetic, "twilio-api-key-secret");
  const v = slug => f.s(`value:${slug}`, 32, ALNUM);
  const sk = slug => `SK${f.s(`sid:${slug}`, 32, LOWER_HEX)}`;
  const gone = "the same-line \"twilio\" keyword removed";
  f.pos("env", "env", "TWILIO_API_SECRET=", v("env"), "\n", "env");
  f.ctwin("env", "env-context", { before: "SESSION_NONCE=" }, `context: ${gone} (TWILIO_API_SECRET renamed SESSION_NONCE)`);
  f.pos("shell-export", "export", "export TWILIO_API_KEY_SECRET='", v("export"), "'\n", "sh");
  f.ctwin("export", "export-context", { before: "export BUILD_NONCE='" }, `context: ${gone} (TWILIO_API_KEY_SECRET renamed BUILD_NONCE)`);
  f.pos("sdk-config", "yaml", "twilio_api_secret: ", v("yaml"), "\n", "yml");
  f.ctwin("yaml", "yaml-context", { before: "request_nonce: " }, `context: ${gone} (twilio_api_secret renamed request_nonce)`);
  f.pos("source-code", "client-sk", `client = Client("${sk("client")}", "`, v("client"), "\", account_sid)\n", "py");
  f.ctwin("client-sk", "client-sk-context", { before: "client = Client(api_key, \"" }, "context: the same-line SK API Key SID replaced by a variable name");
  f.pos("structured-file", "json", "{\"twilioApiSecret\": \"", v("json"), "\"}\n", "json");
  f.ctwin("json", "json-context", { before: "{\"requestNonce\": \"" }, `context: ${gone} (twilioApiSecret renamed requestNonce)`);
  f.pos("ci-config", "actions-env", "env:\n  TWILIO_API_SECRET: ", v("ci"), "\n", "yml");
  f.ctwin("actions-env", "actions-context", { before: "env:\n  CACHE_NONCE: " }, `context: ${gone} (TWILIO_API_SECRET renamed CACHE_NONCE)`);
  f.pos("container-config", "compose-env", "services:\n  voice:\n    environment:\n      - TWILIO_API_SECRET=", v("compose"), "\n", "yml");
  f.ctwin("compose-env", "compose-context", { before: "services:\n  voice:\n    environment:\n      - RELEASE_NONCE=" }, `context: ${gone} (TWILIO_API_SECRET renamed RELEASE_NONCE)`);
  f.pos("cli", "profile-create", `twilio profiles:create --api-key ${sk("cli")} --api-secret `, v("cli"), "\n", "sh");
  f.pos("log", "init-log", "2026-09-24T10:00:00Z twilio client init api_secret=", v("log"), "\n", "log");
  f.ctwin("init-log", "init-log-context", { before: "2026-09-24T10:00:00Z client init api_secret=" }, `context: ${gone} from the log line`);
  f.pos("prose", "handoff-note", "The Twilio API key secret for staging is ", v("prose"), ".\n", "md");
  f.ctwin("handoff-note", "handoff-note-context", { before: "The cache nonce for staging is " }, `context: ${gone} from the sentence`);
  f.pos("basic-auth", "curl-basic", `curl https://api.twilio.com/2010-04-01/Accounts.json -u ${sk("basic")}:`, v("basic"), "\n", "sh");
  f.pos("source-code", "js-constant", "const twilioApiSecret = \"", v("js"), "\";\n", "js");
  f.ctwin("js-constant", "js-constant-context", { before: "const cacheNonce = \"" }, `context: ${gone} (twilioApiSecret renamed cacheNonce)`);

  f.ctl("public-id", "api-key-sid", `TWILIO_API_KEY=${sk("public")}\n`, "env");
  f.ctl("public-id", "account-sid", `TWILIO_ACCOUNT_SID=AC${f.s("ac", 32, LOWER_HEX)}\n`, "env");
  f.ctl("encoded-value", "request-signature", `X-Twilio-Signature: ${f.s("signature", 27, B64)}=\n`, "http");
  f.ctl("near-miss", "wrong-companion", `twilio credentials: ${sk("companion")} AC${f.s("companion-ac", 32, LOWER_HEX)}\n`);
  f.ctl("near-miss", "short-value", `TWILIO_API_SECRET=${f.s("short", 24, ALNUM)}\n`, "env");
  f.ctl("placeholder", "your-secret", "TWILIO_API_SECRET=your_api_secret\n", "env");
  f.ctl("placeholder", "x-mask", `TWILIO_API_SECRET=${"x".repeat(32)}\n`, "env");
  f.ctl("placeholder", "cli-hidden", "? Your API Key Secret: [hidden]\n");
  f.ctl("reference", "actions-secret", "env:\n  TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}\n", "yml");
  f.ctl("reference", "process-env", "new twilio.Twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, { accountSid });\n", "js");
  f.ctl("prose", "one-time-note", "Twilio shows an API key secret only once, when the key is created.\n", "md");
}

// heroku:legacy-api-key → heroku-api-key-legacy. Bare UUID; marker: a same-line heroku keyword.
function herokuLegacy(c, synthetic) {
  const f = family(c, synthetic, "heroku-api-key-legacy");
  const uuid = slug => `${f.s(`${slug}:a`, 8, LOWER_HEX)}-${f.s(`${slug}:b`, 4, LOWER_HEX)}-4${f.s(`${slug}:c`, 3, LOWER_HEX)}-${f.s(`${slug}:v`, 1, "89ab")}${f.s(`${slug}:d`, 3, LOWER_HEX)}-${f.s(`${slug}:e`, 12, LOWER_HEX)}`;
  const gone = "the same-line heroku keyword removed";
  f.pos("env", "env", "HEROKU_API_KEY=", uuid("env"), "\n", "env");
  f.ctwin("env", "env-context", { before: "CACHE_KEY=" }, `context: ${gone} (HEROKU_API_KEY renamed CACHE_KEY)`);
  f.pos("shell-export", "export", "export HEROKU_API_KEY=", uuid("export"), "\n", "sh");
  f.ctwin("export", "export-context", { before: "export CACHE_KEY=" }, `context: ${gone} (HEROKU_API_KEY renamed CACHE_KEY)`);
  f.pos("ci-config", "deploy-action", "      - uses: akhileshns/heroku-deploy@v3.13.15\n        with:\n          heroku_api_key: ", uuid("ci"), "\n", "yml");
  f.ctwin("deploy-action", "deploy-action-context", { before: "      - uses: akhileshns/heroku-deploy@v3.13.15\n        with:\n          cache_key: " }, `context: ${gone} (heroku_api_key renamed cache_key)`);
  f.pos("header", "platform-api", "curl https://api.heroku.com/account -H \"Authorization: Bearer ", uuid("header"), "\"\n", "sh");
  f.ctwin("platform-api", "platform-api-context", { before: "curl https://api.example.invalid/account -H \"Authorization: Bearer " }, `context: ${gone} (the Platform API host)`);
  f.pos("structured-file", "netrc-single-line", "machine api.heroku.com login fixture@example.invalid password ", uuid("netrc"), "\n", "netrc");
  f.ctwin("netrc-single-line", "netrc-single-line-context", { before: "machine api.example.invalid login fixture@example.invalid password " }, `context: ${gone} (the machine host)`);
  f.pos("sdk-config", "terraform-provider", "provider \"heroku\" { api_key = \"", uuid("terraform"), "\" }\n", "tf");
  f.ctwin("terraform-provider", "terraform-provider-context", { before: "provider \"example\" { api_key = \"" }, `context: ${gone} (the provider name)`);
  f.pos("url", "git-remote", "git remote add deploy https://:", uuid("git"), "@git.heroku.com/example-app.git\n", "sh");
  f.ctwin("git-remote", "git-remote-context", { after: "@git.example.invalid/example-app.git\n" }, `context: ${gone} (the git host after the value)`);
  f.pos("container-config", "compose-env", "services:\n  release:\n    environment:\n      - HEROKU_API_KEY=", uuid("compose"), "\n", "yml");
  f.ctwin("compose-env", "compose-context", { before: "services:\n  release:\n    environment:\n      - CACHE_KEY=" }, `context: ${gone} (HEROKU_API_KEY renamed CACHE_KEY)`);
  f.pos("prose", "handoff-note", "Heroku API key for the old pipeline: ", uuid("prose"), "\n", "md");
  f.ctwin("handoff-note", "handoff-note-context", { before: "Cache key for the old pipeline: " }, `context: ${gone} from the sentence`);
  f.pos("log", "deploy-log", "2026-09-24T10:00:00Z deploy step: heroku auth token ", uuid("log"), "\n", "log");
  f.ctwin("deploy-log", "deploy-log-context", { before: "2026-09-24T10:00:00Z deploy step: auth token " }, `context: ${gone} from the log line`);
  f.pos("cli", "inline-env", "HEROKU_API_KEY=", uuid("cli"), " heroku apps:info -a example-app\n", "sh");
  // Realistic contexts the same-line gate does not reach (#232): measured, not excluded.
  f.pos("structured-file", "netrc-multi-line", "machine api.heroku.com\n  login fixture@example.invalid\n  password ", uuid("netrc-multi"), "\nmachine git.heroku.com\n  login fixture@example.invalid\n  password ${HEROKU_API_KEY}\n", "netrc");
  f.pos("tool-output", "auth-token-output", "$ heroku auth:token\n", uuid("auth-token"), "\n");

  f.ctl("public-id", "release-id", `heroku_release_id=${uuid("release")}\n`, "env");
  f.ctl("public-id", "app-uuid-json", `{"herokuAppUuid": "${uuid("app-json")}", "stack": "heroku-24"}\n`, "json");
  f.ctl("public-id", "app-url-path", `GET https://api.heroku.com/apps/${uuid("app-url")}/releases\n`, "log");
  f.ctl("public-id", "router-request-id", `2026-09-24T10:00:00+00:00 heroku[router]: at=info method=GET path="/" host=example-app.herokuapp.com request_id=${uuid("request")} status=200 bytes=512\n`, "log");
  f.ctl("public-id", "oauth-client-id", `HEROKU_OAUTH_ID=${uuid("oauth-client")}\n`, "env");
  f.ctl("public-id", "authorizations-list", `$ heroku authorizations\nbenchmark deploy token  ${uuid("authorization")}  global\n`);
  f.ctl("encoded-value", "buildpack-digest", `heroku/nodejs buildpack sha256=${f.s("buildpack", 64, LOWER_HEX)}\n`);
  f.ctl("near-miss", "non-hex-uuid", `HEROKU_API_KEY=${uuid("non-hex").slice(0, 9)}g${uuid("non-hex-tail").slice(10)}\n`, "env");
  f.ctl("near-miss", "missing-group", `HEROKU_API_KEY=${f.s("group-a", 8, LOWER_HEX)}-${f.s("group-b", 4, LOWER_HEX)}-${f.s("group-c", 4, LOWER_HEX)}-${f.s("group-e", 12, LOWER_HEX)}\n`, "env");
  f.ctl("placeholder", "your-key", "HEROKU_API_KEY=<your-api-key>\n", "env");
  f.ctl("placeholder", "x-mask", "HEROKU_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\n", "env");
  f.ctl("reference", "actions-secret", "with:\n  heroku_api_key: ${{ secrets.HEROKU_API_KEY }}\n", "yml");
  f.ctl("reference", "command-substitution", "export HEROKU_API_KEY=\"$(heroku auth:token)\"\n", "sh");
  f.ctl("prose", "prefix-note", "Heroku now prefixes OAuth tokens with HRKU-; unprefixed tokens keep working until they are regenerated.\n", "md");
}

// confluent:cloud-api-secret-legacy → confluent-cloud-api-secret-legacy. 64 base64-alphabet
// characters (the 60/64 ambiguity is preserved: no 60-character value is asserted either way);
// marker: a same-line confluent keyword.
function confluentLegacy(c, synthetic) {
  const f = family(c, synthetic, "confluent-cloud-api-secret-legacy");
  const secret = (slug, chars = B64) => f.s(`secret:${slug}`, 64, chars);
  const keyId = slug => f.s(`key:${slug}`, 16, UPPER_ALNUM);
  const gone = "the same-line confluent keyword removed";
  const env = secret("env"), tfvars = secret("tfvars");
  f.pos("env", "env", "CONFLUENT_CLOUD_API_SECRET=", env, "\n", "env");
  f.ctwin("env", "env-context", { before: "KAFKA_API_SECRET=" }, `context: ${gone} (CONFLUENT_CLOUD_API_SECRET renamed KAFKA_API_SECRET)`);
  f.pos("shell-export", "export", "export CONFLUENT_CLOUD_API_SECRET='", secret("export"), "'\n", "sh");
  f.ctwin("export", "export-context", { before: "export SASL_PASSWORD='" }, `context: ${gone} (CONFLUENT_CLOUD_API_SECRET renamed SASL_PASSWORD)`);
  f.pos("cli", "api-key-store", `confluent api-key store ${keyId("store")} `, secret("store"), " --resource lkc-a1b2c3\n", "sh");
  f.ctwin("api-key-store", "api-key-store-context", { before: `kafkactl api-key store ${keyId("store")} ` }, `context: ${gone} (the confluent CLI name)`);
  f.pos("basic-auth", "iam-curl", `curl -u ${keyId("curl")}:`, secret("curl"), " https://api.confluent.cloud/iam/v2/api-keys\n", "sh");
  f.ctwin("iam-curl", "iam-curl-context", { after: " https://api.example.invalid/iam/v2/api-keys\n" }, `context: ${gone} (the host after the value)`);
  f.pos("url", "schema-registry-url", `schema.registry.url=https://${keyId("url")}:`, secret("url", ALNUM), "@psrc-a1b2c.us-east-2.aws.confluent.cloud\n", "properties");
  f.ctwin("schema-registry-url", "schema-registry-url-context", { after: "@registry.example.invalid\n" }, `context: ${gone} (the host after the value)`);
  f.pos("sdk-config", "librdkafka-dict", "conf = {'bootstrap.servers': 'pkc-a1b2c.us-east-1.aws.confluent.cloud:9092', 'sasl.username': 'KEY', 'sasl.password': '", secret("python"), "'}\n", "py");
  f.ctwin("librdkafka-dict", "librdkafka-dict-context", { before: "conf = {'bootstrap.servers': 'broker.example.invalid:9092', 'sasl.username': 'KEY', 'sasl.password': '" }, `context: ${gone} (the bootstrap host)`);
  f.pos("structured-file", "tfvars", "confluent_cloud_api_secret = \"", tfvars, "\"\n", "tfvars");
  f.ctwin("tfvars", "tfvars-context", { before: "cloud_api_secret = \"" }, `context: ${gone} (confluent_cloud_api_secret renamed cloud_api_secret)`);
  f.pos("ci-config", "actions-env", "env:\n  CONFLUENT_CLOUD_API_SECRET: ", secret("ci"), "\n", "yml");
  f.ctwin("actions-env", "actions-context", { before: "env:\n  KAFKA_API_SECRET: " }, `context: ${gone} (CONFLUENT_CLOUD_API_SECRET renamed KAFKA_API_SECRET)`);
  f.pos("container-config", "k8s-secret", "apiVersion: v1\nkind: Secret\nstringData:\n  CONFLUENT_API_SECRET: ", secret("k8s"), "\n", "yml");
  f.ctwin("k8s-secret", "k8s-secret-context", { before: "apiVersion: v1\nkind: Secret\nstringData:\n  KAFKA_API_SECRET: " }, `context: ${gone} (CONFLUENT_API_SECRET renamed KAFKA_API_SECRET)`);
  f.pos("source-code", "js-constant", "const confluentApiSecret = \"", secret("js"), "\";\n", "js");
  f.ctwin("js-constant", "js-constant-context", { before: "const kafkaApiSecret = \"" }, `context: ${gone} (confluentApiSecret renamed kafkaApiSecret)`);
  f.pos("log", "client-log", "2026-09-24T10:00:00Z confluent client configured with secret ", secret("log"), "\n", "log");

  // A current cflt secret is a sibling family's secret (#233, #234): never a benign control. Here it
  // appears only as a twin scoped to this legacy family, built checksum-valid from the provider's
  // published snippet (cflt + 54 + base64(CRC32-LE(body54))[:6], docs.confluent.io).
  const cflt = body54 => { const crc = Buffer.alloc(4); crc.writeUInt32LE(crc32(body54)); return `cflt${body54}${crc.toString("base64").slice(0, 6)}`; };
  const sibling = "prefix: the value re-issued in the documented current generation (cflt + 54 + a 6-character CRC32 checksum, docs.confluent.io), a secret of the sibling confluent-cloud-api-secret family. This twin is scoped to the legacy family: the product reporting it as confluent-cloud-api-secret is co-detection, not a false alarm here; only a legacy-family finding fails it";
  f.vtwin("env", "current-generation", cflt(env.slice(4, 58)), sibling, "prefix");
  f.vtwin("tfvars", "current-generation-tfvars", cflt(tfvars.slice(4, 58)), sibling, "prefix");

  f.ctl("public-id", "api-key-id", `CONFLUENT_CLOUD_API_KEY=${keyId("public")}\n`, "env");
  f.ctl("public-id", "global-key-id", `confluent api-key list => GLOBAL${f.s("global", 12, UPPER_ALNUM)}  global  benchmark-sa\n`);
  f.ctl("public-id", "resource-ids", "confluent environment use env-a1b2c3 && confluent kafka cluster use lkc-d4e5f6\n", "sh");
  f.ctl("public-id", "bootstrap-host", "bootstrap.servers=pkc-a1b2c.us-east-1.aws.confluent.cloud:9092\nsecurity.protocol=SASL_SSL\n", "properties");
  f.ctl("encoded-value", "image-digest", `image: confluentinc/cp-server@sha256:${f.s("digest", 64, LOWER_HEX)}\n`, "yml");
  f.ctl("near-miss", "cflt-asset-url", "See https://docs.confluent.io/cloud/current/_images/cflt-assistant-overview.png for the confluent key wizard.\n", "md");
  f.ctl("near-miss", "overlong-value", `CONFLUENT_CLOUD_API_SECRET=${f.s("overlong", 66, B64)}\n`, "env");
  f.ctl("near-miss", "key-id-twice", `confluent api-key store ${keyId("twice")} ${keyId("twice")}\n`, "sh");
  f.ctl("placeholder", "angle-secret", "CONFLUENT_CLOUD_API_SECRET=<API_SECRET>\n", "env");
  f.ctl("placeholder", "masked-table", `| API Key    | ${keyId("table")} |\n| API Secret | ${"*".repeat(64)} |\n`);
  f.ctl("reference", "config-provider", "sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"${file:/secrets/confluent.properties:api.key}\" password=\"${file:/secrets/confluent.properties:api.secret}\";\n", "properties");
  f.ctl("reference", "actions-secret", "env:\n  CONFLUENT_CLOUD_API_SECRET: ${{ secrets.CONFLUENT_CLOUD_API_SECRET }}\n", "yml");
  f.ctl("prose", "one-time-note", "Confluent shows an API secret only once; secrets created after 2025-07-30 start with cflt.\n", "md");
  f.ctl("public-id", "service-account", "confluent iam service-account list => sa-a1b2c3  benchmark-connector  Service account for the connector\n");
}

// generic:bearer-token → bearer-token (T3 policy, RFC 6750). The identifying element is the
// Bearer scheme outside the span; each context twin swaps the credential position for a
// non-credential header or field holding the same value.
function bearer(c, synthetic) {
  const f = family(c, synthetic, "bearer-token");
  const v = slug => `${f.s(`value:${slug}`, 39, B64TOKEN)}${f.s(`last:${slug}`, 1, ALNUM)}`;
  const moved = "context: the Authorization Bearer credential position replaced by";
  f.pos("header", "raw-request", "GET /v1/items HTTP/1.1\nHost: api.example.invalid\nAuthorization: Bearer ", v("raw"), "\n", "http");
  f.ctwin("raw-request", "raw-request-context", { before: "GET /v1/items HTTP/1.1\nHost: api.example.invalid\nX-Request-Id: " }, `${moved} an X-Request-Id header`);
  f.pos("cli", "curl", "curl https://api.example.invalid/v1/items -H \"Authorization: Bearer ", v("curl"), "\"\n", "sh");
  f.ctwin("curl", "curl-context", { before: "curl https://api.example.invalid/v1/items -H \"X-Correlation-Id: " }, `${moved} an X-Correlation-Id header`);
  f.pos("source-code", "fetch", "await fetch(url, { headers: { Authorization: `Bearer ", v("fetch"), "` } });\n", "js");
  f.ctwin("fetch", "fetch-context", { before: "await fetch(url, { headers: { 'X-Trace-Id': `" }, `${moved} an X-Trace-Id header`);
  f.pos("sdk-config", "client-yaml", "client:\n  base_url: https://api.example.invalid\n  headers:\n    Authorization: \"Bearer ", v("yaml"), "\"\n", "yml");
  f.ctwin("client-yaml", "client-yaml-context", { before: "client:\n  base_url: https://api.example.invalid\n  headers:\n    X-Build-Id: \"" }, `${moved} an X-Build-Id header`);
  f.pos("log", "request-log", "2026-09-24T10:00:00Z INFO outbound request headers={\"authorization\":\"Bearer ", v("log"), "\"}\n", "log");
  f.ctwin("request-log", "request-log-context", { before: "2026-09-24T10:00:00Z INFO outbound request headers={\"x-request-id\":\"" }, `${moved} an x-request-id header`);
  f.pos("tool-output", "httpie-verbose", "GET /v1/items HTTP/1.1\nAccept: */*\nAuthorization: Bearer ", v("httpie"), "\nUser-Agent: HTTPie/3.2.2\n\nHTTP/1.1 200 OK\n");
  f.ctwin("httpie-verbose", "httpie-verbose-context", { before: "GET /v1/items HTTP/1.1\nAccept: */*\nIf-None-Match: " }, `${moved} an If-None-Match header`);
  f.pos("structured-file", "har-entry", "{\"request\": {\"headers\": [{\"name\": \"Authorization\", \"value\": \"Bearer ", v("har"), "\"}]}}\n", "json");
  f.ctwin("har-entry", "har-entry-context", { before: "{\"request\": {\"headers\": [{\"name\": \"ETag\", \"value\": \"" }, `${moved} an ETag header`);
  f.pos("ci-config", "workflow-step", "      - run: curl -fsS -H \"Authorization: Bearer ", v("ci"), "\" https://api.example.invalid/deploy\n", "yml");
  f.ctwin("workflow-step", "workflow-step-context", { before: "      - run: curl -fsS -H \"X-Deploy-Id: " }, `${moved} an X-Deploy-Id header`);
  f.pos("header", "lowercase-scheme", "authorization: bearer ", v("lower"), "\n", "http");
  f.ctwin("lowercase-scheme", "lowercase-scheme-context", { before: "x-session-id: " }, `${moved} an x-session-id header`);
  f.pos("prose", "runbook", "Send the header Authorization: Bearer ", v("prose"), " with every call to the staging API.\n", "md");
  f.ctwin("runbook", "runbook-context", { before: "Send the header X-Session-Id: " }, `${moved} an X-Session-Id header`);

  f.ctl("public-id", "request-id", `X-Request-Id: ${f.s("rid-a", 8, LOWER_HEX)}-${f.s("rid-b", 4, LOWER_HEX)}-4${f.s("rid-c", 3, LOWER_HEX)}-8${f.s("rid-d", 3, LOWER_HEX)}-${f.s("rid-e", 12, LOWER_HEX)}\n`, "http");
  f.ctl("public-id", "client-id", `oauth:\n  client_id: ${f.s("client-id", 24, LOWER_ALNUM)}\n  redirect_uri: https://app.example.invalid/callback\n`, "yml");
  f.ctl("public-id", "trace-header", `X-Amzn-Trace-Id: Root=1-${f.s("trace-a", 8, LOWER_HEX)}-${f.s("trace-b", 24, LOWER_HEX)}\n`, "http");
  f.ctl("encoded-value", "etag", `ETag: "${f.s("etag", 40, LOWER_HEX)}"\n`, "http");
  f.ctl("encoded-value", "content-md5", `Content-MD5: ${f.s("md5", 22, B64)}==\n`, "http");
  f.ctl("near-miss", "challenge", "WWW-Authenticate: Bearer realm=\"example\", error=\"invalid_token\"\n", "http");
  f.ctl("near-miss", "token-type-only", "{\"token_type\": \"Bearer\", \"expires_in\": 3600, \"scope\": \"read\"}\n", "json");
  f.ctl("placeholder", "angle-token", "Authorization: Bearer <token>\n", "http");
  f.ctl("placeholder", "your-access-token", "curl -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" https://api.example.invalid/v1/items\n", "sh");
  f.ctl("placeholder", "redacted", "Authorization: Bearer [REDACTED]\n", "http");
  f.ctl("reference", "command-substitution", "curl -H \"Authorization: Bearer $(gcloud auth print-access-token)\" https://api.example.invalid\n", "sh");
  f.ctl("reference", "postman-variable", "{\"key\": \"Authorization\", \"value\": \"Bearer {{accessToken}}\"}\n", "json");
  f.ctl("prose", "rfc-note", "Bearer tokens are sent in the Authorization header; RFC 6750 leaves their contents unspecified.\n", "md");
}

export function build207({ fixture, synthetic }) {
  const c = beta8Corpus(207, { fixture, synthetic });
  for (const build of [supabase, atlassian, firebase, sentryOrg, sentryUser, telegram, discord, twilioAuth, twilioKey, herokuLegacy, confluentLegacy, bearer])
    build(c, synthetic);
  return c.fixtures;
}
