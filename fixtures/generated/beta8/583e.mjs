import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, DIGITS, HEX, LOWER_ALNUM, URLSAFE, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice e (category `beta8-583e`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Buildkite token detector `buildkite-token`: one of the provider's 15 prefixes (bkua_, bkur_, bktx_,
// bkaa_, bkar_, bkct_, bkcqt_, bkaj_, bkjat_, bkpt_, bkrt_, bktr_, bkat_, bkpat_, bkps_), an underscore, then 24 to 2048 bytes
// over [A-Za-z0-9_.-] (handoff redact-secret docs/audits/evidence/1014/buildkite.md at the 3b1a5aa re-pin; product
// redact-secret#1105). Every value is built here from a public `synthetic` seed (hex, base58 after a short org-id segment,
// base64url, or a three-part JWT whose parts are base64url-encoded synthetic JSON); nothing is copied from a provider example,
// a scanner test vector or an issued token, and no complete key-shaped literal appears in this file.
//
// The provider states no per-type length, so nothing narrower than its own floor and cap is claimed. Widths the grammar leaves
// open (a body of 2049 bytes, a trailing "." the detector may trim) and shapes with no provider source (bka_, the legacy bare
// 40-hex token, an identifier that happens to start with a listed prefix) are authored as UNCLAIMED twins (listed in
// benchmarks/evaluation/domains/credential/assessment.ts DISPUTED_PROPERTIES, scored T0). Asserted twins differ from a
// positive by prefix, separator, alphabet, length at the provider's own 23/24 boundary, or boundary only.

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b64url = text => Buffer.from(text, "utf8").toString("base64url");

export function build583e({ fixture, synthetic }) {
  const c = beta8Corpus("583e", { fixture, synthetic });
  const body = (seed, n, alphabet = URLSAFE) => synthetic(seed, n, alphabet);

  const T = "buildkite-token";
  const seed = slug => `beta14:583e:${T}:${slug}`;
  const { check, refuse } = guard("583e", T);

  // Body layouts the provider's own test fixtures describe: bare hex, org-id "." base58, org-id "_" hex, a three-part JWT.
  const hex40 = slug => body(seed(`hex:${slug}`), 40, HEX);
  const orgBase58 = slug => `${body(seed(`org:${slug}`), 8, LOWER_ALNUM)}.${body(seed(`b58:${slug}`), 60, BASE58)}`;
  const orgHex = slug => `${body(seed(`org:${slug}`), 12, LOWER_ALNUM)}_${body(seed(`hex:${slug}`), 40, HEX)}`;
  const jwt = (slug, extra = 0) => {
    const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const claims = { jti: body(seed(`jti:${slug}`), 32, HEX), aud: "buildkite", exp: 1900000000 };
    if (extra) claims.ctx = body(seed(`ctx:${slug}`), extra, ALNUM);
    return `${header}.${b64url(JSON.stringify(claims))}.${body(seed(`sig:${slug}`), 43)}`;
  };

  // slug -> [prefix, body builder]. Everything not listed is a bkua_ + 40 hex API access token (the #860 probe contexts).
  const SPEC = {
    "agent-start-cli": ["bkct", slug => orgBase58(slug)],
    "ps-acquire-job": ["bkjat", slug => jwt(slug)],
    "pipeline-env": ["bkar", slug => orgBase58(slug)],
    "docker-env": ["bkct", slug => orgBase58(slug)],
    "job-env-json": ["bkaj", slug => jwt(slug, 160)],
    "prefix-bkaa": ["bkaa", slug => orgBase58(slug)],
    "prefix-bkcqt": ["bkcqt", slug => orgBase58(slug)],
    "prefix-bkur": ["bkur", slug => hex40(slug)],
    "prefix-bktx": ["bktx", slug => hex40(slug)],
    "prefix-bkpt": ["bkpt", slug => body(seed(`b64:${slug}`), 80)],
    "prefix-bkrt": ["bkrt", slug => body(seed(`b64:${slug}`), 60)],
    "prefix-bktr": ["bktr", slug => orgHex(slug)],
    "prefix-bkat": ["bkat", slug => orgHex(slug)],
    "prefix-bkpat": ["bkpat", slug => orgHex(slug)],
    "prefix-bkps": ["bkps", slug => orgHex(slug)],
    "min-body-24": ["bkct", slug => body(seed(`b64:${slug}`), 24)],
    "max-body-2048": ["bkjat", slug => body(seed(`b64:${slug}`), 2048)],
  };
  const parts = slug => SPEC[slug] ?? ["bkua", slugArg => hex40(slugArg)];
  const tokenBody = slug => parts(slug)[1](slug);
  const prefixOf = slug => `${parts(slug)[0]}_`;
  const key = slug => {
    let b = tokenBody(slug);
    if (slug === "json-api-key") b = at(at(b, 11, "_"), 27, "-"); // a bkua_ body that carries _ and - beside hex
    if (slug === "sdk-kwarg") b = `${b.slice(0, 20)}.${b.slice(21)}`; // and one with a "." (the org-id separator position)
    return check(`${prefixOf(slug)}${b}`);
  };

  const probe = probeContexts({ env: "BUILDKITE_API_ACCESS_TOKEN", name: "Buildkite", host: "api.buildkite.com", ctor: "BuildkiteClient" });
  const agentStart = v => ["#!/bin/sh\nexec buildkite-agent start --token ", v, " --tags queue=default\n"];
  const psAcquire = v => ["2026-10-05T09:14:22Z ps: 4821 ?  Sl  0:02 buildkite-agent start --acquire-job ", v, " --disconnect-after-job\n"];
  const pipelineEnv = v => ["agents:\n  queue: default\nenv:\n  BUILDKITE_AGENT_TOKEN: ", v, "\nsteps:\n  - command: ./ci.sh\n"];
  const dockerEnv = v => ["docker run -d --name bk-agent -e BUILDKITE_AGENT_TOKEN=", v, " buildkite/agent:3\n"];
  const jobEnv = v => ["{\n  \"job_id\": \"hosted-runner-1\",\n  \"env\": { \"BUILDKITE_JOB_TOKEN\": \"", v, "\" }\n}\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"buildkite\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@buildkite/mcp-server\"],\n      \"env\": { \"BUILDKITE_API_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
  const graphql = v => ["curl -s https://graphql.buildkite.com/v1 -H \"Authorization: Bearer ", v, "\" -d '{\"query\":\"{ viewer { user { name } } }\"}'\n"];
  const rest = v => ["curl -s https://api.buildkite.com/v2/organizations/example-org/pipelines -H \"Authorization: Bearer ", v, "\"\n"];
  const minBody = v => ["2026-10-05T09:15:01Z ps: 4821 ?  Sl  0:00 buildkite-agent start --token ", v, "\n"];
  const maxBody = v => ["{\n  \"acquired\": true,\n  \"token\": \"", v, "\"\n}\n"];
  const envLine = name => v => [`# .env\n${name}=`, v, "\nBUILDKITE_ORGANIZATION_SLUG=example-org\n"];
  const logLine = what => v => [`2026-10-05T09:16:40Z ${what}: `, v, "\n"];

  const contexts = [...probe,
    { axis: "cli", slug: "agent-start-cli", ext: "sh", build: agentStart },
    { axis: "log", slug: "ps-acquire-job", ext: "log", build: psAcquire },
    { axis: "ci-config", slug: "pipeline-env", ext: "yml", build: pipelineEnv },
    { axis: "container-config", slug: "docker-env", ext: "sh", build: dockerEnv },
    { axis: "structured-file", slug: "job-env-json", ext: "json", build: jobEnv },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "graphql-curl", ext: "sh", build: graphql },
    { axis: "header", slug: "rest-curl", ext: "sh", build: rest },
    { axis: "log", slug: "min-body-24", ext: "log", build: minBody },
    { axis: "structured-file", slug: "max-body-2048", ext: "json", build: maxBody },
    // One positive per remaining prefix, so every role the detector reports is exercised.
    { axis: "env", slug: "prefix-bkaa", ext: "env", build: envLine("BUILDKITE_AGENT_SESSION_TOKEN") },
    { axis: "log", slug: "prefix-bkcqt", ext: "log", build: logLine("agent: connecting to queue with") },
    { axis: "env", slug: "prefix-bkur", ext: "env", build: envLine("BUILDKITE_OAUTH_REFRESH_TOKEN") },
    { axis: "log", slug: "prefix-bktx", ext: "log", build: logLine("oauth: exchanged to") },
    { axis: "env", slug: "prefix-bkpt", ext: "env", build: envLine("BUILDKITE_PACKAGES_TEMP_TOKEN") },
    { axis: "env", slug: "prefix-bkrt", ext: "env", build: envLine("BUILDKITE_REGISTRY_TOKEN") },
    { axis: "log", slug: "prefix-bktr", ext: "log", build: logLine("trigger: pipeline webhook token") },
    { axis: "log", slug: "prefix-bkat", ext: "log", build: logLine("pipeline: access via") },
    { axis: "env", slug: "prefix-bkpat", ext: "env", build: envLine("BUILDKITE_PORTAL_TOKEN") },
    { axis: "env", slug: "prefix-bkps", ext: "env", build: envLine("BUILDKITE_PORTAL_SECRET") },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const extOf = slug => contexts.find(x => x.slug === slug).ext;
  const tail = slug => tokenBody(slug);
  const twin = (slug, name, value, mutation, kind) => c.twin(T, slug, name, put(slug, value), mutation, kind, extOf(slug));

  // Asserted twins: one property each (prefix, separator, alphabet, length at the provider's 23/24 boundary, boundary).
  twin("dotenv", "uppercase-prefix", refuse(`BKUA_${tail("dotenv")}`), "prefix: uppercase BKUA_ vs the lowercase bkua_", "prefix");
  twin("bearer-header", "unlisted-prefix", refuse(`bkzz_${tail("bearer-header")}`), "prefix: bkzz_ is not one of the provider's 15 listed prefixes", "prefix");
  twin("json-token", "dash-separator", refuse(`bkua-${tail("json-token")}`), "separator: - in place of the _ after bkua", "prefix");
  twin("sdk-kwarg", "dot-separator", refuse(`bkua.${tail("sdk-kwarg")}`), "separator: . in place of the _ after bkua", "prefix");
  twin("x-api-key-header", "body-23", refuse(`bkua_${body(seed("w23"), 23)}`), "length: a 23-byte body, one below the provider's floor of 24 (its own test leaves it unredacted)", "length");
  twin("json-api-key", "slash-in-body", refuse(`bkua_${at(tail("json-api-key"), 8, "/")}`), "alphabet: one early body byte replaced by /, outside [A-Za-z0-9_.-]", "alphabet");
  twin("export", "equals-in-body", refuse(`bkua_${at(tail("export"), 5, "=")}`), "alphabet: one early body byte replaced by =, outside [A-Za-z0-9_.-]", "alphabet");
  twin("chat-paste", "leading-glue", refuse(`x${k["chat-paste"]}`), "boundary: x glued before bkua_, so the run does not start at the prefix", "boundary");
  twin("agent-start-cli", "short-body-23", refuse(`bkct_${body(seed("w23:ct"), 23)}`), "length: a 23-byte bkct_ body, one below the floor of 24", "length");
  twin("ps-acquire-job", "unlisted-prefix-jwt", refuse(`bkjt_${tokenBody("ps-acquire-job")}`), "prefix: bkjt_ (not bkjat_) over the same JWT body", "prefix");
  twin("pipeline-env", "uppercase-agent-prefix", refuse(`BKAR_${tokenBody("pipeline-env")}`), "prefix: uppercase BKAR_ vs the lowercase bkar_", "prefix");
  twin("job-env-json", "glued-jwt-prefix", refuse(`xbkaj_${tokenBody("job-env-json")}`), "boundary: x glued before bkaj_ on a JWT body", "boundary");

  // Unclaimed shapes (no provider source, or the grammar leaves the span open). T0 via DISPUTED_PROPERTIES.
  twin("max-body-2048", "body-2049", `bkjat_${body(seed("body:max-body-2048"), 2048)}${body(seed("w2049"), 1)}`, "length: a 2049-byte body, one past the cap; the match stops at the cap and the tail is not part of the finding, so only the span differs; unclaimed", "length");
  twin("agent-start-cli", "trailing-dot", `${k["agent-start-cli"]}.`, "boundary: one trailing . after the body; a body byte in the provider rule, which the detector may trim as sentence punctuation; unclaimed", "boundary");
  twin("graphql-curl", "third-party-bka-prefix", `bka_${body(seed("bka"), 40, ALNUM)}`, "prefix: bka_ + 40 alphanumerics, a shape only one third-party rule shows; unclaimed", "prefix");
  twin("mcp-env", "legacy-bare-hex", hex40("legacy-bare-hex"), "prefix: the legacy unprefixed 40-hex API token with the bkua_ prefix removed; no distinctive shape; unclaimed", "prefix");
  twin("docker-env", "snake-case-identifier", "bkct_cluster_name_for_builds_main", "alphabet: a snake_case identifier that begins with a listed prefix and has a 28-byte body, the handoff's accepted false-positive shape; unclaimed", "alphabet");

  // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a
  // reference or an obvious placeholder, so no credential-named-neighbour policy redaction reads as a false alarm.
  c.control(T, "near-miss", "cluster-name-identifier", ["cluster: bkct_cluster_name_for_builds\nqueue: default\n"], "yml");
  c.control(T, "near-miss", "prefix-only", ["Buildkite API access tokens start with bkua_ and agent tokens with bkaa_ or bkct_; the rest of the value is never printed here.\n"], "md");
  c.control(T, "near-miss", "unlisted-prefix-cache-key", [`2026-10-05T09:12:03Z registry: cache key bkzz_${body(seed("ctl:bkzz"), 40, HEX)} written\n`], "log");
  c.control(T, "encoded-value", "commit-sha", [`BUILDKITE_COMMIT=${body(seed("ctl:sha"), 40, HEX)}\nBUILDKITE_BRANCH=main\n`], "env");
  c.control(T, "encoded-value", "image-digest", [`image: registry.example/ci-runner@sha256:${body(seed("ctl:digest"), 64, HEX)}\n`], "yml");
  c.control(T, "public-id", "pipeline-and-build-id", [`BUILDKITE_PIPELINE_ID=${uuid(seed("ctl:pipeline"))}\nBUILDKITE_BUILD_ID=${uuid(seed("ctl:build"))}\n`], "env");
  c.control(T, "public-id", "organization-slug", ["BUILDKITE_ORGANIZATION_SLUG=example-org\nBUILDKITE_PIPELINE_SLUG=deploy-web\n"], "env");
  c.control(T, "placeholder", "encoded-token", ["buildkite-agent start --acquire-job bkjat_encoded-token\n"], "sh");
  c.control(T, "placeholder", "xxx-body", ["BUILDKITE_API_ACCESS_TOKEN=bkua_xxx\n"], "env");
  c.control(T, "placeholder", "docs-mask", [`Authorization: Bearer bkua_${"*".repeat(53)}\n`], "md");
  c.control(T, "placeholder", "angle-brackets", ["buildkite-agent start --token bkaa_<your-agent-session-token>\n"], "sh");
  c.control(T, "reference", "env-reference", ["BUILDKITE_AGENT_TOKEN=${BUILDKITE_AGENT_TOKEN}\n"], "env");
  c.control(T, "reference", "secret-get", ["export BUILDKITE_API_TOKEN=\"$(buildkite-agent secret get api_token)\"\n"], "sh");
  c.control(T, "reference", "actions-secret", ["          BUILDKITE_API_TOKEN: ${{ secrets.BUILDKITE_API_TOKEN }}\n"], "yml");
  c.control(T, "prose", "token-guidance", ["A Buildkite agent token lets a machine join a cluster and pull jobs with the secrets of every pipeline the queue serves; rotate it from the cluster settings if it leaks.\n"], "md");

  function uuid(s) {
    const h = body(s, 32, HEX);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return c.fixtures;
}
