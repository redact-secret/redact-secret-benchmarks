import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, ALPHA_FIRST, at, authorPositives, cratesCheckChar, guard, other, probeContexts } from "./528-shared.mjs";

// Issue #528, slice f (category `beta8-528f`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the crates.io API token (cio + 32 [A-Za-z0-9]) and trusted-publishing token (cio_tp_ + 31 + one
// check character); handoff redact-secret docs/audits/evidence/1014/crates-io.md at 4f220ea; product redact-secret#1031.
// Every value is built here from a public `synthetic` seed.
//
// cio is a trigram, so words and identifiers that start with cio and a cio + 32 run inside a longer alphanumeric run
// are controls. POLICY, not T1: the cio_tp_ check character corroborates only; two trusted-publishing positives carry a
// wrong check character and are still positives, and nothing asserts silence on a check failure.

export function build528f({ fixture, synthetic }) {
  const c = beta8Corpus("528f", { fixture, synthetic });
  const TC = "crates-io-token", TP = "crates-io-trusted-publishing-token";
  const seed = (t, slug) => `beta12:528f:${t}:${slug}`;
  const gc = guard("528f", TC), gp = guard("528f", TP);
  const api = slug => gc.check(`cio${synthetic(seed(TC, slug), 32, ALNUM)}`);
  const trusted = slug => {
    const raw = synthetic(seed(TP, slug), 31, ALNUM), check = cratesCheckChar(raw);
    return gp.check(`cio_tp_${raw}${slug.startsWith("check-mismatch") ? other(ALPHA_FIRST, check) : check}`);
  };

  const actions = v => ["jobs:\n  publish:\n    steps:\n      - run: cargo publish --locked\n        env:\n          CARGO_REGISTRY_TOKEN: ", v, "\n"];
  const creds = v => ["# ~/.cargo/credentials.toml\n[registry]\ntoken = \"", v, "\"\n"];
  const publish = v => ["cargo publish --token ", v, " --allow-dirty\n"];
  const login = v => ["$ cargo login ", v, "\n       Login token for `crates-io` saved\n"];
  const probeC = probeContexts({ env: "CARGO_REGISTRY_TOKEN", name: "crates.io", host: "crates.io", ctor: "CratesIoClient" });
  const C = authorPositives(c, TC, [...probeC,
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "structured-file", slug: "credentials-toml", ext: "toml", build: creds },
    { axis: "cli", slug: "cargo-publish-token", ext: "sh", build: publish },
    { axis: "cli", slug: "cargo-login", ext: "txt", build: login },
  ], api);
  const cBody = v => v.slice(3);

  c.twin(TC, "dotenv", "body-31", C.put("dotenv", gc.refuse(C.k.dotenv.slice(0, -1))), "length: a 31-byte body vs exactly 32", "length", "env");
  c.twin(TC, "export", "body-33", C.put("export", gc.refuse(`${C.k.export}${synthetic(seed(TC, "extra"), 1, ALNUM)}`)), "length: a 33-byte body vs exactly 32", "length", "sh");
  c.twin(TC, "json-token", "hyphen-in-body", C.put("json-token", gc.refuse(at(C.k["json-token"], 18, "-"))), "alphabet: one body byte replaced by -, outside Alphanumeric", "alphabet", "json");
  c.twin(TC, "json-api-key", "underscore-in-body", C.put("json-api-key", gc.refuse(at(C.k["json-api-key"], 22, "_"))), "alphabet: one body byte replaced by _, outside Alphanumeric", "alphabet", "json");
  c.twin(TC, "bearer-header", "uppercase-prefix", C.put("bearer-header", gc.refuse(`CIO${cBody(C.k["bearer-header"])}`)), "prefix: CIO vs the lower-case cio", "prefix", "http");
  c.twin(TC, "bare-prose", "leading-glue", C.put("bare-prose", gc.refuse(`x${C.k["bare-prose"]}`)), "boundary: x glued before cio", "boundary", "md");
  c.twin(TC, "chat-paste", "leading-underscore", C.put("chat-paste", gc.refuse(`_${C.k["chat-paste"]}`)), "boundary: _ glued before cio", "boundary", "txt");
  c.twin(TC, "sdk-kwarg", "trailing-underscore", C.put("sdk-kwarg", gc.refuse(`${C.k["sdk-kwarg"]}_x`)), "boundary: _x glued after the 32-byte body", "boundary", "py");

  c.control(TC, "prose", "cio-words", ["Dinner plan: cioppino with sourdough; the recipe is in cioppino-notes.md.\n"], "md");
  c.control(TC, "public-id", "cio-identifiers", ["let cio_config = CioConfig::default();\nlet ciound = cio_config.rounds();\n"], "rs");
  c.control(TC, "encoded-value", "cio-inside-long-run", [`nonce: ${synthetic(seed(TC, "run-a"), 16, ALNUM)}cio${synthetic(seed(TC, "run-b"), 45, ALNUM)}\n`], "yml");
  c.control(TC, "near-miss", "truncated", [`2026-09-29T11:50:02Z cargo: rejected truncated token cio${synthetic(seed(TC, "short"), 10, ALNUM)}\n`], "log");
  c.control(TC, "placeholder", "ellipsis", ["Create an API token (cio...) under Account Settings and run cargo login.\n"], "md");
  c.control(TC, "placeholder", "angle-brackets", ["cargo publish --token <crates-io-token>\n"], "sh");
  c.control(TC, "reference", "actions-secret", ["          CARGO_REGISTRY_TOKEN: ${{ secrets.CRATES_TOKEN }}\n"], "yml");
  c.control(TC, "reference", "env-reference", ["CARGO_REGISTRY_TOKEN=${CARGO_REGISTRY_TOKEN}\n"], "env");

  const ghLog = v => ["2026-09-29T11:52:14.0000000Z ##[group]Run cargo publish\n2026-09-29T11:52:14.0000000Z env:\n2026-09-29T11:52:14.0000000Z   CARGO_REGISTRY_TOKEN: ", v, "\n"];
  const ghEnv = v => ["- id: auth\n  uses: rust-lang/crates-io-auth-action@v1\n- run: echo \"CARGO_REGISTRY_TOKEN=", v, "\" >> \"$GITHUB_ENV\"\n"];
  const mismatchLog = v => ["2026-09-29T11:53:40Z publish: token ", v, " expired before upload\n"];
  const mismatchEnv = v => ["# minted by the OIDC exchange\nCARGO_REGISTRY_TOKEN=", v, "\n"];
  const probeP = probeContexts({ env: "CARGO_REGISTRY_TOKEN", name: "crates.io trusted-publishing", host: "crates.io", ctor: "CratesIoClient" });
  const P = authorPositives(c, TP, [...probeP,
    { axis: "log", slug: "actions-log", ext: "log", build: ghLog },
    { axis: "ci-config", slug: "github-env-export", ext: "yml", build: ghEnv },
    { axis: "log", slug: "check-mismatch-log", ext: "log", build: mismatchLog },
    { axis: "env", slug: "check-mismatch-env", ext: "env", build: mismatchEnv },
  ], trusted);
  const pBody = v => v.slice(7);

  c.twin(TP, "dotenv", "body-31", P.put("dotenv", gp.refuse(P.k.dotenv.slice(0, -1))), "length: a 31-byte body vs exactly 32 (the parser requires 32)", "length", "env");
  c.twin(TP, "export", "body-33", P.put("export", gp.refuse(`${P.k.export}${synthetic(seed(TP, "extra"), 1, ALNUM)}`)), "length: a 33-byte body vs exactly 32", "length", "sh");
  c.twin(TP, "json-token", "hyphen-in-body", P.put("json-token", gp.refuse(at(P.k["json-token"], 20, "-"))), "alphabet: one body byte replaced by -, outside [A-Za-z0-9]", "alphabet", "json");
  c.twin(TP, "bearer-header", "uppercase-prefix", P.put("bearer-header", gp.refuse(`CIO_TP_${pBody(P.k["bearer-header"])}`)), "prefix: CIO_TP_ vs the lower-case cio_tp_", "prefix", "http");
  c.twin(TP, "x-api-key-header", "hyphen-separator", P.put("x-api-key-header", gp.refuse(`cio-tp-${pBody(P.k["x-api-key-header"])}`)), "prefix: cio-tp- in place of the cio_tp_ separators", "prefix", "http");
  c.twin(TP, "bare-prose", "leading-glue", P.put("bare-prose", gp.refuse(`x${P.k["bare-prose"]}`)), "boundary: x glued before cio_tp_", "boundary", "md");
  c.twin(TP, "chat-paste", "trailing-hyphen", P.put("chat-paste", gp.refuse(`${P.k["chat-paste"]}-x`)), "boundary: -x glued after the 32-byte body", "boundary", "txt");

  c.control(TP, "public-id", "setting-name", ["[publish]\ncio_tp_enabled = true\ncio_tp_audience = \"crates.io\"\n"], "toml");
  c.control(TP, "public-id", "workflow-name", ["Trusted publishing is configured for crate acme-core with workflow release.yml and environment crates-io.\n"], "md");
  c.control(TP, "near-miss", "truncated", [`2026-09-29T11:54:02Z publish: rejected truncated token cio_tp_${synthetic(seed(TP, "short"), 12, ALNUM)}\n`], "log");
  c.control(TP, "near-miss", "prefix-at-eol", ["2026-09-29T11:54:20Z publish: expected a trusted-publishing token that starts with cio_tp_\n"], "log");
  c.control(TP, "placeholder", "x-run", ["CARGO_REGISTRY_TOKEN=cio_tp_xxxxxxxxxxxxxxxx\n"], "env");
  c.control(TP, "placeholder", "ellipsis", ["The auth action exchanges the OIDC token for a short-lived token (cio_tp_...) and outputs it.\n"], "md");
  c.control(TP, "reference", "step-output", ["          CARGO_REGISTRY_TOKEN: ${{ steps.auth.outputs.token }}\n"], "yml");
  c.control(TP, "reference", "env-reference", ["CARGO_REGISTRY_TOKEN=${CARGO_REGISTRY_TOKEN}\n"], "env");
  c.control(TP, "prose", "token-guidance", ["crates.io trusted-publishing tokens start with cio_tp_ and expire shortly after the OIDC exchange.\n"], "md");
  return c.fixtures;
}
