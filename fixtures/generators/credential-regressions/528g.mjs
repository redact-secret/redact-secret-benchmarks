import { beta8Corpus } from "./helpers.mjs";
import { BASE32, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #528, slice g (category `beta8-528g`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for Dynatrace access and platform tokens (dt0 + c|s + 2 digits + . + 24 [A-Z2-7] + . + 64 [A-Z2-7];
// handoff redact-secret docs/audits/evidence/1014/dynatrace.md at 4f220ea; product redact-secret#1032). Every value is
// built here from a public `synthetic` seed in uppercase base32. Classic dt0c01 tokens and platform dt0s01/dt0s16 tokens
// are positives; the whole 96 bytes are the span.
//
// The token identifier alone (prefix + public portion) is documented as safe to log and is a control. The URL-encoded
// OpenTelemetry header Authorization=Api-Token%20<token> is a positive: it is a documented transport, although the
// handoff boundary read literally would reject the 0 before dt0 (recorded in the contract's boundary field).

const PREFIX = { "json-token": "dt0s01", "x-api-key-header": "dt0s16", "otel-env-header": "dt0s16", "dynakube-secret": "dt0s01" };

export function build528g({ fixture, synthetic }) {
  const c = beta8Corpus("528g", { fixture, synthetic });
  const T = "dynatrace-token";
  const seed = slug => `beta12:528g:${T}:${slug}`;
  const { check, refuse } = guard("528g", T);
  const pub = slug => synthetic(seed(`public:${slug}`), 24, BASE32);
  const sec = slug => synthetic(seed(`secret:${slug}`), 64, BASE32);
  const P = {};
  const key = slug => { P[slug] = { prefix: PREFIX[slug] ?? "dt0c01", pub: pub(slug), sec: sec(slug) }; return check(`${P[slug].prefix}.${P[slug].pub}.${P[slug].sec}`); };
  const join = p => `${p.prefix}.${p.pub}.${p.sec}`;
  const with_ = (slug, change) => join({ ...P[slug], ...change(P[slug]) });

  const probe = probeContexts({ env: "DT_API_TOKEN", name: "Dynatrace", host: "abc12345.live.dynatrace.com", ctor: "DynatraceClient" });
  const apiToken = v => ["GET /api/v2/metrics HTTP/1.1\nHost: abc12345.live.dynatrace.com\nAuthorization: Api-Token ", v, "\nAccept: application/json\n"];
  const dynakube = v => ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: dynakube\n  namespace: dynatrace\ntype: Opaque\nstringData:\n  apiToken: ", v, "\n"];
  const otelEnv = v => ["OTEL_EXPORTER_OTLP_ENDPOINT=https://abc12345.live.dynatrace.com/api/v2/otlp\nOTEL_EXPORTER_OTLP_HEADERS=Authorization=Api-Token%20", v, "\n"];
  const collector = v => ["exporters:\n  otlphttp:\n    endpoint: https://abc12345.live.dynatrace.com/api/v2/otlp\n    headers:\n      Authorization: \"Api-Token ", v, "\"\n"];
  const contexts = [...probe,
    { axis: "header", slug: "api-token-header", ext: "http", build: apiToken },
    { axis: "container-config", slug: "dynakube-secret", ext: "yml", build: dynakube },
    { axis: "env", slug: "otel-env-header", ext: "env", build: otelEnv },
    { axis: "structured-file", slug: "collector-headers", ext: "yml", build: collector },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);

  c.twin(T, "dotenv", "public-23", put("dotenv", refuse(with_("dotenv", p => ({ pub: p.pub.slice(0, 23) })))), "length: a 23-character public portion vs exactly 24", "length", "env");
  c.twin(T, "export", "public-25", put("export", refuse(with_("export", p => ({ pub: `${p.pub}Q` })))), "length: a 25-character public portion vs exactly 24", "length", "sh");
  c.twin(T, "bearer-header", "secret-63", put("bearer-header", refuse(with_("bearer-header", p => ({ sec: p.sec.slice(0, 63) })))), "length: a 63-character secret portion vs exactly 64", "length", "http");
  c.twin(T, "api-token-header", "secret-65", put("api-token-header", refuse(with_("api-token-header", p => ({ sec: `${p.sec}Q` })))), "length: a 65-character secret portion vs exactly 64", "length", "http");
  c.twin(T, "json-token", "lowercase-byte", put("json-token", refuse(with_("json-token", p => ({ sec: at(p.sec, 10, "q") })))), "alphabet: one secret byte in lowercase; the generator emits uppercase base32", "alphabet", "json");
  c.twin(T, "json-api-key", "digit-outside-base32", put("json-api-key", refuse(with_("json-api-key", p => ({ pub: at(p.pub, 5, "8") })))), "alphabet: one public byte replaced by 8, outside [A-Z2-7]", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "unknown-type-letter", put("sdk-kwarg", refuse(with_("sdk-kwarg", () => ({ prefix: "dt0x01" })))), "prefix: dt0x01, a type letter the docs table does not define (c or s)", "prefix", "py");
  c.twin(T, "x-api-key-header", "version-1", put("x-api-key-header", refuse(with_("x-api-key-header", p => ({ prefix: `dt1${p.prefix.slice(3)}` })))), "prefix: dt1s16 vs the documented dt0", "prefix", "http");
  c.twin(T, "collector-headers", "hyphen-separator", put("collector-headers", refuse(`${P["collector-headers"].prefix}.${P["collector-headers"].pub}-${P["collector-headers"].sec}`)), "separator: - in place of the second .", "alphabet", "yml");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before dt0", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-underscore", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the 64-character secret portion", "boundary", "txt");

  c.control(T, "public-id", "token-identifier-log", [`2026-09-29T12:01:44Z audit: token dt0s01.${pub("ctl-id")} used by automation-user\n`], "log");
  c.control(T, "public-id", "token-identifier-ui", [`| Token | Name | Scopes |\n| --- | --- | --- |\n| dt0c01.${pub("ctl-ui")} | ci-metrics | metrics.read |\n`], "md");
  c.control(T, "placeholder", "docs-placeholder", ["curl -H \"Authorization: Api-Token dt0c01.abc123.abcdefjhij1234567890\" https://{your-environment-id}.live.dynatrace.com/api/v2/metrics\n"], "sh");
  c.control(T, "placeholder", "angle-brackets", ["DT_API_TOKEN=<prefix>.<public-portion>.<secret-portion>\n"], "env");
  c.control(T, "encoded-value", "bare-base32-run", [`totp-seed: ${synthetic(seed("base32"), 64, BASE32)}\n`], "yml");
  c.control(T, "near-miss", "truncated", [`2026-09-29T12:02:10Z oneagent: rejected truncated token dt0c01.${pub("ctl-short")}.${synthetic(seed("short"), 16, BASE32)}\n`], "log");
  c.control(T, "reference", "env-reference", ["DT_API_TOKEN=${DT_API_TOKEN}\n"], "env");
  c.control(T, "reference", "secret-key-ref", ["        - name: DT_API_TOKEN\n          valueFrom:\n            secretKeyRef:\n              name: dynakube\n              key: apiToken\n"], "yml");
  c.control(T, "prose", "token-guidance", ["A Dynatrace token is a prefix, a 24-character public portion and a 64-character secret portion; only the prefix and public portion may be logged.\n"], "md");
  return c.fixtures;
}
