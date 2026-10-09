import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #384, slice d (category `beta8-384d`). See docs/specs/beta8-evidence.md.
//
// Beta.10 corpus for the Together AI (tgp_v1_ + 43 base64url) and Tavily (tvly- + optional dev-
// + 32 alphanumerics) API keys (research redact-secret#783, #786; product redact-secret#867).
// Every credential-shaped value is built here from a public `synthetic` seed; nothing is
// copied from a provider example, a scanner test vector, a code-search sample or an issued key.
//
// Deliberately not authored (see benchmarks/lib/credential-regressions/384d.ts field claims):
//   - Together: a tgp_v2_ or 64-hex legacy value either way (no source states either);
//   - Tavily: a tvly-prod- prefix or a longer production body either way, and any value that
//     tvly-dev- alone would make ambiguous;
//   - a Base64-encoded copy of either key: family scope is undecided.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const URLSAFE = `${ALNUM}_-`;
const HEX = "0123456789abcdef";
const at = (value, index, ch) => value.slice(0, index) + ch + value.slice(index + 1);

export function build384d({ fixture, synthetic }) {
  const c = beta8Corpus("384d", { fixture, synthetic });
  const seed = (target, slug) => `beta10:384d:${target}:${slug}`;
  const guard = target => ({
    check: value => {
      if (!new RegExp(contracts[target].pattern).test(value)) throw new Error(`beta8-384d: authored ${target} positive fails its own contract: ${value.slice(0, 8)}...`);
      return value;
    },
    refuse: value => {
      if (new RegExp(contracts[target].pattern).test(value)) throw new Error(`beta8-384d: ${target} twin value still satisfies the contract`);
      return value;
    },
  });
  const digest = slug => synthetic(`beta10:384d:digest:${slug}`, 64, HEX);
  const uuid = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;

  // ---------------------------------------------------------------- together-ai-api-key
  {
    const T = "together-ai-api-key";
    const { check, refuse } = guard(T);
    const key = slug => check(`tgp_v1_${synthetic(seed(T, slug), 43, URLSAFE)}`);
    const k = Object.fromEntries(["dotenv", "export", "curl", "python", "environ", "openai", "json", "tool", "log", "pasted", "js", "yaml", "actions", "compose", "cli"].map(s => [s, key(s)]));
    const body = v => v.slice(7);

    const dotenv = v => ["# .env\nTOGETHER_API_KEY=", v, "\nTOGETHER_BASE_URL=https://api.together.xyz/v1\n"];
    const exportLine = v => ["export TOGETHER_API_KEY=\"", v, "\"\n"];
    const curl = v => ["curl -s https://api.together.xyz/v1/models -H \"Authorization: Bearer ", v, "\"\n"];
    const python = v => ["from together import Together\n\nclient = Together(api_key=\"", v, "\")\n"];
    const environ = v => ["import os\n\nos.environ[\"TOGETHER_API_KEY\"] = \"", v, "\"\n"];
    const openai = v => ["from openai import OpenAI\n\nclient = OpenAI(base_url=\"https://api.together.xyz/v1\", api_key=\"", v, "\")\n"];
    const json = v => ["{\n  \"togetherApiKey\": \"", v, "\",\n  \"model\": \"meta-llama/Llama-3.3-70B-Instruct-Turbo\"\n}\n"];
    const tool = v => ["{\"tool\": \"bash\", \"arguments\": {\"command\": \"curl -s https://api.together.xyz/v1/chat/completions -H 'Authorization: Bearer ", v, "'\"}}\n"];
    const log = v => ["2026-09-26T10:20:44Z llm-router: upstream=together key ", v, " status=200\n"];

    c.positive(T, "env", "dotenv", dotenv({ secret: k.dotenv }), "env");
    c.positive(T, "shell-export", "export", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-bearer", curl({ secret: k.curl }), "sh");
    c.positive(T, "sdk-config", "python-together", python({ secret: k.python }), "py");
    c.positive(T, "source-code", "python-environ", environ({ secret: k.environ }), "py");
    c.positive(T, "sdk-config", "openai-sdk-base-url", openai({ secret: k.openai }), "py");
    c.positive(T, "structured-file", "json-config", json({ secret: k.json }), "json");
    c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
    c.positive(T, "log", "router-log", log({ secret: k.log }), "log");
    // Research #783 positive contexts: JS apiKey, JSON/YAML, CI and container env, and the CLI flag. Each keeps a distinct authored context and has no twin.
    c.positive(T, "source-code", "js-client", ["import Together from 'together-ai';\n\nconst together = new Together({ apiKey: '", { secret: k.js }, "' });\n"], "ts");
    c.positive(T, "structured-file", "yaml-config", ["llm:\n  provider: together\n  api_key: ", { secret: k.yaml }, "\n  model: meta-llama/Llama-3.3-70B-Instruct-Turbo\n"], "yml");
    c.positive(T, "ci-config", "actions-env", ["jobs:\n  eval:\n    runs-on: ubuntu-latest\n    env:\n      TOGETHER_API_KEY: ", { secret: k.actions }, "\n    steps:\n      - run: python eval.py\n"], "yml");
    c.positive(T, "container-config", "compose-env", ["services:\n  router:\n    image: registry.example.test/router:2.1\n    environment:\n      TOGETHER_API_KEY: ", { secret: k.compose }, "\n"], "yml");
    c.positive(T, "cli", "cli-flag", ["together --api-key ", { secret: k.cli }, " models list\n"], "sh");
    // Research #783: "bare in a log line ... body at start/end of line".
    c.positive(T, "prose", "pasted-key", ["Here is the Together project key for the sandbox, delete it after the demo:\n", { secret: k.pasted }, "\n"], "txt");

    c.twin(T, "dotenv", "short-body", dotenv(refuse(k.dotenv.slice(0, -1))), "length: 42 body characters vs the 43 the scanner rule and observed samples agree on", "length", "env");
    c.twin(T, "export", "long-body", exportLine(refuse(`${k.export}${synthetic(seed(T, "extra"), 1, ALNUM)}`)), "length: 44 body characters vs the 43 the scanner rule and observed samples agree on", "length", "sh");
    c.twin(T, "curl-bearer", "uppercase-prefix", curl(refuse(`TGP_v1_${body(k.curl)}`)), "prefix: the tgp_ stem upper-cased", "prefix", "sh");
    c.twin(T, "python-together", "hyphen-delimiters", python(refuse(`tgp-v1-${body(k.python)}`)), "boundary: hyphens in place of the underscores in tgp_v1_", "boundary", "py");
    c.twin(T, "json-config", "dot-in-body", json(refuse(at(k.json, 30, "."))), "alphabet: one body character replaced by ., outside [A-Za-z0-9_-]", "alphabet", "json");
    c.twin(T, "python-environ", "embedded-leading", environ(refuse(`x${k.environ}`)), "boundary: one identifier character before tgp_v1_, so the key is embedded in a longer token", "boundary", "py");
    // Research #783 lists a non-alphabet character in the body as one twin; + and / are the two Base64 characters outside base64url.
    c.twin(T, "tool-call", "plus-in-body", tool(refuse(at(k.tool, 25, "+"))), "alphabet: one body character replaced by +, a standard-Base64 character outside [A-Za-z0-9_-]", "alphabet", "json");
    c.twin(T, "router-log", "slash-in-body", log(refuse(at(k.log, 32, "/"))), "alphabet: one body character replaced by /, a standard-Base64 character outside [A-Za-z0-9_-]", "alphabet", "log");

    c.control(T, "placeholder", "your-key-here", ["TOGETHER_API_KEY=tgp_v1_your_api_key_here\n"], "env");
    c.control(T, "placeholder", "docs-key", ["client = Together(api_key=\"your_api_key\")\n"], "py");
    c.control(T, "reference", "env-reference", ["TOGETHER_API_KEY=${TOGETHER_API_KEY}\n"], "env");
    c.control(T, "reference", "actions-secret", ["      TOGETHER_API_KEY: ${{ secrets.TOGETHER_API_KEY }}\n"], "yml");
    c.control(T, "prose", "prefix-guidance", ["Project API keys start with tgp_v1_ and are shown once when you create them; keep them out of source control.\n"], "md");
    c.control(T, "public-id", "base-url-and-model", ["TOGETHER_BASE_URL=https://api.together.xyz/v1\nmodel = \"meta-llama/Llama-3.3-70B-Instruct-Turbo\"\n"], "env");
    c.control(T, "public-id", "masked-display", [`console.log("using key " + key.slice(0, 7) + "..." + "${synthetic(seed(T, "mask"), 4, ALNUM)}");\n# prints: tgp_v1_...${synthetic(seed(T, "mask"), 4, ALNUM)}\n`], "js");
    c.control(T, "near-miss", "prefix-only", ["Authorization: Bearer tgp_v1_\n"], "txt");
    c.control(T, "near-miss", "short-body", [`2026-09-26T10:22:01Z llm-router: rejected truncated token tgp_v1_${synthetic(seed(T, "short"), 26, URLSAFE)} from client\n`], "log");
    c.control(T, "encoded-value", "hex-digest", [`sha256: ${digest(T)}\n`], "txt");
    // Research #783 benign axes: docs text saying "tgp_v1_...", Together response object ids, a prefix-less base64url run.
    c.control(T, "placeholder", "docs-ellipsis", ["Use your project key: TOGETHER_API_KEY=tgp_v1_...\n"], "md");
    c.control(T, "public-id", "response-object-id", [`{"id": "${synthetic(seed(T, "response-id"), 12, ALNUM)}-${synthetic(seed(T, "response-id-tail"), 3, "abcdefghijklmnopqrstuvwxyz")}", "object": "chat.completion", "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo"}\n`], "json");
    c.control(T, "near-miss", "unprefixed-run", [`build_id: ${synthetic(seed(T, "unprefixed"), 43, URLSAFE)}\n`], "yml");
    c.control(T, "encoded-value", "base64url-blob", [`etag: ${synthetic(seed(T, "etag"), 48, URLSAFE)}\n`], "txt");
  }

  // ------------------------------------------------------------------ tavily-api-key
  {
    const T = "tavily-api-key";
    const { check, refuse } = guard(T);
    const key = (slug, dev = true) => check(`tvly-${dev ? "dev-" : ""}${synthetic(seed(T, slug), 32, ALNUM)}`);
    const k = { dotenv: key("dotenv"), export: key("export", false), curl: key("curl"), python: key("python"), js: key("js", false), json: key("json"), mcpUrl: key("mcp-url"), mcpEnv: key("mcp-env", false), tool: key("tool"), langchain: key("langchain", false), yaml: key("yaml"), actions: key("actions", false), compose: key("compose"), log: key("log", false), cli: key("cli") };

    const dotenv = v => ["# .env\nTAVILY_API_KEY=", v, "\nTAVILY_PROJECT=research-agent\n"];
    const exportLine = v => ["export TAVILY_API_KEY=\"", v, "\"\n"];
    const curl = v => ["curl -s -X POST https://api.tavily.com/search -H \"Authorization: Bearer ", v, "\" -d '{\"query\": \"open source ocr\"}'\n"];
    const python = v => ["from tavily import TavilyClient\n\nclient = TavilyClient(api_key=\"", v, "\")\n"];
    const js = v => ["import { tavily } from '@tavily/core';\n\nconst client = tavily({ apiKey: '", v, "' });\n"];
    const json = v => ["{\n  \"api_key\": \"", v, "\",\n  \"query\": \"latest release notes\",\n  \"search_depth\": \"basic\"\n}\n"];
    const mcpUrl = v => ["{\n  \"mcpServers\": {\n    \"tavily-remote-mcp\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"mcp-remote\", \"https://mcp.tavily.com/mcp/?tavilyApiKey=", v, "\"]\n    }\n  }\n}\n"];
    const mcpEnv = v => ["{\n  \"mcpServers\": {\n    \"tavily\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"tavily-mcp\"],\n      \"env\": { \"TAVILY_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
    const tool = v => ["{\"tool\": \"bash\", \"arguments\": {\"command\": \"curl -s https://api.tavily.com/extract -H 'Authorization: Bearer ", v, "'\"}}\n"];

    c.positive(T, "env", "dotenv-dev", dotenv({ secret: k.dotenv }), "env");
    c.positive(T, "shell-export", "export-bare", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-bearer", curl({ secret: k.curl }), "sh");
    c.positive(T, "sdk-config", "python-client", python({ secret: k.python }), "py");
    c.positive(T, "source-code", "js-client", js({ secret: k.js }), "ts");
    c.positive(T, "structured-file", "json-body", json({ secret: k.json }), "json");
    c.positive(T, "url", "remote-mcp-query", mcpUrl({ secret: k.mcpUrl }), "json");
    c.positive(T, "container-config", "mcp-client-env", mcpEnv({ secret: k.mcpEnv }), "json");
    c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
    // Research #786 positive contexts include YAML, CI and container env, a log line and the tvly CLI flag; each keeps a distinct authored context and has no twin.
    c.positive(T, "structured-file", "yaml-config", ["search:\n  provider: tavily\n  api_key: ", { secret: k.yaml }, "\n  max_results: 5\n"], "yml");
    c.positive(T, "ci-config", "actions-env", ["jobs:\n  research:\n    runs-on: ubuntu-latest\n    env:\n      TAVILY_API_KEY: ", { secret: k.actions }, "\n    steps:\n      - run: python research.py\n"], "yml");
    c.positive(T, "container-config", "compose-env", ["services:\n  agent:\n    image: registry.example.test/agent:3.0\n    environment:\n      TAVILY_API_KEY: ", { secret: k.compose }, "\n"], "yml");
    c.positive(T, "log", "search-log", ["2026-09-26T10:25:40Z search-agent: calling tavily with key ", { secret: k.log }, " query=\"open source ocr\"\n"], "log");
    c.positive(T, "cli", "cli-flag", ["tvly login --api-key ", { secret: k.cli }, "\n"], "sh");
    // Research #786 positive contexts include the LangChain TavilySearchResults(tavily_api_key=) keyword argument.
    c.positive(T, "sdk-config", "langchain-kwarg", ["from langchain_community.tools.tavily_search import TavilySearchResults\n\ntool = TavilySearchResults(max_results=3, tavily_api_key=\"", { secret: k.langchain }, "\")\n"], "py");

    c.twin(T, "dotenv-dev", "short-body", dotenv(refuse(k.dotenv.slice(0, -1))), "length: 31 body characters vs the 32 the scanner rule and observed samples agree on", "length", "env");
    c.twin(T, "export-bare", "long-body", exportLine(refuse(`${k.export}${synthetic(seed(T, "extra"), 1, ALNUM)}`)), "length: 33 body characters vs the 32 the scanner rule and observed samples agree on", "length", "sh");
    c.twin(T, "curl-bearer", "uppercase-prefix", curl(refuse(`TVLY${k.curl.slice(4)}`)), "prefix: the documented lower-case tvly- spelled TVLY-", "prefix", "sh");
    c.twin(T, "python-client", "underscore-delimiter", python(refuse(`tvly_${k.python.slice(5)}`)), "boundary: tvly_ in place of the tvly- delimiter", "boundary", "py");
    c.twin(T, "json-body", "underscore-in-body", json(refuse(at(k.json, 20, "_"))), "alphabet: one body character replaced by _, outside [A-Za-z0-9]", "alphabet", "json");
    c.twin(T, "js-client", "embedded-leading", js(refuse(`a${k.js}`)), "boundary: one identifier character before tvly-, so the key is embedded in a longer token", "boundary", "ts");
    // Research #786 twins: "-/_ inside body" and "prefix present vs absent".
    c.twin(T, "mcp-client-env", "hyphen-in-body", mcpEnv(refuse(at(k.mcpEnv, 20, "-"))), "alphabet: one body character replaced by -, outside [A-Za-z0-9]", "alphabet", "json");
    c.twin(T, "tool-call", "prefix-absent", tool(refuse(k.tool.replace(/^tvly-(?:dev-)?/, ""))), "prefix: the tvly-dev- stem removed, leaving the 32-character run", "prefix", "json");

    const requestId = uuid(synthetic(seed(T, "request"), 32, HEX));
    c.control(T, "placeholder", "docs-bearer", ["curl -s -X POST https://api.tavily.com/search -H \"Authorization: Bearer tvly-YOUR_API_KEY\"\n"], "sh");
    c.control(T, "placeholder", "dev-ellipsis", ["TAVILY_API_KEY=tvly-dev-...\n"], "env");
    c.control(T, "placeholder", "x-run", [`TAVILY_API_KEY=tvly-dev-${"x".repeat(8)}...\n`], "env");
    c.control(T, "reference", "env-reference", ["TAVILY_API_KEY=${TAVILY_API_KEY}\n"], "env");
    c.control(T, "prose", "cli-and-prefix", ["Install the tvly CLI, then run tvly search \"open source ocr\"; keys start with tvly- and are created at app.tavily.com.\n"], "md");
    c.control(T, "public-id", "key-name", ["{\"name\": \"development-30d-#1\", \"key_type\": \"development\", \"status\": \"active\", \"expires_at\": \"never\"}\n"], "json");
    c.control(T, "public-id", "request-id", [`{"query": "open source ocr", "request_id": "${requestId}", "response_time": 1.2}\n`], "json");
    c.control(T, "near-miss", "prefix-only", ["2026-09-26T10:23:12Z search-agent: key must start with tvly-dev- or tvly-, got an empty value\n"], "log");
    c.control(T, "near-miss", "short-body", [`2026-09-26T10:23:15Z search-agent: rejected truncated token tvly-dev-${synthetic(seed(T, "short"), 8, ALNUM)} from client\n`], "log");
    c.control(T, "encoded-value", "key-digest", [`# audit record\ntavily_api_key_sha256=${digest(T)}\n`], "txt");
    // Research #786 benign axes: `tvly` CLI commands, key names, request ids, documentation placeholders.
    c.control(T, "reference", "cli-login-reference", ["tvly login --api-key \"$TAVILY_API_KEY\"\n"], "sh");
    c.control(T, "public-id", "docs-url", ["See https://docs.tavily.com/documentation/api-reference/introduction for the request format and the api_key body field.\n"], "md");
    c.control(T, "near-miss", "dev-word-run", ["tvly-dev-notes and tvly-dev-changelog are internal wiki pages, not keys.\n"], "md");
    c.control(T, "encoded-value", "base64-etag", [`etag: ${synthetic(seed(T, "etag"), 32, ALNUM)}\n`], "txt");
  }
  return c.fixtures;
}
