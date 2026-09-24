import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";
import { base36Crc, gitlabRoutableValid, contracts as arrivalContracts, registryContracts } from "../../../benchmarks/lib/beta8/212.ts";

// Four of these families graduated to registry detectors (redact-secret#730); their contracts moved to `registryContracts`.
const contracts = { ...arrivalContracts, ...registryContracts };

// Issue #212 corpus (category `beta8-212`). See docs/specs/beta8-evidence.md.
// Five second-wave families (research #226-#230), six arrival targets: the
// Pinecone legacy UUID key is its own context-gated target. Every value is a
// `synthetic()` seed or is built by code below from synthetic bytes (the GitLab
// routable checksum); nothing is provider-issued, scanner-reported, copied from
// a provider documentation example or derived from a real credential.

const PERPLEXITY = "perplexity-api-key";
const FIREWORKS = "fireworks-ai-api-key";
const PINECONE = "pinecone-api-key";
const PINECONE_LEGACY = "pinecone-api-key-legacy";
const SLACK_USER = "slack-user-token";
const GITLAB_RUNNER = "gitlab-runner-authentication-token";

const DIGITS = "0123456789";
const HEX = "0123456789abcdef";
// Base58-consistent (#227 row 17: observed Fireworks bodies avoided 0/O/I/l).
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
// Devise.friendly_token: urlsafe_base64 with l, I, O, 0 translated away (#230 row 7).
const FRIENDLY = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789_-";

export function build212({ fixture, synthetic }) {
  const c = beta8Corpus(212, { fixture, synthetic });
  const seed = (target, slug) => `beta8:212:${target}:${slug}`;
  const check = (target, value) => {
    const contract = contracts[target];
    if (!new RegExp(contract.pattern).test(value) || !(contract.validate?.(value) ?? true))
      throw new Error(`beta8-212: authored ${target} positive fails its own contract: ${value.slice(0, 8)}...`);
    return value;
  };
  const uuid = s => { const h = synthetic(s, 32, HEX); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
  const b64 = text => Buffer.from(text).toString("base64");

  // ---------------------------------------------------------------- Perplexity
  {
    const T = PERPLEXITY;
    const key = slug => check(T, `pplx-${synthetic(seed(T, slug), 48)}`);
    const k = Object.fromEntries(["env", "shell", "bearer", "sdk", "cli-file", "revoke", "mcp", "ci"].map(s => [s, key(s)]));
    c.positive(T, "env", "dotenv", ["PERPLEXITY_API_KEY=", { secret: k.env }, "\nPERPLEXITY_BASE_URL=https://api.perplexity.ai\n"], "env");
    c.positive(T, "shell-export", "pplx-export", ["# LangChain ChatPerplexity reads PPLX_API_KEY\nexport PPLX_API_KEY=\"", { secret: k.shell }, "\"\n"], "sh");
    c.positive(T, "header", "bearer-curl", ["curl https://api.perplexity.ai/chat/completions -H \"Authorization: Bearer ", { secret: k.bearer }, "\" -H \"Content-Type: application/json\" -d '{\"model\": \"sonar\", \"messages\": [{\"role\": \"user\", \"content\": \"ping\"}]}'\n"], "sh");
    c.positive(T, "sdk-config", "python-client", ["from perplexity import Perplexity\n\nclient = Perplexity(api_key=\"", { secret: k.sdk }, "\")\n"], "py");
    c.positive(T, "structured-file", "cli-credentials", ["{\n  \"api_key\": \"", { secret: k["cli-file"] }, "\"\n}\n"], "json");
    c.positive(T, "tool-output", "revoke-payload", ["POST /revoke_auth_token\n{\"auth_token\": \"", { secret: k.revoke }, "\"}\n"], "txt");
    c.positive(T, "header", "mcp-config", ["{\n  \"mcpServers\": {\n    \"perplexity\": {\n      \"url\": \"https://api.perplexity.ai/mcp\",\n      \"headers\": { \"Authorization\": \"Bearer ", { secret: k.mcp }, "\" }\n    }\n  }\n}\n"], "json");
    c.positive(T, "ci-config", "actions-env", ["jobs:\n  search:\n    runs-on: ubuntu-latest\n    env:\n      PERPLEXITYAI_API_KEY: ", { secret: k.ci }, "\n    steps:\n      - run: python search.py\n"], "yml");

    const tw = (pos, slug, before, value, after, mutation, kind, ext) => c.twin(T, pos, slug, [before, value, after], mutation, kind, ext);
    tw("dotenv", "short-body", "PERPLEXITY_API_KEY=", k.env.slice(0, -1), "\nPERPLEXITY_BASE_URL=https://api.perplexity.ai\n", "length: 47-character body vs the tool-corroborated 48 (gitleaks/osv-scalibr exact 48; flare-redact accepts 40-60, a recorded peer difference, not a provider exclusion)", "length", "env");
    tw("bearer-curl", "long-body", "curl https://api.perplexity.ai/chat/completions -H \"Authorization: Bearer ", `${k.bearer}Q`, "\" -H \"Content-Type: application/json\" -d '{\"model\": \"sonar\", \"messages\": [{\"role\": \"user\", \"content\": \"ping\"}]}'\n", "length: 49-character body vs the tool-corroborated 48 (flare-redact's 40-60 range still accepts it; recorded peer difference)", "length", "sh");
    tw("python-client", "missing-dash", "from perplexity import Perplexity\n\nclient = Perplexity(api_key=\"", `pplx${k.sdk.slice(5)}`, "\")\n", "boundary: prefix delimiter dropped (pplx + body vs the provider-documented pplx-); osv-scalibr's test rejects this shape", "boundary", "py");
    tw("cli-credentials", "underscore-delimiter", "{\n  \"api_key\": \"", `pplx_${k["cli-file"].slice(5)}`, "\"\n}\n", "boundary: underscore delimiter (pplx_ vs the provider-documented pplx-)", "boundary", "json");
    tw("revoke-payload", "uppercase-prefix", "POST /revoke_auth_token\n{\"auth_token\": \"", `PPLX-${k.revoke.slice(5)}`, "\"}\n", "prefix namespace: PPLX- vs the provider-documented lowercase pplx-", "prefix", "txt");
    tw("actions-env", "inner-dash", "jobs:\n  search:\n    runs-on: ubuntu-latest\n    env:\n      PERPLEXITYAI_API_KEY: ", `${k.ci.slice(0, 29)}-${k.ci.slice(30)}`, "\n    steps:\n      - run: python search.py\n", "alphabet: one body byte replaced with \"-\" (48-character body kept), outside the tool-corroborated [A-Za-z0-9] body; osv-scalibr's test rejects an internal dash", "alphabet", "yml");

    c.control(T, "placeholder", "docs-placeholder", ["PERPLEXITY_API_KEY=pplx-your-api-key-here\n"], "env");
    c.control(T, "placeholder", "masked-display", ["Key ci-search created. Stored value: pplx-****************************************Xy7Q (shown once)\n"]);
    c.control(T, "public-id", "embedding-model", ["response = client.embeddings.create(model=\"pplx-embed-v1-0.6b\", input=[\"hello\"])\n"], "py");
    c.control(T, "public-id", "base-url-and-name", ["PERPLEXITY_BASE_URL=https://api.perplexity.ai\nPERPLEXITY_TOKEN_NAME=ci-search-2026\n"], "env");
    c.control(T, "reference", "env-reference", ["PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}\n"], "env");
    c.control(T, "reference", "sdk-environ", ["import os\nclient = Perplexity(api_key=os.environ[\"PERPLEXITY_API_KEY\"])\n"], "py");
    c.control(T, "near-miss", "prefix-only", ["# paste your key after the prefix\nPERPLEXITY_API_KEY=pplx-\n"], "env");
    c.control(T, "near-miss", "package-name", ["pip install pplx-srch-sdk\npplx auth login\n"], "sh");
    c.control(T, "encoded-value", "base64-model", [`model_b64: ${b64("pplx-embed-context-v1-4b")}\n`], "yml");
    c.control(T, "prose", "key-guidance", ["Perplexity API keys start with pplx- and are shown only once in the console; store them in PERPLEXITY_API_KEY, never in the repository.\n"], "md");
  }

  // -------------------------------------------------------------- Fireworks AI
  {
    const T = FIREWORKS;
    const key = (slug, n) => check(T, `fw_${synthetic(seed(T, slug), n, BASE58)}`);
    const k = { env: key("env", 22), shell: key("shell", 24), bearer: key("bearer", 22), header: key("header", 24), sdk: key("sdk", 24), cli: key("cli", 22), yaml: key("yaml", 22), js: key("js", 24) };
    c.positive(T, "env", "dotenv", ["FIREWORKS_API_KEY=", { secret: k.env }, "\nFIREWORKS_ACCOUNT_ID=acme-ml\n"], "env");
    c.positive(T, "shell-export", "litellm-export", ["export FIREWORKS_AI_API_KEY=\"", { secret: k.shell }, "\"\n"], "sh");
    c.positive(T, "header", "bearer-curl", ["curl https://api.fireworks.ai/inference/v1/chat/completions -H \"Authorization: Bearer ", { secret: k.bearer }, "\" -H \"Content-Type: application/json\"\n"], "sh");
    c.positive(T, "header", "x-fireworks-header", ["ANTHROPIC_CUSTOM_HEADERS=\"X-Fireworks-Api-Key: ", { secret: k.header }, "\"\n"], "env");
    c.positive(T, "sdk-config", "python-client", ["from fireworks import Fireworks\n\nclient = Fireworks(api_key=\"", { secret: k.sdk }, "\")\n"], "py");
    c.positive(T, "cli", "firectl-flag", ["firectl list models --api-key ", { secret: k.cli }, "\n"], "sh");
    c.positive(T, "structured-file", "litellm-yaml", ["model_list:\n  - model_name: llama\n    litellm_params:\n      model: fireworks_ai/accounts/fireworks/models/llama-v3p1-8b-instruct\n      api_key: ", { secret: k.yaml }, "\n"], "yml");
    c.positive(T, "source-code", "vercel-ai-sdk", ["import { createFireworks } from '@ai-sdk/fireworks';\n\nconst fireworks = createFireworks({ apiKey: '", { secret: k.js }, "' });\n"], "ts");

    const tw = (pos, slug, before, value, after, mutation, kind, ext) => c.twin(T, pos, slug, [before, value, after], mutation, kind, ext);
    tw("dotenv", "hyphen-delimiter", "FIREWORKS_API_KEY=", `fw-${k.env.slice(3)}`, "\nFIREWORKS_ACCOUNT_ID=acme-ml\n", "boundary: hyphen delimiter (fw- vs the documented fw_); provider code accepts only fw_/fpk_ prefixes. One community report writes fw-, recorded as a contradiction, not evidence", "boundary", "env");
    tw("litellm-export", "uppercase-prefix", "export FIREWORKS_AI_API_KEY=\"", `FW_${k.shell.slice(3)}`, "\"\n", "prefix namespace: FW_ vs the documented lowercase fw_ (provider code's startsWith check is case-sensitive)", "prefix", "sh");
    tw("bearer-curl", "letter-prefix", "curl https://api.fireworks.ai/inference/v1/chat/completions -H \"Authorization: Bearer ", `fv_${k.bearer.slice(3)}`, "\" -H \"Content-Type: application/json\"\n", "prefix namespace: fv_ vs the documented fw_ (one-letter deviation; neither fw_ nor fpk_)", "prefix", "sh");
    tw("python-client", "missing-delimiter", "from fireworks import Fireworks\n\nclient = Fireworks(api_key=\"", `fw${k.sdk.slice(3)}`, "\")\n", "boundary: prefix delimiter dropped (fw + body vs the documented fw_)", "boundary", "py");
    tw("firectl-flag", "transposed-prefix", "firectl list models --api-key ", `wf_${k.cli.slice(3)}`, "\n", "prefix namespace: wf_ vs the documented fw_ (transposed; neither fw_ nor fpk_)", "prefix", "sh");

    c.control(T, "placeholder", "docs-placeholder", ["FIREWORKS_API_KEY=fw_your_api_key\n"], "env");
    c.control(T, "placeholder", "ellipsis", ["export FIREWORKS_API_KEY=\"fw_...\"\n"], "sh");
    c.control(T, "placeholder", "console-prefix", ["NAME        KEY PREFIX   CREATED\nci-deploy   fw_3kQ9      2026-09-01\n"]);
    c.control(T, "public-id", "account-and-model", ["FIREWORKS_ACCOUNT_ID=acme-ml\nMODEL=accounts/fireworks/models/llama-v3p1-8b-instruct\n"], "env");
    c.control(T, "public-id", "service-account", ["firectl api-key create --service-account ci-bot@acme-ml.sa.fireworks.ai --key-name ci-deploy\n"], "sh");
    c.control(T, "near-miss", "workflow-ids", ["fw_id = launchpad.add_wf(workflow)\nfw_spec = {\"_category\": \"gpu\"}\n"], "py");
    c.control(T, "near-miss", "firmware-version", ["fw_version=2.14.1-rc3\nfw_env=/etc/fw_env.config\n"], "conf");
    c.control(T, "reference", "sdk-environ", ["import os\nclient = Fireworks(api_key=os.environ[\"FIREWORKS_API_KEY\"])\n"], "py");
    c.control(T, "reference", "keychain-reference", ["{\n  \"apiKey\": \"{keychain:fireworks-api-key}\"\n}\n"], "json");
    c.control(T, "encoded-value", "base64-account", [`FIREWORKS_ACCOUNT_B64=${b64("accounts/acme-ml")}\n`], "env");
    c.control(T, "prose", "key-guidance", ["Fireworks API keys start with fw_ and are shown only when created; Fire Pass keys are a separate product. Keep them in FIREWORKS_API_KEY.\n"], "md");
  }

  // ------------------------------------------------------ Pinecone (pcsk_ keys)
  {
    const T = PINECONE;
    const key = (slug, label = 5) => check(T, `pcsk_${synthetic(seed(T, `${slug}:label`), label)}_${synthetic(seed(T, `${slug}:secret`), 63)}`);
    const k = { env: key("env", 5), shell: key("shell", 6), header: key("header", 5), sdk: key("sdk", 6), ts: key("ts", 5), cli: key("cli", 6), json: key("json", 5), ci: key("ci", 6) };
    c.positive(T, "env", "dotenv", ["PINECONE_API_KEY=", { secret: k.env }, "\nPINECONE_INDEX=docs\n"], "env");
    c.positive(T, "shell-export", "export", ["export PINECONE_API_KEY=\"", { secret: k.shell }, "\"\n"], "sh");
    c.positive(T, "header", "api-key-header", ["curl https://api.pinecone.io/indexes -H \"Api-Key: ", { secret: k.header }, "\" -H \"X-Pinecone-Api-Version: 2025-10\"\n"], "sh");
    c.positive(T, "sdk-config", "python-client", ["from pinecone import Pinecone\n\npc = Pinecone(api_key=\"", { secret: k.sdk }, "\")\n"], "py");
    c.positive(T, "source-code", "ts-client", ["import { Pinecone } from '@pinecone-database/pinecone';\n\nconst pc = new Pinecone({ apiKey: '", { secret: k.ts }, "' });\n"], "ts");
    c.positive(T, "cli", "pc-config", ["pc config set api-key ", { secret: k.cli }, "\n"], "sh");
    c.positive(T, "structured-file", "n8n-credential", ["{\n  \"name\": \"Pinecone account\",\n  \"type\": \"pineconeApi\",\n  \"data\": { \"apiKey\": \"", { secret: k.json }, "\" }\n}\n"], "json");
    c.positive(T, "ci-config", "actions-env", ["jobs:\n  ingest:\n    runs-on: ubuntu-latest\n    env:\n      PINECONE_API_KEY: ", { secret: k.ci }, "\n"], "yml");

    const split = v => { const [, label, secret] = v.split("_"); return { label, secret }; };
    const tw = (pos, slug, before, value, after, mutation, kind, ext) => c.twin(T, pos, slug, [before, value, after], mutation, kind, ext);
    { const { label, secret } = split(k.env); tw("dotenv", "short-label", "PINECONE_API_KEY=", `pcsk_${label.slice(0, 4)}_${secret}`, "\nPINECONE_INDEX=docs\n", "length: 4-character label vs the tool-corroborated 5-6 (trufflehog's pinecone test rejects a 4-character label)", "length", "env"); }
    { const { label, secret } = split(k.shell); tw("export", "long-label", "export PINECONE_API_KEY=\"", `pcsk_${label}Q_${secret}`, "\"\n", "length: 7-character label vs the tool-corroborated 5-6", "length", "sh"); }
    { const { label, secret } = split(k.header); tw("api-key-header", "short-secret", "curl https://api.pinecone.io/indexes -H \"Api-Key: ", `pcsk_${label}_${secret.slice(0, 62)}`, "\" -H \"X-Pinecone-Api-Version: 2025-10\"\n", "length: 62-character secret segment vs the tool-corroborated 63", "length", "sh"); }
    { const { label, secret } = split(k.sdk); tw("python-client", "long-secret", "from pinecone import Pinecone\n\npc = Pinecone(api_key=\"", `pcsk_${label}_${secret}Q`, "\")\n", "length: 64-character secret segment vs the tool-corroborated 63 (pleno-dlp's open pcsk_[A-Za-z0-9_]{40,} still accepts it; recorded peer difference)", "length", "py"); }
    tw("ts-client", "hyphen-delimiter", "import { Pinecone } from '@pinecone-database/pinecone';\n\nconst pc = new Pinecone({ apiKey: '", `pcsk-${k.ts.slice(5)}`, "' });\n", "boundary: hyphen after the prefix (pcsk- vs the provider-code pcsk_)", "boundary", "ts");

    const project = uuid(seed(T, "project-id"));
    c.control(T, "placeholder", "cli-mask", ["$ pc auth status\nAPI key: pcsk***Qm4t (project: docs)\n"]);
    c.control(T, "placeholder", "ellipsis", ["pc config set api-key pcsk_...\n"], "sh");
    c.control(T, "placeholder", "header-placeholder", ["curl https://api.pinecone.io/indexes -H \"Api-Key: YOUR_API_KEY\"\n"], "sh");
    c.control(T, "public-id", "index-host", ["PINECONE_HOST=https://docs-q7k2m1x.svc.aped-4627-b74a.pinecone.io\nPINECONE_INDEX=docs\n"], "env");
    c.control(T, "public-id", "project-id", [`PINECONE_PROJECT_ID=${project}\nPINECONE_ENVIRONMENT=us-east1-gcp\n`], "env");
    c.control(T, "public-id", "cli-environment", ["# selects Pinecone's own deployment target, not a cloud region\nPINECONE_ENVIRONMENT=staging\n"], "env");
    c.control(T, "reference", "env-reference", ["PINECONE_API_KEY=${PINECONE_API_KEY}\n"], "env");
    c.control(T, "reference", "sdk-environ", ["import os\npc = Pinecone(api_key=os.environ[\"PINECONE_API_KEY\"])\n"], "py");
    c.control(T, "near-miss", "prefix-only", ["# create a key in the console; it starts with pcsk_\nPINECONE_API_KEY=pcsk_\n"], "env");
    c.control(T, "encoded-value", "base64-host", [`PINECONE_HOST_B64=${b64("docs-q7k2m1x.svc.aped-4627-b74a.pinecone.io")}\n`], "env");
    c.control(T, "prose", "key-guidance", ["Pinecone shows a new API key once in the console; copy it into PINECONE_API_KEY and never commit it.\n"], "md");
  }

  // ---------------------------------------- Pinecone legacy UUID (context-gated)
  {
    const T = PINECONE_LEGACY;
    // Each positive: [slug, axis, before, after, ext, twin: [contiguous identifier edit on `before`], mutation].
    const positives = [
      ["dotenv", "env", "PINECONE_API_KEY=", "\nPINECONE_ENVIRONMENT=us-west1-gcp\n", "env", ["PINECONE_API_KEY=", "PINECONE_PROJECT_ID="], "PINECONE_API_KEY renamed PINECONE_PROJECT_ID"],
      ["export", "shell-export", "export PINECONE_API_KEY=\"", "\"\n", "sh", ["PINECONE_API_KEY", "PINECONE_INDEX_ID"], "PINECONE_API_KEY renamed PINECONE_INDEX_ID"],
      ["legacy-init", "sdk-config", "import pinecone\n\npinecone.init(api_key=\"", "\", environment=\"us-west1-gcp\")\n", "py", ["pinecone.init(api_key=", "pinecone.init(project_id="], "api_key= keyword renamed project_id="],
      ["api-key-header", "header", "curl -X POST https://docs-q7k2m1x.svc.us-west1-gcp.pinecone.io/query -H \"Api-Key: ", "\" -H \"Content-Type: application/json\"\n", "sh", ["Api-Key:", "X-Project-Id:"], "Api-Key header renamed X-Project-Id"],
      ["ts-legacy-init", "source-code", "const pinecone = new PineconeClient();\nawait pinecone.init({ apiKey: \"", "\", environment: \"us-west4-gcp\" });\n", "ts", ["init({ apiKey:", "init({ projectId:"], "apiKey property renamed projectId"],
      ["yaml-config", "structured-file", "vectorstore:\n  pinecone_api_key: ", "\n  pinecone_environment: us-east1-gcp\n", "yml", ["pinecone_api_key:", "pinecone_project_id:"], "pinecone_api_key renamed pinecone_project_id"],
      ["actions-env", "ci-config", "jobs:\n  ingest:\n    env:\n      PINECONE_API_KEY: ", "\n      PINECONE_ENVIRONMENT: us-west1-gcp\n", "yml", ["PINECONE_API_KEY:", "PINECONE_DATABASE_ID:"], "PINECONE_API_KEY renamed PINECONE_DATABASE_ID"],
      ["compose-env", "container-config", "services:\n  retriever:\n    environment:\n      - PINECONE_API_KEY=", "\n      - PINECONE_ENVIRONMENT=us-east1-gcp\n", "yml", ["PINECONE_API_KEY=", "PINECONE_SERVICE_ACCOUNT_ID="], "PINECONE_API_KEY renamed PINECONE_SERVICE_ACCOUNT_ID"],
      ["langchain", "sdk-config", "vectorstore = PineconeVectorStore(index_name=\"docs\", pinecone_api_key=\"", "\")\n", "py", ["pinecone_api_key=", "pinecone_index_id="], "pinecone_api_key keyword renamed pinecone_index_id"],
      ["terraform-output", "tool-output", "$ terraform output\npinecone_api_key = \"", "\"\n", "txt", ["pinecone_api_key =", "pinecone_project_id ="], "pinecone_api_key output renamed pinecone_project_id"],
      ["n8n-credential", "structured-file", "{\"type\": \"pineconeApi\", \"data\": {\"apiKey\": \"", "\", \"environment\": \"us-west1-gcp\"}}\n", "json", ["\"apiKey\":", "\"indexId\":"], "apiKey field renamed indexId"],
      ["shell-key", "shell-export", "export PINECONE_KEY=", "\n", "sh", ["PINECONE_KEY=", "PINECONE_UUID="], "PINECONE_KEY renamed PINECONE_UUID"],
    ];
    for (const [slug, axis, before, after, ext, [from, to], mutation] of positives) {
      const value = uuid(seed(T, slug));
      c.positive(T, axis, slug, [before, { secret: value }, after], ext);
      if (!before.includes(from)) throw new Error(`beta8-212: ${slug} twin edit not found`);
      c.twin(T, slug, `${slug}-identifier`, [before.replace(from, to), value, after], `context: ${mutation}; the UUID is kept byte-for-byte. A bare UUID beside a Pinecone project/index/database/service-account id name is a public identifier shape, not a legacy key`, "context", ext);
    }
    const ids = n => uuid(seed(T, `public-${n}`));
    const controls = [
      ["near-miss", "empty-assignment", "PINECONE_ENVIRONMENT=us-west1-gcp\nPINECONE_API_KEY=\n", "env"],
      ["near-miss", "none-argument", "pinecone.init(api_key=None, environment=\"us-west1-gcp\")\n", "py"],
      ["near-miss", "empty-header", "curl https://docs-q7k2m1x.svc.us-west1-gcp.pinecone.io/describe_index_stats -H \"Api-Key: \"\n", "sh"],
      ["near-miss", "empty-string", "PINECONE_API_KEY=\"\"  # set in CI\n", "env"],
      ["public-id", "project-id", `PINECONE_PROJECT_ID=${ids(1)}\n`, "env"],
      ["public-id", "admin-key-object", `{"key": {"id": "${ids(2)}", "name": "ci-ingest", "project_id": "${ids(3)}", "roles": ["ProjectEditor"]}}\n`, "json"],
      ["public-id", "service-account-id", `{"service_account": {"id": "${ids(4)}", "name": "ci-bot"}}\n`, "json"],
      ["public-id", "database-id", `DATABASE_ID=${ids(5)}\n`, "env"],
      ["encoded-value", "base64-host", `PINECONE_HOST_B64=${b64("docs-q7k2m1x.svc.us-west1-gcp.pinecone.io")}\n`, "env"],
      ["encoded-value", "base64-environment", `{"environment_b64": "${b64("us-east1-gcp")}"}\n`, "json"],
      ["encoded-value", "url-encoded-host", "redirect=https%3A%2F%2Fapp.pinecone.io%2Forganizations%2Facme%2Fprojects\n", "txt"],
      ["encoded-value", "sha256-index-name", `index_digest: ${createHash("sha256").update("docs-index").digest("hex")}\n`, "yml"],
      ["reference", "env-reference", "PINECONE_API_KEY=${PINECONE_API_KEY}\n", "env"],
      ["reference", "sdk-environ", "pinecone.init(api_key=os.environ[\"PINECONE_API_KEY\"], environment=\"us-west1-gcp\")\n", "py"],
      ["reference", "process-env", "await pinecone.init({ apiKey: process.env.PINECONE_API_KEY, environment: \"us-west4-gcp\" });\n", "ts"],
      ["reference", "actions-secret", "      PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}\n", "yml"],
      ["placeholder", "x-uuid", "PINECONE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\n", "env"],
      ["placeholder", "zero-uuid", "PINECONE_API_KEY=00000000-0000-0000-0000-000000000000\n", "env"],
      ["placeholder", "your-api-key", "pinecone.init(api_key=\"YOUR_API_KEY\", environment=\"YOUR_ENVIRONMENT\")\n", "py"],
      ["placeholder", "sdk-repr-mask", "Config(api_key=...9f2c, host='https://api.pinecone.io')\n", "txt"],
      ["prose", "migration-note", "Older Pinecone projects used an API key paired with an environment such as us-west1-gcp; newer SDKs no longer take an environment.\n", "md"],
      ["prose", "uuid-note", "Pinecone project ids, key ids and service-account ids are all UUIDs, so a UUID alone does not tell you it is a key.\n", "md"],
      ["prose", "rotation-note", "Rotate the Pinecone API key in the console, then update PINECONE_API_KEY in the deployment secrets.\n", "md"],
      ["prose", "header-note", "Every Pinecone REST request carries the key in an Api-Key header, never in the URL.\n", "md"],
    ];
    for (const [axis, slug, content, ext] of controls) c.control(T, axis, slug, [content], ext);
  }

  // ---------------------------------------------------------- Slack user token
  {
    const T = SLACK_USER;
    const token = (slug, [a, b, cc], secretLength = 32) => check(T, `xoxp-${synthetic(seed(T, `${slug}:a`), a, DIGITS)}-${synthetic(seed(T, `${slug}:b`), b, DIGITS)}-${synthetic(seed(T, `${slug}:c`), cc, DIGITS)}-${synthetic(seed(T, `${slug}:secret`), secretLength, HEX)}`);
    const k = {
      env: token("env", [12, 12, 12]), bearer: token("bearer", [11, 10, 11]), oauth: token("oauth", [13, 13, 13]), sdk: token("sdk", [12, 12, 12]),
      url: token("url", [12, 12, 12]), cli: token("cli", [10, 12, 13]), ci: token("ci", [12, 12, 12]),
      // Pre-August-2016 user tokens may carry a 10-character secret (docs.slack.dev/authentication/tokens).
      legacy: token("legacy", [11, 11, 11], 10),
    };
    c.positive(T, "env", "dotenv", ["SLACK_USER_TOKEN=", { secret: k.env }, "\nSLACK_TEAM_ID=T0SYNTH01\n"], "env");
    c.positive(T, "header", "bearer-curl", ["curl -s https://slack.com/api/auth.test -H \"Authorization: Bearer ", { secret: k.bearer }, "\"\n"], "sh");
    c.positive(T, "tool-output", "oauth-v2-access", ["{\n  \"ok\": true,\n  \"app_id\": \"A0SYNTH01\",\n  \"authed_user\": {\n    \"id\": \"U0SYNTH01\",\n    \"scope\": \"search:read\",\n    \"access_token\": \"", { secret: k.oauth }, "\",\n    \"token_type\": \"user\"\n  },\n  \"team\": { \"id\": \"T0SYNTH01\", \"name\": \"Acme\" }\n}\n"], "json");
    c.positive(T, "sdk-config", "python-webclient", ["from slack_sdk import WebClient\n\nclient = WebClient(token=\"", { secret: k.sdk }, "\")\n"], "py");
    c.positive(T, "url", "legacy-query-token", ["GET https://slack.com/api/search.messages?token=", { secret: k.url }, "&query=deploy HTTP/1.1\n"]);
    c.positive(T, "cli", "slack-login", ["slack login --token ", { secret: k.cli }, "\n"], "sh");
    c.positive(T, "ci-config", "audit-env", ["jobs:\n  audit:\n    runs-on: ubuntu-latest\n    env:\n      SLACK_ADMIN_TOKEN: ", { secret: k.ci }, "\n"], "yml");
    c.positive(T, "shell-export", "legacy-short-secret", ["# pre-2016 legacy user token (10-character secret)\nexport SLACK_LEGACY_TOKEN=", { secret: k.legacy }, "\n"], "sh");

    const tw = (pos, slug, before, value, after, mutation, kind, ext) => c.twin(T, pos, slug, [before, value, after], mutation, kind, ext);
    tw("dotenv", "stem-prefix", "SLACK_USER_TOKEN=", `xoyp-${k.env.slice(5)}`, "\nSLACK_TEAM_ID=T0SYNTH01\n", "prefix namespace: xoyp- breaks the xox stem every documented Slack token prefix shares (the registry slack-token twin precedent, xoyb-)", "prefix", "env");
    tw("python-webclient", "uppercase-prefix", "from slack_sdk import WebClient\n\nclient = WebClient(token=\"", `XOXP-${k.sdk.slice(5)}`, "\")\n", "prefix namespace: XOXP- vs the provider-documented lowercase xoxp-", "prefix", "py");
    tw("bearer-curl", "underscore-delimiter", "curl -s https://slack.com/api/auth.test -H \"Authorization: Bearer ", `xoxp_${k.bearer.slice(5)}`, "\"\n", "boundary: underscore after the prefix (xoxp_ vs the documented dash-separated xoxp-)", "boundary", "sh");
    tw("oauth-v2-access", "dotted-sections", "{\n  \"ok\": true,\n  \"app_id\": \"A0SYNTH01\",\n  \"authed_user\": {\n    \"id\": \"U0SYNTH01\",\n    \"scope\": \"search:read\",\n    \"access_token\": \"", `xoxp-${k.oauth.slice(5).replaceAll("-", ".")}`, "\",\n    \"token_type\": \"user\"\n  },\n  \"team\": { \"id\": \"T0SYNTH01\", \"name\": \"Acme\" }\n}\n", "boundary: sections joined by \".\" instead of the documented \"-\" separator", "boundary", "json");
    tw("audit-env", "missing-secret", "jobs:\n  audit:\n    runs-on: ubuntu-latest\n    env:\n      SLACK_ADMIN_TOKEN: ", k.ci.slice(0, k.ci.lastIndexOf("-")), "\n", "length: the final secret section (documented as the secret) is dropped, leaving only the three numeric sections", "length", "yml");

    c.control(T, "public-id", "auth-test", ["{\"ok\": true, \"url\": \"https://acme.slack.com/\", \"team\": \"Acme\", \"user\": \"ci-bot\", \"team_id\": \"T0SYNTH01\", \"user_id\": \"U0SYNTH02\", \"bot_id\": \"B0SYNTH03\"}\n"], "json");
    c.control(T, "public-id", "channel-ids", ["SLACK_CHANNEL_ID=C0SYNTH04\nSLACK_TEAM_ID=T0SYNTH01\nSLACK_ENTERPRISE_ID=E0SYNTH05\n"], "env");
    c.control(T, "public-id", "webhook-host-only", ["SLACK_API_BASE=https://slack.com/api/\nSLACK_WORKSPACE_URL=https://acme.slack.com/\n"], "env");
    c.control(T, "placeholder", "docs-placeholder", ["SLACK_USER_TOKEN=xoxp-your-user-token\n"], "env");
    c.control(T, "placeholder", "masked-sections", ["SLACK_USER_TOKEN=xoxp-XXXXXXXXXXXX-XXXXXXXXXXXX-XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n"], "env");
    c.control(T, "placeholder", "masked-log", ["[info] using user token xoxp-****…**** for search:read\n"], "log");
    c.control(T, "reference", "env-reference", ["SLACK_USER_TOKEN=${SLACK_USER_TOKEN}\n"], "env");
    c.control(T, "reference", "sdk-environ", ["import os\nclient = WebClient(token=os.environ[\"SLACK_USER_TOKEN\"])\n"], "py");
    c.control(T, "near-miss", "prefix-only", ["# user token goes here\nSLACK_USER_TOKEN=xoxp-\n"], "env");
    c.control(T, "encoded-value", "base64-workspace", [`SLACK_WORKSPACE_B64=${b64("https://acme.slack.com/")}\n`], "env");
    c.control(T, "prose", "token-guidance", ["Slack user tokens start with xoxp- and act as the installing user; bot tokens start with xoxb-. Request only the user scopes you need.\n"], "md");
  }

  // ------------------------------------------- GitLab runner authentication token
  {
    const T = GITLAB_RUNNER;
    const legacy = slug => check(T, `glrt-${synthetic(seed(T, slug), 20, FRIENDLY)}`);
    const partitioned = (slug, type) => check(T, `glrt-t${type}_${synthetic(seed(T, slug), 20, FRIENDLY)}`);
    // routable_token.rb: 16 random bytes + sorted "k:v" routing lines (integer values in base36)
    // + one payload-size byte, base64url without padding, then .01.<2-char base36 length>, then the
    // 7-char base36 CRC32 of everything before it. Random bytes are synthetic, never SecureRandom.
    const encode = (slug, routing) => {
      const payload = Object.entries(routing).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v.toString(36)}`).join("\n");
      const bytes = Buffer.concat([Buffer.from(synthetic(seed(T, `${slug}:random`), 32, HEX), "hex"), Buffer.from(payload), Buffer.from([payload.length])]);
      const body = bytes.toString("base64url");
      return { body, head: `glrt-${body}.01.${body.length.toString(36).padStart(2, "0")}` };
    };
    const routable = (slug, routing) => { const { head } = encode(slug, routing); return check(T, head + base36Crc(head)); };
    const n = (slug, digits) => Number(synthetic(seed(T, `${slug}:id`), digits, DIGITS)) + 1;
    const routing = (slug, type, scope) => ({ c: 1, o: n(`${slug}:o`, 6), [scope]: n(`${slug}:${scope}`, 7), t: type, u: n(`${slug}:u`, 6) });
    const k = {
      toml: routable("config-toml", routing("config-toml", 3, "p")),
      register: routable("register", routing("register", 3, "p")),
      env: legacy("env"),
      helm: routable("helm", routing("helm", 2, "g")),
      api: routable("api", routing("api", 1, "o")),
      secret: legacy("k8s-secret"),
      docker: partitioned("docker", 3),
    };
    c.positive(T, "structured-file", "config-toml", ["concurrent = 4\n\n[[runners]]\n  name = \"docker-ci\"\n  url = \"https://gitlab.example.com/\"\n  id = 42\n  token = \"", { secret: k.toml }, "\"\n  token_obtained_at = 2026-09-01T10:00:00Z\n  token_expires_at = 0001-01-01T00:00:00Z\n  executor = \"docker\"\n"], "toml");
    c.positive(T, "cli", "register-flag", ["gitlab-runner register --non-interactive \\\n  --url https://gitlab.example.com \\\n  --token \"", { secret: k.register }, "\" \\\n  --executor docker --docker-image alpine:3.20\n"], "sh");
    c.positive(T, "env", "ci-server-token", ["CI_SERVER_URL=https://gitlab.example.com\nCI_SERVER_TOKEN=", { secret: k.env }, "\n"], "env");
    c.positive(T, "container-config", "helm-values", ["gitlabUrl: https://gitlab.example.com/\nrunnerToken: \"", { secret: k.helm }, "\"\nrbac:\n  create: true\n"], "yml");
    c.positive(T, "tool-output", "user-runners-response", ["$ curl --request POST --header \"PRIVATE-TOKEN: $PAT\" --data \"runner_type=instance_type\" https://gitlab.example.com/api/v4/user/runners\n{\"id\":9001,\"token\":\"", { secret: k.api }, "\",\"token_expires_at\":null}\n"]);
    c.positive(T, "container-config", "k8s-secret", ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: gitlab-runner-secret\ntype: Opaque\nstringData:\n  runner-registration-token: \"\"\n  runner-token: \"", { secret: k.secret }, "\"\n"], "yml");
    c.positive(T, "cli", "docker-register", ["docker run --rm -v /srv/gitlab-runner/config:/etc/gitlab-runner gitlab/gitlab-runner register \\\n  --non-interactive --url https://gitlab.example.com --token ", { secret: k.docker }, " --executor shell\n"], "sh");

    const tw = (pos, slug, before, value, after, mutation, kind, ext) => c.twin(T, pos, slug, [before, value, after], mutation, kind, ext);
    const tomlBefore = "concurrent = 4\n\n[[runners]]\n  name = \"docker-ci\"\n  url = \"https://gitlab.example.com/\"\n  id = 42\n  token = \"";
    const tomlAfter = "\"\n  token_obtained_at = 2026-09-01T10:00:00Z\n  token_expires_at = 0001-01-01T00:00:00Z\n  executor = \"docker\"\n";
    // Checksum twin: the last 7 base36 characters no longer equal the CRC32 of the text before them.
    const crcTail = k.toml.slice(-7), wrongCrc = crcTail.slice(0, -1) + (crcTail.endsWith("0") ? "1" : "0");
    const badCrc = k.toml.slice(0, -7) + wrongCrc;
    if (gitlabRoutableValid(badCrc)) throw new Error("beta8-212: checksum twin still validates");
    tw("config-toml", "checksum-mismatch", tomlBefore, badCrc, tomlAfter, "internal marker: checksum; the last 7 base36 characters are not the CRC32 of the preceding text (every other byte, width and alphabet unchanged), which GitLab's routable_token.rb never emits and its offline check rejects", "boundary", "toml");
    // Base36 twin: one checksum-tail letter uppercased. Integer#to_s(36) and GitLab's own rule emit [0-9a-z] only.
    const registerTail = k.register.slice(-9), letterAt = [...registerTail].findIndex(ch => /[a-z]/.test(ch));
    if (letterAt < 0) throw new Error("beta8-212: register seed has no base36 letter in its tail");
    const upper = k.register.slice(0, -9) + registerTail.slice(0, letterAt) + registerTail[letterAt].toUpperCase() + registerTail.slice(letterAt + 1);
    tw("register-flag", "uppercase-base36", "gitlab-runner register --non-interactive \\\n  --url https://gitlab.example.com \\\n  --token \"", upper, "\" \\\n  --executor docker --docker-image alpine:3.20\n", "alphabet: one base36 letter in the length/checksum tail uppercased; GitLab's generator (Integer#to_s(36)) and its provider-authored rule ([0-9a-z]) emit lowercase only", "alphabet", "sh");
    // Length-holder twin: the 2-char base36 payload length is off by one; the CRC is recomputed so only the length holder is wrong.
    {
      const { body } = encode("helm", routing("helm", 2, "g"));
      const head = `glrt-${body}.01.${(body.length + 1).toString(36).padStart(2, "0")}`, value = head + base36Crc(head);
      if (gitlabRoutableValid(value)) throw new Error("beta8-212: length-holder twin still validates");
      tw("helm-values", "length-holder-mismatch", "gitlabUrl: https://gitlab.example.com/\nrunnerToken: \"", value, "\"\nrbac:\n  create: true\n", "length: the base36 payload-length holder claims one more character than the base64url payload carries (checksum recomputed over the altered text, so only the length holder is wrong)", "length", "yml");
    }
    tw("ci-server-token", "short-body", "CI_SERVER_URL=https://gitlab.example.com\nCI_SERVER_TOKEN=", k.env.slice(0, -1), "\n", "length: 19-character legacy body vs the 20-character Devise.friendly_token GitLab's token field generates", "length", "env");
    tw("k8s-secret", "stem-prefix", "apiVersion: v1\nkind: Secret\nmetadata:\n  name: gitlab-runner-secret\ntype: Opaque\nstringData:\n  runner-registration-token: \"\"\n  runner-token: \"", `xlrt-${k.secret.slice(5)}`, "\"\n", "prefix namespace: xlrt- breaks the gl- stem every GitLab token prefix shares (the registry gitlab-token twin precedent, xlpat-); real gl- siblings are secrets and are not used", "prefix", "yml");
    tw("docker-register", "underscore-delimiter", "docker run --rm -v /srv/gitlab-runner/config:/etc/gitlab-runner gitlab/gitlab-runner register \\\n  --non-interactive --url https://gitlab.example.com --token ", `glrt_${k.docker.slice(5)}`, " --executor shell\n", "boundary: underscore after the prefix (glrt_ vs the documented glrt-)", "boundary", "sh");

    const systemId = `s_${synthetic(seed(T, "system-id"), 12, HEX)}`;
    c.control(T, "public-id", "system-id", [`$ gitlab-runner verify\nVerifying runner... is valid  runner=42 system_id=${systemId}\n`]);
    c.control(T, "public-id", "short-sha", ["Running with gitlab-runner 18.3.0 (5c3a7e1b)\n  on docker-ci Ab3xY9kQ, system ID: s_4e1f0a9c2b7d\n"], "log");
    c.control(T, "public-id", "runner-object", ["{\"id\":42,\"description\":\"docker-ci\",\"active\":true,\"paused\":false,\"runner_type\":\"project_type\",\"token_expires_at\":null}\n"], "json");
    c.control(T, "placeholder", "redacted", ["[[runners]]\n  token = \"glrt-REDACTED\"\n"], "toml");
    c.control(T, "placeholder", "angle-placeholder", ["gitlab-runner register --url https://gitlab.example.com --token \"<runner-authentication-token>\"\n"], "sh");
    c.control(T, "placeholder", "masked", ["runner-token: glrt-****\n"], "yml");
    c.control(T, "reference", "shell-reference", ["gitlab-runner register --non-interactive --url https://gitlab.example.com --token \"$RUNNER_TOKEN\"\n"], "sh");
    c.control(T, "reference", "helm-template", ["runnerToken: \"{{ .Values.secrets.runnerToken }}\"\n"], "yml");
    c.control(T, "near-miss", "prefix-only", ["Runner authentication tokens start with glrt- (or glrtr- for runners registered with a registration token).\nRUNNER_TOKEN_PREFIX=glrt-\n"], "env");
    c.control(T, "encoded-value", "base64-url", [`CI_SERVER_URL_B64=${b64("https://gitlab.example.com/")}\n`], "env");
    c.control(T, "prose", "migration-note", ["Create the runner in the UI first, then register it with the runner authentication token instead of a registration token; registration tokens are deprecated.\n"], "md");
  }

  return c.fixtures;
}
