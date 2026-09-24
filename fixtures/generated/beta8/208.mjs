import { beta8Corpus } from "./helpers.mjs";

// Issue #208 corpus (category `beta8-208`). See docs/specs/beta8-evidence.md.
//
// Four AI inference arrival families (research #216 xAI, #217 Replicate, #218 Groq,
// #220 OpenRouter). Every credential-shaped value is built here from a public
// `synthetic` seed; nothing is copied from a provider example, a scanner report or an
// issued key. Twins derive from their positive's value by one unconditional edit.
//
// Deliberately not authored (see benchmarks/lib/beta8/208.ts field claims):
//   - management keys (xAI `xai-token-`, OpenRouter `sk-or-mgmt-`) and other providers'
//     keys: real secrets of another family, never benign controls here;
//   - `-`/`_` body bytes for Replicate and xAI, uppercase hex for OpenRouter, a 48-character
//     Groq body and a Groq key without the observed WGdyb3FY segment as a negative: each is
//     contested or unresolved, so no fixture asserts silence on it;
//   - a Base64-encoded Groq key: its family scope is undecided.

const HEX = "0123456789abcdef";
const LOWER = "abcdefghijklmnopqrstuvwxyz0123456789";
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";
const QUOTED = "Quoted assignment: key name and enclosing quotes are not secret, but redacting them with the value is acceptable.";
const bearer = secret => ({ secret, envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } });
const quoted = (key, secret, quote = '"') => ({ secret, envelope: { before: `${key}${quote}`, after: quote, reason: QUOTED } });
const b64 = text => Buffer.from(text, "utf8").toString("base64");

export function build208({ fixture, synthetic }) {
  const c = beta8Corpus(208, { fixture, synthetic });
  const seed = (target, slug, len, chars) => synthetic(`beta8:208:${target}:${slug}`, len, chars);
  const uuid = (target, slug) => {
    const h = seed(target, slug, 32, HEX);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const mid = (value, from, ch) => value.slice(0, from) + ch + value.slice(from + 1);
  const values = new Map();
  const value = (target, slug, make) => { const v = make(); values.set(`${target}-${slug}`, v); return v; };
  const of = (target, slug) => values.get(`${target}-${slug}`);

  // ---------------------------------------------------------------- replicate-api-token
  {
    const t = "replicate-api-token";
    const tok = slug => value(t, slug, () => `r8_${seed(t, slug, 37)}`);

    c.positive(t, "env", "env", ["# Replicate\n", "REPLICATE_API_TOKEN=", { secret: tok("env") }, "\nREPLICATE_API_BASE=https://api.replicate.com/v1\n"], "env");
    c.positive(t, "header", "bearer-header", ["curl -s https://api.replicate.com/v1/account -H \"", bearer(tok("bearer-header")), "\"\n"], "sh");
    c.positive(t, "header", "legacy-token-header", ["GET /v1/predictions HTTP/1.1\nHost: api.replicate.com\n",
      "Authorization: Token ", { secret: tok("legacy-token-header") }, "\nAccept: application/json\n"], "http");
    c.positive(t, "sdk-config", "python-sdk", ["import replicate\n\nclient = replicate.Client(", quoted("api_token=", tok("python-sdk")),
      ")\noutput = client.run(\"acme/lighthouse-diffusion\", input={\"prompt\": \"a lighthouse at dusk\"})\n"], "py");
    c.positive(t, "sdk-config", "go-sdk", ["client, err := replicate.NewClient(replicate.WithToken(\"", { secret: tok("go-sdk") }, "\"))\nif err != nil {\n\treturn err\n}\n"], "go");
    c.positive(t, "structured-file", "mcp-config", ["{\n  \"mcpServers\": {\n    \"replicate\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"replicate-mcp\"],\n      \"env\": { ",
      "\"REPLICATE_API_TOKEN\": \"", { secret: tok("mcp-config") }, "\" }\n    }\n  }\n}\n"], "json");
    c.positive(t, "ci-config", "actions-literal", ["jobs:\n  predict:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: replicate/setup-replicate@v1\n        with:\n          token: ",
      { secret: tok("actions-literal") }, "\n      - run: cog predict -i prompt=\"a lighthouse\"\n"], "yml");
    c.positive(t, "prose", "chat-paste", ["The prediction keeps failing with a 401. I'm calling it with ", { secret: tok("chat-paste") },
      " as the token - did I copy it wrong from the account page?\n"], "md");
    c.positive(t, "tool-output", "printenv", ["$ printenv | grep -i replicate\nREPLICATE_API_TOKEN=", { secret: tok("printenv") }, "\nREPLICATE_POLL_INTERVAL=2\n"], "txt");

    c.twin(t, "env", "env-short-body", ["# Replicate\n", "REPLICATE_API_TOKEN=", of(t, "env").slice(0, -1), "\nREPLICATE_API_BASE=https://api.replicate.com/v1\n"],
      "length: 39-character token (36-character body) vs the documented 40-character total", "length", "env");
    c.twin(t, "bearer-header", "bearer-long-body", ["curl -s https://api.replicate.com/v1/account -H \"Authorization: Bearer ", of(t, "bearer-header") + seed(t, "bearer-long-body", 1), "\"\n"],
      "length: 41-character token (38-character body) vs the documented 40-character total", "length", "sh");
    c.twin(t, "python-sdk", "python-dot-body", ["import replicate\n\nclient = replicate.Client(api_token=\"", mid(of(t, "python-sdk"), 20, "."),
      "\")\noutput = client.run(\"acme/lighthouse-diffusion\", input={\"prompt\": \"a lighthouse at dusk\"})\n"],
      "alphabet: one body character replaced by '.', a non-word byte no source admits (only '-' and '_' are contested)", "alphabet", "py");
    c.twin(t, "mcp-config", "mcp-hyphen-prefix", ["{\n  \"mcpServers\": {\n    \"replicate\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"replicate-mcp\"],\n      \"env\": { \"REPLICATE_API_TOKEN\": \"",
      "r8-" + of(t, "mcp-config").slice(3), "\" }\n    }\n  }\n}\n"], "prefix: r8- instead of the documented r8_ separator", "prefix", "json");
    c.twin(t, "go-sdk", "go-uppercase-prefix", ["client, err := replicate.NewClient(replicate.WithToken(\"", "R8_" + of(t, "go-sdk").slice(3), "\"))\nif err != nil {\n\treturn err\n}\n"],
      "prefix: R8_ instead of the documented lowercase r8_", "prefix", "go");
    c.twin(t, "printenv", "printenv-glued", ["$ printenv | grep -i replicate\nREPLICATE_API_TOKEN=", "k" + of(t, "printenv"), "\nREPLICATE_POLL_INTERVAL=2\n"],
      "boundary: an identifier character glued before r8_, so the value is not a delimited token", "boundary", "txt");

    const versionHash = seed(t, "version-hash", 64, HEX);
    c.control(t, "placeholder", "masked-docs", ["curl -s -X POST https://api.replicate.com/v1/predictions -H \"Authorization: Bearer r8_Kq", "*".repeat(35),
      "\" \\\n  -H \"Content-Type: application/json\"\n"], "sh");
    c.control(t, "placeholder", "env-template", ["# copy to .env and fill in\nREPLICATE_API_TOKEN=r8_your_token_here\n"], "env");
    c.control(t, "reference", "actions-secret", ["      - uses: replicate/setup-replicate@v1\n        with:\n          token: ${{ secrets.REPLICATE_API_TOKEN }}\n"], "yml");
    c.control(t, "public-id", "registry-image", ["$ cog push r8.im/acme/lighthouse-diffusion\nimage: r8.im/acme/lighthouse-diffusion@sha256:", seed(t, "registry-digest", 64, HEX), "\n"], "txt");
    c.control(t, "public-id", "model-version", ["output = replicate.run(\n    \"acme/lighthouse-diffusion:", versionHash, "\",\n    input={\"prompt\": \"a lighthouse at dusk\"},\n)\n"], "py");
    c.control(t, "near-miss", "identifier", ["r8_registry_host = \"r8.im\"\nr8_timeout_seconds = 30\nr8_max_retries = 3\n"], "py");
    c.control(t, "near-miss", "truncated", ["2026-09-24T10:12:03Z WARN replicate: token r8_4fT rejected (first 6 characters shown)\n"], "log");
    c.control(t, "encoded-value", "base64-input", ["{\"version\": \"", versionHash, "\", \"input\": {\"prompt_file\": \"data:text/plain;base64,",
      b64("a lighthouse at dusk, oil painting, warm light"), "\"}}\n"], "json");
    c.control(t, "prose", "docs", ["Replicate API tokens are 40-character strings that start with r8_. Create one on the account page and export it as REPLICATE_API_TOKEN; never commit it to a repository.\n"], "md");
  }

  // ---------------------------------------------------------------- xai-api-key
  {
    const t = "xai-api-key";
    const key = slug => value(t, slug, () => `xai-${seed(t, slug, 80)}`);

    c.positive(t, "env", "env", ["XAI_API_KEY=", { secret: key("env") }, "\nXAI_BASE_URL=https://api.x.ai/v1\n"], "env");
    c.positive(t, "shell-export", "export", ["export XAI_API_KEY=\"", { secret: key("export") }, "\"\npython grok_chat.py\n"], "sh");
    c.positive(t, "header", "bearer-header", ["curl https://api.x.ai/v1/chat/completions -H \"", bearer(key("bearer-header")),
      "\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"model\": \"grok-2-latest\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}]}'\n"], "sh");
    c.positive(t, "sdk-config", "openai-compatible", ["from openai import OpenAI\n\nclient = OpenAI(\n    ", quoted("api_key=", key("openai-compatible")), ",\n    base_url=\"https://api.x.ai/v1\",\n)\n"], "py");
    c.positive(t, "sdk-config", "vercel-ai", ["import { createXai } from \"@ai-sdk/xai\";\n\nconst xai = createXai({ ", quoted("apiKey: ", key("vercel-ai")), " });\n"], "ts");
    c.positive(t, "structured-file", "litellm-config", ["model_list:\n  - model_name: grok\n    litellm_params:\n      model: xai/grok-2-latest\n      api_key: ", { secret: key("litellm-config") }, "\n"], "yaml");
    c.positive(t, "prose", "chat-paste", ["Grok keeps answering 400. My key is ", { secret: key("chat-paste") }, " and I set the base URL to api.x.ai - what am I missing?\n"], "md");
    c.positive(t, "tool-output", "env-grep", ["$ env | grep XAI\nXAI_API_KEY=", { secret: key("env-grep") }, "\n"], "txt");
    c.positive(t, "log", "http-debug", ["DEBUG httpx: request headers {'host': 'api.x.ai', 'authorization': '", "Bearer ", { secret: key("http-debug") },
      "', 'content-type': 'application/json'}\n"], "log");

    c.twin(t, "env", "env-short-body", ["XAI_API_KEY=", of(t, "env").slice(0, -1), "\nXAI_BASE_URL=https://api.x.ai/v1\n"],
      "length: 79-character body vs the 80 characters the provider example and every tool rule use", "length", "env");
    c.twin(t, "bearer-header", "bearer-long-body", ["curl https://api.x.ai/v1/chat/completions -H \"Authorization: Bearer ", of(t, "bearer-header") + seed(t, "bearer-long-body", 1),
      "\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"model\": \"grok-2-latest\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}]}'\n"],
      "length: 81-character body vs the 80-character example length", "length", "sh");
    c.twin(t, "openai-compatible", "openai-dot-body", ["from openai import OpenAI\n\nclient = OpenAI(\n    api_key=\"", mid(of(t, "openai-compatible"), 44, "."), "\",\n    base_url=\"https://api.x.ai/v1\",\n)\n"],
      "alphabet: one body character replaced by '.', a non-word byte no source admits (only '_' and '-' are contested)", "alphabet", "py");
    c.twin(t, "vercel-ai", "vercel-underscore-prefix", ["import { createXai } from \"@ai-sdk/xai\";\n\nconst xai = createXai({ apiKey: \"", "xai_" + of(t, "vercel-ai").slice(4), "\" });\n"],
      "prefix: xai_ instead of the documented xai- separator", "prefix", "ts");
    c.twin(t, "env-grep", "env-grep-glued", ["$ env | grep XAI\nXAI_API_KEY=", "k" + of(t, "env-grep"), "\n"],
      "boundary: an identifier character glued before xai-, so the value is not a delimited key", "boundary", "txt");
    c.twin(t, "litellm-config", "litellm-half-body", ["model_list:\n  - model_name: grok\n    litellm_params:\n      model: xai/grok-2-latest\n      api_key: ", of(t, "litellm-config").slice(0, 4 + 41), "\n"],
      "length: 41-character body, about half the 80-character example length", "length", "yaml");

    c.control(t, "placeholder", "env-template", ["# .env.example\nXAI_API_KEY=xai-your-key-here\n"], "env");
    c.control(t, "placeholder", "redacted-api", ["{\n  \"name\": \"ci-runner\",\n  \"redactedApiKey\": \"xai-...Wq7d\",\n  \"disabled\": false\n}\n"], "json");
    c.control(t, "placeholder", "masked-error", ["openai.AuthenticationError: Error code: 400 - Incorrect API key provided: xai-AbCd", "*".repeat(72), "WxYz\n"], "log");
    c.control(t, "public-id", "key-metadata", ["{\n  \"apiKeyId\": \"", uuid(t, "api-key-id"), "\",\n  \"teamId\": \"", uuid(t, "team-id"),
      "\",\n  \"acls\": [\"api-key:endpoint:chat\", \"api-key:model:*\"]\n}\n"], "json");
    c.control(t, "public-id", "packages-and-models", ["pip install xai-sdk langchain-xai\n# https://github.com/xai-org/xai-sdk-python\nmodel = \"xai/grok-2-latest\"\nbase_url = \"https://api.x.ai/v1\"\n"], "sh");
    c.control(t, "reference", "env-lookup", ["import os\nfrom openai import OpenAI\n\nclient = OpenAI(api_key=os.environ[\"XAI_API_KEY\"], base_url=\"https://api.x.ai/v1\")\n"], "py");
    c.control(t, "near-miss", "prefix-check", ["if not api_key.startswith(\"xai-\"):\n    raise ValueError(\"expected an xai- API key\")\n"], "py");
    c.control(t, "encoded-value", "base64-config", ["XAI_CLIENT_CONFIG=", b64(JSON.stringify({ model: "grok-2-latest", base_url: "https://api.x.ai/v1", temperature: 0.2 })), "\n"], "env");
    c.control(t, "prose", "docs", ["xAI API keys start with xai- and are created on the API Keys page of the xAI console. Keep them in XAI_API_KEY; the console shows only the last four characters after creation.\n"], "md");
  }

  // ---------------------------------------------------------------- groq-api-key
  {
    const t = "groq-api-key";
    const key = slug => value(t, slug, () => `gsk_${seed(t, slug, 52)}`);

    c.positive(t, "env", "env", ["GROQ_API_KEY=", { secret: key("env") }, "\nGROQ_BASE_URL=https://api.groq.com\n"], "env");
    c.positive(t, "shell-export", "export", ["export GROQ_API_KEY=", { secret: key("export") }, "\npython transcribe.py\n"], "sh");
    c.positive(t, "header", "bearer-header", ["curl https://api.groq.com/openai/v1/chat/completions -H \"", bearer(key("bearer-header")),
      "\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"model\": \"llama-3.3-70b-versatile\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}]}'\n"], "sh");
    c.positive(t, "sdk-config", "python-sdk", ["from groq import Groq\n\nclient = Groq(", quoted("api_key=", key("python-sdk")), ")\n"], "py");
    c.positive(t, "sdk-config", "openai-compatible", ["import OpenAI from \"openai\";\n\nconst client = new OpenAI({\n  ", quoted("apiKey: ", key("openai-compatible")),
      ",\n  baseURL: \"https://api.groq.com/openai/v1\",\n});\n"], "ts");
    c.positive(t, "structured-file", "settings-json", ["{\n  \"provider\": \"groq\",\n  ", "\"groqApiKey\": \"", { secret: key("settings-json") }, "\",\n  \"model\": \"llama-3.3-70b-versatile\"\n}\n"], "json");
    c.positive(t, "source-code", "space-app", ["import os\nimport gradio as gr\n\nos.environ[\"GROQ_API_KEY\"] = \"", { secret: key("space-app") }, "\"\n"], "py");
    c.positive(t, "prose", "chat-paste", ["Groq returns 401 on every call. This is the key I generated: ", { secret: key("chat-paste") }, " - is it the wrong project?\n"], "md");
    c.positive(t, "tool-output", "printenv", ["$ printenv | grep GROQ\nGROQ_API_KEY=", { secret: key("printenv") }, "\n"], "txt");

    c.twin(t, "env", "env-short-body", ["GROQ_API_KEY=", of(t, "env").slice(0, -1), "\nGROQ_BASE_URL=https://api.groq.com\n"],
      "length: 51-character body vs the tool-corroborated 52", "length", "env");
    c.twin(t, "bearer-header", "bearer-long-body", ["curl https://api.groq.com/openai/v1/chat/completions -H \"Authorization: Bearer ", of(t, "bearer-header") + seed(t, "bearer-long-body", 1),
      "\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"model\": \"llama-3.3-70b-versatile\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}]}'\n"],
      "length: 53-character body vs the tool-corroborated 52", "length", "sh");
    c.twin(t, "python-sdk", "python-dash-body", ["from groq import Groq\n\nclient = Groq(api_key=\"", mid(of(t, "python-sdk"), 30, "-"), "\")\n"],
      "alphabet: one body character replaced by '-', outside the alphanumeric body every source reports", "alphabet", "py");
    c.twin(t, "settings-json", "settings-hyphen-prefix", ["{\n  \"provider\": \"groq\",\n  \"groqApiKey\": \"", "gsk-" + of(t, "settings-json").slice(4), "\",\n  \"model\": \"llama-3.3-70b-versatile\"\n}\n"],
      "prefix: gsk- instead of the gsk_ separator", "prefix", "json");
    c.twin(t, "space-app", "space-no-separator", ["import os\nimport gradio as gr\n\nos.environ[\"GROQ_API_KEY\"] = \"", "gsk" + of(t, "space-app").slice(4), "\"\n"],
      "prefix: gsk with no separator instead of gsk_", "prefix", "py");
    c.twin(t, "printenv", "printenv-glued", ["$ printenv | grep GROQ\nGROQ_API_KEY=", "x" + of(t, "printenv"), "\n"],
      "boundary: an identifier character glued before gsk_ (xgsk_), so the value is not a delimited key", "boundary", "txt");

    c.control(t, "placeholder", "env-template", ["# .env.example\nGROQ_API_KEY=gsk_your_key_here\n"], "env");
    c.control(t, "placeholder", "masked-console", ["Key name: laptop-dev    Secret: gsk_", "*".repeat(48), "Tn4q    Created: 2026-09-01\n"], "txt");
    c.control(t, "public-id", "response-ids", ["{\n  \"id\": \"chatcmpl-", uuid(t, "completion-id"), "\",\n  \"object\": \"chat.completion\",\n  \"model\": \"llama-3.3-70b-versatile\",\n  \"x_groq\": { \"id\": \"req_",
      seed(t, "request-id", 26, LOWER), "\" }\n}\n"], "json");
    c.control(t, "public-id", "models-and-endpoint", ["GROQ_BASE_URL=https://api.groq.com\nGROQ_CHAT_MODEL=llama-3.3-70b-versatile\nGROQ_STT_MODEL=whisper-large-v3\n"], "env");
    c.control(t, "reference", "env-lookup", ["import os\nfrom groq import Groq\n\nclient = Groq(api_key=os.environ.get(\"GROQ_API_KEY\"))\n"], "py");
    c.control(t, "near-miss", "identifier", ["gsk_ticker = \"GSK\"\ngsk_holdings = portfolio.get(gsk_ticker, 0)\n"], "py");
    c.control(t, "near-miss", "truncated", ["2026-09-24 08:41:17 ERROR groq: 401 for key gsk_", seed(t, "truncated", 20), "... (truncated)\n"], "log");
    c.control(t, "encoded-value", "base64-config", ["GROQ_CLIENT_CONFIG=", b64(JSON.stringify({ model: "llama-3.3-70b-versatile", base_url: "https://api.groq.com/openai/v1", max_tokens: 512 })), "\n"], "env");
    c.control(t, "prose", "docs", ["Groq (not Grok) API keys start with gsk_ and are created per project in the GroqCloud console. Read the key from GROQ_API_KEY rather than pasting it into notebooks.\n"], "md");
  }

  // ---------------------------------------------------------------- openrouter-api-key
  {
    const t = "openrouter-api-key";
    const key = slug => value(t, slug, () => `sk-or-v1-${seed(t, slug, 64, HEX)}`);

    c.positive(t, "env", "env", ["OPENROUTER_API_KEY=", { secret: key("env") }, "\nOPENROUTER_BASE_URL=https://openrouter.ai/api/v1\n"], "env");
    c.positive(t, "shell-export", "export", ["export OPENROUTER_API_KEY=\"", { secret: key("export") }, "\"\nnpm run agent\n"], "sh");
    c.positive(t, "header", "bearer-header", ["curl https://openrouter.ai/api/v1/chat/completions -H \"", bearer(key("bearer-header")),
      "\" \\\n  -H \"HTTP-Referer: https://example.test\" \\\n  -d '{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}]}'\n"], "sh");
    c.positive(t, "sdk-config", "openai-compatible", ["from openai import OpenAI\n\nclient = OpenAI(\n    base_url=\"https://openrouter.ai/api/v1\",\n    ", quoted("api_key=", key("openai-compatible")), ",\n)\n"], "py");
    c.positive(t, "sdk-config", "openrouter-sdk", ["import { OpenRouter } from \"@openrouter/sdk\";\n\nconst openrouter = new OpenRouter({ ", quoted("apiKey: ", key("openrouter-sdk")), " });\n"], "ts");
    c.positive(t, "structured-file", "create-key-response", ["{\n  \"data\": {\n    \"label\": \"sk-or-v1-3c9...b07\",\n    \"limit\": 10,\n    \"disabled\": false\n  },\n  ",
      "\"key\": \"", { secret: key("create-key-response") }, "\"\n}\n"], "json");
    c.positive(t, "container-config", "compose", ["services:\n  agent:\n    image: ghcr.io/acme/agent:1.4\n    environment:\n      - OPENROUTER_API_KEY=", { secret: key("compose") }, "\n"], "yml");
    c.positive(t, "prose", "chat-paste", ["OpenRouter says \"No auth credentials found\" but I'm passing ", { secret: key("chat-paste") }, " in the header. Any idea?\n"], "md");
    c.positive(t, "tool-output", "printenv", ["$ printenv | grep OPENROUTER\nOPENROUTER_API_KEY=", { secret: key("printenv") }, "\n"], "txt");

    c.twin(t, "env", "env-short-body", ["OPENROUTER_API_KEY=", of(t, "env").slice(0, -1), "\nOPENROUTER_BASE_URL=https://openrouter.ai/api/v1\n"],
      "length: 63 hex characters vs the documented 64", "length", "env");
    c.twin(t, "bearer-header", "bearer-long-body", ["curl https://openrouter.ai/api/v1/chat/completions -H \"Authorization: Bearer ", of(t, "bearer-header") + seed(t, "bearer-long-body", 1, HEX),
      "\" \\\n  -H \"HTTP-Referer: https://example.test\" \\\n  -d '{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}]}'\n"],
      "length: 65 hex characters vs the documented 64", "length", "sh");
    c.twin(t, "openai-compatible", "openai-non-hex-body", ["from openai import OpenAI\n\nclient = OpenAI(\n    base_url=\"https://openrouter.ai/api/v1\",\n    api_key=\"", mid(of(t, "openai-compatible"), 40, "z"), "\",\n)\n"],
      "alphabet: one body character replaced by 'z', outside the documented lowercase hexadecimal body", "alphabet", "py");
    c.twin(t, "openrouter-sdk", "sdk-wrong-prefix", ["import { OpenRouter } from \"@openrouter/sdk\";\n\nconst openrouter = new OpenRouter({ apiKey: \"", "sk-v1-" + of(t, "openrouter-sdk").slice(9), "\" });\n"],
      "prefix: sk-v1- instead of the documented sk-or-v1-", "prefix", "ts");
    c.twin(t, "printenv", "printenv-glued", ["$ printenv | grep OPENROUTER\nOPENROUTER_API_KEY=", "x" + of(t, "printenv"), "\n"],
      "boundary: an identifier character glued before sk-or-v1-, so the value is not a delimited key", "boundary", "txt");
    c.twin(t, "compose", "compose-half-body", ["services:\n  agent:\n    image: ghcr.io/acme/agent:1.4\n    environment:\n      - OPENROUTER_API_KEY=", of(t, "compose").slice(0, 9 + 32), "\n"],
      "length: 32 hex characters, half the documented 64", "length", "yml");

    const keyHash = seed(t, "key-hash", 64, HEX);
    c.control(t, "placeholder", "env-template", ["# .env.example\nOPENROUTER_API_KEY=sk-or-v1-your-key-here\n"], "env");
    c.control(t, "placeholder", "masked-label", ["{\n  \"data\": {\n    \"label\": \"sk-or-v1-9c2...e41\",\n    \"usage\": 0.42,\n    \"is_free_tier\": false,\n    \"is_management_key\": false\n  }\n}\n"], "json");
    c.control(t, "placeholder", "guardrail-marker", ["user: my key is [SECRET:openrouter-api-key], can you check the quota?\nassistant: I can't see keys; check the Keys page in your OpenRouter settings.\n"], "txt");
    c.control(t, "public-id", "key-hash", ["# key hashes are public identifiers used in /api/v1/keys/{hash}\n{\"hash\": \"", keyHash, "\", \"name\": \"ci\", \"disabled\": true}\nGET https://openrouter.ai/api/v1/keys/", keyHash, "\n"], "txt");
    c.control(t, "public-id", "user-and-models", ["{\n  \"user_id\": \"user_", seed(t, "user-id", 27), "\",\n  \"workspace_id\": \"", uuid(t, "workspace-id"),
      "\",\n  \"models\": [\"openai/gpt-4o\", \"anthropic/claude-3.5-sonnet\", \"meta-llama/llama-3.3-70b-instruct\"]\n}\n"], "json");
    c.control(t, "reference", "env-lookup", ["import os\nfrom openai import OpenAI\n\nclient = OpenAI(base_url=\"https://openrouter.ai/api/v1\", api_key=os.getenv(\"OPENROUTER_API_KEY\"))\n"], "py");
    c.control(t, "near-miss", "prefix-check", ["def looks_like_openrouter(key: str) -> bool:\n    return key.startswith(\"sk-or-v1-\")\n"], "py");
    c.control(t, "encoded-value", "base64-config", ["OPENROUTER_CLIENT_CONFIG=", b64(JSON.stringify({ model: "openai/gpt-4o", base_url: "https://openrouter.ai/api/v1", route: "fallback" })), "\n"], "env");
    c.control(t, "prose", "docs", ["OpenRouter inference keys start with sk-or-v1- and are shown once when created. Store the key in OPENROUTER_API_KEY and send it as a Bearer token.\n"], "md");
  }

  return c.fixtures;
}
