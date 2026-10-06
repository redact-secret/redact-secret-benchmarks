import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, DIGITS, HEX, URLSAFE, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice h (category `beta8-583h`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Fly.io access token (detector `fly-token`, finding type fly_access_token): a first member `fm1r_`,
// `fm1a_` or `fm2_` + at least 64 body bytes over [A-Za-z0-9+/_-] then up to two `=`, optionally comma-joined with further
// members (`fm1r_`, `fm1a_`, `fm2_`, `fo1_`), no upper bound (handoff redact-secret docs/audits/evidence/1014/fly.md at
// 3b1a5aa; product redact-secret#1109). Every value is built here from a public `synthetic` seed over the contract's own
// alphabet; nothing is copied from a provider example, a scanner test vector or an issued token, and no complete
// key-shaped literal appears in this file. The `FlyV1 ` scheme is outside the span: the secret part of every scheme context
// starts at `fm`.
//
// The 64-byte floor is conditional on ruling Q7 (policy `policy-q7-floor`). A standalone `fo1_` (ruling question Q9) and
// three or more `=` are UNCLAIMED twins (benchmarks/evaluation/domains/credential/assessment.ts DISPUTED_PROPERTIES, scored T0).
// Asserted twins differ from a positive by prefix, alphabet, floor or boundary only.

export function build583h({ fixture, synthetic }) {
  const c = beta8Corpus("583h", { fixture, synthetic });
  const T = "fly-token";
  const B64 = `${ALNUM}+/_-`;
  const seed = slug => `beta14:583h:${T}:${slug}`;
  const body = (s, n, alphabet = B64) => synthetic(seed(s), n, alphabet);
  const { check, refuse } = guard("583h", T);

  // One entry per positive context: its members (prefix, body width, padding). Default: one fm2_ member of 100.
  const SPEC = {
    "export": [["fm2_", 64]],
    "bearer-header": [["fm2_", 700]],
    "json-token": [["fm2_", 100, "="]],
    "json-api-key": [["fm2_", 100, "=="]],
    "sdk-kwarg": [["fm1r_", 100]],
    "chat-paste": [["fm1a_", 100]],
    "env-flyv1-unquoted": [["fm2_", 300], ["fm2_", 300]],
    "env-flyv1-quoted": [["fm2_", 200], ["fm2_", 200]],
    "bundle-span": [["fm2_", 150], ["fm2_", 150]],
    "three-member-bundle": [["fm1r_", 120], ["fm2_", 120], ["fm1a_", 120]],
    "session-bundle": [["fm2_", 400], ["fo1_", 43]],
    "auth-token-output": [["fm2_", 90], ["fo1_", 43]],
    "tokens-create-output": [["fm2_", 700]],
    "actions-flyctl-env": [["fm2_", 500, "="]],
    "long-body": [["fm2_", 2000]],
    "plus-slash-body": [["fm2_", 100]],
  };
  const key = slug => {
    const members = (SPEC[slug] ?? [["fm2_", 100]]).map(([p, n, pad = ""], i) => {
      let b = body(`body:${slug}:${i}`, n);
      if (slug === "plus-slash-body") b = at(at(at(at(b, 11, "+"), 29, "/"), 47, "-"), 63, "_");
      return `${p}${b}${pad}`;
    });
    return check(members.join(","));
  };

  const probe = probeContexts({ env: "FLY_API_TOKEN", name: "Fly.io", host: "api.machines.dev", ctor: "FlyClient" });
  const contexts = [...probe,
    { axis: "env", slug: "env-flyv1-unquoted", ext: "env", build: v => ["# .env\nFLY_API_TOKEN=FlyV1 ", v, "\nFLY_APP=pos-sync\n"] },
    { axis: "env", slug: "env-flyv1-quoted", ext: "env", build: v => ["FLY_ACCESS_TOKEN=\"FlyV1 ", v, "\"\n"] },
    { axis: "header", slug: "bundle-span", ext: "http", build: v => ["POST /v1/apps/pos-sync/machines HTTP/1.1\nHost: api.machines.dev\nAuthorization: FlyV1 ", v, "\nContent-Type: application/json\n"] },
    { axis: "cli", slug: "three-member-bundle", ext: "sh", build: v => ["curl -s https://api.fly.io/graphql -H \"Authorization: FlyV1 ", v, "\"\n"] },
    { axis: "tool-output", slug: "session-bundle", ext: "txt", build: v => ["$ fly auth token\n", v, "\n"] },
    { axis: "tool-output", slug: "auth-token-output", ext: "log", build: v => ["2026-10-05T09:12:03Z flyctl: authenticated as deploy@example.test\n2026-10-05T09:12:04Z flyctl: session token ", v, "\n"] },
    { axis: "tool-output", slug: "tokens-create-output", ext: "txt", build: v => ["$ fly tokens create deploy -a pos-sync\nFlyV1 ", v, "\n"] },
    { axis: "ci-config", slug: "actions-flyctl-env", ext: "yml", build: v => ["jobs:\n  deploy:\n    steps:\n      - run: flyctl deploy --remote-only\n        env:\n          FLY_API_TOKEN: ", v, "\n"] },
    { axis: "structured-file", slug: "long-body", ext: "json", build: v => ["{\n  \"fly\": {\n    \"access_token\": \"", v, "\"\n  }\n}\n"] },
    { axis: "env", slug: "plus-slash-body", ext: "env", build: v => ["FLY_ACCESS_TOKEN=", v, "\n"] },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);

  // Asserted twins: one property each (prefix, separator, case, alphabet, floor, boundary), over a positive's own context.
  const member = (p, s, n) => `${p}${body(s, n)}`;
  c.twin(T, "dotenv", "fm3-prefix", put("dotenv", refuse(member("fm3_", "t:fm3", 100))), "prefix: fm3_ vs the documented fm1r_/fm1a_/fm2_", "prefix", "env");
  c.twin(T, "bearer-header", "dash-separator", put("bearer-header", refuse(member("fm2-", "t:dash", 100))), "separator: - in place of the _ after fm2", "prefix", "http");
  c.twin(T, "json-token", "uppercase-prefix", put("json-token", refuse(member("FM2_", "t:upper", 100))), "prefix: uppercase FM2_ vs the case-sensitive fm2_", "prefix", "json");
  c.twin(T, "json-api-key", "dot-in-body", put("json-api-key", refuse(`fm2_${at(body("t:dot", 80), 40, ".")}`)), "alphabet: one body byte replaced by ., outside [A-Za-z0-9+/_-], leaving no 64-byte run", "alphabet", "json");
  c.twin(T, "export", "equals-in-body", put("export", refuse(`fm2_${at(body("t:eq", 80), 40, "=")}`)), "alphabet: one body byte replaced by =, which is padding only after the last byte", "alphabet", "sh");
  c.twin(T, "x-api-key-header", "body-63", put("x-api-key-header", refuse(member("fm2_", "t:w63", 63))), "floor: 63 body bytes, one under the 64-byte minimum decoded macaroon (conditional on Q7)", "length", "http");
  c.twin(T, "actions-flyctl-env", "fm1r-body-63", put("actions-flyctl-env", refuse(member("fm1r_", "t:w63r", 63))), "floor: fm1r_ with 63 body bytes, one under the floor (conditional on Q7)", "length", "yml");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before fm2_, so the run does not start at the prefix", "boundary", "md");
  c.twin(T, "chat-paste", "underscore-glue", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before fm1a_, so the run does not start at the prefix", "boundary", "txt");
  c.twin(T, "sdk-kwarg", "uppercase-member-prefix", put("sdk-kwarg", refuse(member("FM1R_", "t:upperr", 100))), "prefix: uppercase FM1R_ vs fm1r_", "prefix", "py");

  // Unclaimed shapes (T0 via DISPUTED_PROPERTIES): a standalone fo1_ (Q9) and three or more =. No assertion either way.
  c.twin(T, "dotenv", "fo1-standalone-43", put("dotenv", `fo1_${body("t:fo1", 43, URLSAFE)}`), "prefix: a bare fo1_ + 43 with no fm member; the provider states no length (gitleaks 43, T2); unclaimed (Q9, no assertion)", "prefix", "env");
  c.twin(T, "json-token", "padding-3", put("json-token", `fm2_${body("t:pad3", 100)}===`), "padding: three = after the body; the redaction rule allows any count, a whole-byte encoding has at most two; unclaimed", "alphabet", "json");

  // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a reference
  // or an obvious placeholder.
  c.control(T, "near-miss", "tiny-test-fixture", ["const fixture = \"fm2_hi\"; // flyctl unit-test stand-in, far below any macaroon\n"], "ts");
  c.control(T, "near-miss", "identifier-fm2", ["fm2_config_path = \"/etc/fly/fm2.toml\"\nfm2_retry_count = 3\n"], "py");
  c.control(T, "near-miss", "scheme-alone", ["The Authorization scheme for a macaroon is FlyV1, followed by a space and the token; only the scheme is shown here.\n"], "md");
  c.control(T, "near-miss", "prefix-only", ["Scoped Fly.io tokens start with fm2_; the rest of the value is never printed.\n"], "md");
  c.control(T, "encoded-value", "base64-blob", [`logo: data:image/png;base64,iVBORw0KGgo${body("ctl:b64:a", 60, ALNUM)}E${"A".repeat(79)}${body("ctl:b64:b", 60, ALNUM)}\n`], "yml");
  c.control(T, "encoded-value", "sha256-digest", [`image: registry.example/pos-sync@sha256:${body("ctl:digest", 64, HEX)}\n`], "yml");
  c.control(T, "public-id", "machine-id", [`fly machine status ${body("ctl:machine", 14, "0123456789abcdef")} -a pos-sync\n`], "sh");
  c.control(T, "public-id", "app-and-org", [`app = "pos-sync-${body("ctl:app", 6, "abcdefghijklmnopqrstuvwxyz")}"\nprimary_region = "nrt"\norg = "personal-${body("ctl:org", 5, DIGITS)}"\n`], "toml");
  c.control(T, "placeholder", "your-deploy-token", ["FLY_API_TOKEN=", "FlyV1 ", "fm2", "_<your-deploy-", "token>\n"], "env");
  c.control(T, "placeholder", "x-run", ["export FLY_API_TOKEN=\"fm2_xxxxxxxx\"\n"], "sh");
  c.control(T, "reference", "env-reference", ["FLY_API_TOKEN=${FLY_API_TOKEN}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}\n"], "yml");
  c.control(T, "prose", "token-guidance", ["A Fly.io deploy token is scoped to one app and lives for twenty years by default; prefer the narrowest token and revoke it with fly tokens revoke if it leaks.\n"], "md");
  return c.fixtures;
}
