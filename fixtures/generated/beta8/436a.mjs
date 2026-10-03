import { beta8Corpus } from "./helpers.mjs";
import { DIGITS, HEX, LOWER, at, authorPositives, guard, probeContexts } from "./436-shared.mjs";

// Issue #436, slice a (category `beta8-436a`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for Convex deployment and admin keys with a hex body (handoff redact-secret
// docs/audits/evidence/860/convex.md at 54fe385; product redact-secret#912). Every value is built
// here from a public `synthetic` seed in the documented shape: an optional typed lead, the name,
// one |, then 01 + an even-length lowercase hex body. The secret span is the whole key.
//
// Deliberately not authored (see benchmarks/lib/beta8/436a.ts field claims):
//   - an eyJ2… cloud deploy-key body, either way: it is issuance-gated (ruling R4 fixes the prefix only);
//   - the handoff's `prod;` twin and a glue byte before the type lead (`xprod:…`): once the typed lead
//     is broken, the remaining `<cloud-name>|01<hex>` after the `;` or `:` is itself a contract-valid
//     untyped key (lexically inseparable, #84), so the fixture could not assert silence on one property;
//   - a self-hosted name or slug outside the bounded class, either way (project policy, an accepted
//     false negative).

export function build436a({ fixture, synthetic }) {
  const c = beta8Corpus("436a", { fixture, synthetic });
  const T = "convex-deployment-key";
  const seed = slug => `beta11:436a:${T}:${slug}`;
  const { check, refuse } = guard("436a", T);

  /** A public cloud deployment name, [a-z]+-[a-z]+-[0-9]+. */
  const cloud = slug => `${synthetic(seed(`${slug}:adj`), 6, LOWER)}-${synthetic(seed(`${slug}:noun`), 5, LOWER)}-${synthetic(seed(`${slug}:n`), 3, DIGITS)}`;
  const slugOf = (slug, part) => synthetic(seed(`${slug}:${part}`), 7, LOWER);
  /** 01 + (n - 2) lowercase hex: n is the full body length. */
  const body = (slug, n = 76) => `01${synthetic(seed(`${slug}:body`), n - 2, HEX)}`;
  const leads = {
    prod: slug => `prod:${cloud(slug)}`,
    dev: slug => `dev:${cloud(slug)}`,
    preview: slug => `preview:${slugOf(slug, "team")}:${slugOf(slug, "project")}`,
    project: slug => `project:${slugOf(slug, "team")}:${slugOf(slug, "project")}`,
    selfHosted: () => "convex-self-hosted",
    dashboard: slug => cloud(slug),
  };
  const plan = {
    "bare-prose": ["prod", 76], dotenv: ["prod", 76], export: ["dev", 76], "bearer-header": ["selfHosted", 74],
    "x-api-key-header": ["dashboard", 76], "json-token": ["preview", 76], "json-api-key": ["project", 76],
    "sdk-kwarg": ["prod", 96], "chat-paste": ["prod", 76], "compose-self-hosted": ["selfHosted", 74],
    "curl-authorization-convex": ["prod", 76], "actions-deploy": ["preview", 96], "mcp-env": ["prod", 76],
  };
  const key = slug => {
    const [lead, n] = plan[slug];
    return check(`${leads[lead](slug)}|${body(slug, n)}`);
  };

  const probe = probeContexts({ env: "CONVEX_DEPLOY_KEY", name: "Convex", host: "api.convex.dev", ctor: "ConvexClient" });
  const compose = v => ["services:\n  backend:\n    image: ghcr.io/get-convex/convex-backend:latest\n    environment:\n      - INSTANCE_NAME=convex-self-hosted\n      - CONVEX_SELF_HOSTED_ADMIN_KEY=", v, "\n    ports:\n      - \"3210:3210\"\n"];
  const curlConvex = v => ["curl -s -X POST https://api.convex.dev/api/run_test_function -H \"Authorization: Convex ", v, "\" -H \"Content-Type: application/json\"\n"];
  const actions = v => ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npx convex deploy --cmd 'npm run build'\n        env:\n          CONVEX_DEPLOY_KEY: ", v, "\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"convex\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"convex@latest\", \"mcp\", \"start\"],\n      \"env\": { \"CONVEX_DEPLOY_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const contexts = [...probe,
    { axis: "container-config", slug: "compose-self-hosted", ext: "yml", build: compose },
    { axis: "cli", slug: "curl-authorization-convex", ext: "sh", build: curlConvex },
    { axis: "ci-config", slug: "actions-deploy", ext: "yml", build: actions },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const split = v => { const i = v.indexOf("|"); return [v.slice(0, i), v.slice(i + 1)]; };
  const withBody = (v, b) => `${split(v)[0]}|${b}`;

  c.twin(T, "dotenv", "body-72", put("dotenv", refuse(withBody(k.dotenv, body("dotenv", 72)))), "length: a 72-hex body, below the 74 the generator's smallest proto yields", "length", "env");
  c.twin(T, "export", "body-98", put("export", refuse(withBody(k.export, body("export", 98)))), "length: a 98-hex body, above the 96 the generator's largest proto yields", "length", "sh");
  c.twin(T, "json-token", "odd-length-body", put("json-token", refuse(k["json-token"].slice(0, -1))), "length: an odd 75-hex body, which hex-encoded bytes never give", "length", "json");
  c.twin(T, "bearer-header", "version-02", put("bearer-header", refuse(withBody(k["bearer-header"], `02${split(k["bearer-header"])[1].slice(2)}`))), "prefix: body version byte 02 instead of ADMIN_KEY_VERSION 01", "prefix", "http");
  const upperAt = k["x-api-key-header"].indexOf("|") + 11;
  c.twin(T, "x-api-key-header", "uppercase-hex-byte", put("x-api-key-header", refuse(at(k["x-api-key-header"], upperAt, "A"))), "alphabet: one body byte as uppercase hex, which const_hex::encode never emits", "alphabet", "http");
  c.twin(T, "json-api-key", "g-in-body", put("json-api-key", refuse(at(k["json-api-key"], k["json-api-key"].indexOf("|") + 20, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "double-separator", put("sdk-kwarg", refuse(k["sdk-kwarg"].replaceAll("|", "||"))), "boundary: || in place of the single | join", "boundary", "py");
  c.twin(T, "chat-paste", "underscore-name", put("chat-paste", refuse(k["chat-paste"].replace(/^prod:([a-z]+)-([a-z]+)-/, "prod:$1_$2_"))), "boundary: a cloud name with _ in place of -, outside the CLI name grammar", "boundary", "txt");
  c.twin(T, "bare-prose", "space-before-separator", put("bare-prose", refuse(k["bare-prose"].replaceAll("|", " |"))), "boundary: a space between the name and the | join, so | follows no name byte", "boundary", "md");
  c.twin(T, "curl-authorization-convex", "trailing-glue", curlConvex(refuse(`${k["curl-authorization-convex"]}_x`)), "boundary: _x glued after the hex body", "boundary", "sh");

  const pub = cloud("public");
  c.control(T, "public-id", "deployment-selector", [`# .env.local written by npx convex dev\nCONVEX_DEPLOYMENT=dev:${pub} # team: acme, project: web\n`], "env");
  c.control(T, "public-id", "prod-selector", [`CONVEX_DEPLOYMENT=prod:${cloud("prod-selector")}\n`], "env");
  c.control(T, "public-id", "deployment-urls", [`CONVEX_URL=https://${pub}.convex.cloud\nCONVEX_SITE_URL=https://${pub}.convex.site\n`], "env");
  c.control(T, "placeholder", "docs-name-and-key", ["CONVEX_SELF_HOSTED_ADMIN_KEY=prod:your-deployment-name|your-admin-key\n"], "env");
  c.control(T, "placeholder", "adjective-animal", ["CONVEX_DEPLOY_KEY='prod:adjective-animal-123|super-secret-key'\n"], "sh");
  c.control(T, "reference", "body-variable", [`CONVEX_DEPLOY_KEY=prod:${pub}|\${CONVEX_BODY}\n`], "env");
  c.control(T, "reference", "actions-secret", ["        env:\n          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}\n"], "yml");
  c.control(T, "near-miss", "table-cell", [`| deployment | fingerprint |\n| --- | --- |\n| ${pub} | 01${synthetic(seed("table"), 74, HEX)} |\n`], "md");
  c.control(T, "encoded-value", "digest-after-pipe", [`artifact=web-bundle|${"a7"}${synthetic(seed("digest"), 72, HEX)}\n`], "txt");
  c.control(T, "prose", "key-guidance", ["Convex deploy keys look like prod:<deployment-name>|<key>; generate one under Settings, then set CONVEX_DEPLOY_KEY in CI.\n"], "md");
  return c.fixtures;
}
