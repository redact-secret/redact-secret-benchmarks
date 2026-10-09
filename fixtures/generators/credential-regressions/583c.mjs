import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice c (category `beta8-583c`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Sourcegraph personal access token (`sgp_` + optional alphanumeric instance identifier + `_` + 40 hex;
// handoff redact-secret docs/audits/evidence/1014/sourcegraph.md at the registry pin 3b1a5aa; product redact-secret#1103).
// Every value is built here from a public `synthetic` seed by repeating filler of the contract's own alphabet; nothing is
// copied from a provider example, a scanner test vector or an issued key, and no complete key-shaped literal appears in this file.
//
// The claim is the provider validators' union (40 hex of either case, identifier `local`, 16 hex or any alphanumeric run).
// Unclaimed twins (listed in benchmarks/evaluation/domains/credential/assessment.ts DISPUTED_PROPERTIES, scored T0): the
// 33-byte identifier (detector cap, policy), `sgph_` (issuer unknown) and `sgd_` + 64 hex (one provider source).
// Asserted twins differ from a positive by prefix, alphabet, boundary or body length only.

const UPPER_HEX = "0123456789ABCDEF";

export function build583c({ fixture, synthetic }) {
  const c = beta8Corpus("583c", { fixture, synthetic });
  const body = (seed, n, alphabet = HEX) => synthetic(seed, n, alphabet);

  // ------------------------------------------------------------------ sourcegraph-token: sgp_ + [id_] + 40 hex
  {
    const T = "sourcegraph-token";
    const seed = slug => `beta14:583c:${T}:${slug}`;
    const { check, refuse } = guard("583c", T);
    const hex40 = slug => body(seed(`body:${slug}`), 40);
    const id16 = slug => body(seed(`id16:${slug}`), 16);
    // Form per context: bare, 16-hex identifier, `local`, upper-case hex body, alphanumeric identifier.
    const FORM = {
      "bare-prose": "id16", "dotenv": "bare", "export": "local", "bearer-header": "bare", "x-api-key-header": "id16",
      "json-token": "local", "json-api-key": "upper", "sdk-kwarg": "bare", "chat-paste": "alnum",
      "auth-token-header": "id16", "mcp-env": "bare", "src-login": "local", "actions-env": "bare",
    };
    const tail = slug => hex40(slug);
    const key = slug => {
      switch (FORM[slug]) {
        case "id16": return check(`sgp_${id16(slug)}_${hex40(slug)}`);
        case "local": return check(`sgp_local_${hex40(slug)}`);
        case "upper": return check(`sgp_${body(seed(`upper:${slug}`), 40, UPPER_HEX)}`);
        case "alnum": return check(`sgp_${body(seed(`alnum:${slug}`), 11, ALNUM)}_${hex40(slug)}`);
        default: return check(`sgp_${hex40(slug)}`);
      }
    };
    const probe = probeContexts({ env: "SRC_ACCESS_TOKEN", name: "Sourcegraph", host: "sourcegraph.example.com", ctor: "SourcegraphClient" });
    const authToken = v => ["curl -s https://sourcegraph.example.com/.api/graphql -H \"Authorization: token ", v, "\" -d '{\"query\":\"query { currentUser { username } }\"}'\n"];
    const mcp = v => ["{\n  \"mcpServers\": {\n    \"sourcegraph\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"sourcegraph-mcp-server\"],\n      \"env\": { \"SRC_ENDPOINT\": \"https://sourcegraph.example.com\", \"SRC_ACCESS_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
    const login = v => ["SRC_ENDPOINT=https://sourcegraph.example.com SRC_ACCESS_TOKEN=", v, " src login\n"];
    const actions = v => ["jobs:\n  batch:\n    steps:\n      - run: src batch apply -f changes.batch.yaml\n        env:\n          SRC_ACCESS_TOKEN: ", v, "\n"];
    const contexts = [...probe,
      { axis: "header", slug: "auth-token-header", ext: "sh", build: authToken },
      { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
      { axis: "cli", slug: "src-login", ext: "sh", build: login },
      { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    ];
    const { k, put } = authorPositives(c, T, contexts, key);

    // Asserted twins: one property each, over a positive's own context.
    c.twin(T, "dotenv", "body-39", put("dotenv", refuse(`sgp_${body(seed("w39"), 39)}`)), "length: 39 hex after sgp_ vs the exactly-40 body of both provider validators", "length", "env");
    c.twin(T, "export", "body-41", put("export", refuse(`sgp_local_${body(seed("w41"), 41)}`)), "length: 41 hex after sgp_local_ vs the exactly-40 body", "length", "sh");
    c.twin(T, "bearer-header", "non-hex-tail", put("bearer-header", refuse(`sgp_${at(tail("bearer-header"), 39, "g")}`)), "alphabet: the last body byte replaced by g, outside [a-fA-F0-9]", "alphabet", "http");
    c.twin(T, "x-api-key-header", "identifier-without-underscore", put("x-api-key-header", refuse(`sgp_${id16("x-api-key-header")}${tail("x-api-key-header")}`)), "separator: the 16-hex identifier and the 40-hex body run together with no _ between them", "alphabet", "http");
    c.twin(T, "json-token", "uppercase-prefix", put("json-token", refuse(`SGP_${k["json-token"].slice(4)}`)), "prefix: uppercase SGP_ vs the case-sensitive sgp_", "prefix", "json");
    c.twin(T, "json-api-key", "dash-separator", put("json-api-key", refuse(`sgp-${k["json-api-key"].slice(4)}`)), "prefix: sgp- in place of sgp_", "prefix", "json");
    c.twin(T, "sdk-kwarg", "identifier-hyphen", put("sdk-kwarg", refuse(`sgp_ab-cd${body(seed("idh"), 4, ALNUM)}_${tail("sdk-kwarg")}`)), "alphabet: a hyphen inside the instance identifier, outside [A-Za-z0-9]", "alphabet", "py");
    c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before sgp_, so the run does not start at the prefix", "boundary", "md");
    c.twin(T, "chat-paste", "trailing-glue", put("chat-paste", refuse(`${k["chat-paste"]}x`)), "boundary: x glued after the 40-hex body", "boundary", "txt");
    c.twin(T, "auth-token-header", "trailing-underscore-glue", put("auth-token-header", refuse(`${k["auth-token-header"]}_`)), "boundary: _ glued after the 40-hex body", "boundary", "sh");

    // Unclaimed shapes (policy cap, issuer unknown, one provider source). T0 via DISPUTED_PROPERTIES.
    c.twin(T, "mcp-env", "identifier-33", put("mcp-env", `sgp_${body(seed("id33"), 33, ALNUM)}_${tail("mcp-env")}`), "length: a 33-character instance identifier; unclaimed (the 32-byte cap is detector policy, the 2025 validator accepts any length)", "length", "json");
    c.twin(T, "src-login", "sgph-prefix", put("src-login", `sgph_${tail("src-login")}`), "prefix: sgph_ + 40 hex, accepted by both validators with no known issuer; unclaimed", "prefix", "sh");
    c.twin(T, "actions-env", "sgd-64", put("actions-env", `sgd_${body(seed("sgd"), 64)}`), "prefix and length: sgd_ + 64 hex, the Cody Gateway derived key (one provider source); unclaimed", "prefix", "yml");

    // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a
    // reference or an obvious placeholder.
    c.control(T, "near-miss", "word-only", ["The helper reads sgp_token from the keychain and never logs it.\n"], "md");
    c.control(T, "near-miss", "prefix-only", ["Sourcegraph personal access tokens start with sgp_; the rest of the value is never printed here.\n"], "md");
    c.control(T, "near-miss", "constant-sentinel", ["const localInstancePrefix = \"sgp_local_\" // sentinel for dev instances, no token follows\n"], "ts");
    c.control(T, "encoded-value", "git-sha", [`commit ${body(seed("ctl:sha"), 40)}\nAuthor: Release Bot <bot@example.com>\n\n    bump search index version\n`], "txt");
    c.control(T, "encoded-value", "sha256-digest", [`artifact digest sha256:${body(seed("ctl:digest"), 64)}\n`], "txt");
    c.control(T, "public-id", "endpoint-and-instance", [`SRC_ENDPOINT=https://sourcegraph.example.com\nINSTANCE_REF=${body(seed("ctl:inst"), 16)}\n`], "env");
    c.control(T, "placeholder", "x-run", ["SRC_ACCESS_TOKEN=sgp_xxxxxxxxxxxxxxxxxxxxxxxx\n"], "env");
    c.control(T, "placeholder", "angle-brackets", ["export SRC_ACCESS_TOKEN=\"sgp_local_<your-access-token>\"\n"], "sh");
    c.control(T, "reference", "env-reference", ["SRC_ACCESS_TOKEN=${SRC_ACCESS_TOKEN}\n"], "env");
    c.control(T, "reference", "actions-secret", ["          SRC_ACCESS_TOKEN: ${{ secrets.SRC_ACCESS_TOKEN }}\n"], "yml");
    c.control(T, "reference", "process-env", ["const token = process.env.SRC_ACCESS_TOKEN;\n"], "ts");
    c.control(T, "prose", "token-guidance", ["Create a personal access token in your user settings and export it as SRC_ACCESS_TOKEN before running src; it acts as you on the instance.\n"], "md");
  }
  return c.fixtures;
}
