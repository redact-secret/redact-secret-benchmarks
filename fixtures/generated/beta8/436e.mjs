import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, authorPositives, guard, probeContexts } from "./436-shared.mjs";

// Issue #436, slice e (category `beta8-436e`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Apify API token (apify_api_ + at least 20 alphanumerics, open-ended; handoff
// redact-secret docs/audits/evidence/860/apify.md at 54fe385; product redact-secret#916). Every value is
// built here from a public `synthetic` seed; bodies are 36 (the observed width), 20 (the provider floor)
// or 128 (the product's streaming cap).
//
// Deliberately not authored: a body over 128, either way (the provider's rule would flag it, the
// product's cap would not), and a full apify_ui_ Console token (no stated shape).

export function build436e({ fixture, synthetic }) {
  const c = beta8Corpus("436e", { fixture, synthetic });
  const T = "apify-api-token";
  const seed = slug => `beta11:436e:${T}:${slug}`;
  const { check, refuse } = guard("436e", T);
  const width = { "json-token": 20, "mcp-env": 128 };
  const key = slug => check(`apify_api_${synthetic(seed(slug), width[slug] ?? 36, ALNUM)}`);

  const probe = probeContexts({ env: "APIFY_TOKEN", name: "Apify", host: "api.apify.com", ctor: "ApifyClient" });
  const jsClient = v => ["import { ApifyClient } from 'apify-client';\n\nconst client = new ApifyClient({ token: '", v, "' });\nconst run = await client.actor('apify/web-scraper').call();\n"];
  const pyPositional = v => ["from apify_client import ApifyClient\n\nclient = ApifyClient(\"", v, "\")\nrun = client.actor(\"apify/web-scraper\").call()\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"actors-mcp-server\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@apify/actors-mcp-server\"],\n      \"env\": { \"APIFY_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
  const curl = v => ["curl -s \"https://api.apify.com/v2/acts/apify~web-scraper/runs\" -H \"Authorization: Bearer ", v, "\"\n"];
  const contexts = [...probe,
    { axis: "source-code", slug: "js-client", ext: "ts", build: jsClient },
    { axis: "sdk-config", slug: "python-positional", ext: "py", build: pyPositional },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(10);

  c.twin(T, "json-token", "body-19", put("json-token", refuse(k["json-token"].slice(0, -1))), "length: a 19-character body, one below the provider linter's 20 floor", "length", "json");
  c.twin(T, "dotenv", "uppercase-prefix", put("dotenv", refuse(`APIFY_API_${body(k.dotenv)}`)), "prefix: APIFY_API_ vs the case-sensitive apify_api_", "prefix", "env");
  c.twin(T, "export", "hyphen-prefix", put("export", refuse(`apify-api-${body(k.export)}`)), "boundary: apify-api- in place of the underscore delimiters", "boundary", "sh");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before apify_api_", "boundary", "md");
  c.twin(T, "bearer-header", "trailing-underscore", put("bearer-header", refuse(`${k["bearer-header"]}_x`)), "boundary: _x glued after the alphanumeric run", "boundary", "http");
  c.twin(T, "chat-paste", "trailing-hyphen", put("chat-paste", refuse(`${k["chat-paste"]}-x`)), "boundary: -x glued after the alphanumeric run", "boundary", "txt");
  c.twin(T, "sdk-kwarg", "underscore-in-body", put("sdk-kwarg", refuse(`apify_api_${body(k["sdk-kwarg"]).slice(0, 12)}_${body(k["sdk-kwarg"]).slice(13)}`)), "alphabet: one body character replaced by _, outside [A-Za-z0-9], leaving a 12-character run", "alphabet", "py");

  c.control(T, "placeholder", "your-token", ["APIFY_TOKEN=apify_api_YOUR_TOKEN\n"], "env");
  c.control(T, "placeholder", "test-names", ["tokens = [\"apify_api_test_token\", \"apify_api_invalid_token\", \"apify_api_dummy_for_smoke\"]\n"], "py");
  c.control(T, "placeholder", "ellipsis", ["Set APIFY_TOKEN to your API token (apify_api_...) from Console > Settings > Integrations.\n"], "md");
  c.control(T, "public-id", "identifiers", ["from apify_client.errors import apify_api_error\n\nAPIFY_API_BASE_URL = \"https://api.apify.com/v2\"\n"], "py");
  c.control(T, "public-id", "console-token-name", ["if token.startswith(\"apify_ui_\"):\n    kind = \"apify_ui_test\"\n"], "py");
  c.control(T, "reference", "actions-secret", ["      APIFY_TOKEN: ${{ secrets.APIFY_TOKEN }}\n"], "yml");
  c.control(T, "reference", "env-reference", ["APIFY_TOKEN=${APIFY_TOKEN}\n"], "env");
  c.control(T, "near-miss", "prefix-at-eol", ["2026-09-28T13:05:51Z actor: token must start with apify_api_\n"], "log");
  c.control(T, "near-miss", "short-body", [`2026-09-28T13:06:02Z actor: rejected truncated token apify_api_${synthetic(seed("short"), 12, ALNUM)} (too short)\n`], "log");
  c.control(T, "prose", "token-guidance", ["Apify API tokens start with apify_api_; Console session tokens start with apify_ui_ and are not API tokens.\n"], "md");
  return c.fixtures;
}
