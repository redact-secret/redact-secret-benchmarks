import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, LOWER_ALNUM, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #528, slice h (category `beta8-528h`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Paddle Billing API key (pdl_live_apikey_ | pdl_sdbx_apikey_ + 26 [a-z0-9] + _ + 22
// [A-Za-z0-9] + _ + 3 [A-Za-z0-9], the provider-published regex; handoff redact-secret docs/audits/evidence/1014/paddle.md
// at 4f220ea; product redact-secret#1033). Every value is built here from a public `synthetic` seed; live and sandbox
// keys are one family. The apikey_ + 26 key id alone (webhooks, API responses) and a legacy-shaped 50-character value
// outside a named context are controls; one-property twins cover every segment.

const SANDBOX = new Set(["json-token", "export", "sandbox-dotenv", "chat-paste"]);

export function build528h({ fixture, synthetic }) {
  const c = beta8Corpus("528h", { fixture, synthetic });
  const T = "paddle-api-key";
  const seed = slug => `beta12:528h:${T}:${slug}`;
  const { check, refuse } = guard("528h", T);
  const P = {};
  const join = p => `pdl_${p.env}_apikey_${p.id}_${p.secret}_${p.suffix}`;
  const key = slug => {
    P[slug] = { env: SANDBOX.has(slug) ? "sdbx" : "live", id: synthetic(seed(`id:${slug}`), 26, LOWER_ALNUM), secret: synthetic(seed(`secret:${slug}`), 22, ALNUM), suffix: synthetic(seed(`suffix:${slug}`), 3, ALNUM) };
    return check(join(P[slug]));
  };
  const with_ = (slug, change) => join({ ...P[slug], ...change(P[slug]) });

  const probe = probeContexts({ env: "PADDLE_API_KEY", name: "Paddle", host: "api.paddle.com", ctor: "Client" });
  const tsSdk = v => ["import { Environment, Paddle } from '@paddle/paddle-node-sdk';\n\nconst paddle = new Paddle('", v, "', { environment: Environment.production });\n"];
  const sandboxEnv = v => ["# .env.local\nPADDLE_ENVIRONMENT=sandbox\nPADDLE_API_KEY=", v, "\n"];
  const pySdk = v => ["from paddle_billing import Client\n\npaddle = Client(\"", v, "\")\nfor product in paddle.products.list():\n    print(product.id)\n"];
  const contexts = [...probe,
    { axis: "source-code", slug: "node-sdk-constructor", ext: "ts", build: tsSdk },
    { axis: "env", slug: "sandbox-dotenv", ext: "env", build: sandboxEnv },
    { axis: "sdk-config", slug: "python-sdk-client", ext: "py", build: pySdk },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);

  c.twin(T, "dotenv", "id-25", put("dotenv", refuse(with_("dotenv", p => ({ id: p.id.slice(0, 25) })))), "length: a 25-character key-id segment vs exactly 26", "length", "env");
  c.twin(T, "export", "id-27", put("export", refuse(with_("export", p => ({ id: `${p.id}a` })))), "length: a 27-character key-id segment vs exactly 26", "length", "sh");
  c.twin(T, "json-token", "uppercase-in-id", put("json-token", refuse(with_("json-token", p => ({ id: at(p.id, 7, "K") })))), "alphabet: one key-id byte in uppercase, outside the documented [a-z0-9]", "alphabet", "json");
  c.twin(T, "json-api-key", "secret-21", put("json-api-key", refuse(with_("json-api-key", p => ({ secret: p.secret.slice(0, 21) })))), "length: a 21-character secret segment vs exactly 22", "length", "json");
  c.twin(T, "bearer-header", "secret-23", put("bearer-header", refuse(with_("bearer-header", p => ({ secret: `${p.secret}Z` })))), "length: a 23-character secret segment vs exactly 22", "length", "http");
  c.twin(T, "x-api-key-header", "suffix-2", put("x-api-key-header", refuse(with_("x-api-key-header", p => ({ suffix: p.suffix.slice(0, 2) })))), "length: a 2-character suffix vs exactly 3 (68 in all)", "length", "http");
  c.twin(T, "sdk-kwarg", "suffix-4", put("sdk-kwarg", refuse(with_("sdk-kwarg", p => ({ suffix: `${p.suffix}7` })))), "length: a 4-character suffix vs exactly 3 (70 in all)", "length", "py");
  c.twin(T, "node-sdk-constructor", "test-environment", put("node-sdk-constructor", refuse(with_("node-sdk-constructor", () => ({ env: "test" })))), "prefix: pdl_test_ vs the documented live or sdbx", "prefix", "ts");
  c.twin(T, "python-sdk-client", "missing-apikey", put("python-sdk-client", refuse(k["python-sdk-client"].replace("_apikey_", "_"))), "prefix: apikey_ removed (four underscores, 62 in all)", "prefix", "py");
  c.twin(T, "sandbox-dotenv", "hyphen-separator", put("sandbox-dotenv", refuse(`pdl_sdbx_apikey_${P["sandbox-dotenv"].id}-${P["sandbox-dotenv"].secret}_${P["sandbox-dotenv"].suffix}`)), "separator: - in place of the _ after the key-id segment", "alphabet", "env");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before pdl_", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-glue", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the 3-character suffix", "boundary", "txt");

  const keyId = slug => `apikey_${synthetic(seed(`ctl-id:${slug}`), 26, LOWER_ALNUM)}`;
  c.control(T, "public-id", "webhook-key-id", [`{\n  "event_type": "api_key.created",\n  "data": {\n    "id": "${keyId("webhook")}",\n    "name": "CI deploys",\n    "status": "active"\n  }\n}\n`], "json");
  c.control(T, "public-id", "api-list-key-id", [`GET /api-keys -> 200\n  ${keyId("list")}  "Reporting"  expires 2027-01-01\n`], "log");
  c.control(T, "encoded-value", "legacy-shaped-build-id", [`build: ${synthetic(seed("legacy"), 50, LOWER_ALNUM)}\n`], "yml");
  c.control(T, "near-miss", "truncated", [`2026-09-29T12:10:30Z billing: rejected truncated key pdl_live_apikey_${synthetic(seed("short"), 10, LOWER_ALNUM)}\n`], "log");
  c.control(T, "placeholder", "docs-regex", ["Match keys with ^pdl_(live|sdbx)_apikey_[a-z\\d]{26}_[a-zA-Z\\d]{22}_[a-zA-Z\\d]{3}$ in your secret scanner.\n"], "md");
  c.control(T, "placeholder", "ellipsis", ["PADDLE_API_KEY=pdl_sdbx_apikey_...\n"], "env");
  c.control(T, "reference", "env-reference", ["PADDLE_API_KEY=${PADDLE_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          PADDLE_API_KEY: ${{ secrets.PADDLE_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["Paddle API keys start with pdl_live_apikey_ or pdl_sdbx_apikey_; the apikey_ id alone is not a secret.\n"], "md");
  return c.fixtures;
}
