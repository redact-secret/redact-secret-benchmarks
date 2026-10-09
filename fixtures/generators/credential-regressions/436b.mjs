import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, LOWER, URLSAFE, at, authorPositives, guard, probeContexts } from "./436-shared.mjs";

// Issue #436, slice b (category `beta8-436b`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the 1Password service-account token (ops_eyJ + Base64url, variable length;
// handoff redact-secret docs/audits/evidence/860/onepassword.md at 54fe385; product redact-secret#913).
// Every value is built here from a public `synthetic` seed over the Base64url alphabet; nothing is
// decoded from, or shaped after, a provider example beyond the documented lead.
//
// The Connect server token is a three-segment JWT the jwt detector keeps: it is a prefix twin (another
// credential class), never a benign control. Deliberately not authored: the account Secret Key (A3-…),
// another family, either way; and a trailing glue byte after a full-length body (`/`, `+` or a third
// `=`): the body alphabet is the identifier class, so the full token before the glue stays a
// contract-valid match (lexically inseparable, #84). The +, / and = twins sit early in the body instead.

const b64url = text => Buffer.from(text, "utf8").toString("base64url");

export function build436b({ fixture, synthetic }) {
  const c = beta8Corpus("436b", { fixture, synthetic });
  const T = "onepassword-service-account-token";
  const seed = slug => `beta11:436b:${T}:${slug}`;
  const { check, refuse } = guard("436b", T);
  /** Body lengths after ops_eyJ: 627 matches the 634-character provider example's total; 250 is the floor; 630 and 866 are the handoff's axes. */
  const lengths = { dotenv: 250, "sdk-kwarg": 630, "mcp-env": 866 };
  const padding = { "python-sdk": "=", "op-cli": "==" };
  const padLength = { "python-sdk": 632, "op-cli": 635 };
  const key = slug => {
    const n = lengths[slug] ?? padLength[slug] ?? 627;
    let body = synthetic(seed(slug), n, URLSAFE);
    if (slug === "json-api-key") body = at(at(body, 120, "-"), 360, "_");
    return check(`ops_eyJ${body}${padding[slug] ?? ""}`);
  };

  const probe = probeContexts({ env: "OP_SERVICE_ACCOUNT_TOKEN", name: "1Password", host: "my.1password.com", ctor: "OnePasswordClient" });
  const actions = v => ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    env:\n      OP_SERVICE_ACCOUNT_TOKEN: ", v, "\n    steps:\n      - uses: 1password/load-secrets-action@v2\n"];
  const opCli = v => ["export OP_SERVICE_ACCOUNT_TOKEN=", v, "\nop vault list --format json\nop read \"op://Deploy/postgres/password\"\n"];
  const pySdk = v => ["from onepassword.client import Client\n\nclient = await Client.authenticate(\n    auth=\"", v, "\",\n    integration_name=\"deploy-bot\",\n    integration_version=\"v1.0.0\",\n)\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"vault\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"op-mcp-server\"],\n      \"env\": { \"OP_SERVICE_ACCOUNT_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
  const contexts = [...probe,
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "cli", slug: "op-cli", ext: "sh", build: opCli },
    { axis: "source-code", slug: "python-sdk", ext: "py", build: pySdk },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const tail = v => v.slice(7);

  // A Connect server token: a three-segment JWT, built from synthetic claims, with no ops_ prefix.
  const connect = [
    b64url(JSON.stringify({ alg: "ES256", kid: synthetic(seed("jwt-kid"), 26, LOWER), typ: "JWT" })),
    b64url(JSON.stringify({ "1password.com/auuid": synthetic(seed("jwt-a"), 26, ALNUM), "1password.com/token": synthetic(seed("jwt-t"), 32, URLSAFE), "1password.com/fts": ["vaultaccess"], "1password.com/vts": [{ u: synthetic(seed("jwt-v"), 26, LOWER), a: 49152 }], aud: ["com.1password.connect"], iat: 1790000000, iss: "com.1password.b5", jti: synthetic(seed("jwt-j"), 26, LOWER), sub: synthetic(seed("jwt-s"), 26, ALNUM) })),
    synthetic(seed("jwt-sig"), 86, URLSAFE),
  ].join(".");

  c.twin(T, "dotenv", "body-249", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: 249 Base64url bytes after ops_eyJ, one below the 250 policy floor", "length", "env");
  c.twin(T, "export", "lowercase-j", put("export", refuse(`ops_eyj${tail(k.export)}`)), "prefix: ops_eyj, which is not the Base64 of {\" that a serialized object begins with", "prefix", "sh");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`OPS_${k["bearer-header"].slice(4)}`)), "prefix: OPS_ vs the documented lower-case ops_", "prefix", "http");
  c.twin(T, "json-token", "hyphen-prefix", put("json-token", refuse(`ops-${k["json-token"].slice(4)}`)), "boundary: ops- in place of the ops_ separator", "boundary", "json");
  c.twin(T, "json-api-key", "plus-in-body", put("json-api-key", refuse(at(k["json-api-key"], 60, "+"))), "alphabet: one body byte replaced by +, standard Base64, outside the stated Base64url class", "alphabet", "json");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before ops_", "boundary", "md");
  c.twin(T, "chat-paste", "slash-in-body", put("chat-paste", refuse(at(k["chat-paste"], 80, "/"))), "alphabet: one body byte replaced by /, standard Base64, outside the stated Base64url class", "alphabet", "txt");
  c.twin(T, "actions-env", "padding-inside-body", put("actions-env", refuse(at(k["actions-env"], 90, "="))), "alphabet: an = inside the body; Base64url padding only ends the value", "alphabet", "yml");
  c.twin(T, "sdk-kwarg", "connect-jwt", put("sdk-kwarg", refuse(connect)), "prefix: a Connect server token, a three-segment JWT with no ops_ prefix (another credential class)", "prefix", "py");

  c.control(T, "placeholder", "ellipsis", ["OP_SERVICE_ACCOUNT_TOKEN=ops_...\n"], "env");
  c.control(T, "placeholder", "masked", ["Service account deploy-bot created; token ops_*** was shown once and copied to the CI vault.\n"], "md");
  c.control(T, "reference", "secret-reference", ["DATABASE_PASSWORD=op://Private/postgres/credential\nSTRIPE_KEY=op://Deploy/stripe/credential\n"], "env");
  c.control(T, "reference", "actions-secret", ["    env:\n      OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_TOKEN }}\n"], "yml");
  c.control(T, "public-id", "ops-identifiers", ["from metrics.handlers import ops_function_name, ops_token_count\n\nops_function_name(\"nightly\")\n"], "py");
  c.control(T, "public-id", "account-and-vault", [`OP_ACCOUNT=my.1password.com\nOP_VAULT_ID=${synthetic(seed("vault"), 26, LOWER)}\n`], "env");
  c.control(T, "near-miss", "truncated", [`2026-09-28T09:14:03Z deploy: op rejected a truncated token ops_eyJ${synthetic(seed("short"), 40, ALNUM)} (length check)\n`], "log");
  c.control(T, "encoded-value", "cache-digest", [`op-cache sha256 ${synthetic(seed("digest"), 64, HEX)}\n`], "txt");
  c.control(T, "prose", "token-guidance", ["1Password service account tokens start with ops_; store OP_SERVICE_ACCOUNT_TOKEN in your CI secret store, never in the repo.\n"], "md");
  return c.fixtures;
}
