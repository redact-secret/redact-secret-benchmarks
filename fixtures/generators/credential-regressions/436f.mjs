import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, LOWER, at, authorPositives, guard, probeContexts } from "./436-shared.mjs";

// Issue #436, slice f (category `beta8-436f`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Weights & Biases wandb_v1_ API key (handoff redact-secret
// docs/audits/evidence/860/wandb.md at 54fe385; product redact-secret#917). Every value is built here
// from a public `synthetic` seed: wandb_v1_ + a [A-Za-z0-9_] body.
//
// Length: the docs say "about 86" and every provider fixture is 86. By the orchestrator decision on
// redact-secret#917 the product matches a bounded tolerant range around 86, so positives carry totals
// 85, 86 and 87 and no fixture asserts silence on any length (no length twin, no short-body control).
// Deliberately not authored either way: a wandb_v2_ value (unknown version) and a legacy 40-hex key
// under a W&B name (generic context owns it; not this family).

const HOST_ENVELOPE = "Quoted assignment with the on-prem <host>- label: the key name, quotes and the public host label are not secret, but redacting them with the key is acceptable; only the wandb_v1_ key must be covered.";

export function build436f({ fixture, synthetic }) {
  const c = beta8Corpus("436f", { fixture, synthetic });
  const T = "wandb-api-key";
  const seed = slug => `beta11:436f:${T}:${slug}`;
  const { check, refuse } = guard("436f", T);
  /** Total length per positive (86 unless listed); the body carries the 27/_/rest split unless listed as unsplit. */
  const total = { export: 85, "json-api-key": 87, "sdk-kwarg": 85, "netrc-password": 87 };
  const unsplit = new Set(["json-token", "wandb-login"]);
  const key = slug => {
    const n = (total[slug] ?? 86) - 9;
    const body = unsplit.has(slug) ? synthetic(seed(slug), n, ALNUM) : `${synthetic(seed(`${slug}:id`), 27, ALNUM)}_${synthetic(seed(`${slug}:secret`), n - 28, ALNUM)}`;
    return check(`wandb_v1_${body}`);
  };

  const probe = probeContexts({ env: "WANDB_API_KEY", name: "Weights & Biases", host: "api.wandb.ai", ctor: "wandb.Api" });
  const login = v => ["import wandb\n\nwandb.login(key=\"", v, "\")\nrun = wandb.init(project=\"agent-evals\")\n"];
  const netrc = v => ["# ~/.netrc\nmachine api.wandb.ai\n  login user\n  password ", v, "\n"];
  const onPrem = v => ["# self-managed server\nWANDB_BASE_URL=https://wandb.corp.example.test\n", { ...v, envelope: { before: "WANDB_API_KEY=\"local-", after: "\"", reason: HOST_ENVELOPE } }, "\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"wandb\": {\n      \"command\": \"uvx\",\n      \"args\": [\"wandb-mcp-server\"],\n      \"env\": { \"WANDB_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const contexts = [...probe,
    { axis: "sdk-config", slug: "wandb-login", ext: "py", build: login },
    { axis: "basic-auth", slug: "netrc-password", ext: "netrc", build: netrc },
    { axis: "env", slug: "on-prem-host-label", ext: "env", build: onPrem },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(9);

  c.twin(T, "dotenv", "hyphen-in-body", put("dotenv", refuse(at(k.dotenv, 50, "-"))), "alphabet: one body byte replaced by -, outside [A-Za-z0-9_]", "alphabet", "env");
  c.twin(T, "export", "uppercase-prefix", put("export", refuse(`WANDB_V1_${body(k.export)}`)), "prefix: WANDB_V1_ vs the lower-case wandb_v1_", "prefix", "sh");
  c.twin(T, "bearer-header", "hyphen-prefix", put("bearer-header", refuse(`wandb-v1-${body(k["bearer-header"])}`)), "boundary: wandb-v1- in place of the underscore delimiters", "boundary", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before wandb_v1_", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before wandb_v1_", "boundary", "txt");
  c.twin(T, "json-token", "trailing-hyphen", put("json-token", refuse(`${k["json-token"]}-x`)), "boundary: -x glued after the body", "boundary", "json");

  c.control(T, "placeholder", "ellipsis", ["export WANDB_API_KEY=wandb_v1_...\n"], "sh");
  c.control(T, "placeholder", "test-constant-shape", ["const FAKE_KEY = \"wandb_v1_test_key_for_config_masking_1234567\";\n"], "ts");
  c.control(T, "reference", "env-reference", ["WANDB_API_KEY=${WANDB_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      WANDB_API_KEY: ${{ secrets.WANDB_API_KEY }}\n"], "yml");
  c.control(T, "encoded-value", "git-sha", [`commit ${synthetic(seed("git-sha"), 40, HEX)}\nAuthor: CI Bot <ci@example.test>\n`], "txt");
  c.control(T, "public-id", "version-identifiers", ["def wandb_version_1_migration(run):\n    return run.config.get(\"wandb_version\")\n"], "py");
  c.control(T, "public-id", "entity-and-project", [`WANDB_ENTITY=${synthetic(seed("entity"), 8, LOWER)}\nWANDB_PROJECT=agent-evals\nWANDB_BASE_URL=https://api.wandb.ai\n`], "env");
  c.control(T, "prose", "key-guidance", ["W&B now issues longer API keys that start with wandb_v1_; older 40-character keys still work. Set WANDB_API_KEY or run wandb login.\n"], "md");
  return c.fixtures;
}
