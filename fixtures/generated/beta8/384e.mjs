import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #384, slice e (category `beta8-384e`). See docs/specs/beta8-evidence.md.
//
// Beta.10 corpus for five keyword-gated providers with no documented key format (research
// redact-secret#781 Mistral, #782 Cohere, #784 AI21, #787 Exa, #789 Deepgram; product
// redact-secret#868). Every family is context-gated: a value is a positive only beside a
// same-line provider name, host or SDK constructor, and each positive has a context twin that
// keeps the value byte-for-byte and removes that gate (an identifier-named sibling such as
// MISTRAL_KEY_ID, an unrelated constructor, or another host). Every credential-shaped value is
// built here from a public `synthetic` seed; nothing is copied from a provider example, a
// scanner test vector, a code-search sample or an issued key. Exa's UUID-shaped value is a
// carrier for the gate, not a format claim (benchmarks/lib/beta8/384e.ts).
//
// Deliberately not authored (see the field claims in 384e.ts):
//   - a bare-value positive for any family: a bare 32- or 40-character run cannot be told from a
//     hash, a request id or another provider's key;
//   - an alphabet or case twin for Deepgram (hex versus base36 is disputed between the tools),
//     and an uppercase Mistral twin (the rules agree only once case is folded);
//   - a co- Cohere twin, an rt_ Mistral realtime token, a Codestral key, a 32-hex Deepgram key and
//     an api_key_id of the same shape as a benign control (it appears only as a context twin);
//   - a hash or request id placed beside the provider keyword as a control: the contract admits
//     any value of the right shape beside the gate, so silence there would be asserted, not
//     evidenced.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HEX = "0123456789abcdef";
const b64 = text => Buffer.from(text, "utf8").toString("base64");

export function build384e({ fixture, synthetic }) {
  const c = beta8Corpus("384e", { fixture, synthetic });
  const seed = (target, slug) => `beta10:384e:${target}:${slug}`;
  const uuid = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;

  /**
   * One context: the positive is `pre + secret + post`; its twin is `twin.pre + value + twin.post`,
   * the same value with exactly one property of the gate changed.
   */
  const ctx = (axis, slug, ext, pre, post, twin) => ({ axis, slug, ext, pre, post, twin });

  /** The twelve shared contexts, parametrised by the provider's own names. */
  const shared = cfg => ({
    dotenv: ctx("env", "dotenv", "env", `# .env\n${cfg.env}=`, "\n", { slug: "id-named-env", pre: `# .env\n${cfg.idEnv}=`, post: "\n", mutation: `context: ${cfg.env} renamed ${cfg.idEnv}, an identifier name; the value is kept byte-for-byte` }),
    dotenvAlt: ctx("env", "dotenv-alt", "env", `${cfg.envAlt}=`, "\n", { slug: "id-named-env-alt", pre: `${cfg.idEnvAlt}=`, post: "\n", mutation: `context: ${cfg.envAlt} renamed ${cfg.idEnvAlt}, an identifier name; the value is kept byte-for-byte` }),
    export: ctx("shell-export", "export", "sh", `export ${cfg.env}="`, "\"\n", { slug: "id-named-export", pre: `export ${cfg.idEnv}="`, post: "\"\n", mutation: `context: ${cfg.env} renamed ${cfg.idEnv}, an identifier name; the value is kept byte-for-byte` }),
    compose: ctx("container-config", "compose-env", "yml", `services:\n  app:\n    image: registry.example.test/app:3.1\n    environment:\n      ${cfg.env}: `, "\n", { slug: "id-named-compose", pre: `services:\n  app:\n    image: registry.example.test/app:3.1\n    environment:\n      ${cfg.idEnv}: `, post: "\n", mutation: `context: ${cfg.env} renamed ${cfg.idEnv}, an identifier name; the value is kept byte-for-byte` }),
    ctor: ctx("sdk-config", "python-ctor", "py", `${cfg.import}\n\nclient = ${cfg.ctor}(${cfg.kw}="`, "\")\n", { slug: "unrelated-python-ctor", pre: `${cfg.import}\n\nclient = Widget(${cfg.kw}="`, post: "\")\n", mutation: `context: the ${cfg.ctor} constructor replaced by an unrelated Widget constructor; the value is kept byte-for-byte` }),
    langchain: ctx("sdk-config", "langchain-kwarg", "py", `llm = ${cfg.lcClass}(model="${cfg.model}", ${cfg.lcKw}="`, "\")\n", { slug: "id-named-kwarg", pre: `llm = ${cfg.lcClass}(model="${cfg.model}", ${cfg.lcTwinKw}="`, post: "\")\n", mutation: `context: the ${cfg.lcKw} argument renamed ${cfg.lcTwinKw}, an identifier name; the value is kept byte-for-byte` }),
    js: ctx("source-code", "ts-ctor", "ts", `const client = new ${cfg.jsCtor}({ ${cfg.jsKw}: "`, "\" });\n", { slug: "unrelated-ts-ctor", pre: `const client = new Widget({ ${cfg.jsKw}: "`, post: "\" });\n", mutation: `context: the ${cfg.jsCtor} constructor replaced by an unrelated Widget constructor; the value is kept byte-for-byte` }),
    curl: ctx("header", "curl-header", "sh", `curl -s https://${cfg.host}/v1/models -H "Authorization: ${cfg.scheme} `, "\"\n", { slug: "other-host-curl", pre: `curl -s https://api.example.invalid/v1/models -H "Authorization: ${cfg.scheme} `, post: "\"\n", mutation: `context: the ${cfg.host} host replaced by api.example.invalid, so no ${cfg.name} name remains on the line; the value is kept byte-for-byte` }),
    yaml: ctx("structured-file", "litellm-yaml", "yml", `model_list:\n  - model_name: ${cfg.model}\n    litellm_params:\n      model: ${cfg.litellmModel}\n      api_key: `, "\n", { slug: "other-provider-model", pre: "model_list:\n  - model_name: fast-chat\n    litellm_params:\n      model: example/fast-chat-small\n      api_key: ", post: "\n", mutation: `context: the ${cfg.name} model name replaced by an unrelated one, so no ${cfg.name} name remains in the block; the value is kept byte-for-byte` }),
    json: ctx("structured-file", "json-config", "json", `{\n  "${cfg.camel}": "`, "\",\n  \"region\": \"us\"\n}\n", { slug: "id-named-json", pre: `{\n  "${cfg.camelTwin}": "`, post: "\",\n  \"region\": \"us\"\n}\n", mutation: `context: the ${cfg.camel} field renamed ${cfg.camelTwin}, an identifier name; the value is kept byte-for-byte` }),
    tool: ctx("tool-output", "tool-call", "json", `{"tool": "bash", "arguments": {"command": "export ${cfg.env}=`, " && ./run-eval.sh\"}}\n", { slug: "id-named-tool-call", pre: `{"tool": "bash", "arguments": {"command": "export ${cfg.idEnv}=`, post: " && ./run-eval.sh\"}}\n", mutation: `context: ${cfg.env} renamed ${cfg.idEnv}, an identifier name; the value is kept byte-for-byte` }),
    log: ctx("log", "proxy-log", "log", `2026-09-26T10:31:07Z gateway upstream=${cfg.host} key=`, " status=200\n", { slug: "other-host-log", pre: "2026-09-26T10:31:07Z gateway upstream=api.example.invalid key=", post: " status=200\n", mutation: `context: the ${cfg.host} upstream replaced by api.example.invalid, so no ${cfg.name} name remains on the line; the value is kept byte-for-byte` }),
  });

  /** Positives, their context twins and the two structural (length) twins of one gated family. */
  const family = (cfg, contexts, { structural = true } = {}) => {
    const T = cfg.T;
    const pattern = contracts[T].pattern ? new RegExp(contracts[T].pattern) : null;
    const values = new Map();
    for (const x of contexts) {
      const value = cfg.value(seed(T, x.slug));
      if (pattern && !pattern.test(value)) throw new Error(`beta8-384e: authored ${T} value fails its own contract`);
      values.set(x.slug, value);
      c.positive(T, x.axis, x.slug, [x.pre, { secret: value }, x.post], x.ext);
    }
    for (const x of contexts) {
      const value = values.get(x.slug);
      c.twin(T, x.slug, x.twin.slug, [x.twin.pre, value, x.twin.post], x.twin.mutation, "context", x.ext);
    }
    if (structural && pattern) {
      const [a, b] = [contexts[0], contexts[2]];
      const shortValue = values.get(a.slug).slice(0, -1);
      const longValue = `${values.get(b.slug)}${synthetic(seed(T, "extra"), 1, cfg.alphabet)}`;
      if (pattern.test(shortValue) || pattern.test(longValue)) throw new Error(`beta8-384e: ${T} length twin still satisfies the contract`);
      c.twin(T, a.slug, "short-value", [a.pre, shortValue, a.post], `length: ${cfg.length - 1} characters vs the ${cfg.length} the scanner rules and observed samples agree on, beside the same gate`, "length", a.ext);
      c.twin(T, b.slug, "long-value", [b.pre, longValue, b.post], `length: ${cfg.length + 1} characters vs the ${cfg.length} the scanner rules and observed samples agree on, beside the same gate`, "length", b.ext);
    }
  };

  /**
   * Unpaired positives (#508): further same-line-gated carriers of the same value, each with no twin, so a
   * family reaches the stable.empirical positive-case floor (counted over positives that are not paired).
   * Every carrier keeps a name the contract already names (env name, host, SDK argument or camel-case field)
   * on the value's own line; no shape, alphabet or case property beyond the frozen contract is asserted.
   */
  const unpaired = (cfg, count) => {
    const T = cfg.T;
    const pattern = contracts[T].pattern ? new RegExp(contracts[T].pattern) : null;
    const all = [
      ["ci-config", "actions-env-literal", "yml", `jobs:\n  eval:\n    runs-on: ubuntu-24.04\n    env:\n      ${cfg.env}: `, "\n    steps:\n      - run: ./run-eval.sh\n"],
      ["container-config", "docker-run-env", "sh", `docker run --rm -e ${cfg.env}=`, " registry.example.test/worker:2.4\n"],
      ["container-config", "k8s-env-value", "yml", `env:\n  - name: ${cfg.env}\n    value: "`, "\"\n"],
      ["cli", "inline-env-command", "sh", `${cfg.env}=`, ` ./run-eval.sh --model ${cfg.model}\n`],
      ["header", "http-request-header", "http", `POST /v1/chat HTTP/1.1\nHost: ${cfg.host}\nAuthorization: ${cfg.scheme} `, "\nContent-Type: application/json\n"],
      ["structured-file", "toml-config-key", "toml", `[client]\n${cfg.lcKw} = "`, "\"\ntimeout = 30\n"],
      ["tool-output", "printenv-output", "txt", `$ env | grep ${cfg.env}\n${cfg.env}=`, "\n"],
      ["log", "auth-failure-log", "log", `2026-09-29T09:12:44Z level=warn msg="upstream auth failed" ${cfg.env}=`, " attempt=2\n"],
      ["source-code", "camel-const", "ts", `export const ${cfg.camel} = "`, "\";\n"],
      ["sdk-config", "python-environ-assign", "py", `import os\n\nos.environ["${cfg.env}"] = "`, "\"\n"],
    ];
    for (const [axis, slug, ext, pre, post] of all.slice(0, count)) {
      const value = cfg.value(seed(T, `unpaired:${slug}`));
      if (pattern && !pattern.test(value)) throw new Error(`beta8-384e: authored ${T} value fails its own contract`);
      c.positive(T, axis, slug, [pre, { secret: value }, post], ext);
    }
  };

  /** Independent benign controls: gate-free values, identifiers, placeholders, references and prose. */
  const controls = (cfg, { count }) => {
    const T = cfg.T;
    const bare = cfg.value(seed(T, "bare-control"));
    const reqHex = synthetic(seed(T, "request-hex"), 32, HEX);
    const all = [
      ["placeholder", "your-key-here", "env", [`${cfg.env}=your_${cfg.name.toLowerCase()}_api_key_here\n`]],
      ["placeholder", "angle-key", "env", [`${cfg.env}=<YOUR_API_KEY>\n`]],
      ["placeholder", "docs-ctor", "py", [`client = ${cfg.ctor}(${cfg.kw}="your-api-key")\n`]],
      ["placeholder", "x-ellipsis", "env", [`${cfg.env}=xxxx...\n`]],
      ["placeholder", "upper-name", "env", [`${cfg.env}=YOUR_${cfg.name.toUpperCase()}_API_KEY\n`]],
      ["reference", "env-reference", "env", [`${cfg.env}=\${${cfg.env}}\n`]],
      ["reference", "python-environ", "py", [`import os\n\nkey = os.environ["${cfg.env}"]\n`]],
      ["reference", "actions-secret", "yml", [`      ${cfg.env}: \${{ secrets.${cfg.env} }}\n`]],
      ["public-id", "request-uuid", "json", [`{"id": "${uuid(synthetic(seed(T, "request-uuid"), 32, HEX))}", "object": "response", "model": "${cfg.model}"}\n`]],
      ["public-id", "request-hex", "txt", [`x-request-id: ${reqHex}\nserver: gateway-3\n`]],
      ["public-id", "project-uuid", "env", [`PROJECT_ID=${uuid(synthetic(seed(T, "project-uuid"), 32, HEX))}\n`]],
      ["public-id", "model-id", "yml", [`model: ${cfg.model}\nmax_tokens: 512\n`]],
      ["public-id", "object-id", "json", [`{"id": "cmpl-${synthetic(seed(T, "object-id"), 24, HEX)}", "finish_reason": "stop"}\n`]],
      ["near-miss", "bare-line", "txt", [`${bare}\n`]],
      ["near-miss", "bare-in-prose", "md", [`The build finished with digest ${bare} and no warnings.\n`]],
      ["near-miss", "unrelated-assignment", "env", [`BUILD_HASH=${bare}\n`]],
      ["near-miss", "embedded-run", "txt", [`trace_id ${synthetic(seed(T, "embedded-a"), 16, ALNUM)}${bare}${synthetic(seed(T, "embedded-b"), 16, ALNUM)}\n`]],
      ["encoded-value", "base64-text", "yml", [`attachment_b64: ${b64(`release notes for build ${synthetic(seed(T, "notes"), 24, ALNUM)}`)}\n`]],
      ["encoded-value", "sha256-digest", "txt", [`sha256: ${synthetic(seed(T, "digest"), 64, HEX)}\n`]],
      ["encoded-value", "data-uri", "md", [`![diagram](data:image/png;base64,${b64(synthetic(seed(T, "png"), 48, ALNUM))})\n`]],
      ["prose", "key-guidance", "md", [`${cfg.name} keys are created in the console, shown once and should be stored in a secrets manager; never commit them to source control.\n`]],
      ["prose", "model-notes", "md", [`We evaluated ${cfg.model} against two baselines and found it faster on short prompts.\n`]],
    ];
    // A smaller family takes a balanced subset: every axis stays represented.
    const order = count >= all.length ? all : [0, 1, 2, 5, 6, 8, 11, 13, 14, 18].map(i => all[i]).slice(0, count);
    for (const [axis, slug, ext, parts] of order) c.control(T, axis, slug, parts, ext);
  };

  // -------------------------------------------------------------------- Mistral
  {
    const cfg = {
      T: "mistral-api-key", name: "Mistral", length: 32, alphabet: ALNUM, value: s => synthetic(s, 32, ALNUM),
      env: "MISTRAL_API_KEY", envAlt: "CODESTRAL_API_KEY", idEnv: "MISTRAL_KEY_ID", idEnvAlt: "CODESTRAL_TRACE_ID", host: "api.mistral.ai", scheme: "Bearer",
      import: "from mistralai import Mistral", ctor: "Mistral", kw: "api_key", lcClass: "ChatMistralAI", lcKw: "mistral_api_key", lcTwinKw: "mistral_run_id", jsCtor: "Mistral", jsKw: "apiKey",
      model: "mistral-large-latest", litellmModel: "mistral/mistral-large-latest", camel: "mistralApiKey", camelTwin: "mistralRequestId",
    };
    const s = shared(cfg);
    family(cfg, [s.dotenv, s.dotenvAlt, s.export, s.compose, s.ctor, s.langchain, s.js, s.curl, s.yaml, s.json, s.tool, s.log]);
    controls(cfg, { count: 22 });
    unpaired(cfg, 10);
  }

  // --------------------------------------------------------------------- Cohere
  {
    const cfg = {
      T: "cohere-api-key", name: "Cohere", length: 40, alphabet: ALNUM, value: s => synthetic(s, 40, ALNUM),
      env: "CO_API_KEY", envAlt: "COHERE_API_KEY", idEnv: "CO_ORG_ID", idEnvAlt: "COHERE_OWNER_ID", host: "api.cohere.com", scheme: "Bearer",
      import: "import cohere", ctor: "cohere.ClientV2", kw: "api_key", lcClass: "ChatCohere", lcKw: "cohere_api_key", lcTwinKw: "cohere_run_id", jsCtor: "CohereClientV2", jsKw: "token",
      model: "command-r-plus", litellmModel: "cohere/command-r-plus", camel: "cohereApiKey", camelTwin: "cohereRequestId",
    };
    const s = shared(cfg);
    family(cfg, [s.dotenv, s.dotenvAlt, s.export, s.compose, s.ctor, s.langchain, s.js, s.curl, s.yaml, s.json, s.tool, s.log]);
    controls(cfg, { count: 22 });
    unpaired(cfg, 7);
  }

  // ------------------------------------------------------------------- Deepgram
  {
    const cfg = {
      T: "deepgram-api-key", name: "Deepgram", length: 40, alphabet: HEX, value: s => synthetic(s, 40, HEX),
      env: "DEEPGRAM_API_KEY", envAlt: "DG_API_KEY", idEnv: "DEEPGRAM_PROJECT_ID", idEnvAlt: "DG_REQUEST_ID", host: "api.deepgram.com", scheme: "Token",
      import: "from deepgram import DeepgramClient", ctor: "DeepgramClient", kw: "api_key", lcClass: "DeepgramLoader", lcKw: "deepgram_api_key", lcTwinKw: "deepgram_run_id", jsCtor: "DeepgramClient", jsKw: "key",
      model: "nova-3", litellmModel: "deepgram/nova-3", camel: "deepgramApiKey", camelTwin: "deepgramRequestId",
    };
    const s = shared(cfg);
    // Deepgram-specific gates: the Token scheme in three carriers and the WebSocket subprotocol pair.
    const headerJson = ctx("header", "json-header-token", "json", `{"url": "https://${cfg.host}/v1/listen", "headers": {"Authorization": "Token `, "\"}}\n", { slug: "other-host-json-header", pre: "{\"url\": \"https://api.example.invalid/v1/listen\", \"headers\": {\"Authorization\": \"Token ", post: "\"}}\n", mutation: "context: the api.deepgram.com host replaced by api.example.invalid, so no Deepgram name remains in the object; the value is kept byte-for-byte" });
    const subprotocol = ctx("header", "websocket-subprotocol", "txt", `GET wss://${cfg.host}/v1/listen HTTP/1.1\nSec-WebSocket-Protocol: token, `, "\n", { slug: "other-host-websocket", pre: "GET wss://api.example.invalid/v1/listen HTTP/1.1\nSec-WebSocket-Protocol: token, ", post: "\n", mutation: "context: the api.deepgram.com host replaced by api.example.invalid, so no Deepgram name remains on the request; the value is kept byte-for-byte" });
    const createClient = ctx("source-code", "create-client", "ts", "import { createClient } from '@deepgram/sdk';\n\nconst deepgram = createClient(\"", "\");\n", { slug: "unrelated-factory", pre: "import { createWidget } from 'widget-sdk';\n\nconst widget = createWidget(\"", post: "\");\n", mutation: "context: the Deepgram createClient factory replaced by an unrelated one, so no Deepgram name remains; the value is kept byte-for-byte" });
    family(cfg, [s.dotenv, s.dotenvAlt, s.export, s.compose, s.ctor, createClient, s.js, s.curl, headerJson, subprotocol, s.tool, s.log]);
    controls(cfg, { count: 22 });
    unpaired(cfg, 8);
  }

  // ----------------------------------------------------------------------- AI21
  {
    const cfg = {
      T: "ai21-api-key", name: "AI21", length: 32, alphabet: ALNUM, value: s => synthetic(s, 32, ALNUM),
      env: "AI21_API_KEY", envAlt: "AI21_API_KEY", idEnv: "AI21_API_HOST", idEnvAlt: "AI21_AWS_REGION", host: "api.ai21.com", scheme: "Bearer",
      import: "from ai21 import AI21Client", ctor: "AI21Client", kw: "api_key", lcClass: "ChatAI21", lcKw: "api_key", lcTwinKw: "run_id", jsCtor: "AI21", jsKw: "apiKey",
      model: "jamba-mini", litellmModel: "ai21/jamba-mini", camel: "ai21ApiKey", camelTwin: "ai21RequestId",
    };
    const s = shared(cfg);
    // redact-secret#1013 (T2, context-48): the twelve shared contexts as Mistral, Cohere and Deepgram use, the full
    // control set and two unpaired carriers, so the context-constrained floors (48 fixtures, 10 context twins) are met.
    family(cfg, [s.dotenv, s.dotenvAlt, s.export, s.compose, s.ctor, s.langchain, s.js, s.curl, s.yaml, s.json, s.tool, s.log]);
    controls(cfg, { count: 22 });
    unpaired(cfg, 2);
  }

  // ------------------------------------------------------------------------ Exa
  {
    const T = "exa-api-key";
    const host = "api.exa.ai";
    const value = slug => uuid(synthetic(seed(T, slug), 32, HEX));
    const idTwin = (label, name) => `context: ${label} renamed ${name}, a documented identifier field; the value is kept byte-for-byte`;
    const contexts = [
      ctx("env", "dotenv", "env", "# .env\nEXA_API_KEY=", "\n", { slug: "key-id-env", pre: "# .env\nEXA_KEY_ID=", post: "\n", mutation: idTwin("EXA_API_KEY", "EXA_KEY_ID") }),
      ctx("shell-export", "export", "sh", "export EXA_API_KEY=\"", "\"\n", { slug: "api-key-id-export", pre: "export EXA_API_KEY_ID=\"", post: "\"\n", mutation: idTwin("EXA_API_KEY", "EXA_API_KEY_ID") }),
      ctx("sdk-config", "python-kwarg", "py", "from exa_py import Exa\n\nexa = Exa(api_key=\"", "\")\n", { slug: "unrelated-python-ctor", pre: "from exa_py import Exa\n\nexa = Widget(api_key=\"", post: "\")\n", mutation: "context: the Exa constructor replaced by an unrelated Widget constructor; the value is kept byte-for-byte" }),
      ctx("sdk-config", "python-positional", "py", "from exa_py import Exa\n\nexa = Exa(\"", "\")\n", { slug: "unrelated-python-positional", pre: "from exa_py import Exa\n\nexa = Widget(\"", post: "\")\n", mutation: "context: the Exa constructor replaced by an unrelated Widget constructor; the value is kept byte-for-byte" }),
      ctx("source-code", "langchain-kwarg", "py", "tool = ExaSearchResults(exa_api_key=\"", "\")\n", { slug: "team-id-kwarg", pre: "tool = ExaSearchResults(exa_team_id=\"", post: "\")\n", mutation: idTwin("the exa_api_key argument", "exa_team_id") }),
      ctx("source-code", "js-positional", "ts", "import Exa from 'exa-js';\n\nconst exa = new Exa(\"", "\");\n", { slug: "unrelated-js-positional", pre: "import Exa from 'exa-js';\n\nconst exa = new Widget(\"", post: "\");\n", mutation: "context: the Exa constructor replaced by an unrelated Widget constructor; the value is kept byte-for-byte" }),
      ctx("url", "hosted-mcp-query", "json", `{ "mcpServers": { "exa": { "url": "https://mcp.exa.ai/mcp?exaApiKey=`, "\" } } }\n", { slug: "request-id-query", pre: "{ \"mcpServers\": { \"exa\": { \"url\": \"https://mcp.exa.ai/mcp?requestId=", post: "\" } } }\n", mutation: idTwin("the exaApiKey query parameter", "requestId") }),
      ctx("header", "curl-x-api-key", "sh", `curl -s https://${host}/search -H "x-api-key: `, "\"\n", { slug: "other-host", pre: "curl -s https://api.example.invalid/search -H \"x-api-key: ", post: "\"\n", mutation: `context: the ${host} host replaced by api.example.invalid, so no Exa name remains on the line; the value is kept byte-for-byte` }),
    ];
    for (const x of contexts) {
      const v = value(x.slug);
      c.positive(T, x.axis, x.slug, [x.pre, { secret: v }, x.post], x.ext);
      c.twin(T, x.slug, x.twin.slug, [x.twin.pre, v, x.twin.post], x.twin.mutation, "context", x.ext);
    }
    const cfg = { T, name: "Exa", env: "EXA_API_KEY", ctor: "Exa", kw: "api_key", model: "exa-research", value: s => value(s) };
    controls(cfg, { count: 10 });
    // Exa-specific benign siblings: documented placeholders and non-secret settings.
    c.control(T, "placeholder", "quickstart-key", ["export EXA_API_KEY=\"your-api-key\"\n"], "sh");
    c.control(T, "public-id", "team-management-ids", [`{"id": "${value("mgmt-id")}", "teamId": "${value("mgmt-team")}", "userId": "${value("mgmt-user")}", "name": "ci"}\n`], "json");
    c.control(T, "near-miss", "content-length-setting", ["EXA_MAX_CONTENT_LENGTH=4000\nEXA_NUM_RESULTS=10\n"], "env");
    c.control(T, "prose", "bearer-docs", ["Send the key as Authorization: Bearer <key> or in the x-api-key header; it is created at the Exa dashboard.\n"], "md");
  }
  return c.fixtures;
}
