import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, at, authorPositives, guard, probeContexts } from "./464-shared.mjs";

// Issue #464, slice b (category `beta8-464b`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the ClickHouse Cloud API key secret (4b1d + exactly 38 [A-Za-z0-9]; T1 as of 2025-04-16;
// handoff redact-secret docs/audits/evidence/860/clickhouse-cloud.md at 8b6a5fd; product redact-secret#971). Every
// value is built here from a public `synthetic` seed.
//
// POLICY, not T1: the product's at-least-one-uppercase guard. The provider staff regex admits an all-lowercase
// body, so no fixture asserts silence on one. Every positive body is mixed case and every twin keeps a mixed-case
// body, so the guard is never what a fixture measures. The key ID (Basic-auth username) is an unmarked companion.

const hasUpper = v => /[A-Z]/.test(v.slice(4));

export function build464b({ fixture, synthetic }) {
  const c = beta8Corpus("464b", { fixture, synthetic });
  const T = "clickhouse-cloud-api-secret";
  const seed = slug => `beta12:464b:${T}:${slug}`;
  const { check, refuse } = guard("464b", T);
  const key = slug => {
    const v = check(`4b1d${synthetic(seed(slug), 38, ALNUM)}`);
    if (!hasUpper(v)) throw new Error(`beta8-464b: ${slug} positive body is not mixed case`);
    return v;
  };
  // A twin must keep a mixed-case body, so the policy guard is never the reason it is silent.
  const mixed = v => {
    if (!hasUpper(v)) throw new Error("beta8-464b: a twin lost its uppercase body byte, so the policy guard would explain it");
    return v;
  };
  const keyId = slug => synthetic(seed(`key-id:${slug}`), 20, ALNUM);
  const uuid = slug => { const h = synthetic(seed(`uuid:${slug}`), 32, HEX); return `${h.slice(0, 8)}-4b1d-4${h.slice(9, 12)}-a${h.slice(13, 16)}-${h.slice(16, 28)}`; };

  const probe = probeContexts({ env: "CLICKHOUSE_CLOUD_API_SECRET", name: "ClickHouse Cloud", host: "api.clickhouse.cloud", ctor: "ClickHouseCloud" });
  const terraform = v => [`provider "clickhouse" {\n  organization_id = "${uuid("org")}"\n  token_key       = "${keyId("tf")}"\n  token_secret    = "`, v, "\"\n}\n"];
  const curlVar = v => ["curl -s --user $KEY_ID:", v, " https://api.clickhouse.cloud/v1/organizations\n"];
  const curlLiteral = v => [`curl -s --user ${keyId("curl")}:`, v, " https://api.clickhouse.cloud/v1/organizations/services\n"];
  const dotenvPair = v => [`CLICKHOUSE_CLOUD_API_KEY_ID=${keyId("pair")}\nCLICKHOUSE_CLOUD_API_SECRET=`, v, "\n"];
  const requests = v => [`import requests\n\nKEY_ID = "${keyId("py")}"\nresp = requests.get("https://api.clickhouse.cloud/v1/organizations", auth=(KEY_ID, "`, v, "\"))\n"];
  const actions = v => ["jobs:\n  provision:\n    steps:\n      - run: ./scripts/provision.sh\n        env:\n          CLICKHOUSE_CLOUD_API_SECRET: ", v, "\n"];
  const compose = v => ["services:\n  provisioner:\n    image: example.test/provisioner:latest\n    environment:\n      CLICKHOUSE_CLOUD_API_SECRET: ", v, "\n"];
  const contexts = [...probe,
    { axis: "container-config", slug: "compose-env", ext: "yml", build: compose },
    { axis: "structured-file", slug: "terraform-token-secret", ext: "tf", build: terraform },
    { axis: "basic-auth", slug: "curl-user-var", ext: "sh", build: curlVar },
    { axis: "basic-auth", slug: "curl-user-literal", ext: "sh", build: curlLiteral },
    { axis: "env", slug: "dotenv-key-id-pair", ext: "env", build: dotenvPair },
    { axis: "source-code", slug: "python-requests-auth", ext: "py", build: requests },
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(4);

  c.twin(T, "dotenv", "body-37", put("dotenv", refuse(mixed(k.dotenv.slice(0, -1)))), "length: a 37-byte body vs exactly 38", "length", "env");
  c.twin(T, "export", "body-39", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, ALNUM)}`)), "length: a 39-byte body vs exactly 38", "length", "sh");
  c.twin(T, "json-token", "knowledge-base-39-byte-total", put("json-token", refuse(mixed(k["json-token"].slice(0, -3)))), "length: the older 39-byte total (35 after the prefix), set aside by ruling R3 date order", "length", "json");
  c.twin(T, "json-api-key", "uppercase-prefix", put("json-api-key", refuse(`4B1D${body(k["json-api-key"])}`)), "prefix: 4B1D vs the lower-case 4b1d the provider staff stated", "prefix", "json");
  c.twin(T, "bearer-header", "wrong-prefix-4b1c", put("bearer-header", refuse(`4b1c${body(k["bearer-header"])}`)), "prefix: 4b1c vs 4b1d", "prefix", "http");
  c.twin(T, "x-api-key-header", "hyphen-in-body", put("x-api-key-header", refuse(mixed(at(k["x-api-key-header"], 30, "-")))), "alphabet: one body byte replaced by -, outside [A-Za-z0-9]", "alphabet", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`a${k["bare-prose"]}`)), "boundary: a glued before 4b1d, so the run reads a4b1d…", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before 4b1d", "boundary", "txt");
  c.twin(T, "curl-user-var", "trailing-underscore", put("curl-user-var", refuse(`${k["curl-user-var"]}_x`)), "boundary: _x glued after the 38-byte body", "boundary", "sh");
  c.twin(T, "sdk-kwarg", "trailing-hyphen", put("sdk-kwarg", refuse(`${k["sdk-kwarg"]}-x`)), "boundary: -x glued after the 38-byte body", "boundary", "py");

  c.control(T, "public-id", "uuid-with-4b1d", [`organization_id: ${uuid("ctl-a")}\nservice_id: ${uuid("ctl-b")}\n`], "yml");
  c.control(T, "public-id", "key-id-alone", [`CLICKHOUSE_CLOUD_API_KEY_ID=${keyId("ctl")}\n`], "env");
  c.control(T, "encoded-value", "sha1-digest-4b1d", [`git rev-parse HEAD\n4b1d${synthetic(seed("sha1"), 36, HEX)}\n`], "txt");
  c.control(T, "encoded-value", "sha256-digest-4b1d", [`sha256:4b1d${synthetic(seed("sha256"), 60, HEX)}\n`], "txt");
  c.control(T, "encoded-value", "base64-run-mid", [`payload: ${synthetic(seed("b64a"), 8, ALNUM)}4b1d${synthetic(seed("b64b"), 40, ALNUM)}\n`], "yml");
  c.control(T, "placeholder", "docs-placeholders", ["KEY_ID=mykeyid\nKEY_SECRET=mykeysecret\ncurl --user $KEY_ID:$KEY_SECRET https://api.clickhouse.cloud/v1/organizations\n"], "sh");
  c.control(T, "placeholder", "ellipsis", ["Set CLICKHOUSE_CLOUD_API_SECRET to your key secret (4b1d...) from the console.\n"], "md");
  c.control(T, "reference", "env-reference", ["CLICKHOUSE_CLOUD_API_SECRET=${CLICKHOUSE_CLOUD_API_SECRET}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      CLICKHOUSE_CLOUD_API_SECRET: ${{ secrets.CLICKHOUSE_CLOUD_API_SECRET }}\n"], "yml");
  c.control(T, "near-miss", "truncated", [`2026-09-29T10:12:30Z provision: rejected truncated secret 4b1d${synthetic(seed("short"), 12, ALNUM)} from 203.0.113.9\n`], "log");
  c.control(T, "prose", "key-guidance", ["ClickHouse Cloud API keys are a key ID and a key secret used as HTTP Basic credentials; the secret is shown once.\n"], "md");
  return c.fixtures;
}
