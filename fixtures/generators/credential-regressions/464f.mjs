import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, UPPER_DIGITS, at, authorPositives, guard, probeContexts } from "./464-shared.mjs";

// Issue #464, slice f (category `beta8-464f`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the RunPod API key (rpa_ + at least 31 [A-Za-z0-9], open-ended; handoff redact-secret
// docs/audits/evidence/860/runpod.md at 8b6a5fd; product redact-secret#974). Every value is built here from a
// public `synthetic` seed; bodies are 31 (the policy floor), 46 with and without the 40-upper-plus-6-mixed layout
// the tools report, and 128 (the cap).
//
// POLICY under ruling R10, not T1: the floor of 31 (the provider floor is 16) and the 128-byte cap. The 30-byte twin
// and the Redirect.pizza control assert the policy floor because the handoff decides it; a body of 16-30 is an
// accepted false negative and nothing asserts silence on 129. rps_ S3 secrets are another credential class: a
// benign control, never a positive.

export function build464f({ fixture, synthetic }) {
  const c = beta8Corpus("464f", { fixture, synthetic });
  const T = "runpod-api-key";
  const seed = slug => `beta12:464f:${T}:${slug}`;
  const { check, refuse } = guard("464f", T);
  const layout46 = slug => `${synthetic(seed(`${slug}:upper`), 40, UPPER_DIGITS)}${synthetic(seed(`${slug}:tail`), 6, ALNUM)}`;
  const bodyFor = slug => {
    if (slug === "json-token") return synthetic(seed(slug), 31, ALNUM);
    if (slug === "mcp-env") return synthetic(seed(slug), 128, ALNUM);
    if (["sdk-kwarg", "chat-paste", "runpodctl-config", "python-module"].includes(slug)) return synthetic(seed(slug), 46, ALNUM);
    return layout46(slug);
  };
  const key = slug => check(`rpa_${bodyFor(slug)}`);

  const probe = probeContexts({ env: "RUNPOD_API_KEY", name: "RunPod", host: "rest.runpod.io", ctor: "RunPod" });
  const pyModule = v => ["import runpod\n\nrunpod.api_key = \"", v, "\"\nendpoint = runpod.Endpoint(\"abc123\")\n"];
  const runpodctl = v => ["runpodctl config --apiKey ", v, "\nrunpodctl get pod\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"runpod\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@runpod/mcp-server\"],\n      \"env\": { \"RUNPOD_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const graphql = v => ["curl -s https://api.runpod.io/graphql -H \"Authorization: Bearer ", v, "\" -H \"Content-Type: application/json\" -d '{\"query\": \"{ myself { id } }\"}'\n"];
  const contexts = [...probe,
    { axis: "source-code", slug: "python-module", ext: "py", build: pyModule },
    { axis: "cli", slug: "runpodctl-config", ext: "sh", build: runpodctl },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "curl-graphql-bearer", ext: "sh", build: graphql },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(4);

  c.twin(T, "dotenv", "body-30-policy-floor", put("dotenv", refuse(k.dotenv.slice(0, 4 + 30))), "length: POLICY (ruling R10), not T1: a 30-byte body, Redirect.pizza's width, vs the policy floor of 31 (the provider floor is 16)", "length", "env");
  c.twin(T, "export", "trailing-underscore", put("export", refuse(`${k.export}_x`)), "boundary: _x glued after the alphanumeric run", "boundary", "sh");
  c.twin(T, "json-token", "trailing-hyphen", put("json-token", refuse(`${k["json-token"]}-x`)), "boundary: -x glued after the alphanumeric run", "boundary", "json");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`RPA_${body(k["bearer-header"])}`)), "prefix: RPA_ vs the case-sensitive rpa_", "prefix", "http");
  c.twin(T, "x-api-key-header", "hyphen-prefix", put("x-api-key-header", refuse(`rpa-${body(k["x-api-key-header"])}`)), "boundary: rpa- in place of the rpa_ separator", "boundary", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before rpa_", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before rpa_", "boundary", "txt");

  c.control(T, "near-miss", "redirect-pizza-30", [`REDIRECTPIZZA_API_TOKEN=rpa_${synthetic(seed("redirect-pizza"), 30, ALNUM)}\n`], "env");
  c.control(T, "near-miss", "s3-secret-rps", [`RUNPOD_S3_SECRET_KEY=rps_${synthetic(seed("rps"), 44, ALNUM)}\n`], "env");
  c.control(T, "near-miss", "truncated", [`2026-09-29T10:16:04Z runpod: rejected truncated key rpa_${synthetic(seed("short"), 8, ALNUM)} (length 12)\n`], "log");
  c.control(T, "near-miss", "prefix-at-eol", ["2026-09-29T10:16:20Z runpod: expected a key that starts with rpa_\n"], "log");
  c.control(T, "placeholder", "ellipsis", ["Set RUNPOD_API_KEY to your key (rpa_...) from Settings > API Keys.\n"], "md");
  c.control(T, "placeholder", "x-run", ["RUNPOD_API_KEY=rpa_xxxx\n"], "env");
  c.control(T, "placeholder", "word-fixture", ["RUNPOD_API_KEY=rpa_your_key_for_ci_pipeline_test_fixture_only\n"], "env");
  c.control(T, "reference", "env-reference", ["RUNPOD_API_KEY=${RUNPOD_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      RUNPOD_API_KEY: ${{ secrets.RUNPOD_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["RunPod API keys start with rpa_ and are scoped All or Read Only; S3-compatible secrets start with rps_ and are a different credential.\n"], "md");
  return c.fixtures;
}
