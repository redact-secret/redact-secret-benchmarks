import { crc32 } from "node:zlib";
import { beta8Corpus } from "./helpers.mjs";

// Issue #209 corpus (category `beta8-209`). See docs/specs/beta8-evidence.md.
//
// Hardens the seven smallest documented-stable registry families to the
// `documented-24` profile. Every value is synthetic (`synthetic()` seeds) or
// independently constructed here (the Confluent checksum, from the algorithm
// docs.confluent.io publishes, via node:zlib — assessment.ts's contract
// `validate` recomputes it with its own table CRC32). Research inputs:
// redact-secret#642 (azure-devops, google, notion, anthropic), redact-secret#645
// (datadog), #234 (confluent) and #235 (heroku).

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BASE64 = `${ALNUM}+/`;
const URLSAFE = `${ALNUM}_-`;
const HEX = "0123456789abcdef";
const UPPER_DIGIT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";
const URI = "URI scheme, user and host are not secret, but redacting the whole connection URI is acceptable; only the password must be covered.";

/** A twin carries no secret span: flatten a positive's parts (envelopes included) into literal text. A companion span is kept: it is never a secret span. */
const flat = parts => parts.map(p => (typeof p === "string" || p.companion !== undefined ? p : `${p.envelope?.before ?? ""}${p.secret}${p.envelope?.after ?? ""}`));

// --- Confluent Cloud API secret (#234): cflt + 54 body + 6-character checksum. ---
const le = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const be = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
/** docs.confluent.io's snippet: CRC32 of the 54 body characters (prefix excluded), little-endian, standard Base64, first 6. */
const cfltChecksum = body => le(crc32(Buffer.from(body, "ascii"))).toString("base64").slice(0, 6);

export function build209({ fixture, synthetic }) {
  const c = beta8Corpus(209, { fixture, synthetic });
  const seed = (target, slug) => `beta8:209:${target}:${slug}`;
  const uuid = label => { const h = synthetic(label, 32, HEX); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
  const differs = (a, b, what) => { if (a === b) throw new Error(`beta8-209: ${what} did not change the value`); return a; };

  // ---------------------------------------------------------------- azure-devops
  {
    const T = "azure-devops-personal-access-token";
    // Microsoft Learn: 84 characters with a fixed AZDO signature at positions 76-80; Purview: [A-Za-z0-9].
    const pat = slug => { const s = synthetic(seed(T, slug), 80); return `${s.slice(0, 76)}AZDO${s.slice(76)}`; };
    const env = v => ["# Azure DevOps CLI (az devops) reads this variable\n", "AZURE_DEVOPS_EXT_PAT=", { secret: v }, "\n"];
    const url = v => ["git clone ", { secret: v, envelope: { before: "https://build-agent:", after: "@dev.azure.com/contoso/Payments/_git/payments-api", reason: URI } }, "\n"];
    const cli = v => ["$ echo ", { secret: v }, " | az devops login --organization https://dev.azure.com/contoso\n"];
    const nuget = v => ['<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <packageSourceCredentials>\n    <contoso-feed>\n      <add key="Username" value="build-agent" />\n      <add key="ClearTextPassword" value="', { secret: v }, '" />\n    </contoso-feed>\n  </packageSourceCredentials>\n</configuration>\n'];
    const envPat = pat("env"), urlPat = pat("url"), nugetPat = pat("nuget");
    c.positive(T, "env", "env-ext-pat", env(envPat), "env");
    c.positive(T, "url", "git-remote-url", url(urlPat));
    c.positive(T, "cli", "az-devops-login-stdin", cli(pat("cli")), "sh");
    c.positive(T, "structured-file", "nuget-config-password", nuget(nugetPat), "config");
    c.twin(T, "git-remote-url", "git-remote-url-length", flat(url(`${urlPat}${synthetic(seed(T, "url-extra"), 1)}`)),
      "85 characters: one extra trailing [A-Za-z0-9] byte after the four post-signature characters, against the documented 84", "length");
    c.twin(T, "env-ext-pat", "env-ext-pat-signature-offset", flat(env(differs(`${envPat.slice(0, 75)}AZDO${envPat[75]}${envPat.slice(80)}`, envPat, "signature offset"))),
      "the AZDO signature moved one position earlier (0-based offsets 75-78, not the documented 76-79); length and alphabet unchanged", "boundary");
    c.twin(T, "nuget-config-password", "nuget-config-password-signature-case", flat(nuget(`${nugetPat.slice(0, 76)}azdo${nugetPat.slice(80)}`)),
      "the fixed signature written in lower case (azdo) instead of the documented AZDO; every other byte unchanged", "boundary", "config");
    c.control(T, "public-id", "pipeline-ids", [`System.TeamProjectId=${uuid(seed(T, "project-id"))}\nSystem.CollectionId=${uuid(seed(T, "collection-id"))}\nBuild.BuildId=20417\nSystem.TeamFoundationCollectionUri=https://dev.azure.com/contoso/\n`]);
    c.control(T, "prose", "rotation-note", ["Azure DevOps personal access tokens expire after at most one year. Rotate them from User settings, then update the pipeline variable group.\n"]);
    c.control(T, "placeholder", "ext-pat-template", ["AZURE_DEVOPS_EXT_PAT=<personal-access-token>\n"], "env");
  }

  // ---------------------------------------------------------------- datadog ddapp_
  {
    const T = "datadog-application-key";
    // docs.datadoghq.com documents the ddapp_ prefix; 34 alphanumerics come from Datadog-owned code (provisional).
    const key = slug => `ddapp_${synthetic(seed(T, slug), 34)}`;
    const header = v => ["GET /api/v2/users HTTP/1.1\nHost: api.datadoghq.com\nAccept: application/json\nDD-APPLICATION-KEY: ", { secret: v }, "\n"];
    const tf = v => ['provider "datadog" {\n  api_key = var.datadog_api_key\n  app_key = "', { secret: v }, '"\n  api_url = "https://api.us5.datadoghq.com/"\n}\n'];
    const dog = v => ['$ dog --api-key "$DD_API_KEY" --application-key ', { secret: v }, " monitor show_all\n"];
    const py = v => ['from datadog_api_client import Configuration\n\nconfiguration = Configuration()\nconfiguration.api_key["apiKeyAuth"] = os.environ["DD_API_KEY"]\nconfiguration.api_key["appKeyAuth"] = "', { secret: v }, '"\n'];
    const headerKey = key("header"), tfKey = key("terraform"), pyKey = key("python");
    c.positive(T, "header", "http-header", header(headerKey), "http");
    c.positive(T, "sdk-config", "terraform-provider", tf(tfKey), "tf");
    c.positive(T, "cli", "dogshell-flag", dog(key("dogshell")), "sh");
    c.positive(T, "source-code", "api-client-python", py(pyKey), "py");
    c.twin(T, "http-header", "http-header-separator", flat(header(`ddapp-${headerKey.slice(6)}`)),
      "the documented ddapp_ prefix's underscore replaced by a dash (ddapp-); body unchanged", "boundary", "http");
    c.twin(T, "terraform-provider", "terraform-provider-prefix-case", flat(tf(`DDAPP_${tfKey.slice(6)}`)),
      "the documented lower-case ddapp_ prefix written in upper case (DDAPP_); body unchanged", "prefix", "tf");
    c.twin(T, "api-client-python", "api-client-python-prefix", flat(py(`ddaqp_${pyKey.slice(6)}`)),
      "one prefix byte changed (ddaqp_, not a Datadog prefix); body unchanged", "prefix", "py");
    c.control(T, "public-id", "key-id-listing", [`Application key "ci-reporting"\n  Key ID:    ${uuid(seed(T, "key-id"))}\n  Owner:     svc-reporting\n  Last used: 2026-09-01\n`]);
    c.control(T, "encoded-value", "audit-fingerprint", [`2026-09-20T12:00:00Z audit application_key.rotated name=ci-reporting fingerprint_sha256=${synthetic(seed(T, "fingerprint"), 64, HEX)}\n`], "log");
    c.control(T, "placeholder", "app-key-template", ["DD_APP_KEY=<YOUR_DATADOG_APPLICATION_KEY>\n"], "env");
  }

  // ---------------------------------------------------------------- google AIza
  {
    const T = "google-api-key";
    // Provider example only: AIza + 35 of [A-Za-z0-9_-] (body tool-corroborated).
    const key = slug => `AIza${synthetic(seed(T, slug), 35, URLSAFE)}`;
    const url = v => ["https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=", { secret: v }, "\n"];
    const header = v => ["POST /v1/places:searchText HTTP/1.1\nHost: places.googleapis.com\nContent-Type: application/json\nX-Goog-Api-Key: ", { secret: v }, "\nX-Goog-FieldMask: places.displayName\n"];
    const services = v => ['{\n  "project_info": { "project_id": "demo-payments" },\n  "client": [\n    { "api_key": [ { "current_key": "', { secret: v }, '" } ] }\n  ]\n}\n'];
    const web = v => ['const firebaseConfig = {\n  apiKey: "', { secret: v }, '",\n  authDomain: "demo-payments.firebaseapp.com",\n  projectId: "demo-payments",\n};\n'];
    const urlKey = key("url"), headerKey = key("header"), servicesKey = key("services");
    c.positive(T, "url", "geocode-query", url(urlKey));
    c.positive(T, "header", "goog-api-key-header", header(headerKey), "http");
    c.positive(T, "structured-file", "google-services-json", services(servicesKey), "json");
    c.positive(T, "source-code", "firebase-web-config", web(key("web")), "js");
    c.twin(T, "geocode-query", "geocode-query-length", flat(url(`${urlKey}${synthetic(seed(T, "url-extra"), 1)}`)),
      "40 characters: one extra trailing byte against the example's 39", "length");
    c.twin(T, "goog-api-key-header", "goog-api-key-header-prefix-case", flat(header(`Aiza${headerKey.slice(4)}`)),
      "the AIza prefix's second byte lower-cased (Aiza); body unchanged", "prefix", "http");
    c.twin(T, "google-services-json", "google-services-json-prefix", flat(services(`BIza${servicesKey.slice(4)}`)),
      "the AIza prefix's first byte changed (BIza); body unchanged", "prefix", "json");
    c.control(T, "public-id", "oauth-client-id", [`GOOGLE_CLIENT_ID=${synthetic(seed(T, "project-number"), 12, "0123456789")}-${synthetic(seed(T, "client-id"), 32, "abcdefghijklmnopqrstuvwxyz0123456789")}.apps.googleusercontent.com\n`], "env");
    c.control(T, "prose", "restriction-note", ["Restrict each API key to the APIs and HTTP referrers that need it, and rotate any key that ships in a client bundle.\n"]);
    c.control(T, "placeholder", "maps-script-template", ['<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap" async></script>\n'], "html");
  }

  // ---------------------------------------------------------------- notion secret_
  {
    const T = "notion-token";
    // Notion changelog: secret_ is the legacy (still valid) prefix; 43 alphanumerics are tool-corroborated.
    const token = slug => `secret_${synthetic(seed(T, slug), 43)}`;
    const header = v => ["GET /v1/users/me HTTP/1.1\nHost: api.notion.com\n", { secret: v, envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\nNotion-Version: 2022-06-28\n"];
    const env = v => ["NOTION_API_KEY=", { secret: v }, `\nNOTION_DATABASE_ID=${synthetic(seed(T, "env-database-id"), 32, HEX)}\n`];
    const js = v => ['import { Client } from "@notionhq/client";\n\nconst notion = new Client({ auth: "', { secret: v }, '" });\n'];
    const ci = v => ["jobs:\n  sync:\n    runs-on: ubuntu-latest\n    env:\n      NOTION_TOKEN: ", { secret: v }, "\n    steps:\n      - run: node scripts/sync-roadmap.mjs\n"];
    const headerToken = token("header"), envToken = token("env"), jsToken = token("js");
    c.positive(T, "header", "bearer-header", header(headerToken), "http");
    c.positive(T, "env", "env-api-key", env(envToken), "env");
    c.positive(T, "source-code", "sdk-client", js(jsToken), "js");
    c.positive(T, "ci-config", "github-actions-env", ci(token("ci")), "yml");
    c.twin(T, "bearer-header", "bearer-header-separator", flat(header(`secret-${headerToken.slice(7)}`)),
      "the documented secret_ prefix's underscore replaced by a dash (secret-); body unchanged", "boundary", "http");
    c.twin(T, "env-api-key", "env-api-key-length", flat(env(`${envToken}${synthetic(seed(T, "env-extra"), 1)}`)),
      "44 body characters: one extra trailing byte", "length", "env");
    c.twin(T, "sdk-client", "sdk-client-prefix-case", flat(js(`Secret_${jsToken.slice(7)}`)),
      "the lower-case secret_ prefix capitalised (Secret_); body unchanged", "prefix", "js");
    c.control(T, "public-id", "database-and-page-ids", [`NOTION_DATABASE_ID=${synthetic(seed(T, "database-id"), 32, HEX)}\nNOTION_PAGE_ID=${uuid(seed(T, "page-id"))}\n`], "env");
    c.control(T, "near-miss", "snake-case-identifier", ["settings.secret_manager_rotation_interval_days = 30\n"], "py");
    c.control(T, "prose", "vault-note", ["The roadmap sync keeps its Notion secret in the team vault. Never paste it into a page, a ticket or a chat thread.\n"]);
  }

  // ---------------------------------------------------------------- heroku HRKU-
  {
    const T = "heroku-api-key";
    // #235: three documented generations. G2 (65) = HRKU-AA + 58 of [A-Za-z0-9_-] (AA example/tool-observed);
    // G1 (41) = HRKU- + UUID. G0 (bare UUID) is heroku-api-key-legacy's (#207), not authored here.
    const g2 = slug => `HRKU-AA${synthetic(seed(T, slug), 58, URLSAFE)}`;
    const g1 = slug => `HRKU-${uuid(seed(T, slug))}`;
    const netrc = v => ["machine api.heroku.com\n  login ops@example.com\n  password ", { secret: v }, "\nmachine git.heroku.com\n  login ops@example.com\n  password ", { secret: v }, "\n"];
    const header = v => ["GET /account HTTP/1.1\nHost: api.heroku.com\nAccept: application/vnd.heroku+json; version=3\n", { secret: v, envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\n"];
    const env = v => ["HEROKU_API_KEY=", { secret: v }, "\n"];
    const transcript = v => [`$ heroku authorizations:create -d "ci deploy"\nCreating OAuth Authorization... done\nClient:      <none>\nID:          ${uuid(seed(T, "transcript-authorization-id"))}\nDescription: ci deploy\nScope:       global\nToken:       `, { secret: v }, "\nUpdated at:  2024-11-05T14:22:31Z (less than a minute)\n"];
    const headerToken = g2("header"), envToken = g1("env"), transcriptToken = g1("transcript");
    c.positive(T, "structured-file", "netrc-g2", netrc(g2("netrc")), "netrc");
    c.positive(T, "header", "bearer-header-g2", header(headerToken), "http");
    c.positive(T, "env", "env-g1", env(envToken), "env");
    c.positive(T, "tool-output", "authorizations-create-g1", transcript(transcriptToken));
    c.twin(T, "env-g1", "env-g1-length", flat(env(envToken.slice(0, -1))),
      "40 characters: the 41-character HRKU-<uuid> generation with its final UUID hex digit removed", "length", "env");
    c.twin(T, "authorizations-create-g1", "authorizations-create-g1-separator", flat(transcript(`HRKU_${transcriptToken.slice(5)}`)),
      "the documented HRKU- prefix's dash replaced by an underscore (HRKU_); UUID and length unchanged", "boundary");
    c.twin(T, "bearer-header-g2", "bearer-header-g2-prefix-case", flat(header(`hrku-${headerToken.slice(5)}`)),
      "the documented upper-case HRKU- prefix lower-cased (hrku-); body unchanged", "prefix", "http");
    c.control(T, "public-id", "authorization-ids", [`$ heroku authorizations\nci deploy     ${uuid(seed(T, "list-id-1"))}  global\nterraform     ${uuid(seed(T, "list-id-2"))}  global\n`]);
    c.control(T, "prose", "generation-note", ["OAuth tokens granted since April 2025 are 65 characters long. Older tokens keep working until they are regenerated, so rotate them on your own schedule.\n"]);
    c.control(T, "placeholder", "netrc-template", ["machine api.heroku.com\n  login <email>\n  password HRKU-<token>\n"], "netrc");
  }

  // ---------------------------------------------------------------- anthropic sk-ant-api03-
  {
    const T = "anthropic-token";
    // Provider documents the sk-ant-api03- prefix; 93-character body and AA suffix are tool-corroborated.
    const key = slug => `sk-ant-api03-${synthetic(seed(T, slug), 93, URLSAFE)}AA`;
    const header = v => ["POST /v1/messages HTTP/1.1\nHost: api.anthropic.com\nx-api-key: ", { secret: v }, "\nanthropic-version: 2023-06-01\ncontent-type: application/json\n"];
    const env = v => ["ANTHROPIC_API_KEY=", { secret: v }, "\n"];
    const py = v => ['import anthropic\n\nclient = anthropic.Anthropic(api_key="', { secret: v }, '")\n'];
    const mcp = v => ['{\n  "mcpServers": {\n    "docs": {\n      "command": "npx",\n      "args": ["-y", "docs-server"],\n      "env": { "ANTHROPIC_API_KEY": "', { secret: v }, '" }\n    }\n  }\n}\n'];
    const headerKey = key("header");
    c.positive(T, "header", "x-api-key-header", header(headerKey), "http");
    c.positive(T, "env", "env-api-key", env(key("env")), "env");
    c.positive(T, "source-code", "python-client", py(key("python")), "py");
    c.positive(T, "sdk-config", "mcp-server-env", mcp(key("mcp")), "json");
    c.twin(T, "x-api-key-header", "x-api-key-header-stem", flat(header(`xk-ant-api03-${headerKey.slice(13)}`)),
      "the sk- stem of the documented sk-ant-api03- prefix broken (xk-ant-api03-, not an Anthropic prefix); body unchanged", "prefix", "http");
    c.control(T, "public-id", "response-identifiers", [`HTTP/1.1 200 OK\nrequest-id: req_${synthetic(seed(T, "request-id"), 24)}\nanthropic-organization-id: ${uuid(seed(T, "organization-id"))}\n\n{"id":"msg_${synthetic(seed(T, "message-id"), 24)}","type":"message","model":"claude-sonnet-4-5"}\n`], "http");
    c.control(T, "prose", "key-classes-note", ["Claude API keys and Admin API keys are different key classes; an Admin key cannot call the Messages API. Keep both out of source control.\n"]);
    c.control(T, "placeholder", "env-template", ["ANTHROPIC_API_KEY=sk-ant-api03-...\n"], "env");
  }

  // ---------------------------------------------------------------- confluent cflt
  {
    const T = "confluent-cloud-api-secret";
    const keyId = slug => synthetic(seed(T, `key-id-${slug}`), 16, UPPER_DIGIT);
    const body = slug => synthetic(seed(T, slug), 54, BASE64);
    const secret = slug => { const b = body(slug); return `cflt${b}${cfltChecksum(b)}`; };
    const env = v => [`CONFLUENT_CLOUD_API_KEY=${keyId("env")}\nCONFLUENT_CLOUD_API_SECRET=`, { secret: v }, "\n"];
    const props = v => [`bootstrap.servers=pkc-4n7dq.us-west-2.aws.confluent.cloud:9092\nsecurity.protocol=SASL_SSL\nsasl.mechanisms=PLAIN\nsasl.username=${keyId("props")}\nsasl.password=`, { secret: v }, "\n"];
    const cliJson = v => [`$ confluent api-key create --resource lkc-8w6q3p -o json\n{\n  "key": "${keyId("cli")}",\n  "secret": "`, { secret: v }, '"\n}\n'];
    // #213 / redact-secret#739 (maintainer decision 2026-09-24; the issue is closed as not planned):
    // the product flagging this "apiKey" value as generic-token is accepted behaviour, not a defect.
    // A 16-character random value under an apiKey name cannot be told apart from a real API key
    // (e.g. Alpha Vantage's) without cross-line context, and the key ID is the paired companion of
    // the secret, so redacting it leaks nothing. The key ID is therefore a `companion` span here and
    // in the twin built from this positive: redacting it costs no collateral, and it is never
    // required, since the key ID stays documented as not secret.
    const KEY_ID_COMPANION = "Public Confluent API key ID paired with the secret (documented as not secret). Redacting it is accepted, never required: a 16-character random value under an apiKey name is indistinguishable from a real API key without cross-line context (redact-secret#739, closed as not planned).";
    const vault = v => ['{\n  "apiKey": "', { companion: keyId("vault"), note: KEY_ID_COMPANION }, '",\n  "apiSecret": "', { secret: v },'",\n  "serviceAccountId": "sa-7k2m9q",\n  "resourceId": "lkc-8w6q3p",\n  "environmentId": "env-3xr1v5"\n}\n'];
    const envSecret = secret("env"), propsSecret = secret("props"), cliSecret = secret("cli");
    c.positive(T, "env", "env-cloud-secret", env(envSecret), "env");
    c.positive(T, "sdk-config", "kafka-client-properties", props(propsSecret), "properties");
    c.positive(T, "tool-output", "cli-api-key-create-json", cliJson(cliSecret));
    c.positive(T, "structured-file", "secrets-manager-json", vault(secret("vault")), "json");
    // Checksum twins: prefix, length and alphabet unchanged; only the last six characters differ.
    const bumped = envSecret.slice(58, 59) === "A" ? "B" : "A";
    c.twin(T, "env-cloud-secret", "env-cloud-secret-checksum", flat(env(differs(`${envSecret.slice(0, 58)}${bumped}${envSecret.slice(59)}`, envSecret, "checksum bump"))),
      "checksum: the first of the six checksum characters changed, so they no longer equal the Base64 CRC32 of the 54 body characters; prefix, length and alphabet unchanged", "checksum", "env");
    const propsBody = propsSecret.slice(4, 58);
    c.twin(T, "kafka-client-properties", "kafka-client-properties-checksum-byte-order", flat(props(differs(`cflt${propsBody}${be(crc32(Buffer.from(propsBody, "ascii"))).toString("base64").slice(0, 6)}`, propsSecret, "big-endian checksum"))),
      "checksum: the CRC32 of the 54 body characters encoded big-endian instead of the documented little-endian; prefix, length and alphabet unchanged", "checksum", "properties");
    const cliBody = cliSecret.slice(4, 58);
    c.twin(T, "cli-api-key-create-json", "cli-api-key-create-json-checksum-prefix-included", flat(cliJson(differs(`cflt${cliBody}${le(crc32(Buffer.from(`cflt${cliBody}`, "ascii"))).toString("base64").slice(0, 6)}`, cliSecret, "prefix-included checksum"))),
      "checksum: the CRC32 computed over cflt plus the body (58 characters) instead of the documented 54 body characters; prefix, length and alphabet unchanged", "checksum");
    const vaultBody = body("vault"), urlSafeBody = `${vaultBody.slice(0, 20)}_${vaultBody.slice(21)}`;
    c.twin(T, "secrets-manager-json", "secrets-manager-json-alphabet", flat(vault(differs(`cflt${urlSafeBody}${cfltChecksum(urlSafeBody)}`, secret("vault"), "url-safe body"))),
      "alphabet: body character 21 replaced by \"_\" (URL-safe Base64, outside the documented A-Z a-z 0-9 + /), with the checksum recomputed over the mutated body so only the alphabet property fails", "alphabet", "json");
    c.control(T, "public-id", "sasl-username-only", [`bootstrap.servers=pkc-4n7dq.us-west-2.aws.confluent.cloud:9092\nsasl.mechanisms=PLAIN\nsasl.username=${keyId("public")}\n`], "properties");
    c.control(T, "prose", "ticker-note", ["CFLT shares closed higher after the quarterly report, and two analysts raised their price targets.\n"]);
  }

  return c.fixtures;
}
