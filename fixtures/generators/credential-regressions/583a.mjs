import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, DIGITS, HEX, URLSAFE, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice a (category `beta8-583a`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Square access token (`EAAA` + 60) and the Square OAuth application secret (`sq0csp-` + 43 or 44,
// `sandbox-sq0csb-` + 43), all over [A-Za-z0-9_-] (handoff redact-secret docs/audits/evidence/1014/square.md at fa955d2;
// product redact-secret#1107). Every value is built here from a public `synthetic` seed by repeating filler of the
// contract's own alphabet; nothing is copied from a provider example, a scanner test vector or an issued key, and no
// complete key-shaped literal appears in this file.
//
// Square disclaims length validation and its own examples disagree (63 vs 64, 43 vs 44). The contract claims the stable
// widths; every conflicting width is authored as an UNCLAIMED twin (listed in
// benchmarks/evaluation/domains/credential/assessment.ts DISPUTED_PROPERTIES, scored T0): the corpus asserts neither detection nor silence on it.
// Asserted twins differ from a positive by prefix, alphabet or boundary only.

export function build583a({ fixture, synthetic }) {
  const c = beta8Corpus("583a", { fixture, synthetic });
  const body = (seed, n, alphabet = URLSAFE) => synthetic(seed, n, alphabet);

  // ------------------------------------------------------------------ square-token: EAAA + exactly 60 [A-Za-z0-9_-]
  {
    const T = "square-token";
    const seed = slug => `beta14:583a:${T}:${slug}`;
    const { check, refuse } = guard("583a", T);
    const tail = slug => body(seed(`body:${slug}`), 60);
    const key = slug => {
      let b = tail(slug);
      if (slug === "json-api-key") b = at(at(b, 13, "-"), 41, "_"); // a body that carries both - and _
      return check(`EAAA${b}`);
    };
    const probe = probeContexts({ env: "SQUARE_ACCESS_TOKEN", name: "Square", host: "connect.squareup.com", ctor: "SquareClient" });
    const nodeSdk = v => ["import { Client, Environment } from \"square\";\n\nconst client = new Client({ accessToken: \"", v, "\", environment: Environment.Production });\n"];
    const mcp = v => ["{\n  \"mcpServers\": {\n    \"square\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"square-mcp-server\"],\n      \"env\": { \"SQUARE_ACCESS_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
    const curl = v => ["curl -s https://connect.squareup.com/v2/locations -H \"Square-Version: 2024-01-18\" -H \"Authorization: Bearer ", v, "\"\n"];
    const actions = v => ["jobs:\n  deploy:\n    steps:\n      - run: ./sync-catalog.sh\n        env:\n          SQUARE_ACCESS_TOKEN: ", v, "\n"];
    const docker = v => ["docker run --rm -e SQUARE_ACCESS_TOKEN=", v, " catalog-sync:latest\n"];
    const contexts = [...probe,
      { axis: "sdk-config", slug: "node-sdk-client", ext: "ts", build: nodeSdk },
      { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
      { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
      { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
      { axis: "container-config", slug: "docker-env", ext: "sh", build: docker },
    ];
    const { k, put } = authorPositives(c, T, contexts, key);
    const swap = (slug, value) => put(slug, value);

    // Asserted twins: one property each (prefix, alphabet, boundary), over a positive's own context.
    c.twin(T, "dotenv", "lowercase-prefix", swap("dotenv", refuse(`eaaa${tail("dotenv")}`)), "prefix: lowercase eaaa vs the case-sensitive EAAA", "prefix", "env");
    c.twin(T, "bearer-header", "eaab-prefix", swap("bearer-header", refuse(`EAAB${tail("bearer-header")}`)), "prefix: EAAB vs the documented EAAA", "prefix", "http");
    c.twin(T, "json-token", "plus-in-body", swap("json-token", refuse(`EAAA${at(tail("json-token"), 20, "+")}`)), "alphabet: one body byte replaced by +, outside [A-Za-z0-9_-]", "alphabet", "json");
    c.twin(T, "sdk-kwarg", "slash-in-body", swap("sdk-kwarg", refuse(`EAAA${at(tail("sdk-kwarg"), 33, "/")}`)), "alphabet: one body byte replaced by /, outside [A-Za-z0-9_-]", "alphabet", "py");
    c.twin(T, "x-api-key-header", "equals-in-body", swap("x-api-key-header", refuse(`EAAA${at(tail("x-api-key-header"), 59, "=")}`)), "alphabet: the last body byte replaced by =, outside [A-Za-z0-9_-]", "alphabet", "http");
    c.twin(T, "bare-prose", "leading-glue", swap("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before EAAA, so the run does not start at the prefix", "boundary", "md");
    c.twin(T, "chat-paste", "meta-style-long-run", swap("chat-paste", refuse(`EAAA${body(seed("long-run"), 150)}`)), "boundary: EAAA followed by a 150-character URL-safe run, the shape of a Meta Graph token, not a 60-character body", "boundary", "txt");

    // Unclaimed shapes (Square disclaims length validation; its own examples disagree). T0 via DISPUTED_PROPERTIES.
    c.twin(T, "export", "body-59", swap("export", `EAAA${body(seed("w59"), 59)}`), "length: 59 after EAAA (63 in all): the provider's other example width; unclaimed (Q8, no assertion)", "length", "sh");
    c.twin(T, "node-sdk-client", "body-61", swap("node-sdk-client", `EAAA${body(seed("w61"), 61)}`), "length: 61 after EAAA (65 in all); unclaimed (no source)", "length", "ts");
    c.twin(T, "mcp-env", "eaal-59", swap("mcp-env", `EAAl${body(seed("eaal"), 59)}`), "prefix and length: EAAl + 59, the ObtainToken reference access_token form (63 in all); unclaimed pending the issuance check (#584)", "prefix", "json");
    c.twin(T, "curl-bearer", "eqaa-60", swap("curl-bearer", `EQAA${body(seed("eqaa"), 60)}`), "prefix: EQAA + 60, the ObtainToken reference refresh_token form; unclaimed pending the issuance check (#584)", "prefix", "sh");
    c.twin(T, "docker-env", "legacy-sq0atp", swap("docker-env", `sq0atp-${body(seed("sq0atp"), 22)}`), "prefix: sq0atp- + 22, a legacy personal-token form only scanner rules show; unclaimed", "prefix", "sh");

    // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a
    // reference or an obvious placeholder, so no credential-named-neighbour policy redaction reads as a false alarm.
    c.control(T, "near-miss", "meta-graph-token", [`2026-10-05T09:12:03Z graph: refreshed page token EAAB${body(seed("ctl:graph"), 160, ALNUM)} for page 4471 (not a Square token)\n`], "log");
    c.control(T, "near-miss", "prefix-only", ["Square access tokens start with EAAA; the rest of the value is never printed.\n"], "md");
    c.control(T, "encoded-value", "docker-digest", [`image: registry.example/pos-sync@sha256:eaaa${body(seed("ctl:digest"), 60, HEX)}\n`], "yml");
    c.control(T, "encoded-value", "base64-blob-padding", [`logo: data:image/png;base64,iVBORw0KGgo${body(seed("ctl:b64:a"), 40, ALNUM)}E${"A".repeat(79)}${body(seed("ctl:b64:b"), 40, ALNUM)}\n`], "yml");
    c.control(T, "public-id", "application-id", [`const applicationId = "sq0idp-${body(seed("ctl:appid"), 22)}"; // public, shown in the browser\n`], "ts");
    c.control(T, "public-id", "sandbox-application-id", [`sandbox application id: sandbox-sq0idb-${body(seed("ctl:sbappid"), 22)}\n`], "md");
    c.control(T, "placeholder", "your-access-token", ["SQUARE_ACCESS_TOKEN=EAAA-your-access-token\n"], "env");
    c.control(T, "placeholder", "angle-brackets", ["export SQUARE_ACCESS_TOKEN=\"EAAA<your-production-access-token>\"\n"], "sh");
    c.control(T, "reference", "env-reference", ["SQUARE_ACCESS_TOKEN=${SQUARE_ACCESS_TOKEN}\n"], "env");
    c.control(T, "reference", "actions-secret", ["          SQUARE_ACCESS_TOKEN: ${{ secrets.SQUARE_ACCESS_TOKEN }}\n"], "yml");
    c.control(T, "prose", "token-guidance", ["A Square access token authorizes payments and refunds for a seller; keep it in a secret store and revoke it from the Developer Console if it leaks.\n"], "md");
  }

  // ---------------------------------------------- square-oauth-application-secret: sq0csp- + 43/44, sandbox-sq0csb- + 43
  {
    const T = "square-oauth-application-secret";
    const seed = slug => `beta14:583a:${T}:${slug}`;
    const { check, refuse } = guard("583a", T);
    // The production secret is claimed at both provider widths; most contexts carry 43, the reference-page contexts 44.
    const WIDE = new Set(["json-api-key", "sdk-kwarg", "chat-paste", "obtain-token-json", "node-sdk-obtain-token"]);
    const SANDBOX = new Set(["sandbox-dotenv", "sandbox-json"]);
    const prefixOf = slug => SANDBOX.has(slug) ? "sandbox-sq0csb-" : "sq0csp-";
    const widthOf = slug => SANDBOX.has(slug) ? 43 : WIDE.has(slug) ? 44 : 43;
    const tail = (slug, n = widthOf(slug)) => body(seed(`body:${slug}`), n);
    const key = slug => {
      let b = tail(slug);
      if (slug === "json-token") b = at(at(b, 9, "-"), 30, "_");
      return check(`${prefixOf(slug)}${b}`);
    };
    const probe = probeContexts({ env: "SQUARE_CLIENT_SECRET", name: "Square OAuth application", host: "connect.squareup.com", ctor: "SquareOAuth" });
    const obtain = v => ["POST /oauth2/token HTTP/1.1\nHost: connect.squareup.com\nContent-Type: application/json\n\n{\n  \"client_id\": \"sq0idp-", body(seed("obtain:client-id"), 22), "\",\n  \"client_secret\": \"", v, "\",\n  \"grant_type\": \"authorization_code\"\n}\n"];
    const nodeObtain = v => ["const { result } = await client.oAuthApi.obtainToken({\n  clientId: process.env.SQUARE_APPLICATION_ID,\n  clientSecret: \"", v, "\",\n  grantType: \"authorization_code\",\n});\n"];
    const actions = v => ["jobs:\n  oauth:\n    steps:\n      - run: ./exchange-code.sh\n        env:\n          SQUARE_CLIENT_SECRET: ", v, "\n"];
    const mcp = v => ["{\n  \"mcpServers\": {\n    \"square-oauth\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"square-oauth-mcp\"],\n      \"env\": { \"SQUARE_CLIENT_SECRET\": \"", v, "\" }\n    }\n  }\n}\n"];
    const sandboxEnv = v => ["# .env.sandbox\nSQUARE_ENVIRONMENT=sandbox\nSQUARE_CLIENT_SECRET=", v, "\n"];
    const sandboxJson = v => ["{\n  \"environment\": \"sandbox\",\n  \"clientSecret\": \"", v, "\"\n}\n"];
    const contexts = [...probe,
      { axis: "structured-file", slug: "obtain-token-json", ext: "http", build: obtain },
      { axis: "sdk-config", slug: "node-sdk-obtain-token", ext: "ts", build: nodeObtain },
      { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
      { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
      { axis: "env", slug: "sandbox-dotenv", ext: "env", build: sandboxEnv },
      { axis: "structured-file", slug: "sandbox-json", ext: "json", build: sandboxJson },
    ];
    const { k, put } = authorPositives(c, T, contexts, key);

    // Asserted twins: prefix, separator, alphabet, case, boundary.
    c.twin(T, "dotenv", "short-prefix", put("dotenv", refuse(`sq0cs-${tail("dotenv")}`)), "prefix: sq0cs- (the p role letter removed) vs sq0csp-", "prefix", "env");
    c.twin(T, "bearer-header", "underscore-separator", put("bearer-header", refuse(`sq0csp_${tail("bearer-header")}`)), "separator: _ in place of the - after sq0csp", "alphabet", "http");
    c.twin(T, "json-token", "plus-in-body", put("json-token", refuse(`sq0csp-${at(tail("json-token"), 17, "+")}`)), "alphabet: one body byte replaced by +, outside [A-Za-z0-9_-]", "alphabet", "json");
    c.twin(T, "x-api-key-header", "slash-in-body", put("x-api-key-header", refuse(`sq0csp-${at(tail("x-api-key-header"), 31, "/")}`)), "alphabet: one body byte replaced by /, outside [A-Za-z0-9_-]", "alphabet", "http");
    c.twin(T, "bare-prose", "uppercase-prefix", put("bare-prose", refuse(`SQ0CSP-${tail("bare-prose")}`)), "prefix: uppercase SQ0CSP- vs the case-sensitive sq0csp-", "prefix", "md");
    c.twin(T, "chat-paste", "leading-glue", put("chat-paste", refuse(`x${k["chat-paste"]}`)), "boundary: x glued before sq0csp-, so the run does not start at the prefix", "boundary", "txt");
    c.twin(T, "sdk-kwarg", "long-run", put("sdk-kwarg", refuse(`sq0csp-${body(seed("long-run"), 130)}`)), "boundary: sq0csp- followed by a 130-character URL-safe run, not a 43- or 44-character body", "boundary", "py");
    c.twin(T, "mcp-env", "application-id-prefix", put("mcp-env", refuse(`sq0idp-${tail("mcp-env")}`)), "prefix: sq0idp- (the public application id prefix) with a secret-width body", "prefix", "json");
    c.twin(T, "sandbox-dotenv", "sandbox-application-id-prefix", put("sandbox-dotenv", refuse(`sandbox-sq0idb-${tail("sandbox-dotenv")}`)), "prefix: sandbox-sq0idb- (the sandbox application id prefix) with a secret-width body", "prefix", "env");

    // Unclaimed widths (Square's own examples disagree on 43 vs 44 and it disclaims length validation). T0 via DISPUTED_PROPERTIES.
    c.twin(T, "dotenv", "production-42", put("dotenv", `sq0csp-${tail("dotenv", 42)}`), "length: 42 after sq0csp-; unclaimed (outside the 43/44 union)", "length", "env");
    c.twin(T, "export", "production-45", put("export", `sq0csp-${tail("export", 45)}`), "length: 45 after sq0csp-; unclaimed (outside the 43/44 union)", "length", "sh");
    c.twin(T, "sandbox-dotenv", "sandbox-42", put("sandbox-dotenv", `sandbox-sq0csb-${tail("sandbox-dotenv", 42)}`), "length: 42 after sandbox-sq0csb-; unclaimed (the sandbox secret has one docs page)", "length", "env");
    c.twin(T, "sandbox-json", "sandbox-44", put("sandbox-json", `sandbox-sq0csb-${tail("sandbox-json", 44)}`), "length: 44 after sandbox-sq0csb-; unclaimed (the production secret has both widths, the sandbox one documented width is 43)", "length", "json");

    c.control(T, "near-miss", "prefix-only", ["The OAuth application secret starts with sq0csp- in production and sandbox-sq0csb- in the sandbox; the body is never printed here.\n"], "md");
    c.control(T, "encoded-value", "sha256-digest", [`artifact digest sha256:${body(seed("ctl:digest"), 64, HEX)}\n`], "txt");
    c.control(T, "public-id", "application-id", [`SQUARE_APPLICATION_ID=sq0idp-${body(seed("ctl:appid"), 22)}\n`], "env");
    c.control(T, "public-id", "sandbox-application-id", [`SQUARE_SANDBOX_APPLICATION_ID=sandbox-sq0idb-${body(seed("ctl:sbappid"), 22)}\n`], "env");
    c.control(T, "public-id", "browser-application-id", [`<script>Square.payments("sq0idp-${body(seed("ctl:browser"), 22)}", "L${body(seed("ctl:loc"), 12, DIGITS)}");</script>\n`], "html");
    c.control(T, "placeholder", "x-run", ["SQUARE_CLIENT_SECRET=sq0csp-xxxxxxxx\n"], "env");
    c.control(T, "placeholder", "angle-brackets", ["client_secret: sandbox-sq0csb-<your-sandbox-application-secret>\n"], "yml");
    c.control(T, "reference", "env-reference", ["SQUARE_CLIENT_SECRET=${SQUARE_CLIENT_SECRET}\n"], "env");
    c.control(T, "reference", "process-env", ["const clientSecret = process.env.SQUARE_CLIENT_SECRET;\n"], "ts");
    c.control(T, "prose", "secret-guidance", ["The application secret lets an integration exchange authorization codes and renew seller tokens; store it server-side only.\n"], "md");
  }
  return c.fixtures;
}
