import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #528, slice e (category `beta8-528e`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Clojars deploy token (CLOJARS_ + 60 lowercase hex, exactly the server validator; handoff
// redact-secret docs/audits/evidence/1014/clojars.md at 4f220ea; product redact-secret#1025). Every value is built here
// from a public `synthetic` seed. The prefix is case-sensitive; CLOJARS_USERNAME/CLOJARS_PASSWORD variable names and a
// CLOJARS_ value with one uppercase hex byte (the validator rejects it) are controls.

export function build528e({ fixture, synthetic }) {
  const c = beta8Corpus("528e", { fixture, synthetic });
  const T = "clojars-deploy-token";
  const seed = slug => `beta12:528e:${T}:${slug}`;
  const { check, refuse } = guard("528e", T);
  const key = slug => check(`CLOJARS_${synthetic(seed(slug), 60, HEX)}`);

  const probe = probeContexts({ env: "CLOJARS_PASSWORD", name: "Clojars", host: "clojars.org", ctor: "ClojarsClient" });
  const actions = v => ["jobs:\n  deploy:\n    steps:\n      - run: lein deploy clojars\n        env:\n          CLOJARS_USERNAME: acme-ci\n          CLOJARS_PASSWORD: ", v, "\n"];
  const lein = v => [";; ~/.lein/credentials.clj\n{#\"https://repo.clojars.org\" {:username \"acme-ci\" :password \"", v, "\"}}\n"];
  const m2 = v => ["<settings>\n  <servers>\n    <server>\n      <id>clojars</id>\n      <username>acme-ci</username>\n      <password>", v, "</password>\n    </server>\n  </servers>\n</settings>\n"];
  const contexts = [...probe,
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "structured-file", slug: "lein-credentials", ext: "clj", build: lein },
    { axis: "structured-file", slug: "maven-settings", ext: "xml", build: m2 },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(8);

  c.twin(T, "dotenv", "body-59", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 59-byte body vs exactly 60", "length", "env");
  c.twin(T, "export", "body-61", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, HEX)}`)), "length: a 61-byte body vs exactly 60", "length", "sh");
  c.twin(T, "json-token", "uppercase-hex-byte", put("json-token", refuse(at(k["json-token"], 20, "E"))), "alphabet: one body byte as uppercase hex; hexadecimalize lowercases and the validator is [0-9a-f]", "alphabet", "json");
  c.twin(T, "json-api-key", "non-hex-letter", put("json-api-key", refuse(at(k["json-api-key"], 40, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(T, "bearer-header", "lowercase-prefix", put("bearer-header", refuse(`clojars_${body(k["bearer-header"])}`)), "prefix: clojars_ vs the case-sensitive CLOJARS_", "prefix", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`X${k["bare-prose"]}`)), "boundary: X glued before CLOJARS_", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-underscore", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the 60-hex body", "boundary", "txt");
  c.twin(T, "x-api-key-header", "trailing-hyphen", put("x-api-key-header", refuse(`${k["x-api-key-header"]}-x`)), "boundary: -x glued after the 60-hex body", "boundary", "http");

  c.control(T, "public-id", "username-env", ["CLOJARS_USERNAME=acme-ci\nCLOJARS_ENVIRONMENT=production\n"], "env");
  c.control(T, "public-id", "env-name-list", ["Required secrets: CLOJARS_USERNAME, CLOJARS_PASSWORD (a deploy token, not the account password).\n"], "md");
  c.control(T, "near-miss", "uppercase-hex-value", [`2026-09-29T11:43:55Z validator: is-deploy-token? false for CLOJARS_${at(synthetic(seed("upper"), 60, HEX), 33, "F")}\n`], "log");
  c.control(T, "near-miss", "truncated", [`2026-09-29T11:44:10Z lein: rejected truncated token CLOJARS_${synthetic(seed("short"), 20, HEX)}\n`], "log");
  c.control(T, "encoded-value", "bare-60-hex", [`artifact-digest: ${synthetic(seed("bare"), 60, HEX)}\n`], "yml");
  c.control(T, "placeholder", "ellipsis", ["Create a deploy token (CLOJARS_...) on your Clojars dashboard and use it as CLOJARS_PASSWORD.\n"], "md");
  c.control(T, "reference", "env-reference", ["CLOJARS_PASSWORD=${CLOJARS_PASSWORD}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          CLOJARS_PASSWORD: ${{ secrets.CLOJARS_DEPLOY_TOKEN }}\n"], "yml");
  c.control(T, "prose", "token-guidance", ["Clojars deploy tokens start with CLOJARS_ and can be scoped to one group or artifact.\n"], "md");
  return c.fixtures;
}
