import { beta8Corpus } from "./helpers.mjs";

// Issue #210 corpus (category `beta8-210`). See docs/specs/beta8-evidence.md.
// Families: langsmith:api-key (research #219) and langfuse:secret-key (#221).
// Every value is built here from `synthetic` seeds; none is provider-issued,
// copied from provider documentation, or derived from a real credential.
// No trace payload is retained: observability metadata below is a minimal,
// locally authored skeleton.
const HEX = "0123456789abcdef";
const LS = "langsmith-api-key";
const LF = "langfuse-secret-key";

export function build210({ fixture, synthetic }) {
  const c = beta8Corpus(210, { fixture, synthetic });
  const hex = (slug, n) => synthetic(`beta8:210:${slug}`, n, HEX);

  // --- langsmith:api-key -----------------------------------------------------
  // lsv2_<pt|sk>_<32 lowercase hex>_<10 lowercase hex> (tool-corroborated widths).
  const lsParts = slug => ({ body: hex(`langsmith:${slug}:body`, 32), tail: hex(`langsmith:${slug}:tail`, 10) });
  const lsKey = (role, slug) => { const { body, tail } = lsParts(slug); return `lsv2_${role}_${body}_${tail}`; };
  // A lowercase UUIDv4 built from synthetic bytes, for public identifiers of both families.
  const uuid4 = slug => {
    const h = hex(`uuid:${slug}`, 32).split("");
    h[12] = "4";
    h[16] = "89ab"[HEX.indexOf(h[16]) % 4];
    const s = h.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  const lsEnv = value => [
    "# .env — local tracing for the support-bot service\n",
    "LANGSMITH_TRACING=true\n",
    "LANGSMITH_ENDPOINT=https://api.smith.langchain.com\n",
    `LANGSMITH_WORKSPACE_ID=${uuid4("langsmith:env:workspace")}\n`,
    "LANGSMITH_PROJECT=support-bot-staging\n",
    "LANGSMITH_API_KEY=", value, "\n",
  ];
  c.positive(LS, "env", "pat-dotenv", lsEnv({ secret: lsKey("pt", "pat-dotenv") }), "env");

  const lsLegacyShell = value => [
    "#!/usr/bin/env bash\n",
    "# legacy LangChain tracing variable names, still read by the SDK\n",
    "export LANGCHAIN_TRACING_V2=true\n",
    "export LANGCHAIN_PROJECT=nightly-evals\n",
    "export LANGCHAIN_API_KEY=", value, "\n",
    "python run_evals.py --dataset regression-set\n",
  ];
  c.positive(LS, "shell-export", "service-key-legacy-export", lsLegacyShell({ secret: lsKey("sk", "service-key-legacy-export") }), "sh");

  // One physical line: the benchmark's gitleaks adapter maps a finding by its reported start line, so a
  // match that crosses a trailing-backslash line continuation is unmappable and would drop the whole gitleaks run.
  const lsCurl = value => [
    "curl -s -H 'X-API-Key: ", value, "'",
    ` -H 'X-Tenant-Id: ${uuid4("langsmith:curl:tenant")}' https://api.smith.langchain.com/api/v1/sessions\n`,
  ];
  c.positive(LS, "header", "service-key-x-api-key", lsCurl({ secret: lsKey("sk", "service-key-x-api-key") }), "sh");

  const lsOtlp = value => [
    "services:\n",
    "  agent:\n",
    "    image: registry.example.test/agent:1.4.2\n",
    "    environment:\n",
    "      OTEL_EXPORTER_OTLP_ENDPOINT: https://api.smith.langchain.com/otel\n",
    "      OTEL_EXPORTER_OTLP_HEADERS: \"x-api-key=", value, ",Langsmith-Project=agent-prod\"\n",
  ];
  c.positive(LS, "container-config", "pat-otlp-header-list", lsOtlp({ secret: lsKey("pt", "pat-otlp-header-list") }), "yml");

  const lsProfile = value => [
    "{\n",
    "  \"current_profile\": \"work\",\n",
    "  \"profiles\": {\n",
    "    \"work\": {\n",
    "      \"api_url\": \"https://api.smith.langchain.com\",\n",
    `      \"workspace_id\": \"${uuid4("langsmith:profile:workspace")}\",\n`,
    "      \"api_key\": \"", value, "\"\n",
    "    }\n",
    "  }\n",
    "}\n",
  ];
  c.positive(LS, "structured-file", "pat-profile-json", lsProfile({ secret: lsKey("pt", "pat-profile-json") }), "json");

  const lsSdk = value => [
    "from langsmith import Client\n\n",
    "client = Client(\n",
    "    api_url=\"https://api.smith.langchain.com\",\n",
    "    api_key=\"", value, "\",\n",
    ")\n",
    "print(client.list_projects())\n",
  ];
  c.positive(LS, "sdk-config", "service-key-python-client", lsSdk({ secret: lsKey("sk", "service-key-python-client") }), "py");

  const lsTraceMeta = value => [
    "{\"level\":\"debug\",\"msg\":\"run metadata\",\"run\":{",
    `\"id\":\"${uuid4("langsmith:log:run")}\",\"trace_id\":\"${uuid4("langsmith:log:trace")}\",`,
    "\"extra\":{\"metadata\":{\"ls_provider\":\"openai\",\"ls_model_name\":\"example-model\",\"ls_run_depth\":1,",
    "\"request_headers\":{\"x-api-key\":\"", value, "\",\"content-type\":\"application/json\"}}}}}\n",
  ];
  c.positive(LS, "log", "pat-nested-run-metadata", lsTraceMeta({ secret: lsKey("pt", "pat-nested-run-metadata") }), "log");

  const lsCi = value => [
    "name: evals\n",
    "on: [push]\n",
    "jobs:\n",
    "  run:\n",
    "    runs-on: ubuntu-latest\n",
    "    env:\n",
    "      LANGSMITH_TRACING: \"true\"\n",
    "      LANGSMITH_API_KEY: ", value, "\n",
    "    steps:\n",
    "      - run: pytest -q tests/evals\n",
  ];
  c.positive(LS, "ci-config", "service-key-workflow-env", lsCi({ secret: lsKey("sk", "service-key-workflow-env") }), "yml");

  // Twins: exactly one structural property of the positive's value differs.
  {
    const { body, tail } = lsParts("pat-dotenv");
    c.twin(LS, "pat-dotenv", "short-first-segment", lsEnv(`lsv2_pt_${body.slice(0, 31)}_${tail}`),
      "First segment shortened from 32 to 31 hex characters; every other byte and the context are unchanged", "length");
  }
  {
    const { body, tail } = lsParts("service-key-x-api-key");
    c.twin(LS, "service-key-x-api-key", "short-tail", lsCurl(`lsv2_sk_${body}_${tail.slice(0, 9)}`),
      "Tail segment shortened from 10 to 9 hex characters; every other byte and the context are unchanged", "length");
  }
  {
    const { body, tail } = lsParts("pat-profile-json");
    c.twin(LS, "pat-profile-json", "unknown-role-code", lsProfile(`lsv2_px_${body}_${tail}`),
      "Role code pt replaced by px, which neither the provider documentation (PAT/service key) nor any peer rule names; body and tail are unchanged", "prefix");
  }
  {
    const { body, tail } = lsParts("pat-otlp-header-list");
    c.twin(LS, "pat-otlp-header-list", "non-hex-body", lsOtlp(`lsv2_pt_${body.slice(0, 16)}z${body.slice(17)}_${tail}`),
      "One body character replaced by z, outside the hex alphabet every peer rule uses; width and context unchanged. The provider SDK redactor is alphanumeric, so this twin rests on the tool-corroborated alphabet only", "alphabet");
  }
  {
    const { body, tail } = lsParts("service-key-python-client");
    c.twin(LS, "service-key-python-client", "merged-segments", lsSdk(`lsv2_sk_${body}${tail}`),
      "The _ separator between the 32- and 10-character segments is removed, so the value no longer has the two-segment layout; characters are otherwise unchanged", "boundary");
  }

  // Independent controls: public identifiers, placeholders, references, prose, near misses, a digest.
  c.control(LS, "public-id", "workspace-ids-env", [
    "# LangSmith workspace routing (no credential in this file)\n",
    "LANGSMITH_ENDPOINT=https://api.smith.langchain.com\n",
    `LANGSMITH_WORKSPACE_ID=${uuid4("langsmith:ctl:workspace")}\n`,
    `LANGSMITH_ORGANIZATION_ID=${uuid4("langsmith:ctl:org")}\n`,
    "LANGSMITH_PROJECT=checkout-agent\n",
  ], "env");
  c.control(LS, "public-id", "trace-share-link", [
    "Repro trace for the regression is public:\n",
    `https://smith.langchain.com/public/${uuid4("langsmith:ctl:share")}/r\n`,
    `run_id=${uuid4("langsmith:ctl:run")} trace_id=${uuid4("langsmith:ctl:trace")}\n`,
    "metadata: ls_provider=anthropic ls_model_name=example-model ls_run_depth=2\n",
  ], "md");
  c.control(LS, "placeholder", "masked-short-key", [
    "{\n",
    `  \"id\": \"${uuid4("langsmith:ctl:key-id")}\",\n`,
    `  \"short_key\": \"lsv2_pt_...${hex("langsmith:ctl:short-key", 4)}\",\n`,
    "  \"description\": \"ci tracing\",\n",
    "  \"expires_at\": \"2027-01-31T00:00:00Z\"\n",
    "}\n",
  ], "json");
  c.control(LS, "placeholder", "env-example", [
    "# .env.example — copy to .env and fill in\n",
    "LANGSMITH_TRACING=true\n",
    "LANGSMITH_API_KEY=lsv2_pt_...\n",
    "# service key alternative: lsv2_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_xxxxxxxxxx\n",
  ], "env");
  c.control(LS, "placeholder", "legacy-readme", [
    "## Tracing\n\n",
    "Older examples used `LANGCHAIN_API_KEY=ls__...`; newer ones use\n",
    "`LANGSMITH_API_KEY=<your-api-key>`.\n",
  ], "md");
  c.control(LS, "reference", "workflow-secret-ref", [
    "    env:\n",
    "      LANGSMITH_TRACING: \"true\"\n",
    "      LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}\n",
  ], "yml");
  c.control(LS, "reference", "python-env-lookup", [
    "import os\n",
    "from langsmith import Client\n\n",
    "client = Client(api_key=os.environ[\"LANGSMITH_API_KEY\"])\n",
  ], "py");
  c.control(LS, "prose", "key-roles-doc", [
    "LangSmith offers personal access tokens and service keys. Create either one\n",
    "under Settings, then API Keys; the key is displayed only once, so store it in\n",
    "your secret manager before closing the dialog.\n",
  ], "md");
  c.control(LS, "near-miss", "missing-tail", [
    "The pasted key below was cut off after its first segment, so the request was rejected.\n",
    `lsv2_pt_${hex("langsmith:ctl:missing-tail", 32)}\n`,
  ]);
  c.control(LS, "near-miss", "prefix-only-grep", [
    "$ grep -rn \"lsv2_sk_\" deploy/\n",
    "(no matches)\n",
  ], "log");
  c.control(LS, "encoded-value", "requirements-hash", [
    "langsmith==0.3.45 \\\n",
    `    --hash=sha256:${hex("langsmith:ctl:wheel-digest", 64)}\n`,
  ]);

  // --- langfuse:secret-key ---------------------------------------------------
  // sk-lf- + lowercase UUIDv4, as Langfuse's key generator mints it (provider code).
  const lfKey = slug => `sk-lf-${uuid4(`langfuse:${slug}`)}`;
  const lfPub = slug => `pk-lf-${uuid4(`langfuse:${slug}:public`)}`;

  const lfEnv = value => [
    "# .env\n",
    `LANGFUSE_PUBLIC_KEY=${lfPub("dotenv")}\n`,
    "LANGFUSE_SECRET_KEY=", value, "\n",
    "LANGFUSE_BASE_URL=https://cloud.langfuse.com\n",
  ];
  c.positive(LF, "env", "dotenv", lfEnv({ secret: lfKey("dotenv") }), "env");

  const lfPy = value => [
    "from langfuse import Langfuse\n\n",
    "langfuse = Langfuse(\n",
    `    public_key=\"${lfPub("python-client")}\",\n`,
    "    secret_key=\"", value, "\",\n",
    "    base_url=\"https://us.cloud.langfuse.com\",\n",
    ")\n",
  ];
  c.positive(LF, "sdk-config", "python-client", lfPy({ secret: lfKey("python-client") }), "py");

  const lfCurl = value => [
    "curl -s -u \"", `${lfPub("curl-basic-auth")}:`, value, "\" \\\n",
    "  https://cloud.langfuse.com/api/public/projects\n",
  ];
  c.positive(LF, "basic-auth", "curl-basic-auth", lfCurl({ secret: lfKey("curl-basic-auth") }), "sh");

  const lfGateway = value => [
    "POST /v1/chat/completions HTTP/1.1\n",
    "Host: gateway.langfuse.example.test\n",
    "Authorization: Bearer ", value, "\n",
    "Content-Type: application/json\n",
  ];
  c.positive(LF, "header", "gateway-bearer", lfGateway({ secret: lfKey("gateway-bearer") }), "http");

  const lfCompose = value => [
    "services:\n",
    "  langfuse-web:\n",
    "    image: langfuse/langfuse:3\n",
    "    environment:\n",
    `      LANGFUSE_INIT_PROJECT_ID: proj-${hex("langfuse:compose:project", 8)}\n`,
    `      LANGFUSE_INIT_PROJECT_PUBLIC_KEY: ${lfPub("compose-init")}\n`,
    "      LANGFUSE_INIT_PROJECT_SECRET_KEY: ", value, "\n",
  ];
  c.positive(LF, "container-config", "compose-init", lfCompose({ secret: lfKey("compose-init") }), "yml");

  const lfLitellm = value => [
    "litellm_settings:\n",
    "  success_callback: [\"langfuse\"]\n",
    "  default_team_settings:\n",
    "    - team_id: research\n",
    `      langfuse_public_key: ${lfPub("litellm-config")}\n`,
    "      langfuse_secret: ", value, "\n",
    "      langfuse_host: https://cloud.langfuse.com\n",
  ];
  c.positive(LF, "structured-file", "litellm-config", lfLitellm({ secret: lfKey("litellm-config") }), "yml");

  const lfLog = value => [
    "ERROR proxy: callback init failed team_settings=",
    `{\"team_id\":\"research\",\"metadata\":{\"callback\":{\"name\":\"langfuse\",\"langfuse_public_key\":\"${lfPub("error-log")}\",`,
    "\"langfuse_secret_key\":\"", value, "\"}}}\n",
  ];
  c.positive(LF, "log", "error-log-team-settings", lfLog({ secret: lfKey("error-log") }), "log");

  const lfTs = value => [
    "import { Langfuse } from \"langfuse\";\n\n",
    "export const langfuse = new Langfuse({\n",
    `  publicKey: \"${lfPub("typescript-client")}\",\n`,
    "  secretKey: \"", value, "\",\n",
    "  baseUrl: \"https://cloud.langfuse.com\",\n",
    "});\n",
  ];
  c.positive(LF, "source-code", "typescript-client", lfTs({ secret: lfKey("typescript-client") }), "ts");

  // Twins.
  {
    const body = lfKey("dotenv").slice("sk-lf-".length);
    c.twin(LF, "dotenv", "public-key", lfEnv(`pk-lf-${body}`),
      "sk-lf- replaced by pk-lf-, the public-key namespace Langfuse documents as safe to expose in browser code; the UUID body and context are unchanged", "public-prefix");
  }
  {
    const body = lfKey("python-client").slice("sk-lf-".length);
    c.twin(LF, "python-client", "version-nibble", lfPy(`sk-lf-${body.slice(0, 14)}1${body.slice(15)}`),
      "UUID version nibble changed from 4 to 1, so the body is no longer the version-4 UUID Langfuse's generator mints. Out of the minted-shape claim only; no claim is made about self-hosted operator-defined values", "alphabet");
  }
  {
    const body = lfKey("curl-basic-auth").slice("sk-lf-".length);
    c.twin(LF, "curl-basic-auth", "variant-nibble", lfCurl(`sk-lf-${body.slice(0, 19)}c${body.slice(20)}`),
      "UUID variant nibble changed to c, outside the RFC 4122 variant (8, 9, a, b) randomUUID() always sets. Out of the minted-shape claim only; no claim is made about self-hosted operator-defined values", "alphabet");
  }
  {
    const body = lfKey("litellm-config").slice("sk-lf-".length);
    c.twin(LF, "litellm-config", "short-last-group", lfLitellm(`sk-lf-${body.slice(0, -1)}`),
      "Last UUID group shortened from 12 to 11 hex characters (41 characters total); every other byte and the context are unchanged", "length");
  }
  {
    const body = lfKey("typescript-client").slice("sk-lf-".length);
    c.twin(LF, "typescript-client", "no-hyphens", lfTs(`sk-lf-${body.replaceAll("-", "")}`),
      "The four UUID hyphens are removed, so the body is 32 bare hex characters instead of the 8-4-4-4-12 grouping; the hex characters are unchanged", "boundary");
  }

  c.control(LF, "public-id", "browser-public-key", [
    "import { LangfuseWeb } from \"langfuse\";\n\n",
    "// Browser SDK: public key only; the secret key never ships to the client.\n",
    "const langfuse = new LangfuseWeb({\n",
    `  publicKey: \"${lfPub("browser")}\",\n`,
    "  baseUrl: \"https://cloud.langfuse.com\",\n",
    "});\n",
  ], "ts");
  c.control(LF, "public-id", "trace-url-ids", [
    "Slow span reported by on-call:\n",
    `https://cloud.langfuse.com/project/${hex("langfuse:ctl:project", 25)}/traces/${uuid4("langfuse:ctl:trace")}\n`,
    `observation_id=${uuid4("langfuse:ctl:observation")} session_id=${uuid4("langfuse:ctl:session")}\n`,
  ], "md");
  c.control(LF, "public-id", "region-hosts-env", [
    "# Langfuse region endpoints (no credential in this file)\n",
    "LANGFUSE_BASE_URL=https://cloud.langfuse.com\n",
    "# LANGFUSE_BASE_URL=https://us.cloud.langfuse.com\n",
    "# LANGFUSE_BASE_URL=https://jp.cloud.langfuse.com\n",
    `LANGFUSE_PUBLIC_KEY=${lfPub("region-hosts")}\n`,
  ], "env");
  c.control(LF, "placeholder", "masked-display", [
    "API keys\n",
    `  public key   ${lfPub("masked-display")}\n`,
    `  secret key   sk-lf-...${hex("langfuse:ctl:masked", 4)}\n`,
    "  created      2026-09-01\n",
  ]);
  c.control(LF, "placeholder", "env-example", [
    "# .env.example\n",
    "LANGFUSE_PUBLIC_KEY=pk-lf-...\n",
    "LANGFUSE_SECRET_KEY=<your-langfuse-secret-key>\n",
    "LANGFUSE_BASE_URL=https://cloud.langfuse.com\n",
  ], "env");
  c.control(LF, "reference", "k8s-secret-ref", [
    "        env:\n",
    "          - name: LANGFUSE_SECRET_KEY\n",
    "            valueFrom:\n",
    "              secretKeyRef:\n",
    "                name: langfuse-credentials\n",
    "                key: secret-key\n",
  ], "yml");
  c.control(LF, "reference", "python-env-lookup", [
    "import os\n",
    "from langfuse import Langfuse\n\n",
    "langfuse = Langfuse(secret_key=os.environ[\"LANGFUSE_SECRET_KEY\"], public_key=os.environ[\"LANGFUSE_PUBLIC_KEY\"])\n",
  ], "py");
  c.control(LF, "prose", "key-pair-doc", [
    "Each Langfuse project has a public key and a secret key. The public key can be\n",
    "used in browser code; keep the secret key on the server and rotate it if it\n",
    "is ever committed.\n",
  ], "md");
  c.control(LF, "near-miss", "truncated-uuid", [
    `support ticket: rotated the key that starts sk-lf-${hex("langfuse:ctl:truncated", 8)}-${hex("langfuse:ctl:truncated-2", 4)} after the leak review\n`,
  ]);
  c.control(LF, "near-miss", "prefix-only-grep", [
    "$ grep -rn \"sk-lf-\" services/\n",
    "(no matches)\n",
  ], "log");
  c.control(LF, "encoded-value", "hashed-key-row", [
    "-- api_keys row (secret never stored in clear; digest and display form only)\n",
    `public_key            | ${lfPub("hashed-row")}\n`,
    `fast_hashed_secret_key| ${hex("langfuse:ctl:digest", 64)}\n`,
    `display_secret_key    | sk-lf-...${hex("langfuse:ctl:digest-display", 4)}\n`,
  ], "sql");

  return c.fixtures;
}
