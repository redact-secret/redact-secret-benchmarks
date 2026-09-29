import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, uuid, guard, indexContexts } from "./434-shared.mjs";

// Issue #434, slice f (category `beta8-434f`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Firecrawl API key (fc- + a dashless lowercase UUIDv4; handoff redact-secret
// docs/audits/evidence/860/firecrawl.md at 270faf8; product redact-secret#908). Every value is built
// here from a public `synthetic` seed with the version and variant nibbles set as a random UUIDv4
// would have them.
//
// Deliberately not authored as a benign control: a bare dashed UUID in a credential position (a
// legacy Firecrawl key the contract does not attribute). A dashed UUID appears only as a request id.

const VARIANT = "89ab";

export function build434f({ fixture, synthetic }) {
  const c = beta8Corpus("434f", { fixture, synthetic });
  const T = "firecrawl-api-key";
  const seed = slug => `beta11:434f:${T}:${slug}`;
  const { check, refuse } = guard("434f", T);
  /** 32 lowercase hex with byte 12 = version and byte 16 = variant. */
  const v4 = (slug, version = "4", variant = VARIANT[synthetic(seed(`${slug}:variant`), 1, "0123")] ) => {
    const h = synthetic(seed(slug), 32, HEX);
    return `${h.slice(0, 12)}${version}${h.slice(13, 16)}${variant}${h.slice(17)}`;
  };
  const key = slug => check(`fc-${v4(slug)}`);

  const contexts = indexContexts({ env: "FIRECRAWL_API_KEY", name: "Firecrawl", host: "api.firecrawl.dev", ctor: "FirecrawlApp" });
  const pyApp = v => ["from firecrawl import FirecrawlApp\n\napp = FirecrawlApp(api_key=\"", v, "\")\n"];
  const jsApp = v => ["import Firecrawl from '@mendable/firecrawl-js';\n\nconst firecrawl = new Firecrawl({ apiKey: '", v, "' });\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"firecrawl-mcp\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"firecrawl-mcp\"],\n      \"env\": { \"FIRECRAWL_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const curl = v => ["curl -s -X POST https://api.firecrawl.dev/v2/scrape -H \"Authorization: Bearer ", v, "\" -d '{\"url\": \"https://example.test\"}'\n"];
  const composeEnv = v => ["services:\n  crawler:\n    image: example.test/crawler:latest\n    environment:\n      FIRECRAWL_API_KEY: ", v, "\n"];
  const actionsEnv = v => ["jobs:\n  scrape:\n    runs-on: ubuntu-latest\n    env:\n      FIRECRAWL_API_KEY: ", v, "\n"];
  const goHttp = v => ["req, _ := http.NewRequest(\"POST\", \"https://api.firecrawl.dev/v2/scrape\", body)\nreq.Header.Set(\"Authorization\", \"Bearer ", v, "\")\n"];
  const all = [...contexts,
    { axis: "sdk-config", slug: "python-app", ext: "py", build: pyApp },
    { axis: "source-code", slug: "js-client", ext: "ts", build: jsApp },
    { axis: "container-config", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
    { axis: "container-config", slug: "compose-env", ext: "yml", build: composeEnv },
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actionsEnv },
    { axis: "source-code", slug: "go-http", ext: "go", build: goHttp },
  ];
  const k = {};
  for (const x of all) {
    k[x.slug] = key(x.slug);
    c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
  }
  const put = (slug, v) => all.find(x => x.slug === slug).build(v);
  const body = v => v.slice(3);
  const dashed = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

  c.twin(T, "dotenv", "body-31", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: 31 hex vs exactly 32", "length", "env");
  c.twin(T, "export", "body-33", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, HEX)}`)), "length: 33 hex vs exactly 32", "length", "sh");
  c.twin(T, "bearer-header", "version-1", put("bearer-header", refuse(at(k["bearer-header"], 3 + 12, "1"))), "version nibble: 1 vs the 4 of a random UUIDv4", "alphabet", "http");
  c.twin(T, "x-api-key-header", "version-7", put("x-api-key-header", refuse(at(k["x-api-key-header"], 3 + 12, "7"))), "version nibble: 7 vs 4", "alphabet", "http");
  c.twin(T, "json-token", "version-0", put("json-token", refuse(at(k["json-token"], 3 + 12, "0"))), "version nibble: 0 vs 4", "alphabet", "json");
  c.twin(T, "json-api-key", "variant-c", put("json-api-key", refuse(at(k["json-api-key"], 3 + 16, "c"))), "variant nibble: c vs one of 8 9 a b", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "variant-7", put("sdk-kwarg", refuse(at(k["sdk-kwarg"], 3 + 16, "7"))), "variant nibble: 7 vs one of 8 9 a b", "alphabet", "py");
  c.twin(T, "python-app", "uppercase-hex", pyApp(refuse(at(k["python-app"], 3 + 5, "B"))), "alphabet: one body byte as uppercase hex; the database renders lowercase", "alphabet", "py");
  c.twin(T, "js-client", "g-in-body", jsApp(refuse(at(k["js-client"], 3 + 25, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "ts");
  c.twin(T, "mcp-env", "dashed-uuid", mcp(refuse(`fc-${dashed(body(k["mcp-env"]))}`)), "separators: fc- + a dashed UUID, which is not an issued form", "boundary", "json");
  c.twin(T, "curl-bearer", "uppercase-prefix", curl(refuse(`FC-${body(k["curl-bearer"])}`)), "prefix: FC- vs the documented lower-case fc-", "prefix", "sh");
  c.twin(T, "chat-paste", "underscore-prefix", put("chat-paste", refuse(`fc_${body(k["chat-paste"])}`)), "prefix: fc_ in place of fc-", "prefix", "txt");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before fc-", "boundary", "md");
  c.twin(T, "dotenv", "trailing-glue", put("dotenv", refuse(`${k.dotenv}_x`)), "boundary: _x glued after the body", "boundary", "env");

  c.control(T, "placeholder", "your-api-key", ["FIRECRAWL_API_KEY=fc-YOUR-API-KEY\n"], "env");
  c.control(T, "placeholder", "docs-ctor", ["app = FirecrawlApp(api_key=\"fc-your-api-key\")\n"], "py");
  c.control(T, "placeholder", "short-samples", ["Examples in the README use fc-test and fc-xxx; replace them with your own key.\n"], "md");
  c.control(T, "near-miss", "css-classes", ["<td class=\"fc-daygrid-day fc-day-today\"><a class=\"fc-event fc-event-start\">Standup</a></td>\n"], "html");
  c.control(T, "near-miss", "md5-cache-key", [`cache: fc-${v4("md5", "e", "c")} hit=true ttl=300\n`], "log");
  c.control(T, "public-id", "request-uuid", [`{"success": true, "id": "${uuid(synthetic(seed("job"), 32, HEX))}", "url": "https://api.firecrawl.dev/v2/crawl"}\n`], "json");
  c.control(T, "reference", "env-reference", ["FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}\n"], "yml");
  c.control(T, "encoded-value", "digest", [`# audit record\nkey_sha256=${synthetic(seed("digest"), 64, HEX)}\n`], "txt");
  c.control(T, "prose", "key-guidance", ["Firecrawl keys start with fc- and are created in the dashboard; older keys were plain UUIDs.\n"], "md");
  return c.fixtures;
}
