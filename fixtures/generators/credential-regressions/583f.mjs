import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, DIGITS, HEX, URLSAFE, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice f (category `beta8-583f`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Pydantic Logfire token namespace `pylf_v<n>_<region>_` + an optional organization UUID + an
// alphanumeric body (handoff redact-secret docs/audits/evidence/1014/pydantic-logfire.md at 3b1a5aa; product
// redact-secret#1106). Every value is built here from a public `synthetic` seed (prefix, version, region and UUID are
// assembled from the grammar's own parts, the body is synthetic filler); nothing is copied from a provider test fixture,
// a scanner test vector or an issued key, and no complete key-shaped literal appears in this file.
//
// The body floor is a policy (ruling Q7), so nothing here asserts silence below it: the 19-byte body, a body broken by a
// non-alphanumeric byte inside the first 20, a region over 16 letters and a version over 3 digits are UNCLAIMED twins
// (listed in benchmarks/evaluation/domains/credential/assessment.ts DISPUTED_PROPERTIES, scored T0). Asserted twins differ from a
// positive by prefix, version, region, organization-id shape or boundary only.

export function build583f({ fixture, synthetic }) {
  const c = beta8Corpus("583f", { fixture, synthetic });
  const T = "pydantic-logfire-token";
  const seed = slug => `beta14:583f:${T}:${slug}`;
  const body = (s, n, alphabet = ALNUM) => synthetic(s, n, alphabet);
  const { check, refuse } = guard("583f", T);

  const prefix = (version, region) => ["pylf", `v${version}`, region, ""].join("_");
  const uuid = (slug, caseOf = "lower") => {
    const h = body(seed(`org:${slug}`), 32, HEX);
    const u = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
    return caseOf === "upper" ? u.toUpperCase() : u;
  };
  // Per-context shape: version, region, organization id case (v2 keys carry one), body width.
  const SHAPE = {
    "bare-prose": { v: 1, r: "us" },
    "dotenv": { v: 1, r: "us" },
    "export": { v: 1, r: "eu" },
    "bearer-header": { v: 2, r: "us", org: "lower" },
    "x-api-key-header": { v: 1, r: "eu" },
    "json-token": { v: 2, r: "eu", org: "lower" },
    "json-api-key": { v: 2, r: "us", org: "upper" },
    "sdk-kwarg": { v: 1, r: "stagingus" },
    "chat-paste": { v: 1, r: "ap" },
    "logfire-read-token": { v: 1, r: "us" },
    "logfire-api-key": { v: 2, r: "eu", org: "lower" },
    "gateway-key": { v: 2, r: "us", org: "lower" },
    "configure-token": { v: 1, r: "us" },
    "otel-headers": { v: 1, r: "eu" },
    "actions-env": { v: 1, r: "us", n: 64 },
    "compose-env": { v: 2, r: "stagingeu", org: "upper" },
  };
  const parts = slug => {
    const s = SHAPE[slug];
    return { s, pre: prefix(s.v, s.r), org: s.org ? `${uuid(slug, s.org)}_` : "", n: s.n ?? 44 };
  };
  const tail = (slug, n) => body(seed(`body:${slug}`), n ?? parts(slug).n);
  const key = slug => { const p = parts(slug); return check(`${p.pre}${p.org}${tail(slug)}`); };
  const head = slug => { const p = parts(slug); return `${p.pre}${p.org}`; };

  const probe = probeContexts({ env: "LOGFIRE_TOKEN", name: "Logfire", host: "logfire-us.pydantic.dev", ctor: "LogfireClient" });
  const readEnv = v => ["# .env\nLOGFIRE_READ_TOKEN=", v, "\nLOGFIRE_BASE_URL=https://logfire-us.pydantic.dev\n"];
  const apiKeyEnv = v => ["# .env.production\nLOGFIRE_API_KEY=", v, "\nLOGFIRE_PROJECT=billing-api\n"];
  const gatewayEnv = v => ["# .env\nPYDANTIC_AI_GATEWAY_API_KEY=", v, "\nMODEL=gateway/openai:gpt-5\n"];
  const configure = v => ["import logfire\n\nlogfire.configure(token=\"", v, "\", service_name=\"billing-api\")\nlogfire.info(\"started\")\n"];
  const otel = v => ["export OTEL_EXPORTER_OTLP_ENDPOINT=https://logfire-us.pydantic.dev\nexport OTEL_EXPORTER_OTLP_HEADERS='Authorization=", v, "'\n"];
  const actions = v => ["jobs:\n  test:\n    steps:\n      - run: pytest\n        env:\n          LOGFIRE_TOKEN: ", v, "\n"];
  const compose = v => ["services:\n  api:\n    image: billing-api:latest\n    environment:\n      LOGFIRE_API_KEY: ", v, "\n"];
  const contexts = [...probe,
    { axis: "env", slug: "logfire-read-token", ext: "env", build: readEnv },
    { axis: "env", slug: "logfire-api-key", ext: "env", build: apiKeyEnv },
    { axis: "env", slug: "gateway-key", ext: "env", build: gatewayEnv },
    { axis: "sdk-config", slug: "configure-token", ext: "py", build: configure },
    { axis: "cli", slug: "otel-headers", ext: "sh", build: otel },
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "container-config", slug: "compose-env", ext: "yml", build: compose },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const swap = (slug, value) => put(slug, value);

  // Asserted twins: one property each (prefix, version, region, organization-id shape, boundary), over a positive's own context.
  c.twin(T, "dotenv", "uppercase-prefix", swap("dotenv", refuse(`PYLF_${(head("dotenv") + tail("dotenv")).slice(5)}`)), "prefix: uppercase PYLF_ vs the case-sensitive pylf_", "prefix", "env");
  c.twin(T, "export", "no-version-digits", swap("export", refuse(`pylf_v_eu_${tail("export")}`)), "version: pylf_v_ with no digits vs pylf_v<digits>_", "prefix", "sh");
  c.twin(T, "bearer-header", "no-region", swap("bearer-header", refuse(`pylf_v2__${uuid("bearer-header", "lower")}_${tail("bearer-header")}`)), "region: the region segment removed (pylf_v2__) vs a lowercase region", "prefix", "http");
  c.twin(T, "x-api-key-header", "uppercase-region", swap("x-api-key-header", refuse(`pylf_v1_EU_${tail("x-api-key-header")}`)), "region: uppercase EU vs the lowercase [a-z]+ region", "prefix", "http");
  c.twin(T, "json-token", "uuid-short-first-group", swap("json-token", refuse(`pylf_v2_eu_${uuid("json-token").slice(1)}_${tail("json-token")}`)), "organization id: first UUID group of 7 hex vs 8 (not a UUID segment)", "prefix", "json");
  c.twin(T, "json-api-key", "uuid-wide-fourth-group", swap("json-api-key", refuse(`pylf_v2_us_${(() => { const u = uuid("json-api-key", "upper"); return `${u.slice(0, 19)}F${u.slice(19)}`; })()}_${tail("json-api-key")}`)), "organization id: fourth UUID group of 5 hex vs 4 (not a UUID segment)", "prefix", "json");
  c.twin(T, "sdk-kwarg", "region-digit", swap("sdk-kwarg", refuse(`pylf_v1_us1_${tail("sdk-kwarg")}`)), "region: a digit inside the region vs [a-z]+", "prefix", "py");
  c.twin(T, "gateway-key", "different-prefix", swap("gateway-key", refuse(`plyf_v2_us_${uuid("gateway-key")}_${tail("gateway-key")}`)), "prefix: plyf_ (two letters swapped) vs pylf_", "prefix", "env");
  c.twin(T, "bare-prose", "leading-glue", swap("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before pylf_, so the run does not start at the prefix", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-glue", swap("chat-paste", refuse(`${k["chat-paste"]}-`)), "boundary: a - glued after the body, so the run continues past the alphanumeric body", "boundary", "txt");
  c.twin(T, "compose-env", "trailing-underscore-glue", swap("compose-env", refuse(`${k["compose-env"]}_`)), "boundary: a _ glued after the body, so the run continues past the alphanumeric body", "boundary", "yml");

  // Unclaimed shapes: the body floor is a policy (Q7), and the provider regexes leave the rest open. T0 via DISPUTED_PROPERTIES.
  c.twin(T, "dotenv", "body-19", swap("dotenv", `${head("dotenv")}${tail("dotenv", 19)}`), "length: a 19-byte body, one under the policy floor of 20; unclaimed (Q7, no assertion of silence)", "length", "env");
  c.twin(T, "logfire-read-token", "read-body-19", swap("logfire-read-token", `${head("logfire-read-token")}${tail("logfire-read-token", 19)}`), "length: a 19-byte body, one under the policy floor of 20; unclaimed (Q7, no assertion of silence)", "length", "env");
  c.twin(T, "logfire-api-key", "uuid-body-19", swap("logfire-api-key", `${head("logfire-api-key")}${tail("logfire-api-key", 19)}`), "length: a v2 key with an organization UUID and a 19-byte body; unclaimed (Q7)", "length", "env");
  c.twin(T, "json-token", "plus-in-body", swap("json-token", `${head("json-token")}${at(tail("json-token"), 5, "+")}`), "alphabet: one early body byte replaced by +; the run breaks inside the first 20, so silence would rest on the policy floor; unclaimed (Q7)", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "slash-in-body", swap("sdk-kwarg", `${head("sdk-kwarg")}${at(tail("sdk-kwarg"), 8, "/")}`), "alphabet: one early body byte replaced by /; silence would rest on the policy floor; unclaimed (Q7)", "alphabet", "py");
  c.twin(T, "configure-token", "dash-in-body", swap("configure-token", `${head("configure-token")}${at(tail("configure-token"), 12, "-")}`), "alphabet: a - inside a non-UUID body; the gateway parser admits it and no provider source issues it; unclaimed", "alphabet", "py");
  c.twin(T, "otel-headers", "underscore-in-body", swap("otel-headers", `${head("otel-headers")}${at(tail("otel-headers"), 25, "_")}`), "alphabet: a _ inside a non-UUID body; the gateway parser admits it; unclaimed", "alphabet", "sh");
  c.twin(T, "x-api-key-header", "region-over-16", swap("x-api-key-header", `pylf_v1_${body(seed("region17"), 17, "abcdefghijklmnopqrstuvwxyz")}_${tail("x-api-key-header")}`), "region: 17 lowercase letters; the product's cap is a policy and the provider regex has none; unclaimed", "prefix", "http");
  c.twin(T, "export", "version-four-digits", swap("export", `pylf_v${body(seed("ver4"), 4, DIGITS)}_eu_${tail("export")}`), "version: four digits; the product's 1-to-3 cap is a policy and the provider regex has none; unclaimed", "prefix", "sh");

  // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a
  // reference or an obvious placeholder, so no credential-named-neighbour policy redaction reads as a false alarm.
  c.control(T, "near-miss", "other-vendor-prefix", [`2026-10-05T09:12:03Z exporter: loaded plf_v1_us_${body(seed("ctl:other"), 44)} from the cache index (not a Logfire token)\n`], "log");
  c.control(T, "near-miss", "prefix-only", ["Logfire tokens start with pylf_v<n>_<region>_; the rest of the value is never printed.\n"], "md");
  c.control(T, "near-miss", "scrubber-pattern", ["scrubbing:\n  extra_patterns:\n    - 'pylf_v\\d+_'\n"], "yml");
  c.control(T, "encoded-value", "sha256-digest", [`artifact digest sha256:${body(seed("ctl:digest"), 64, HEX)}\n`], "txt");
  c.control(T, "encoded-value", "base64-blob-padding", [`logo: data:image/png;base64,iVBORw0KGgo${body(seed("ctl:b64:a"), 40)}E${"A".repeat(79)}${body(seed("ctl:b64:b"), 40)}\n`], "yml");
  c.control(T, "public-id", "project-url", [`dashboard: https://logfire-us.pydantic.dev/acme/billing-api (project ${body(seed("ctl:proj"), 8, HEX)}, public in the browser)\n`], "md");
  c.control(T, "public-id", "region-hostname", ["endpoint: https://logfire-us.pydantic.dev/v1/traces\nbackup: https://logfire-eu.pydantic.dev/v1/traces\n"], "yml");
  c.control(T, "placeholder", "ellipsis", ["LOGFIRE_TOKEN=pylf_v1_us_...\n"], "env");
  c.control(T, "placeholder", "angle-brackets", ["export LOGFIRE_TOKEN=\"pylf_v1_us_<your-write-token>\"\n"], "sh");
  c.control(T, "placeholder", "masked-cli-output", [`Token: pylf_v1_us_${body(seed("ctl:mask"), 5)}****  (masked by the dashboard)\n`], "txt");
  c.control(T, "reference", "env-reference", ["LOGFIRE_TOKEN=${LOGFIRE_TOKEN}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          LOGFIRE_TOKEN: ${{ secrets.LOGFIRE_TOKEN }}\n"], "yml");
  c.control(T, "reference", "os-environ", ["logfire.configure(token=os.environ[\"LOGFIRE_TOKEN\"])\n"], "py");
  c.control(T, "prose", "token-guidance", ["A Logfire write token lets a service send traces to one project; keep it in a secret store and revoke it from the project settings if it leaks.\n"], "md");
  return c.fixtures;
}
