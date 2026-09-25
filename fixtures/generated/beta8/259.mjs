import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";
import { contracts as arrivalContracts, registryContracts } from "../../../benchmarks/lib/beta8/259.ts";

const contracts = { ...arrivalContracts, ...registryContracts };

// Issue #259 corpus (category `beta8-259`). See docs/specs/beta8-evidence.md.
// travisci-api-token, neon-api-key and postman-collection-access-key are
// registry detectors at the 3144bb3 pin (redact-secret#773); the prefix-less
// Mailgun key triplet is a context-gated arrival family inside the shared
// mailgun-api-key detector. Every value is a `synthetic()` seed or is built by
// code below from synthetic bytes; nothing is provider-issued, scanner-reported,
// copied from a provider documentation example or derived from a real
// credential. GitHub push protection matches some of these shapes in committed
// text, so no literal value appears in this source: values exist only in the
// generated (gitignored) corpus.

const TRAVIS = "travisci-api-token";
const NEON = "neon-api-key";
const PMAT = "postman-collection-access-key";
const TRIPLET = "mailgun-api-key-triplet";

const DIGITS = "0123456789";
const HEX = "0123456789abcdef";
const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function build259({ fixture, synthetic }) {
  const c = beta8Corpus(259, { fixture, synthetic });
  const seed = (target, slug) => `beta8:259:${target}:${slug}`;
  const check = (target, value) => {
    const contract = contracts[target];
    if (!new RegExp(contract.pattern).test(value) || !(contract.validate?.(value) ?? true))
      throw new Error(`beta8-259: authored ${target} positive fails its own contract: ${value.slice(0, 6)}...`);
    return value;
  };
  const b64 = text => Buffer.from(text).toString("base64");
  const sha256 = text => createHash("sha256").update(text).digest("hex");

  // -------------------------------------------------------------- Travis CI
  {
    const T = TRAVIS;
    // 22 alphanumerics with at least one letter and one digit (contract and product guard).
    const token = slug => {
      const body = synthetic(seed(T, slug), 20, ALNUM);
      return check(T, `${body.slice(0, 7)}${synthetic(seed(T, `${slug}:d`), 1, DIGITS)}${body.slice(7)}${synthetic(seed(T, `${slug}:l`), 1, "abcdefghijklmnopqrstuvwxyz")}`);
    };
    const k = Object.fromEntries(["env", "export", "header", "cli", "ci", "json", "python", "log"].map(s => [s, token(s)]));
    const env = v => ["# Travis CI release automation\nTRAVIS_API_TOKEN=", v, "\nTRAVIS_ENDPOINT=https://api.travis-ci.com\n"];
    const exportLine = v => ["export TRAVIS_TOKEN=\"", v, "\"\n"];
    const header = v => ["curl -s -H \"Travis-API-Version: 3\" -H \"Authorization: token ", v, "\" https://api.travis-ci.com/user\n"];
    const cli = v => ["travis whoami --pro --token ", v, "\n"];
    const ci = (v, key = "TRAVIS_API_TOKEN") => [`jobs:\n  trigger:\n    runs-on: ubuntu-latest\n    env:\n      ${key}: `, v, "\n    steps:\n      - run: ./scripts/trigger-travis.sh\n"];
    const json = v => ["{\n  \"travis_api_token\": \"", v, "\",\n  \"travis_endpoint\": \"https://api.travis-ci.com\"\n}\n"];
    const python = v => ["from travispy import TravisPy\n\ntravis = TravisPy(\"", v, "\")\n"];
    const log = v => ["2026-09-25T10:00:00Z travis-sync: using API token ", v, " for org acme\n"];
    const text = parts => parts.map(p => (typeof p === "string" ? p : p.secret)).join("");
    c.positive(T, "env", "dotenv", env({ secret: k.env }), "env");
    c.positive(T, "shell-export", "export", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-authorization", header({ secret: k.header }), "sh");
    c.positive(T, "cli", "travis-whoami", cli({ secret: k.cli }), "sh");
    c.positive(T, "ci-config", "actions-env", ci({ secret: k.ci }), "yml");
    c.positive(T, "structured-file", "json-config", json({ secret: k.json }), "json");
    c.positive(T, "source-code", "travispy-client", python({ secret: k.python }), "py");
    c.positive(T, "log", "sync-log", log({ secret: k.log }), "log");

    c.twin(T, "dotenv", "short-token", env(k.env.slice(0, 21)), "length: 21 characters vs the 22 both pinned tools corroborate", "length", "env");
    c.twin(T, "export", "long-token", exportLine(`${k.export}7`), "length: 23 characters vs the 22 both pinned tools corroborate", "length", "sh");
    c.twin(T, "curl-authorization", "underscore-body", header(`${k.header.slice(0, 11)}_${k.header.slice(12)}`), "alphabet: one character replaced by _, which trufflehog admits and gitleaks does not; outside the contract's [A-Za-z0-9] intersection (recorded peer difference)", "alphabet", "sh");
    c.twin(T, "travis-whoami", "no-travis-context", ["ci-client whoami --pro --token ", k.cli, "\n"], "context: the travis command replaced by a neutral CI client, so no travis keyword remains on the line; the token is kept byte-for-byte", "context", "sh");
    c.twin(T, "actions-env", "identifier-key", ci(k.ci, "TRAVIS_BUILD_ID"), "context: TRAVIS_API_TOKEN renamed TRAVIS_BUILD_ID, a Travis identifier name; the token is kept byte-for-byte", "context", "yml");
    if (text(ci(k.ci)) === text(ci(k.ci, "TRAVIS_BUILD_ID"))) throw new Error("beta8-259: identifier twin did not change");

    const buildId = synthetic(seed(T, "build-id"), 9, DIGITS);
    const commit = synthetic(seed(T, "commit"), 40, HEX);
    c.control(T, "placeholder", "docs-token", ["curl -H \"Travis-API-Version: 3\" -H \"Authorization: token xxxxxxxxxxxx\" https://api.travis-ci.com/repo/1/requests\n"], "sh");
    c.control(T, "placeholder", "env-example", ["TRAVIS_API_TOKEN=your-travis-api-token\n"], "env");
    c.control(T, "public-id", "build-env", [`TRAVIS_BUILD_ID=${buildId}\nTRAVIS_JOB_NUMBER=412.1\nTRAVIS_BRANCH=main\n`], "env");
    c.control(T, "public-id", "commit-sha", [`TRAVIS_COMMIT=${commit}\nTRAVIS_REPO_SLUG=acme/api-gateway-service\n`], "env");
    c.control(T, "public-id", "build-url", [`travis build: https://app.travis-ci.com/github/acme/api-gateway/builds/${buildId}\n`]);
    c.control(T, "reference", "env-reference", ["TRAVIS_API_TOKEN=${TRAVIS_API_TOKEN}\n"], "env");
    c.control(T, "reference", "actions-secret", ["      TRAVIS_API_TOKEN: ${{ secrets.TRAVIS_API_TOKEN }}\n"], "yml");
    c.control(T, "encoded-value", "travis-secure", [`# .travis.yml\nenv:\n  global:\n    - secure: "${b64(synthetic(seed(T, "secure"), 96))}"\n`], "yml");
    c.control(T, "encoded-value", "artifact-digest", [`travis artifact sha256: ${sha256("api-gateway-1.4.2.tar.gz")}\n`]);
    c.control(T, "near-miss", "letters-only-stage", ["travis stage: IntegrationTestLinuxArm\n"]);
    c.control(T, "prose", "token-guidance", ["Travis CI API tokens come from `travis token --pro` and go in an Authorization: token header; keep them in TRAVIS_API_TOKEN, never in .travis.yml.\n"], "md");
  }

  // ------------------------------------------------------------------ Neon
  {
    const T = NEON;
    const key = slug => check(T, `napi_${synthetic(seed(T, slug), 64, ALNUM)}`);
    const k = Object.fromEntries(["env", "export", "header", "cli", "sdk", "ci", "mcp", "create"].map(s => [s, key(s)]));
    const body = v => v.slice(5);
    const env = v => ["NEON_API_KEY=", v, "\nNEON_PROJECT_ID=cool-darkness-123456\n"];
    const exportLine = v => ["export NEON_API_KEY=\"", v, "\"\n"];
    const cli = v => ["neonctl projects list --api-key ", v, "\n"];
    const mcp = v => ["{\n  \"mcpServers\": {\n    \"Neon\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@neondatabase/mcp-server-neon\", \"start\", \"", v, "\"]\n    }\n  }\n}\n"];
    const create = v => ["$ neonctl api-keys create --name ci --output json\n{\"id\": 3225999, \"name\": \"ci\", \"key\": \"", v, "\"}\n"];
    c.positive(T, "env", "dotenv", env({ secret: k.env }), "env");
    c.positive(T, "shell-export", "export", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "bearer-curl", ["curl https://console.neon.tech/api/v2/projects -H \"Authorization: Bearer ", { secret: k.header }, "\" -H \"Accept: application/json\"\n"], "sh");
    c.positive(T, "cli", "neonctl-flag", cli({ secret: k.cli }), "sh");
    c.positive(T, "sdk-config", "ts-api-client", ["import { createApiClient } from '@neondatabase/api-client';\n\nconst apiClient = createApiClient({ apiKey: '", { secret: k.sdk }, "' });\n"], "ts");
    c.positive(T, "ci-config", "create-branch-action", ["      - uses: neondatabase/create-branch-action@v6\n        with:\n          project_id: cool-darkness-123456\n          api_key: ", { secret: k.ci }, "\n"], "yml");
    c.positive(T, "structured-file", "mcp-config", mcp({ secret: k.mcp }), "json");
    c.positive(T, "tool-output", "api-key-create", create({ secret: k.create }), "txt");

    c.twin(T, "dotenv", "inner-dash", env(`napi_${body(k.env).slice(0, 32)}-${body(k.env).slice(33)}`), "alphabet: one body character replaced by -, which splits the body into runs below the 64-character floor betterleaks and mask-go corroborate", "alphabet", "env");
    c.twin(T, "export", "hyphen-delimiter", exportLine(`napi-${body(k.export)}`), "boundary: napi- vs the provider-documented napi_ delimiter", "boundary", "sh");
    c.twin(T, "neonctl-flag", "uppercase-prefix", cli(`NAPI_${body(k.cli)}`), "prefix namespace: NAPI_ vs the provider-documented lowercase napi_", "prefix", "sh");
    c.twin(T, "mcp-config", "short-body", mcp(`napi_${body(k.mcp).slice(0, 63)}`), "length: a 63-character body vs the tool-corroborated 64-character floor", "length", "json");
    c.twin(T, "api-key-create", "prefix-letter", create(`nopi_${body(k.create)}`), "prefix namespace: nopi_ vs the provider-documented napi_ (one-letter deviation)", "prefix", "txt");

    c.control(T, "placeholder", "docs-placeholder", ["NEON_API_KEY=napi_your_api_key_here\n"], "env");
    c.control(T, "placeholder", "masked-display", ["API key ci created: napi_********************************************************Q7xk (shown once)\n"]);
    c.control(T, "public-id", "project-and-branch", ["NEON_PROJECT_ID=cool-darkness-123456\nNEON_BRANCH_ID=br-wispy-meadow-a1b2c3d4\nNEON_ENDPOINT_ID=ep-cool-darkness-a1b2c3d4\n"], "env");
    c.control(T, "public-id", "pooled-host", ["PGHOST=ep-cool-darkness-a1b2c3d4-pooler.us-east-2.aws.neon.tech\nPGDATABASE=neondb\nPGUSER=neondb_owner\n"], "env");
    c.control(T, "public-id", "api-key-list", ["$ neonctl api-keys list\n┌─────────┬─────────────┐\n│ Id      │ Name        │\n│ 3225999 │ development │\n└─────────┴─────────────┘\n"]);
    c.control(T, "reference", "env-reference", ["NEON_API_KEY=${NEON_API_KEY}\n"], "env");
    c.control(T, "reference", "actions-secret", ["          api_key: ${{ secrets.NEON_API_KEY }}\n"], "yml");
    c.control(T, "near-miss", "node-api-call", ["napi_status status = napi_create_string_utf8(env, text, NAPI_AUTO_LENGTH, &result);\n"], "c");
    c.control(T, "near-miss", "prefix-only", ["# paste the key after the prefix\nNEON_API_KEY=napi_\n"], "env");
    c.control(T, "encoded-value", "project-digest", [`project_digest: ${sha256("cool-darkness-123456")}\n`], "yml");
    c.control(T, "prose", "key-guidance", ["Neon API keys start with napi_ and are shown once; project-scoped keys reach one project. Store them in NEON_API_KEY.\n"], "md");
  }

  // ---------------------------------------------- Postman collection access key
  {
    const T = PMAT;
    const key = slug => check(T, `PMAT-${synthetic(seed(T, slug), 26, UPPER_ALNUM)}`);
    const k = Object.fromEntries(["url", "env", "cli", "ci", "export", "json", "share", "chat"].map(s => [s, key(s)]));
    const uid = `12345678-${synthetic(seed(T, "uid-a"), 8, HEX)}-4${synthetic(seed(T, "uid-b"), 3, HEX)}-8${synthetic(seed(T, "uid-c"), 3, HEX)}-${synthetic(seed(T, "uid-d"), 12, HEX)}`;
    const collectionUrl = `https://api.getpostman.com/collections/${uid}?access_key=`;
    const curl = v => ["curl \"", collectionUrl, v, "\"\n"];
    const env = v => ["POSTMAN_COLLECTION_ACCESS_KEY=", v, "\n"];
    const newman = v => ["newman run \"", collectionUrl, v, "\" --reporters cli\n"];
    const exportLine = v => ["export POSTMAN_COLLECTION_ACCESS_KEY=", v, "\n"];
    const share = v => ["Share via API\nCollection JSON URL: ", collectionUrl, v, "\nThis key expires after 60 days of inactivity.\n"];
    c.positive(T, "url", "curl-collection-json", curl({ secret: k.url }), "sh");
    c.positive(T, "env", "dotenv", env({ secret: k.env }), "env");
    c.positive(T, "cli", "newman-run", newman({ secret: k.cli }), "sh");
    c.positive(T, "ci-config", "actions-newman", ["jobs:\n  api-tests:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npx newman run \"", collectionUrl, { secret: k.ci }, "\"\n"], "yml");
    c.positive(T, "shell-export", "export", exportLine({ secret: k.export }), "sh");
    c.positive(T, "structured-file", "share-config", ["{\n  \"collection\": \"", uid, "\",\n  \"accessKey\": \"", { secret: k.json }, "\"\n}\n"], "json");
    c.positive(T, "tool-output", "share-via-api", share({ secret: k.share }), "txt");
    c.positive(T, "prose", "chat-share", ["Here is the read-only link to the collection JSON: ", collectionUrl, { secret: k.chat }, " (valid while it is used)\n"], "md");

    const b = v => v.slice(5);
    c.twin(T, "curl-collection-json", "short-body", curl(`PMAT-${b(k.url).slice(0, 25)}`), "length: 25 characters vs the 26 GitLab's rule and the provider's masked display give", "length", "sh");
    c.twin(T, "dotenv", "long-body", env(`PMAT-${b(k.env)}Q`), "length: 27 characters vs the 26 GitLab's rule and the provider's masked display give", "length", "env");
    c.twin(T, "newman-run", "api-key-prefix", newman(`PMAK-${b(k.cli)}`), "prefix namespace: PMAK- (the Postman API key prefix) with the 26-character collection-key body, which fits neither the PMAT- contract nor the PMAK- 24-hex-34-hex grammar", "prefix", "sh");
    c.twin(T, "export", "lowercase-prefix", exportLine(`pmat-${b(k.export)}`), "prefix namespace: pmat- vs the upper-case PMAT- the provider displays", "prefix", "sh");
    c.twin(T, "share-via-api", "underscore-delimiter", share(`PMAT_${b(k.share)}`), "boundary: PMAT_ vs the PMAT- delimiter the provider displays", "boundary", "txt");

    c.control(T, "placeholder", "masked-key-list", ["Collection access keys\nci-share   PMAT-**********************Q7XK   expires in 58 days\n"]);
    c.control(T, "placeholder", "docs-placeholder", ["POSTMAN_COLLECTION_ACCESS_KEY=PMAT-<your-collection-access-key>\n"], "env");
    c.control(T, "reference", "postman-variable", [`GET https://api.getpostman.com/collections/{{collectionUid}}?access_key={{collectionAccessKey}}\n`]);
    c.control(T, "reference", "env-reference", [`newman run "https://api.getpostman.com/collections/${uid}?access_key=\${POSTMAN_COLLECTION_ACCESS_KEY}"\n`], "sh");
    c.control(T, "public-id", "collection-uid", [`COLLECTION_UID=${uid}\nWORKSPACE_ID=${synthetic(seed(T, "workspace"), 8, HEX)}-0000-4000-8000-000000000000\n`], "env");
    c.control(T, "public-id", "public-share-link", [`https://www.postman.com/acme/workspace/public-api/collection/${uid}\n`]);
    c.control(T, "near-miss", "prefix-only", ["# the key starts with PMAT- and is shown once\nPOSTMAN_COLLECTION_ACCESS_KEY=PMAT-\n"], "env");
    c.control(T, "near-miss", "document-code", ["See PMAT-ROADMAP-2026-Q3 for the collection sharing plan.\n"], "md");
    c.control(T, "encoded-value", "base64-uid", [`collection_b64: ${b64(uid)}\n`], "yml");
    c.control(T, "prose", "key-guidance", ["A collection access key gives read-only access to one collection's JSON and expires after 60 days of inactivity; revoke it on the API keys page.\n"], "md");
    c.control(T, "prose", "sharing-note", ["Remove sensitive data from a collection before you share it with a collection access key.\n"], "md");
  }

  // ------------------------------------------ Mailgun key triplet (context-gated)
  {
    const T = TRIPLET;
    // Built from pieces so no literal triplet appears in committed text.
    const triplet = slug => check(T, [synthetic(seed(T, `${slug}:a`), 32, HEX), synthetic(seed(T, `${slug}:b`), 8, HEX), synthetic(seed(T, `${slug}:c`), 8, HEX)].join("-"));
    // [slug, axis, before, after, ext, [from, to], mutation]: the twin edits one contiguous span of `before`.
    const positives = [
      ["dotenv", "env", "MAILGUN_API_KEY=", "\nMAILGUN_DOMAIN=mg.example.com\n", "env", ["MAILGUN_API_KEY=", "MAILGUN_KEY_ID="], "MAILGUN_API_KEY renamed MAILGUN_KEY_ID"],
      ["export", "shell-export", "export MAILGUN_API_KEY=\"", "\"\n", "sh", ["MAILGUN_API_KEY", "MAILGUN_DOMAIN_ID"], "MAILGUN_API_KEY renamed MAILGUN_DOMAIN_ID"],
      ["signing-key", "env", "MAILGUN_WEBHOOK_SIGNING_KEY=", "\n", "env", ["MAILGUN_WEBHOOK_SIGNING_KEY=", "MAILGUN_WEBHOOK_ID="], "MAILGUN_WEBHOOK_SIGNING_KEY renamed MAILGUN_WEBHOOK_ID"],
      ["python-client", "sdk-config", "from mailgun.client import Client\n\nclient = Client(auth=(\"api\", \"", "\"))  # mailgun\n", "py", ["# mailgun", "# mailer"], "same-line mailgun comment replaced by mailer, so no mailgun keyword remains on the value's line"],
      ["node-client", "source-code", "const mg = mailgun.client({ username: 'api', key: '", "' });\n", "js", ["mailgun.client", "mailer.client"], "mailgun.client renamed mailer.client, so no mailgun keyword remains on the line"],
      ["yaml-config", "structured-file", "mailer:\n  mailgun_api_key: ", "\n  mailgun_domain: mg.example.com\n", "yml", ["mailgun_api_key:", "mailgun_key_id:"], "mailgun_api_key renamed mailgun_key_id"],
      ["actions-env", "ci-config", "jobs:\n  notify:\n    env:\n      MAILGUN_API_KEY: ", "\n", "yml", ["MAILGUN_API_KEY:", "MAILGUN_KEY_ID:"], "MAILGUN_API_KEY renamed MAILGUN_KEY_ID"],
      ["compose-env", "container-config", "services:\n  mailer:\n    environment:\n      - MAILGUN_PRIVATE_KEY=", "\n", "yml", ["MAILGUN_PRIVATE_KEY=", "MAILGUN_PRIVATE_ID="], "MAILGUN_PRIVATE_KEY renamed MAILGUN_PRIVATE_ID"],
      ["json-settings", "structured-file", "{\"mailgunApiKey\": \"", "\", \"mailgunDomain\": \"mg.example.com\"}\n", "json", ["\"mailgunApiKey\":", "\"mailgunKeyId\":"], "mailgunApiKey renamed mailgunKeyId"],
      ["log-line", "log", "2026-09-25T10:00:00Z mailgun: rotated private API key to ", "\n", "log", ["mailgun:", "mailer:"], "mailgun: log tag replaced by mailer:, so no mailgun keyword remains on the line"],
      ["cli-flag", "cli", "mailgun-cli send --api-key ", " --to ops@example.com\n", "sh", ["mailgun-cli", "mailer-cli"], "mailgun-cli renamed mailer-cli, so no mailgun keyword remains on the line"],
      ["terraform-var", "tool-output", "$ terraform output\nmailgun_api_key = \"", "\"\n", "txt", ["mailgun_api_key =", "mailgun_key_id ="], "mailgun_api_key output renamed mailgun_key_id"],
    ];
    for (const [slug, axis, before, after, ext, [from, to], mutation] of positives) {
      const value = triplet(slug);
      c.positive(T, axis, slug, [before, { secret: value }, after], ext);
      if (!before.includes(from) && !after.includes(from)) throw new Error(`beta8-259: ${slug} twin edit not found`);
      const [b2, a2] = before.includes(from) ? [before.replace(from, to), after] : [before, after.replace(from, to)];
      c.twin(T, slug, `${slug}-context`, [b2, value, a2], `context: ${mutation}; the triplet is kept byte-for-byte`, "context", ext);
    }
    // Structural twins: the same line context, one segment property of the triplet changed.
    {
      const [a, b, cc] = triplet("dotenv").split("-");
      c.twin(T, "dotenv", "short-first-segment", ["MAILGUN_API_KEY=", [a.slice(0, 31), b, cc].join("-"), "\nMAILGUN_DOMAIN=mg.example.com\n"], "length: a 31-character first segment vs the 32 both pinned tools corroborate", "length", "env");
      const [a2, b2, c2] = triplet("export").split("-");
      c.twin(T, "export", "merged-last-segments", ["export MAILGUN_API_KEY=\"", `${a2}-${b2}${c2}`, "\"\n"], "boundary: the dash between the two 8-character segments removed, so the value is 32-16 rather than 32-8-8", "boundary", "sh");
    }
    const piece = (slug, n) => synthetic(seed(T, slug), n, HEX);
    const keyId = `${piece("key-id-a", 8)}-${piece("key-id-b", 8)}`;
    const controls = [
      ["public-id", "key-object-id", `{"key": {"id": "${keyId}", "description": "mailgun ci", "role": "sending"}}\n`, "json"],
      ["public-id", "domain", "MAILGUN_DOMAIN=mg.example.com\nMAILGUN_REGION=eu\n", "env"],
      ["public-id", "message-id", `mailgun queued message <20260925100000.${piece("msg", 16)}@mg.example.com>\n`, "log"],
      ["public-id", "webhook-event-id", `{"event-data": {"id": "${piece("event", 22)}", "event": "delivered"}, "mailgun": true}\n`, "json"],
      ["placeholder", "x-triplet", `MAILGUN_API_KEY=${["x".repeat(32), "x".repeat(8), "x".repeat(8)].join("-")}\n`, "env"],
      ["placeholder", "zero-triplet", `MAILGUN_API_KEY=${["0".repeat(32), "0".repeat(8), "0".repeat(8)].join("-")}\n`, "env"],
      ["placeholder", "your-key", "MAILGUN_API_KEY=YOUR_MAILGUN_API_KEY\n", "env"],
      ["placeholder", "masked", `mailgun key: ${"*".repeat(32)}-${piece("mask", 4)}****-********\n`],
      ["reference", "env-reference", "MAILGUN_API_KEY=${MAILGUN_API_KEY}\n", "env"],
      ["reference", "actions-secret", "      MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}\n", "yml"],
      ["reference", "python-environ", "client = Client(auth=(\"api\", os.environ[\"MAILGUN_API_KEY\"]))  # mailgun\n", "py"],
      ["reference", "vault-path", "mailgun_api_key: vault:secret/data/mailer#mailgun_api_key\n", "yml"],
      ["near-miss", "short-first-segment", `MAILGUN_API_KEY=${[piece("nm1-a", 31), piece("nm1-b", 8), piece("nm1-c", 8)].join("-")}\n`, "env"],
      ["near-miss", "short-last-segment", `MAILGUN_API_KEY=${[piece("nm2-a", 32), piece("nm2-b", 8), piece("nm2-c", 7)].join("-")}\n`, "env"],
      ["near-miss", "uppercase-hex", `MAILGUN_API_KEY=${[piece("nm3-a", 32), piece("nm3-b", 8), piece("nm3-c", 8)].join("-").toUpperCase()}\n`, "env"],
      ["near-miss", "two-segments", `MAILGUN_API_KEY=${[piece("nm4-a", 32), piece("nm4-b", 8)].join("-")}\n`, "env"],
      ["encoded-value", "webhook-signature", `mailgun webhook signature: ${sha256("1727258400:synthetic-token")}\n`, "log"],
      ["encoded-value", "base64-domain", `MAILGUN_DOMAIN_B64=${b64("mg.example.com")}\n`, "env"],
      ["encoded-value", "sha256-template", `mailgun template digest ${sha256("welcome-email-v3")}\n`],
      ["encoded-value", "url-encoded", "mailgun redirect=https%3A%2F%2Fapp.mailgun.com%2Fmg%2Fsending%2Fdomains\n"],
      ["prose", "key-types", "Mailgun issues several key types: account API keys, domain sending keys and the HTTP webhook signing key.\n", "md"],
      ["prose", "rotation", "Rotate the Mailgun private API key on the API Security page, then update MAILGUN_API_KEY everywhere it is deployed.\n", "md"],
      ["prose", "key-id-note", "Mailgun shows each key with an id; the id is not the secret and can be logged.\n", "md"],
      ["prose", "legacy-note", "Older Mailgun accounts used key- prefixed API keys; newer keys have no prefix.\n", "md"],
    ];
    for (const [axis, slug, content, ext] of controls) c.control(T, axis, slug, [content], ext);
  }

  return c.fixtures;
}
