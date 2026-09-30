import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, at, authorPositives, base64Of16, guard, probeContexts, uuidOf } from "./528-shared.mjs";

// Issue #528, slice a (category `beta8-528a`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Bitwarden Secrets Manager access token (0. + UUID + . + 30 [A-Za-z0-9] + : + 22 Base64 + ==;
// handoff redact-secret docs/audits/evidence/1014/bitwarden.md at 4f220ea; product redact-secret#1019). Every value is
// built here from a public `synthetic` seed; the key is a canonical padded Base64 encoding of 16 synthetic bytes.
//
// The unpadded-key twin is outside the issued grammar (the parser accepts it, the generator always pads). A version-
// dotted UUID without the secret and key, a semantic version before a UUID and Password Manager user./organization.
// client ids are controls.

export function build528a({ fixture, synthetic }) {
  const c = beta8Corpus("528a", { fixture, synthetic });
  const T = "bitwarden-secrets-manager-access-token";
  const seed = slug => `beta12:528a:${T}:${slug}`;
  const { check, refuse } = guard("528a", T);
  const uuid = slug => uuidOf(synthetic(seed(`uuid:${slug}`), 32, HEX));
  const parts = slug => ({ id: uuid(slug), secret: synthetic(seed(`secret:${slug}`), 30, ALNUM), key: base64Of16(synthetic(seed(`key:${slug}`), 32, HEX)) });
  const join = p => `0.${p.id}.${p.secret}:${p.key}`;
  const P = {};
  const key = slug => {
    P[slug] = parts(slug);
    if (slug === "json-api-key") P[slug].id = P[slug].id.toUpperCase();
    return check(join(P[slug]));
  };

  const probe = probeContexts({ env: "BWS_ACCESS_TOKEN", name: "Bitwarden Secrets Manager", host: "api.bitwarden.com", ctor: "BitwardenClient" });
  const bws = v => ["bws secret list --access-token ", v, " --output table\n"];
  const actions = v => ["jobs:\n  deploy:\n    steps:\n      - uses: bitwarden/sm-action@v2\n        with:\n          access_token: ", v, "\n          secrets: |\n            db-password > DB_PASSWORD\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"bitwarden\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@bitwarden/mcp-server\"],\n      \"env\": { \"BWS_ACCESS_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
  const docker = v => ["docker run --rm -e BWS_ACCESS_TOKEN=", v, " bitwarden/bws secret list\n"];
  const contexts = [...probe,
    { axis: "cli", slug: "bws-cli-flag", ext: "sh", build: bws },
    { axis: "ci-config", slug: "actions-with-access-token", ext: "yml", build: actions },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "container-config", slug: "docker-env-flag", ext: "sh", build: docker },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const with_ = (slug, change) => join({ ...P[slug], ...change(P[slug]) });

  c.twin(T, "dotenv", "secret-29", put("dotenv", refuse(with_("dotenv", p => ({ secret: p.secret.slice(0, 29) })))), "length: a 29-character client secret vs exactly 30", "length", "env");
  c.twin(T, "export", "secret-31", put("export", refuse(with_("export", p => ({ secret: `${p.secret}${synthetic(seed("extra"), 1, ALNUM)}` })))), "length: a 31-character client secret vs exactly 30", "length", "sh");
  c.twin(T, "json-token", "hyphen-in-secret", put("json-token", refuse(with_("json-token", p => ({ secret: at(p.secret, 12, "-") })))), "alphabet: one client-secret byte replaced by -, outside [A-Za-z0-9]", "alphabet", "json");
  c.twin(T, "bearer-header", "key-21", put("bearer-header", refuse(with_("bearer-header", p => ({ key: `${p.key.slice(0, 21)}==` })))), "length: a 21-character Base64 key before == vs exactly 22", "length", "http");
  c.twin(T, "x-api-key-header", "key-23", put("x-api-key-header", refuse(with_("x-api-key-header", p => ({ key: `${p.key.slice(0, 22)}A==` })))), "length: a 23-character Base64 key before == vs exactly 22", "length", "http");
  c.twin(T, "sdk-kwarg", "single-padding", put("sdk-kwarg", refuse(with_("sdk-kwarg", p => ({ key: p.key.slice(0, -1) })))), "padding: the key ends with one = instead of ==", "length", "py");
  c.twin(T, "chat-paste", "unpadded-key", put("chat-paste", refuse(with_("chat-paste", p => ({ key: p.key.slice(0, -2) })))), "padding: the key without == (the parser accepts it, but the generator always pads, so it is outside the issued grammar)", "length", "txt");
  c.twin(T, "bws-cli-flag", "version-1", put("bws-cli-flag", refuse(`1${k["bws-cli-flag"].slice(1)}`)), "prefix: version 1. vs the only version the parser accepts, 0.", "prefix", "sh");
  c.twin(T, "mcp-env", "uuid-missing-hyphen", put("mcp-env", refuse(with_("mcp-env", p => ({ id: p.id.replace("-", "") })))), "structure: the UUID with its first - removed (35 bytes, not 8-4-4-4-12)", "length", "json");
  c.twin(T, "docker-env-flag", "non-hex-in-uuid", put("docker-env-flag", refuse(with_("docker-env-flag", p => ({ id: at(p.id, 3, "g") })))), "alphabet: one UUID byte replaced by g, outside hex", "alphabet", "sh");
  c.twin(T, "actions-with-access-token", "colon-as-dot", put("actions-with-access-token", refuse(`0.${P["actions-with-access-token"].id}.${P["actions-with-access-token"].secret}.${P["actions-with-access-token"].key}`)), "separator: . in place of the : before the key", "alphabet", "yml");
  c.twin(T, "bare-prose", "leading-digit-glue", put("bare-prose", refuse(`1${k["bare-prose"]}`)), "boundary: 1 glued before 0., so the run reads 10.<uuid>", "boundary", "md");
  c.twin(T, "json-api-key", "leading-v-glue", put("json-api-key", refuse(`v${k["json-api-key"]}`)), "boundary: v glued before 0., so the run reads v0.<uuid>", "boundary", "json");
  c.twin(T, "chat-paste", "trailing-glue", put("chat-paste", refuse(`${k["chat-paste"]}x`)), "boundary: x glued after the closing ==", "boundary", "txt");

  const ctl = slug => parts(`ctl:${slug}`);
  c.control(T, "near-miss", "secret-without-key", [`2026-09-29T11:02:10Z bws: rejected token 0.${ctl("nokey").id}.${ctl("nokey").secret} (missing encryption key)\n`], "log");
  c.control(T, "near-miss", "version-dotted-uuid", [`2026-09-29T11:02:30Z sync: cursor 0.${ctl("cursor").id} acknowledged\n`], "log");
  c.control(T, "public-id", "semver-then-uuid", [`## Changelog\n\n- 1.4.0.${ctl("semver").id}: build metadata for the staging release\n`], "md");
  c.control(T, "public-id", "uuid-json-filename", [`cache/0.${ctl("file").id}.json written (412 bytes)\n`], "log");
  c.control(T, "public-id", "password-manager-client-id", [`BW_CLIENTID=user.${ctl("user").id}\nBW_ORG_CLIENTID=organization.${ctl("org").id}\n`], "env");
  c.control(T, "encoded-value", "bare-base64-key", [`iv: ${base64Of16(synthetic(seed("iv"), 32, HEX))}\nalgorithm: aes-256-cbc\n`], "yml");
  c.control(T, "placeholder", "angle-brackets", ["BWS_ACCESS_TOKEN=0.<access-token-id>.<client-secret>:<encryption-key>\n"], "env");
  c.control(T, "placeholder", "x-run", ["export BWS_ACCESS_TOKEN=\"0.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxx==\"\n"], "sh");
  c.control(T, "reference", "env-reference", ["BWS_ACCESS_TOKEN=${BWS_ACCESS_TOKEN}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          access_token: ${{ secrets.BWS_ACCESS_TOKEN }}\n"], "yml");
  c.control(T, "prose", "token-guidance", ["A Secrets Manager access token names a machine account, a client secret and an encryption key; it is shown once.\n"], "md");
  return c.fixtures;
}
