import { beta8Corpus } from "./helpers.mjs";
import { LOWER_ALNUM, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #528, slice i (category `beta8-528i`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for Honeycomb ingest keys (hc + one [a-z] + ik_ or ic_ + 58 [a-z0-9], 64 in all; handoff redact-secret
// docs/audits/evidence/1014/honeycomb.md at 4f220ea; product redact-secret#1034). Every value is built here from a public
// `synthetic` seed; environment (ik_) and classic (ic_) keys and several type letters are positives.
//
// Key ids (hc?ik_ + 26), configuration-key and environment ids are controls. The management key (hc?mk_ + 26 + : + 32)
// is ISSUANCE-GATED and unclaimed, and 22-character configuration keys and 32-hex classic keys are credentials outside
// the family, so none of them is authored either way; only an hcxmk_ + 58 prefix twin touches the management prefix.

const LETTER = { dotenv: "a", export: "b", "json-token": "m", "sdk-kwarg": "z", "otel-env-headers": "a" };
const CLASSIC = new Set(["x-api-key-header", "json-api-key", "libhoney-go-config"]);

export function build528i({ fixture, synthetic }) {
  const c = beta8Corpus("528i", { fixture, synthetic });
  const T = "honeycomb-api-key";
  const seed = slug => `beta12:528i:${T}:${slug}`;
  const { check, refuse } = guard("528i", T);
  const key = slug => check(`hc${LETTER[slug] ?? "x"}${CLASSIC.has(slug) ? "ic" : "ik"}_${synthetic(seed(slug), 58, LOWER_ALNUM)}`);

  const probe = probeContexts({ env: "HONEYCOMB_API_KEY", name: "Honeycomb", host: "api.honeycomb.io", ctor: "Libhoney" });
  const teamHeader = v => ["POST /1/events/checkout HTTP/1.1\nHost: api.honeycomb.io\nX-Honeycomb-Team: ", v, "\nContent-Type: application/json\n"];
  const otelEnv = v => ["OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io\nOTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=", v, "\nOTEL_SERVICE_NAME=checkout\n"];
  const collector = v => ["exporters:\n  otlp/honeycomb:\n    endpoint: api.honeycomb.io:443\n    headers:\n      x-honeycomb-team: ", v, "\n"];
  const libhoney = v => ["libhoney.Init(libhoney.Config{\n\tAPIKey:  \"", v, "\",\n\tDataset: \"checkout\",\n})\n"];
  const contexts = [...probe,
    { axis: "header", slug: "x-honeycomb-team-header", ext: "http", build: teamHeader },
    { axis: "env", slug: "otel-env-headers", ext: "env", build: otelEnv },
    { axis: "structured-file", slug: "collector-headers", ext: "yml", build: collector },
    { axis: "source-code", slug: "libhoney-go-config", ext: "go", build: libhoney },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(6);

  c.twin(T, "dotenv", "body-57", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 57-byte body vs exactly 58", "length", "env");
  c.twin(T, "export", "body-59", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, LOWER_ALNUM)}`)), "length: a 59-byte body vs exactly 58", "length", "sh");
  c.twin(T, "json-token", "uppercase-byte", put("json-token", refuse(at(k["json-token"], 30, "Q"))), "alphabet: one body byte in uppercase, outside [a-z0-9]", "alphabet", "json");
  c.twin(T, "json-api-key", "hyphen-in-body", put("json-api-key", refuse(at(k["json-api-key"], 36, "-"))), "alphabet: one body byte replaced by -, outside [a-z0-9]", "alphabet", "json");
  c.twin(T, "bearer-header", "no-type-letter", put("bearer-header", refuse(`hcik_${body(k["bearer-header"])}`)), "prefix: hcik_ without the one-letter type byte", "prefix", "http");
  c.twin(T, "x-api-key-header", "uppercase-type-letter", put("x-api-key-header", refuse(`hcAic_${body(k["x-api-key-header"])}`)), "prefix: hcAic_, an uppercase type letter outside [a-z]", "prefix", "http");
  c.twin(T, "collector-headers", "management-prefix", put("collector-headers", refuse(`hcxmk_${body(k["collector-headers"])}`)), "prefix: hcxmk_ (the management-key prefix) with an ingest-key body; the management key is unclaimed", "prefix", "yml");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before hc", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-underscore", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the 58-byte body", "boundary", "txt");

  const id26 = slug => synthetic(seed(`id:${slug}`), 26, LOWER_ALNUM);
  c.control(T, "public-id", "ingest-key-id", [`{\n  "id": "hcxik_${id26("key-id")}",\n  "name": "checkout-ingest",\n  "key_type": "ingest"\n}\n`], "json");
  c.control(T, "public-id", "environment-id", [`environment: hcxen_${id26("env")}\ndataset: checkout\n`], "yml");
  c.control(T, "public-id", "configuration-key-id", [`2026-09-29T12:20:02Z audit: configuration key hcxlk_${id26("lk")} rotated by alice\n`], "log");
  c.control(T, "near-miss", "truncated", [`2026-09-29T12:20:40Z exporter: rejected truncated key hcxik_${synthetic(seed("short"), 20, LOWER_ALNUM)}\n`], "log");
  c.control(T, "placeholder", "ellipsis", ["Paste an ingest key (hcxik_...) into HONEYCOMB_API_KEY.\n"], "md");
  c.control(T, "placeholder", "angle-brackets", ["OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=<your-ingest-key>\n"], "env");
  c.control(T, "reference", "env-reference", ["HONEYCOMB_API_KEY=${HONEYCOMB_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          HONEYCOMB_API_KEY: ${{ secrets.HONEYCOMB_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["Honeycomb ingest keys are the key id and secret concatenated; the key id alone is shown in the UI and is not secret.\n"], "md");
  return c.fixtures;
}
