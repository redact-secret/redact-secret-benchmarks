import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, at, authorPositives, guard, probeContexts } from "./464-shared.mjs";

// Issue #464, slice a (category `beta8-464a`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Daytona API key (dtn_ + exactly 64 lowercase hex; T1 as of v0.190.0 under ruling R9;
// handoff redact-secret docs/audits/evidence/860/daytona.md at 8b6a5fd; product redact-secret#970). Every value is
// built here from a public `synthetic` seed in the documented shape.
//
// The bare 64-hex SHA-256 and the unprefixed self-provisioned runner key are lexically the same body without the
// prefix, so they are encoded-value controls, never positives. dtn_secret_ and dtn_artifact_ identifiers are
// near-miss controls. The contract is dated (T1 as of the generator, 2026-06-23): nothing asserts the live cloud.

export function build464a({ fixture, synthetic }) {
  const c = beta8Corpus("464a", { fixture, synthetic });
  const T = "daytona-api-key";
  const seed = slug => `beta12:464a:${T}:${slug}`;
  const { check, refuse } = guard("464a", T);
  const key = slug => check(`dtn_${synthetic(seed(slug), 64, HEX)}`);

  const probe = probeContexts({ env: "DAYTONA_API_KEY", name: "Daytona", host: "app.daytona.io", ctor: "Daytona" });
  const pyConfig = v => ["from daytona import Daytona, DaytonaConfig\n\nconfig = DaytonaConfig(api_key=\"", v, "\")\ndaytona = Daytona(config)\nsandbox = daytona.create()\n"];
  const tsClient = v => ["import { Daytona } from '@daytonaio/sdk';\n\nconst daytona = new Daytona({ apiKey: '", v, "' });\nconst sandbox = await daytona.create();\n"];
  const terraform = v => ["# terraform.tfvars\nproject = \"agent-sandboxes\"\ndaytona_api_key = \"", v, "\"\n"];
  const curl = v => ["curl -s https://app.daytona.io/api/sandbox -H \"Authorization: Bearer ", v, "\"\n"];
  const sandboxLog = v => ["2026-09-29T10:10:02Z runner: registered sandbox pool with DAYTONA_API_KEY=", v, " region=us\n"];
  const compose = v => ["services:\n  agent:\n    image: example.test/agent:latest\n    environment:\n      DAYTONA_API_KEY: ", v, "\n"];
  const actions = v => ["jobs:\n  e2e:\n    steps:\n      - run: pytest tests/sandbox\n        env:\n          DAYTONA_API_KEY: ", v, "\n"];
  const contexts = [...probe,
    { axis: "container-config", slug: "compose-env", ext: "yml", build: compose },
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "sdk-config", slug: "python-config", ext: "py", build: pyConfig },
    { axis: "source-code", slug: "ts-client", ext: "ts", build: tsClient },
    { axis: "structured-file", slug: "terraform-variable", ext: "tfvars", build: terraform },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
    { axis: "log", slug: "sandbox-log", ext: "log", build: sandboxLog },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(4);

  c.twin(T, "dotenv", "body-63", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 63-byte body vs exactly 64", "length", "env");
  c.twin(T, "export", "body-65", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, HEX)}`)), "length: a 65-byte body vs exactly 64", "length", "sh");
  c.twin(T, "json-token", "uppercase-hex-byte", put("json-token", refuse(at(k["json-token"], 10, "A"))), "alphabet: one body byte as uppercase hex, which the generator never emits", "alphabet", "json");
  c.twin(T, "json-api-key", "non-hex-letter", put("json-api-key", refuse(at(k["json-api-key"], 20, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`DTN_${body(k["bearer-header"])}`)), "prefix: DTN_ vs the lower-case dtn_ the generator emits", "prefix", "http");
  c.twin(T, "x-api-key-header", "hyphen-separator", put("x-api-key-header", refuse(`dtn-${body(k["x-api-key-header"])}`)), "boundary: dtn- in place of the dtn_ separator", "boundary", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before dtn_", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before dtn_", "boundary", "txt");
  c.twin(T, "curl-bearer", "trailing-underscore", put("curl-bearer", refuse(`${k["curl-bearer"]}_x`)), "boundary: _x glued after the 64-byte body", "boundary", "sh");
  c.twin(T, "sdk-kwarg", "trailing-hyphen", put("sdk-kwarg", refuse(`${k["sdk-kwarg"]}-x`)), "boundary: -x glued after the 64-byte body", "boundary", "py");

  c.control(T, "near-miss", "secret-placeholder", [`Secret handle injected into the sandbox: dtn_secret_${synthetic(seed("secret-handle"), 24, ALNUM)}\n`], "txt");
  c.control(T, "near-miss", "secret-then-hex", [`DAYTONA_SECRET_REF=dtn_secret_${synthetic(seed("secret-hex"), 64, HEX)}\n`], "env");
  c.control(T, "near-miss", "artifact-marker", [`2026-09-29T10:11:40Z sandbox stdout: dtn_artifact_${synthetic(seed("artifact"), 12, ALNUM)} written to /workspace/out\n`], "log");
  c.control(T, "placeholder", "masked", ["Created API key \"ci\" (dtn_***) for the platform organization.\n"], "md");
  c.control(T, "placeholder", "ellipsis", ["export DAYTONA_API_KEY=dtn_...  # from the dashboard\n"], "sh");
  c.control(T, "placeholder", "openapi-example", ["{ \"apiKey\": \"dtn_1234567890\", \"name\": \"ci\" }\n"], "json");
  c.control(T, "encoded-value", "bare-sha256", [`sha256sum daytona-runner.tar.gz\n${synthetic(seed("sha256"), 64, HEX)}  daytona-runner.tar.gz\n`], "txt");
  c.control(T, "encoded-value", "runner-key-unprefixed", [`RUNNER_API_KEY=${synthetic(seed("runner"), 64, HEX)}\n`], "env");
  c.control(T, "encoded-value", "named-bare-hex", [`DAYTONA_API_KEY=${synthetic(seed("named-hex"), 64, HEX)}\n`], "env");
  c.control(T, "reference", "env-reference", ["DAYTONA_API_KEY=${DAYTONA_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      DAYTONA_API_KEY: ${{ secrets.DAYTONA_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["Daytona API keys start with dtn_; sandbox Secrets are injected as dtn_secret_ handles and are not API keys.\n"], "md");
  return c.fixtures;
}
