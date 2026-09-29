import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, guard, indexContexts } from "./434-shared.mjs";

// Issue #434, slice c (category `beta8-434c`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the E2B team API key (e2b_ + 40 lowercase hex; handoff redact-secret
// docs/audits/evidence/860/e2b.md at 270faf8; product redact-secret#905). Every value is built here
// from a public `synthetic` seed in the documented shape.
//
// The retired sk_e2b_ user token is another credential class, so it is a prefix twin, never a
// benign control. A 64-hex value is authored only as a labelled digest, not as a sandbox token.

export function build434c({ fixture, synthetic }) {
  const c = beta8Corpus("434c", { fixture, synthetic });
  const T = "e2b-api-key";
  const seed = slug => `beta11:434c:${T}:${slug}`;
  const { check, refuse } = guard("434c", T);
  const key = slug => check(`e2b_${synthetic(seed(slug), 40, HEX)}`);

  const contexts = indexContexts({ env: "E2B_API_KEY", name: "E2B", host: "api.e2b.dev", ctor: "Sandbox.create" });
  const pySandbox = v => ["from e2b_code_interpreter import Sandbox\n\nsbx = Sandbox.create(api_key=\"", v, "\")\n"];
  const jsSandbox = v => ["import { Sandbox } from '@e2b/code-interpreter';\n\nconst sbx = await Sandbox.create({ apiKey: '", v, "' });\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"e2b\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@e2b/mcp-server\"],\n      \"env\": { \"E2B_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const curl = v => ["curl -s https://api.e2b.dev/sandboxes -H \"X-API-Key: ", v, "\"\n"];
  const all = [...contexts,
    { axis: "sdk-config", slug: "python-sandbox", ext: "py", build: pySandbox },
    { axis: "source-code", slug: "js-sandbox", ext: "ts", build: jsSandbox },
    { axis: "container-config", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "curl-x-api-key", ext: "sh", build: curl },
  ];
  const k = {};
  for (const x of all) {
    k[x.slug] = key(x.slug);
    c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
  }
  const put = (slug, v) => all.find(x => x.slug === slug).build(v);
  const body = v => v.slice(4);

  c.twin(T, "dotenv", "body-39", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 39-byte body vs exactly 40", "length", "env");
  c.twin(T, "export", "body-41", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, HEX)}`)), "length: a 41-byte body vs exactly 40", "length", "sh");
  c.twin(T, "json-token", "uppercase-hex-byte", put("json-token", refuse(at(k["json-token"], 10, "A"))), "alphabet: one body byte as uppercase hex, which the generator never issues", "alphabet", "json");
  c.twin(T, "json-api-key", "g-in-body", put("json-api-key", refuse(at(k["json-api-key"], 15, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "hyphen-in-body", put("sdk-kwarg", refuse(at(k["sdk-kwarg"], 24, "-"))), "alphabet: one body byte replaced by -", "alphabet", "py");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`E2B_${body(k["bearer-header"])}`)), "prefix: E2B_ vs the lower-case e2b_ the generator emits", "prefix", "http");
  c.twin(T, "x-api-key-header", "hyphen-separator", put("x-api-key-header", refuse(`e2b-${body(k["x-api-key-header"])}`)), "boundary: e2b- in place of the e2b_ separator", "boundary", "http");
  c.twin(T, "python-sandbox", "retired-user-token", pySandbox(refuse(`sk_e2b_${synthetic(seed("sk-e2b"), 40, HEX)}`)), "prefix: sk_e2b_ + 40 hex, the retired user access token, a different credential class", "prefix", "py");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before e2b_", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before e2b_", "boundary", "txt");
  c.twin(T, "curl-x-api-key", "trailing-glue", curl(refuse(`${k["curl-x-api-key"]}_x`)), "boundary: _x glued after the body", "boundary", "sh");

  c.control(T, "public-id", "package-import", ["from e2b_code_interpreter import Sandbox\nfrom e2b_desktop import Sandbox as Desktop\n"], "py");
  c.control(T, "public-id", "module-names", ["pip install e2b_code_interpreter e2b_desktop  # also see the e2b_sandbox and e2b_dev modules\n"], "sh");
  c.control(T, "placeholder", "ellipsis", ["Set E2B_API_KEY to your key (e2b_...) from the dashboard.\n"], "md");
  c.control(T, "placeholder", "masked", ["Key e2b_*** created on 2026-09-28 by the platform team.\n"], "md");
  c.control(T, "reference", "env-reference", ["E2B_API_KEY=${E2B_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      E2B_API_KEY: ${{ secrets.E2B_API_KEY }}\n"], "yml");
  c.control(T, "encoded-value", "git-sha", [`commit ${synthetic(seed("git-sha"), 40, HEX)}\nAuthor: CI Bot <ci@example.test>\n`], "txt");
  c.control(T, "encoded-value", "template-digest", [`template build digest: sha256:${synthetic(seed("digest"), 64, HEX)}\n`], "txt");
  c.control(T, "near-miss", "truncated", [`2026-09-28T10:10:02Z api: rejected truncated key e2b_${synthetic(seed("short"), 16, HEX)} from 203.0.113.9\n`], "log");
  c.control(T, "prose", "key-guidance", ["E2B team API keys start with e2b_; the older sk_e2b_ access tokens stopped working on 2026-08-01.\n"], "md");
  return c.fixtures;
}
