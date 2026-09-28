import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, uuid, guard, indexContexts } from "./434-shared.mjs";

// Issue #434, slice e (category `beta8-434e`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Helicone read-write (sk-) and write-only (pk-) keys (handoff redact-secret
// docs/audits/evidence/860/helicone.md at 270faf8; product redact-secret#907). Every value is built
// here from a public `synthetic` seed: four 7-byte groups (the generator's lowercase base32 is used
// only as a test-generator hint, R8), all nine documented prefixes and the proxy key.
//
// Deliberately not authored: the exact-width all-x placeholder (the handoff accepts it as claimed,
// so it is neither a positive nor a benign control) and any -gov combination (unresolved). The
// legacy bare sk- 4x7 and -cp- customer-portal keys are Helicone credentials outside the contract,
// so they are prefix twins, never benign controls.

const B32 = "abcdefghijklmnopqrstuvwxyz234567";

export function build434e({ fixture, synthetic }) {
  const c = beta8Corpus("434e", { fixture, synthetic });
  const seed = (target, slug) => `beta11:434e:${target}:${slug}`;
  const digest = slug => synthetic(`beta11:434e:digest:${slug}`, 64, HEX);

  for (const [T, role, segments] of [
    ["helicone-api-key", "sk", ["", "eu-", "rl-", "eu-rl-", "proxy"]],
    ["helicone-write-api-key", "pk", ["", "eu-", "rl-", "eu-rl-"]],
  ]) {
    const { check, refuse } = guard("434e", T);
    const groups = (slug, widths = [7, 7, 7, 7]) => widths.map((w, i) => synthetic(seed(T, `${slug}:g${i}`), w, B32)).join("-");
    let n = 0;
    const key = slug => {
      const seg = segments[n++ % segments.length];
      if (seg === "proxy") return check(`sk-helicone-proxy-${groups(slug)}-${uuid(synthetic(seed(T, `${slug}:uuid`), 32, HEX))}`);
      return check(`${role}-helicone-${seg}${groups(slug)}`);
    };
    const contexts = indexContexts({ env: "HELICONE_API_KEY", name: "Helicone", host: "ai-gateway.helicone.ai", ctor: "HeliconeClient" });
    const heliconeAuth = v => ["curl https://ai-gateway.helicone.ai/v1/chat/completions \\\n  -H \"Helicone-Auth: Bearer ", v, "\" \\\n  -H \"Content-Type: application/json\"\n"];
    const openaiHeaders = v => ["from openai import OpenAI\n\nclient = OpenAI(\n    base_url=\"https://oai.helicone.ai/v1\",\n    default_headers={\"Helicone-Auth\": \"Bearer ", v, "\"},\n)\n"];
    const extras = [
      { axis: "header", slug: "helicone-auth", ext: "sh", build: heliconeAuth },
      { axis: "sdk-config", slug: "openai-default-headers", ext: "py", build: openaiHeaders },
    ];
    if (role === "pk") extras.push({ axis: "url", slug: "gateway-url-path", ext: "py", build: v => ["client = OpenAI(base_url=\"https://gateway.helicone.ai/", v, "/v1/\")\n"] });
    const all = [...contexts, ...extras];
    const k = {};
    for (const x of all) {
      k[x.slug] = key(x.slug);
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    }
    const put = (slug, v) => all.find(x => x.slug === slug).build(v);
    // Segment assignment follows context order: bare-prose "", dotenv eu-, export rl-, bearer-header eu-rl-, then
    // x-api-key-header proxy (sk) or "" (pk), and so on round the list.
    const std = slug => k[slug].startsWith(`${role}-helicone-proxy-`) ? null : k[slug];
    const head = v => v.slice(0, v.length - 31);
    const tail = v => v.slice(-31);
    const P = `${role}-helicone-`;

    c.twin(T, "bare-prose", "group-of-6", put("bare-prose", refuse(`${P}${groups("g6", [7, 6, 7, 7])}`)), "groups: one group of 6 bytes vs exactly 7", "length", "md");
    c.twin(T, "dotenv", "group-of-8", put("dotenv", refuse(`${head(std("dotenv"))}${groups("g8", [7, 7, 8, 7])}`)), "groups: one group of 8 bytes vs exactly 7", "length", "env");
    c.twin(T, "export", "three-groups", put("export", refuse(std("export").slice(0, -8))), "groups: three groups vs exactly four", "length", "sh");
    c.twin(T, "bearer-header", "five-groups", put("bearer-header", refuse(`${std("bearer-header")}-${synthetic(seed(T, "fifth"), 7, B32)}`)), "groups: a fifth group glued on, so the four-group key is embedded in a longer run", "boundary", "http");
    c.twin(T, "json-token", "underscore-separators", put("json-token", refuse(`${head(std("json-token"))}${tail(std("json-token")).replaceAll("-", "_")}`)), "separator: _ in place of - between the groups", "boundary", "json");
    c.twin(T, "json-api-key", "uppercase-byte", put("json-api-key", refuse(at(std("json-api-key"), std("json-api-key").length - 3, "Q"))), "alphabet: one group byte upper-cased; the generator lowercases the whole key", "alphabet", "json");
    c.twin(T, "sdk-kwarg", "dot-in-group", put("sdk-kwarg", refuse(at(std("sdk-kwarg"), std("sdk-kwarg").length - 10, "."))), "alphabet: one group byte replaced by ., outside [a-z0-9]", "alphabet", "py");
    c.twin(T, "bearer-header", "segment-order", put("bearer-header", refuse(k["bearer-header"].replace("-eu-rl-", "-rl-eu-"))), "segments: -rl-eu- vs the validator's order -eu-rl-", "prefix", "http");
    c.twin(T, "helicone-auth", "provider-segment-glued", heliconeAuth(refuse(k["helicone-auth"].replace("-helicone-", "-heliconeX-"))), "prefix: -heliconeX- vs the literal -helicone- segment", "prefix", "sh");
    c.twin(T, "openai-default-headers", "leading-glue", openaiHeaders(refuse(`x${k["openai-default-headers"]}`)), `boundary: x glued before ${role}-helicone-`, "boundary", "py");
    c.twin(T, "bare-prose", "trailing-glue", put("bare-prose", refuse(`${k["bare-prose"]}_x`)), "boundary: _x glued after the last group", "boundary", "md");
    c.twin(T, "dotenv", "legacy-bare", put("dotenv", refuse(`${role}-${tail(std("dotenv"))}`)), `prefix: the legacy bare ${role}- + 4x7 form without -helicone- (a Helicone key the contract does not attribute)`, "prefix", "env");
    c.twin(T, "export", "customer-portal", put("export", refuse(`${role}-cp-${tail(std("export"))}`)), `prefix: the customer-portal ${role}-cp- form (no helicone segment)`, "prefix", "sh");
    if (role === "sk") {
      const proxy = k["x-api-key-header"];
      if (!proxy.startsWith("sk-helicone-proxy-")) throw new Error("beta8-434e: the x-api-key-header positive must carry the proxy key");
      c.twin(T, "x-api-key-header", "proxy-malformed-uuid", put("x-api-key-header", refuse(`${proxy.slice(0, -13)}${proxy.slice(-12)}`)), "proxy: the last UUID dash removed, so the UUID is not 8-4-4-4-12", "boundary", "http");
    } else {
      c.twin(T, "gateway-url-path", "underscore-separator-in-path", ["client = OpenAI(base_url=\"https://gateway.helicone.ai/", refuse(k["gateway-url-path"].replace(/^pk-helicone-/, "pk_helicone-")), "/v1/\")\n"], "separator: pk_helicone- in place of pk-helicone-", "boundary", "py");
    }

    c.control(T, "placeholder", "ellipsis", [`Set HELICONE_API_KEY to your ${role}-helicone-... key from the dashboard.\n`], "md");
    c.control(T, "placeholder", "angle", [`Helicone-Auth: Bearer <${role.toUpperCase()}_HELICONE_KEY>\n`], "txt");
    c.control(T, "reference", "env-reference", ["HELICONE_API_KEY=${HELICONE_API_KEY}\n"], "env");
    c.control(T, "reference", "python-environ", ["default_headers={\"Helicone-Auth\": f\"Bearer {os.environ['HELICONE_API_KEY']}\"}\n"], "py");
    c.control(T, "public-id", "urls", ["Docs: https://docs.helicone.ai/helicone-headers/helicone-auth\nGateway: https://ai-gateway.helicone.ai/v1\n"], "md");
    c.control(T, "public-id", "request-id", [`helicone-id: ${uuid(synthetic(seed(T, "request"), 32, HEX))}\n`], "txt");
    c.control(T, "near-miss", "truncated", [`2026-09-28T10:30:21Z worker: key not well formed: ${role}-helicone-${synthetic(seed(T, "short"), 7, B32)}\n`], "log");
    c.control(T, "near-miss", "word-groups", [`branch names: ${role}-helicone-release-notes and ${role}-helicone-dashboard-refresh\n`], "txt");
    c.control(T, "encoded-value", "digest", [`# audit record\nkey_sha256=${digest(T)}\n`], "txt");
    c.control(T, "prose", "role-guidance", ["sk- keys are read-write; pk- keys are write-only and may go in the gateway URL path, but they are still credentials.\n"], "md");
  }
  return c.fixtures;
}
