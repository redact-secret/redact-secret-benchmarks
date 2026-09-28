import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, authorPositives, guard, probeContexts } from "./436-shared.mjs";

// Issue #436, slice c (category `beta8-436c`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Inngest signing key (signkey-prod-/test-/branch- + 64 lowercase hex; handoff
// redact-secret docs/audits/evidence/860/inngest.md at 54fe385; product redact-secret#914). Every value
// is built here from a public `synthetic` seed in the documented shape; the hashed wire form is the
// same shape, so it is authored the same way.
//
// A bare 64-hex value is authored only as a labelled digest, never as a self-hosted key.

export function build436c({ fixture, synthetic }) {
  const c = beta8Corpus("436c", { fixture, synthetic });
  const T = "inngest-signing-key";
  const seed = slug => `beta11:436c:${T}:${slug}`;
  const { check, refuse } = guard("436c", T);
  const label = { export: "test", "json-token": "branch", "fallback-dotenv": "prod", "vercel-env": "branch", "chat-paste": "test" };
  const key = slug => check(`signkey-${label[slug] ?? "prod"}-${synthetic(seed(slug), 64, HEX)}`);

  const probe = probeContexts({ env: "INNGEST_SIGNING_KEY", name: "Inngest", host: "api.inngest.com", ctor: "Inngest" });
  const fallback = v => ["# .env\nINNGEST_EVENT_KEY=local\nINNGEST_SIGNING_KEY_FALLBACK=", v, "\n"];
  const client = v => ["import { Inngest } from \"inngest\";\n\nexport const inngest = new Inngest({ id: \"billing-app\", signingKey: \"", v, "\" });\n"];
  const curl = v => ["curl -s https://api.inngest.com/v1/events/01J00000000000000000000000/runs -H \"Authorization: Bearer ", v, "\"\n"];
  const vercel = v => ["$ vercel env ls\n name                  value        environments\n INNGEST_EVENT_KEY     Encrypted    Production\n$ vercel env pull .env.local && cat .env.local\nINNGEST_SIGNING_KEY=\"", v, "\"\n"];
  const contexts = [...probe,
    { axis: "env", slug: "fallback-dotenv", ext: "env", build: fallback },
    { axis: "source-code", slug: "ts-client", ext: "ts", build: client },
    { axis: "cli", slug: "curl-hashed-bearer", ext: "sh", build: curl },
    { axis: "tool-output", slug: "vercel-env", ext: "txt", build: vercel },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(v.lastIndexOf("-") + 1);

  c.twin(T, "dotenv", "body-63", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 63-hex body vs exactly 64", "length", "env");
  c.twin(T, "export", "body-65", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, HEX)}`)), "length: a 65-hex body vs exactly 64", "length", "sh");
  c.twin(T, "json-token", "uppercase-hex-byte", put("json-token", refuse(at(k["json-token"], 30, "C"))), "alphabet: one body byte as uppercase hex, which the generator never emits", "alphabet", "json");
  c.twin(T, "json-api-key", "g-in-body", put("json-api-key", refuse(at(k["json-api-key"], 40, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "unknown-label", put("sdk-kwarg", refuse(`signkey-preview-${body(k["sdk-kwarg"])}`)), "prefix: signkey-preview-, an environment label that is not a provider constant", "prefix", "py");
  c.twin(T, "bearer-header", "underscore-delimiters", put("bearer-header", refuse(`signkey_prod_${body(k["bearer-header"])}`)), "boundary: signkey_prod_ in place of the hyphen delimiters", "boundary", "http");
  c.twin(T, "x-api-key-header", "uppercase-prefix", put("x-api-key-header", refuse(`SIGNKEY-prod-${body(k["x-api-key-header"])}`)), "prefix: SIGNKEY- vs the lower-case signkey- constant", "prefix", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before signkey-", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-glue", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the body", "boundary", "txt");

  c.control(T, "placeholder", "docs-angle", ["curl https://api.inngest.com/v1/events -H \"Authorization: Bearer signkey-prod-<YOUR-SIGNING-KEY>\"\n"], "sh");
  c.control(T, "placeholder", "sdk-short", ["const inngest = new Inngest({ id: \"test\", signingKey: \"signkey-test-12345\" });\n"], "ts");
  c.control(T, "placeholder", "zeros", ["INNGEST_SIGNING_KEY=signkey-prod-000000\n"], "env");
  c.control(T, "reference", "env-reference", ["INNGEST_SIGNING_KEY=${INNGEST_SIGNING_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      INNGEST_SIGNING_KEY: ${{ secrets.INNGEST_SIGNING_KEY }}\n"], "yml");
  c.control(T, "encoded-value", "sha256-digest", [`release artifact sha256 ${synthetic(seed("digest"), 64, HEX)}\n`], "txt");
  c.control(T, "public-id", "event-key-local", ["# local dev server\nINNGEST_DEV=1\nINNGEST_EVENT_KEY=local\n"], "env");
  c.control(T, "public-id", "no-event-key-sentinel", ["if (eventKey === \"NO_EVENT_KEY_SET\") {\n  throw new Error(\"Set INNGEST_EVENT_KEY before sending events\");\n}\n"], "ts");
  c.control(T, "near-miss", "truncated", [`2026-09-28T11:02:44Z serve: signature check failed for truncated key signkey-prod-${synthetic(seed("short"), 16, HEX)} (expected 64 hex)\n`], "log");
  c.control(T, "prose", "key-guidance", ["Inngest signing keys start with signkey-prod-, signkey-test- or signkey-branch-; set INNGEST_SIGNING_KEY and rotate with INNGEST_SIGNING_KEY_FALLBACK.\n"], "md");
  return c.fixtures;
}
