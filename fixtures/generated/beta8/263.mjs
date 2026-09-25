import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #263 corpus (category `beta8-263`). See docs/specs/beta8-evidence.md.
// Empirical fixture-floor raise for ten T2 registry families. Every fixture is
// authored against the family's existing registry contract (#208, #210, #212,
// #259); none changes a contract. Each family gets independent positives on
// new contexts and twin pairs whose negative differs from its own positive in
// exactly one documented property. travisci-api-token is context-constrained,
// so its new twins keep the token byte-for-byte and change only the context.
// Every value is a `synthetic()` seed or is built below from synthetic bytes;
// nothing is provider-issued, scanner-reported, copied from provider
// documentation or derived from a real credential. Shapes GitHub push
// protection matches never appear as literals in this source.

const DIGITS = "0123456789";
const HEX = "0123456789abcdef";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const FRIENDLY = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789_-";

export function build263({ fixture, synthetic }) {
  const c = beta8Corpus(263, { fixture, synthetic });
  const seed = (target, slug) => `beta8:263:${target}:${slug}`;
  const check = (target, value) => {
    const contract = contracts[target];
    if (!contract) throw new Error(`beta8-263: no registry contract for ${target}`);
    if (!new RegExp(contract.pattern).test(value) || !(contract.validate?.(value) ?? true))
      throw new Error(`beta8-263: authored ${target} value fails its own contract: ${value.slice(0, 6)}...`);
    return value;
  };
  const refuse = (target, value) => {
    if (new RegExp(contracts[target].pattern).test(value)) throw new Error(`beta8-263: ${target} twin value still satisfies the contract`);
    return value;
  };

  // --------------------------------------------------------------- groq-api-key
  {
    const T = "groq-api-key";
    const key = slug => check(T, `gsk_${synthetic(seed(T, slug), 52, ALNUM)}`);
    const k = Object.fromEntries(["url", "structured", "container", "tool", "cli", "log", "twin-a", "twin-b"].map(s => [s, key(s)]));
    c.positive(T, "container-config", "compose-env", ["services:\n  chat:\n    image: registry.example.test/chat:2.1\n    environment:\n      GROQ_API_KEY: ", { secret: k.container }, "\n"], "yml");
    c.positive(T, "structured-file", "toml-provider", ["[providers.groq]\nbase_url = \"https://api.groq.com/openai/v1\"\napi_key = \"", { secret: k.structured }, "\"\n"], "toml");
    c.positive(T, "tool-output", "secrets-list", ["$ doppler secrets get GROQ_API_KEY --plain\n", { secret: k.tool }, "\n"], "txt");
    c.positive(T, "cli", "curl-models", ["curl https://api.groq.com/openai/v1/models -H \"Authorization: Bearer ", { secret: k.cli }, "\"\n"], "sh");
    c.positive(T, "log", "startup-log", ["2026-09-25T09:12:03Z INFO llm: provider=groq key=", { secret: k.log }, " model=llama-3.3-70b\n"], "log");
    const envA = v => ["# .env\nGROQ_API_KEY=", v, "\nGROQ_MODEL=llama-3.3-70b-versatile\n"];
    const pyB = v => ["from groq import Groq\n\nclient = Groq(api_key=\"", v, "\")\n"];
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: k["twin-a"] }), "env");
    c.positive(T, "sdk-config", "twin-base-python", pyB({ secret: k["twin-b"] }), "py");
    c.twin(T, "twin-base-dotenv", "short-body", envA(refuse(T, k["twin-a"].slice(0, 55))), "length: 51 body characters vs the 52 the contract requires", "length", "env");
    c.twin(T, "twin-base-python", "prefix-separator", pyB(refuse(T, `gsk-${k["twin-b"].slice(4)}`)), "prefix: gsk- instead of the gsk_ separator", "prefix", "py");
  }

  // ---------------------------------------------------------------- xai-api-key
  {
    const T = "xai-api-key";
    const key = slug => check(T, `xai-${synthetic(seed(T, slug), 80, ALNUM)}`);
    const k = Object.fromEntries(["container", "structured", "tool", "cli", "log", "twin-a", "twin-b"].map(s => [s, key(s)]));
    c.positive(T, "container-config", "k8s-secret", ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: grok-proxy\nstringData:\n  XAI_API_KEY: ", { secret: k.container }, "\n"], "yml");
    c.positive(T, "structured-file", "json-profile", ["{\n  \"provider\": \"xai\",\n  \"apiKey\": \"", { secret: k.structured }, "\"\n}\n"], "json");
    c.positive(T, "tool-output", "vault-read", ["$ vault kv get -field=api_key secret/xai\n", { secret: k.tool }, "\n"], "txt");
    c.positive(T, "cli", "curl-chat", ["curl https://api.x.ai/v1/chat/completions -H \"Authorization: Bearer ", { secret: k.cli }, "\" -d @req.json\n"], "sh");
    c.positive(T, "log", "retry-log", ["WARN xai-client retrying with key ", { secret: k.log }, " after 429\n"], "log");
    const envA = v => ["XAI_API_KEY=", v, "\nXAI_BASE_URL=https://api.x.ai/v1\n"];
    const tsB = v => ["import OpenAI from \"openai\";\n\nconst grok = new OpenAI({ baseURL: \"https://api.x.ai/v1\", apiKey: \"", v, "\" });\n"];
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: k["twin-a"] }), "env");
    c.positive(T, "sdk-config", "twin-base-ts", tsB({ secret: k["twin-b"] }), "ts");
    c.twin(T, "twin-base-dotenv", "short-body", envA(refuse(T, k["twin-a"].slice(0, 83))), "length: 79 body characters vs the 80 the contract requires", "length", "env");
    c.twin(T, "twin-base-ts", "prefix-letter", tsB(refuse(T, `xal-${k["twin-b"].slice(4)}`)), "prefix: xal- instead of the documented xai-", "prefix", "ts");
  }

  // ---------------------------------------------------------- langsmith-api-key
  {
    const T = "langsmith-api-key";
    const key = (role, slug) => check(T, `lsv2_${role}_${synthetic(seed(T, `${slug}:body`), 32, HEX)}_${synthetic(seed(T, `${slug}:tail`), 10, HEX)}`);
    c.positive(T, "shell-export", "export-pat", ["export LANGSMITH_API_KEY=", { secret: key("pt", "export-pat") }, "\n"], "sh");
    c.positive(T, "cli", "langgraph-cli", ["langgraph deploy --api-key ", { secret: key("sk", "langgraph-cli") }, " --name support-bot\n"], "sh");
    c.positive(T, "tool-output", "op-read", ["$ op read op://Engineering/langsmith/credential\n", { secret: key("sk", "op-read") }, "\n"], "txt");
    c.positive(T, "prose", "runbook", ["Rotate the tracing key: the current service key is ", { secret: key("sk", "runbook") }, " and expires Friday.\n"], "md");
    const envA = v => ["LANGSMITH_TRACING=true\nLANGSMITH_API_KEY=", v, "\n"];
    const jsonB = v => ["{\n  \"langsmith\": {\n    \"api_key\": \"", v, "\"\n  }\n}\n"];
    const ciC = v => ["env:\n  LANGSMITH_API_KEY: ", v, "\n"];
    const a = key("pt", "twin-a"), b = key("sk", "twin-b"), cc = key("pt", "twin-c");
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: a }), "env");
    c.positive(T, "structured-file", "twin-base-json", jsonB({ secret: b }), "json");
    c.positive(T, "ci-config", "twin-base-ci", ciC({ secret: cc }), "yml");
    c.twin(T, "twin-base-dotenv", "long-tail", envA(refuse(T, `${a}0`)), "length: an 11-character tail vs the 10 the contract requires", "length", "env");
    c.twin(T, "twin-base-json", "role-code", jsonB(refuse(T, `lsv2_sx_${b.slice(8)}`)), "prefix: role code sx, which neither the documentation nor any peer rule names", "prefix", "json");
    c.twin(T, "twin-base-ci", "non-hex-tail", ciC(refuse(T, `${cc.slice(0, -1)}g`)), "alphabet: the last tail character replaced by g, outside lowercase hex", "alphabet", "yml");
  }

  // -------------------------------------------------------- langfuse-secret-key
  {
    const T = "langfuse-secret-key";
    const uuid4 = slug => {
      const h = synthetic(seed(T, slug), 32, HEX).split("");
      h[12] = "4";
      h[16] = "89ab"[HEX.indexOf(h[16]) % 4];
      const s = h.join("");
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    };
    const key = slug => check(T, `sk-lf-${uuid4(slug)}`);
    c.positive(T, "shell-export", "export", ["export LANGFUSE_SECRET_KEY=", { secret: key("export") }, "\n"], "sh");
    c.positive(T, "cli", "curl-basic", ["curl -u pk-lf-", uuid4("curl-pk"), ":", { secret: key("curl-basic") }, " https://cloud.langfuse.com/api/public/projects\n"], "sh");
    c.positive(T, "tool-output", "secret-get", ["$ gcloud secrets versions access latest --secret=langfuse-sk\n", { secret: key("secret-get") }, "\n"], "txt");
    c.positive(T, "prose", "handover-note", ["Langfuse handover: the staging secret key is ", { secret: key("handover-note") }, ", keep it out of the browser bundle.\n"], "md");
    const envA = v => ["LANGFUSE_PUBLIC_KEY=pk-lf-", uuid4("env-pk"), "\nLANGFUSE_SECRET_KEY=", v, "\n"];
    const pyB = v => ["from langfuse import Langfuse\n\nlangfuse = Langfuse(secret_key=\"", v, "\")\n"];
    const ciC = v => ["env:\n  LANGFUSE_SECRET_KEY: ", v, "\n"];
    const a = key("twin-a"), b = key("twin-b"), cc = key("twin-c");
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: a }), "env");
    c.positive(T, "sdk-config", "twin-base-python", pyB({ secret: b }), "py");
    c.positive(T, "ci-config", "twin-base-ci", ciC({ secret: cc }), "yml");
    c.twin(T, "twin-base-dotenv", "version-nibble", envA(refuse(T, `${a.slice(0, 20)}5${a.slice(21)}`)), "alphabet: UUID version nibble 5 instead of the 4 the key generator mints", "alphabet", "env");
    c.twin(T, "twin-base-python", "variant-nibble", pyB(refuse(T, `${b.slice(0, 25)}7${b.slice(26)}`)), "alphabet: UUID variant nibble 7, outside the 8/9/a/b RFC 4122 variant", "alphabet", "py");
    c.twin(T, "twin-base-ci", "long-last-group", ciC(refuse(T, `${cc}0`)), "length: a 13-character last group vs the 12 of a UUID", "length", "yml");
  }

  // ---------------------------------------------------------------- neon-api-key
  {
    const T = "neon-api-key";
    const key = slug => check(T, `napi_${synthetic(seed(T, slug), 64, ALNUM)}`);
    c.positive(T, "container-config", "compose-env", ["services:\n  migrate:\n    image: registry.example.test/migrate:1.0\n    environment:\n      NEON_API_KEY: ", { secret: key("compose") }, "\n"], "yml");
    c.positive(T, "structured-file", "terraform-vars", ["neon_api_key = \"", { secret: key("tfvars") }, "\"\nregion_id    = \"aws-us-east-2\"\n"], "tfvars");
    c.positive(T, "tool-output", "secret-print", ["$ aws secretsmanager get-secret-value --secret-id neon --query SecretString --output text\n", { secret: key("tool") }, "\n"], "txt");
    c.positive(T, "prose", "incident-note", ["Incident 482: a Neon org key ", { secret: key("prose") }, " was pasted into the ticket; revoke it.\n"], "md");
    const envA = v => ["NEON_API_KEY=", v, "\nNEON_PROJECT_ID=cool-darkness-123456\n"];
    const tsB = v => ["import { createApiClient } from \"@neondatabase/api-client\";\n\nconst neon = createApiClient({ apiKey: \"", v, "\" });\n"];
    const hdrC = v => ["GET /api/v2/projects HTTP/1.1\nHost: console.neon.tech\nAuthorization: Bearer ", v, "\n"];
    const a = key("twin-a"), b = key("twin-b"), cc = key("twin-c");
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: a }), "env");
    c.positive(T, "sdk-config", "twin-base-ts", tsB({ secret: b }), "ts");
    c.positive(T, "header", "twin-base-header", hdrC({ secret: cc }), "http");
    c.twin(T, "twin-base-dotenv", "short-body", envA(refuse(T, a.slice(0, -1))), "length: 63 body characters, below the 64-character floor", "length", "env");
    c.twin(T, "twin-base-ts", "prefix-letter", tsB(refuse(T, `npai_${b.slice(5)}`)), "prefix: npai_ instead of the documented napi_", "prefix", "ts");
    c.twin(T, "twin-base-header", "dash-in-body", hdrC(refuse(T, `${cc.slice(0, 37)}-${cc.slice(38)}`)), "alphabet: one body character replaced by -, which splits the body below the 64-character floor", "alphabet", "http");
  }

  // ----------------------------------------------------------- perplexity-api-key
  {
    const T = "perplexity-api-key";
    const key = slug => check(T, `pplx-${synthetic(seed(T, slug), 48, ALNUM)}`);
    c.positive(T, "container-config", "compose-env", ["services:\n  search:\n    environment:\n      PERPLEXITY_API_KEY: ", { secret: key("compose") }, "\n"], "yml");
    c.positive(T, "tool-output", "secret-print", ["$ pass show ai/perplexity\n", { secret: key("tool") }, "\n"], "txt");
    c.positive(T, "cli", "curl-chat", ["curl https://api.perplexity.ai/chat/completions -H \"Authorization: Bearer ", { secret: key("cli") }, "\" -d @q.json\n"], "sh");
    c.positive(T, "log", "debug-log", ["DEBUG sonar request key=", { secret: key("log") }, " model=sonar-pro\n"], "log");
    c.positive(T, "prose", "chat-message", ["can you try my perplexity key? ", { secret: key("prose") }, "\n"], "md");
    const envA = v => ["PERPLEXITY_API_KEY=", v, "\n"];
    const pyB = v => ["from openai import OpenAI\n\nclient = OpenAI(api_key=\"", v, "\", base_url=\"https://api.perplexity.ai\")\n"];
    const a = key("twin-a"), b = key("twin-b");
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: a }), "env");
    c.positive(T, "sdk-config", "twin-base-python", pyB({ secret: b }), "py");
    c.twin(T, "twin-base-dotenv", "short-body", envA(refuse(T, a.slice(0, -1))), "length: 47 body characters vs the 48 the contract requires", "length", "env");
    c.twin(T, "twin-base-python", "prefix-letter", pyB(refuse(T, `pplq-${b.slice(5)}`)), "prefix: pplq- instead of pplx-", "prefix", "py");
  }

  // ------------------------------------------------------------ pinecone-api-key
  {
    const T = "pinecone-api-key";
    const key = (slug, label = 5) => check(T, `pcsk_${synthetic(seed(T, `${slug}:label`), label, ALNUM)}_${synthetic(seed(T, `${slug}:secret`), 63, ALNUM)}`);
    c.positive(T, "container-config", "compose-env", ["services:\n  rag:\n    environment:\n      PINECONE_API_KEY: ", { secret: key("compose") }, "\n"], "yml");
    c.positive(T, "structured-file", "json-config", ["{\n  \"vectorStore\": \"pinecone\",\n  \"apiKey\": \"", { secret: key("json", 6) }, "\"\n}\n"], "json");
    c.positive(T, "tool-output", "secret-print", ["$ infisical secrets get PINECONE_API_KEY --plain\n", { secret: key("tool") }, "\n"], "txt");
    c.positive(T, "log", "error-log", ["ERROR pinecone upsert failed for key ", { secret: key("log") }, ": 403 Forbidden\n"], "log");
    const envA = v => ["PINECONE_API_KEY=", v, "\nPINECONE_INDEX=docs\n"];
    const pyB = v => ["from pinecone import Pinecone\n\npc = Pinecone(api_key=\"", v, "\")\n"];
    const shC = v => ["export PINECONE_API_KEY=\"", v, "\"\n"];
    const a = key("twin-a"), b = key("twin-b"), cc = key("twin-c");
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: a }), "env");
    c.positive(T, "sdk-config", "twin-base-python", pyB({ secret: b }), "py");
    c.positive(T, "shell-export", "twin-base-export", shC({ secret: cc }), "sh");
    c.twin(T, "twin-base-dotenv", "short-secret", envA(refuse(T, a.slice(0, -1))), "length: a 62-character secret segment vs the 63 the contract requires", "length", "env");
    c.twin(T, "twin-base-python", "prefix-letter", pyB(refuse(T, `pcsx_${b.slice(5)}`)), "prefix: pcsx_ instead of pcsk_", "prefix", "py");
    c.twin(T, "twin-base-export", "short-label", shC(refuse(T, `pcsk_${cc.slice(5, 9)}${cc.slice(10)}`)), "length: a 4-character label, below the 5-6 the contract requires", "length", "sh");
  }

  // -------------------------------------------------- postman-collection-access-key
  {
    const T = "postman-collection-access-key";
    const P = ["PM", "AT-"].join("");
    const key = slug => check(T, `${P}${synthetic(seed(T, slug), 26, UPPER_ALNUM)}`);
    c.positive(T, "container-config", "compose-env", ["services:\n  contract-tests:\n    environment:\n      POSTMAN_COLLECTION_ACCESS_KEY: ", { secret: key("compose") }, "\n"], "yml");
    c.positive(T, "structured-file", "newman-json", ["{\n  \"collection\": \"https://api.getpostman.com/collections/12345678-0000-4000-8000-000000000001\",\n  \"access_key\": \"", { secret: key("json") }, "\"\n}\n"], "json");
    c.positive(T, "tool-output", "share-output", ["Share via API: collection JSON is available with access key ", { secret: key("tool") }, "\n"], "txt");
    c.positive(T, "log", "ci-log", ["[newman] fetching collection with access_key=", { secret: key("log") }, "\n"], "log");
    const envA = v => ["POSTMAN_COLLECTION_ACCESS_KEY=", v, "\n"];
    const urlB = v => ["https://api.getpostman.com/collections/12345678-0000-4000-8000-000000000002?access_key=", v, "\n"];
    const shC = v => ["export POSTMAN_COLLECTION_ACCESS_KEY=\"", v, "\"\n"];
    const a = key("twin-a"), b = key("twin-b"), cc = key("twin-c");
    c.positive(T, "env", "twin-base-dotenv", envA({ secret: a }), "env");
    c.positive(T, "url", "twin-base-url", urlB({ secret: b }), "txt");
    c.positive(T, "shell-export", "twin-base-export", shC({ secret: cc }), "sh");
    c.twin(T, "twin-base-dotenv", "short-body", envA(refuse(T, a.slice(0, -1))), "length: 25 characters vs the 26 GitLab's rule and the provider's masked display give", "length", "env");
    c.twin(T, "twin-base-url", "underscore-delimiter", urlB(refuse(T, `${P.slice(0, 4)}_${b.slice(5)}`)), "boundary: an underscore in place of the dash delimiter the provider displays", "boundary", "txt");
    c.twin(T, "twin-base-export", "long-body", shC(refuse(T, `${cc}Q`)), "length: 27 characters vs the 26 GitLab's rule and the provider's masked display give", "length", "sh");
  }

  // ------------------------------------------------ gitlab-runner-authentication-token
  {
    const T = "gitlab-runner-authentication-token";
    const legacy = slug => check(T, `glrt-${synthetic(seed(T, slug), 20, FRIENDLY)}`);
    const partitioned = (slug, type) => check(T, `glrt-t${type}_${synthetic(seed(T, slug), 20, FRIENDLY)}`);
    c.positive(T, "shell-export", "export", ["export CI_SERVER_TOKEN=", { secret: legacy("export") }, "\n"], "sh");
    c.positive(T, "sdk-config", "terraform-runner", ["resource \"gitlab_user_runner\" \"build\" {}\n\nlocals {\n  runner_token = \"", { secret: partitioned("terraform", 1) }, "\"\n}\n"], "tf");
    c.positive(T, "tool-output", "register-output", ["Runner registered successfully. Token: ", { secret: legacy("tool") }, "\n"], "txt");
    c.positive(T, "log", "runner-log", ["Oct  2 10:11:12 ci gitlab-runner[811]: using token ", { secret: partitioned("log", 2) }, " for runner build-01\n"], "log");
    c.positive(T, "prose", "handover", ["New runner for the build fleet: ", { secret: legacy("prose") }, " (register with --token).\n"], "md");
    c.positive(T, "header", "api-header", ["POST /api/v4/runners/verify HTTP/1.1\nHost: gitlab.example.com\nContent-Type: application/json\n\n{\"token\":\"", { secret: legacy("header") }, "\"}\n"], "http");
    c.positive(T, "url", "query-token", ["https://gitlab.example.com/api/v4/runners/verify?token=", { secret: partitioned("url", 3) }, "\n"], "txt");
    const tomlA = v => ["[[runners]]\n  name = \"build-02\"\n  url = \"https://gitlab.example.com\"\n  token = \"", v, "\"\n  executor = \"docker\"\n"];
    const cliB = v => ["gitlab-runner register --non-interactive --url https://gitlab.example.com --token ", v, " --executor shell\n"];
    const a = legacy("twin-a"), b = legacy("twin-b");
    c.positive(T, "structured-file", "twin-base-toml", tomlA({ secret: a }), "toml");
    c.positive(T, "cli", "twin-base-register", cliB({ secret: b }), "sh");
    c.twin(T, "twin-base-toml", "short-body", tomlA(refuse(T, a.slice(0, -1))), "length: a 19-character body vs the 20 of the legacy shape", "length", "toml");
    c.twin(T, "twin-base-register", "prefix-letter", cliB(refuse(T, `glrx-${b.slice(5)}`)), "prefix: glrx- instead of glrt-", "prefix", "sh");
  }

  // ------------------------------------------------------------ travisci-api-token
  {
    const T = "travisci-api-token";
    // 22 alphanumerics with at least one letter and one digit (contract and product guard).
    const token = slug => {
      const body = synthetic(seed(T, slug), 20, ALNUM);
      return check(T, `${body.slice(0, 7)}${synthetic(seed(T, `${slug}:d`), 1, DIGITS)}${body.slice(7)}${synthetic(seed(T, `${slug}:l`), 1, LOWER)}`);
    };
    // Each pair keeps the token byte-for-byte; the twin changes only the context, so the
    // same-line travis keyword or the credential-named key that the contract needs is gone.
    const pairs = [
      ["ci-config", "yml", v => ["env:\n  global:\n    - TRAVIS_API_TOKEN=", v, "\n"], v => ["env:\n  global:\n    - TRAVIS_REPO_SLUG=", v, "\n"], "TRAVIS_API_TOKEN renamed TRAVIS_REPO_SLUG, a Travis identifier name"],
      ["env", "env", v => ["TRAVIS_TOKEN=", v, "\n"], v => ["# travis\nTOKEN=", v, "\n"], "the travis keyword moved to the line above; the assignment names no provider"],
      ["cli", "sh", v => ["travis login --pro --token ", v, "\n"], v => ["ci login --pro --token ", v, "\n"], "the travis command replaced by a neutral CI client, so no travis keyword remains on the line"],
      ["header", "sh", v => ["curl https://api.travis-ci.com/repos -H \"Authorization: token ", v, "\"\n"], v => ["curl https://api.example.test/repos -H \"Authorization: token ", v, "\"\n"], "the Travis API host replaced by a neutral one, so no travis keyword remains on the line"],
      ["structured-file", "json", v => ["{ \"travis\": { \"api_token\": \"", v, "\" } }\n"], v => ["{ \"service\": { \"api_token\": \"", v, "\" } }\n"], "the travis section renamed service"],
      ["source-code", "py", v => ["travis = TravisPy(\"", v, "\")\n"], v => ["client = CiClient(\"", v, "\")\n"], "the TravisPy client replaced by a neutral client"],
      ["log", "log", v => ["INFO travis-sync token=", v, "\n"], v => ["INFO build-sync token=", v, "\n"], "the travis-sync logger renamed build-sync"],
      ["shell-export", "sh", v => ["export TRAVIS_API_TOKEN=", v, "\n"], v => ["export TRAVIS_JOB_NUMBER=", v, "\n"], "TRAVIS_API_TOKEN renamed TRAVIS_JOB_NUMBER, a Travis identifier name"],
    ];
    pairs.forEach(([axis, ext, positive, twin, mutation], i) => {
      const v = token(`pair-${i}`);
      c.positive(T, axis, `context-base-${i + 1}`, positive({ secret: v }), ext);
      c.twin(T, `context-base-${i + 1}`, `context-${i + 1}`, twin(v), `context: ${mutation}; the token is kept byte-for-byte`, "context", ext);
    });
  }

  return c.fixtures;
}
