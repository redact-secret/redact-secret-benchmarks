import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, at, authorPositives, guard, probeContexts } from "./464-shared.mjs";

// Issue #464, slice d (category `beta8-464d`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Browserbase API key, bb_live_ only (bb_live_ + at least 20 [A-Za-z0-9], open-ended;
// handoff redact-secret docs/audits/evidence/860/browserbase.md at 8b6a5fd; product redact-secret#973). Every value
// is built here from a public `synthetic` seed; bodies are 20 (the provider floor), 32 and 128 (the cap).
//
// POLICY, not T1: the 128-byte upper bound; a body over 128 is not authored either way (no 129 twin). bb_test_ is
// issuance-gated and unclaimed, so a bb_test_ value is a benign control, never a positive. The two provider rules
// disagree on a glued -; the handoff decides both, so the boundary twins are handoff decisions, not provider facts.

export function build464d({ fixture, synthetic }) {
  const c = beta8Corpus("464d", { fixture, synthetic });
  const T = "browserbase-api-key";
  const seed = slug => `beta12:464d:${T}:${slug}`;
  const { check, refuse } = guard("464d", T);
  const width = { "json-token": 20, "mcp-env": 128 };
  const key = slug => check(`bb_live_${synthetic(seed(slug), width[slug] ?? 32, ALNUM)}`);
  const uuid = slug => { const h = synthetic(seed(`uuid:${slug}`), 32, "0123456789abcdef"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };

  const probe = probeContexts({ env: "BROWSERBASE_API_KEY", name: "Browserbase", host: "api.browserbase.com", ctor: "Browserbase" });
  const bbHeader = v => ["POST /v1/sessions HTTP/1.1\nHost: api.browserbase.com\nX-BB-API-Key: ", v, "\nContent-Type: application/json\n"];
  const pySdk = v => ["from browserbase import Browserbase\n\nbb = Browserbase(api_key=\"", v, `")\nsession = bb.sessions.create(project_id="${uuid("py")}")\n`];
  const stagehand = v => ["import { Stagehand } from '@browserbasehq/stagehand';\n\nconst stagehand = new Stagehand({ env: 'BROWSERBASE', apiKey: '", v, `', projectId: '${uuid("ts")}' });\n`];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"browserbase\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@browserbasehq/mcp-server-browserbase\"],\n      \"env\": { \"BROWSERBASE_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const contexts = [...probe,
    { axis: "header", slug: "x-bb-api-key-header", ext: "http", build: bbHeader },
    { axis: "sdk-config", slug: "python-sdk", ext: "py", build: pySdk },
    { axis: "source-code", slug: "stagehand-ts", ext: "ts", build: stagehand },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(8);

  c.twin(T, "json-token", "body-19", put("json-token", refuse(k["json-token"].slice(0, -1))), "length: a 19-byte body, one below the provider CI gate floor of 20", "length", "json");
  c.twin(T, "dotenv", "trailing-underscore", put("dotenv", refuse(`${k.dotenv}_x`)), "boundary: _x glued after the alphanumeric run", "boundary", "env");
  c.twin(T, "export", "trailing-hyphen", put("export", refuse(`${k.export}-x`)), "boundary: -x glued after the alphanumeric run (a handoff decision: the two provider rules disagree on -)", "boundary", "sh");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`BB_LIVE_${body(k["bearer-header"])}`)), "prefix: BB_LIVE_ vs the case-sensitive bb_live_", "prefix", "http");
  c.twin(T, "x-api-key-header", "hyphen-prefix", put("x-api-key-header", refuse(`bb-live-${body(k["x-api-key-header"])}`)), "boundary: bb-live- in place of the underscore delimiters", "boundary", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before bb_live_", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before bb_live_", "boundary", "txt");

  c.control(T, "near-miss", "bb-test-key", [`BROWSERBASE_API_KEY=bb_test_${synthetic(seed("bb-test"), 32, ALNUM)}\n`], "env");
  c.control(T, "near-miss", "live-session-identifier", [`2026-09-29T10:14:02Z browserbase: attached bb_live_session_${synthetic(seed("session"), 24, ALNUM)} to project\n`], "log");
  c.control(T, "near-miss", "prefix-at-eol", ["2026-09-29T10:14:20Z browserbase: expected a key that starts with bb_live_\n"], "log");
  c.control(T, "placeholder", "ellipsis", ["Set BROWSERBASE_API_KEY to your key (bb_live_...) from the dashboard.\n"], "md");
  c.control(T, "placeholder", "your-api-key-here", ["BROWSERBASE_API_KEY=bb_live_your_api_key_here\n"], "env");
  c.control(T, "placeholder", "x-run", ["apiKey: 'bb_live_xxxx'\n"], "ts");
  c.control(T, "public-id", "timestamp-cookie", [`Set-Cookie: bb_${Date.UTC(2026, 8, 29)}=1; Path=/; Secure\n`], "http");
  c.control(T, "public-id", "project-id", [`BROWSERBASE_PROJECT_ID=${uuid("ctl-project")}\n`], "env");
  c.control(T, "reference", "env-reference", ["BROWSERBASE_API_KEY=${BROWSERBASE_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["Browserbase API keys start with bb_live_ and are sent as the X-BB-API-Key header.\n"], "md");
  return c.fixtures;
}
