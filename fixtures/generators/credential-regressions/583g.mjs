import { createHmac } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, LOWER_ALNUM, URLSAFE, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice g (category `beta8-583g`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Mapbox secret access token (`sk.` + a base64url JSON payload that leads `eyJ` + `.` + exactly 22
// base64url signature characters; handoff redact-secret docs/audits/evidence/1014/mapbox.md at the 3b1a5aa re-pin; product
// redact-secret#1108). Every value is built here from a public `synthetic` seed: the payload is the base64url of a two-claim
// JSON object over synthetic filler (or `eyJ` + filler where an exact payload width is wanted) and the signature is synthetic
// filler of the contract's own alphabet. Nothing is copied from a provider example, a scanner test vector or an issued token, and
// no complete token-shaped literal appears in this file.
//
// The payload has no provider-stated bound and its floor (3 + 20 characters) is derived from provider code, not stated by
// Mapbox: whether that floor may serve as T1 is ruling Q7 (policy, never T1). A payload of 19 is therefore authored UNCLAIMED
// (listed in DISPUTED_PROPERTIES, scored T0), as is the temporary `tk.` token (Q9, unclaimed). Asserted twins differ from a
// positive by prefix, case, separator, alphabet, signature width or boundary only. Public `pk.` tokens are public by design.

export function build583g({ fixture, synthetic }) {
  const c = beta8Corpus("583g", { fixture, synthetic });
  const body = (seed, n, alphabet = URLSAFE) => synthetic(seed, n, alphabet);
  const b64url = s => Buffer.from(s, "utf8").toString("base64url");

  // ------------------------------------------------------------------ mapbox-token: sk. + eyJ payload + . + 22 signature
  {
    const T = "mapbox-token";
    const seed = slug => `beta14:583g:${T}:${slug}`;
    const { check, refuse } = guard("583g", T);
    // Exact payload widths (counting the leading eyJ) where a context pins one; every other context carries a realistic
    // two-claim JSON payload (user and token id), the documented `u` + `a` shape.
    const WIDTH = { "sdk-kwarg": 23, "gradle-properties": 55, "tilesets-cli": 63, netrc: 100, "api-url-query": 250 };
    const claims = slug => b64url(JSON.stringify({ u: body(seed(`user:${slug}`), 10, LOWER_ALNUM), a: body(seed(`id:${slug}`), 25, LOWER_ALNUM) }));
    const payloadOf = slug => {
      let p = WIDTH[slug] ? `eyJ${body(seed(`payload:${slug}`), WIDTH[slug] - 3)}` : claims(slug);
      if (slug === "json-api-key") p = at(at(p, 30, "-"), 45, "_"); // a payload that carries both - and _
      return p;
    };
    const sigOf = slug => body(seed(`sig:${slug}`), 22);
    const assemble = (p, s) => `sk.${p}.${s}`;
    const key = slug => check(assemble(payloadOf(slug), sigOf(slug)));

    const probe = probeContexts({ env: "MAPBOX_SECRET_TOKEN", name: "Mapbox", host: "api.mapbox.com", ctor: "MapboxClient" });
    const accessEnv = v => ["# .env.local\nMAPBOX_ACCESS_TOKEN=", v, "\nNEXT_PUBLIC_MAP_STYLE=streets-v12\n"];
    const gl = v => ["import mapboxgl from \"mapbox-gl\";\n\nmapboxgl.accessToken = \"", v, "\";\nconst map = new mapboxgl.Map({ container: \"map\", style: \"mapbox://styles/mapbox/streets-v12\" });\n"];
    const sdk = v => ["import mbxClient from \"@mapbox/mapbox-sdk\";\n\nconst base = mbxClient({ accessToken: \"", v, "\" });\n"];
    const tilesets = v => ["$ MAPBOX_ACCESS_TOKEN=", v, " tilesets upload-source acme-maps parcels ./parcels.geojson\n"];
    const apiUrl = v => ["curl -s \"https://api.mapbox.com/tilesets/v1/acme-maps?limit=50&access_token=", v, "\"\n"];
    const gradle = v => ["# gradle.properties\norg.gradle.jvmargs=-Xmx2g\nMAPBOX_DOWNLOADS_TOKEN=", v, "\n"];
    const netrc = v => ["machine api.mapbox.com\nlogin mapbox\npassword ", v, "\n"];
    const actions = v => ["jobs:\n  build:\n    steps:\n      - run: ./gradlew assembleRelease\n        env:\n          MAPBOX_DOWNLOADS_TOKEN: ", v, "\n"];
    const contexts = [...probe,
      { axis: "env", slug: "access-token-env", ext: "env", build: accessEnv },
      { axis: "source-code", slug: "mapbox-gl-access-token", ext: "ts", build: gl },
      { axis: "sdk-config", slug: "mapbox-sdk-client", ext: "ts", build: sdk },
      { axis: "cli", slug: "tilesets-cli", ext: "sh", build: tilesets },
      { axis: "url", slug: "api-url-query", ext: "sh", build: apiUrl },
      { axis: "env", slug: "gradle-properties", ext: "txt", build: gradle },
      { axis: "basic-auth", slug: "netrc", ext: "txt", build: netrc },
      { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    ];
    const { k, put } = authorPositives(c, T, contexts, key);
    const swap = (slug, value) => put(slug, value);
    const P = slug => payloadOf(slug), S = slug => sigOf(slug);

    // Asserted twins: one property each (prefix, case, separator, alphabet, signature width, boundary).
    c.twin(T, "dotenv", "uppercase-prefix", swap("dotenv", refuse(`SK.${P("dotenv")}.${S("dotenv")}`)), "case: uppercase SK. vs the case-sensitive sk.", "prefix", "env");
    c.twin(T, "bearer-header", "underscore-separator", swap("bearer-header", refuse(`sk_${P("bearer-header")}.${S("bearer-header")}`)), "separator: _ in place of the . after sk", "alphabet", "http");
    c.twin(T, "x-api-key-header", "dash-separator", swap("x-api-key-header", refuse(`sk-${P("x-api-key-header")}.${S("x-api-key-header")}`)), "separator: - in place of the . after sk (the OpenAI-style sk- form)", "alphabet", "http");
    c.twin(T, "json-token", "signature-21", swap("json-token", refuse(assemble(P("json-token"), S("json-token").slice(0, 21)))), "length: a 21-character signature vs the documented 22", "length", "json");
    c.twin(T, "json-api-key", "signature-23", swap("json-api-key", refuse(assemble(P("json-api-key"), `${S("json-api-key")}${body(seed("sig23"), 1)}`))), "boundary: a 23rd signature byte, so the run does not end at the 22nd", "boundary", "json");
    c.twin(T, "bare-prose", "leading-glue", swap("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before sk., so the run does not start at the prefix", "boundary", "md");
    c.twin(T, "chat-paste", "missing-second-dot", swap("chat-paste", refuse(`sk.${P("chat-paste")}${S("chat-paste")}`)), "separator: the second dot removed, so the signature is not a separate 22-character part", "alphabet", "txt");
    c.twin(T, "export", "public-pk-same-shape", swap("export", refuse(`pk.${P("export")}.${S("export")}`)), "prefix: pk. (a public token, never a secret) with the identical payload and signature", "prefix", "sh");
    c.twin(T, "access-token-env", "payload-not-json-lead", swap("access-token-env", refuse(`sk.eyK${P("access-token-env").slice(3)}.${S("access-token-env")}`)), "prefix: the payload leads eyK, not the JSON opener eyJ", "prefix", "env");
    c.twin(T, "mapbox-gl-access-token", "plus-in-payload", swap("mapbox-gl-access-token", refuse(assemble(at(P("mapbox-gl-access-token"), 30, "+"), S("mapbox-gl-access-token")))), "alphabet: one payload byte replaced by +, outside [A-Za-z0-9_-]", "alphabet", "ts");
    c.twin(T, "mapbox-sdk-client", "equals-in-signature", swap("mapbox-sdk-client", refuse(assemble(P("mapbox-sdk-client"), `${S("mapbox-sdk-client").slice(0, 21)}=`))), "alphabet: the last signature byte replaced by =, outside [A-Za-z0-9_-]", "alphabet", "ts");

    // Unclaimed shapes. T0 via DISPUTED_PROPERTIES: the payload floor is derived from provider code (Q7), and the temporary
    // tk. token is unclaimed pending the maintainer (Q9).
    c.twin(T, "actions-env", "payload-below-floor-22", swap("actions-env", `sk.eyJ${body(seed("w19"), 19)}.${S("actions-env")}`), "length: a 22-character payload (eyJ + 19), one below the derived floor; unclaimed (Q7, no assertion)", "length", "yml");
    c.twin(T, "tilesets-cli", "temporary-tk-prefix", swap("tilesets-cli", `tk.${P("tilesets-cli")}.${S("tilesets-cli")}`), "prefix: tk. (a temporary token that expires within the hour); unclaimed pending the maintainer (Q9)", "prefix", "sh");

    // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a
    // reference or an obvious placeholder.
    const pk = slug => `pk.${claims(`pk:${slug}`)}.${body(seed(`pk-sig:${slug}`), 22)}`;
    c.control(T, "public-id", "pk-in-page-markup", [`<div id="map" data-mapbox-public="${pk("html")}" data-style="streets-v12"></div>\n`], "html");
    c.control(T, "public-id", "pk-in-prose", [`The storefront map loads with the public token ${pk("prose")}, which ships in the page and is restricted by URL.\n`], "md");
    c.control(T, "near-miss", "style-and-tileset-ids", [`style: mapbox://styles/acme-maps/${body(seed("ctl:style"), 25, LOWER_ALNUM)}\ntileset: acme-maps.${body(seed("ctl:tileset"), 6, LOWER_ALNUM)}\n`], "yml");
    c.control(T, "near-miss", "prefix-only", ["Server-side Mapbox tokens start with sk. and carry secret scopes; browser code must use a pk. token instead. The value is never printed here.\n"], "md");
    // The no-double-report case: a three-part JWT (eyJ header) whose claims are Mapbox-shaped is the jwt detector's, never this family (R7).
    {
      const input = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${claims("jwt")}`;
      const jwt = `${input}.${createHmac("sha256", body(seed("ctl:jwt-key"), 32, ALNUM)).update(input).digest("base64url")}`;
      c.control(T, "encoded-value", "jwt-with-mapbox-claims", [`2026-10-05T09:12:03Z gateway: forwarded session assertion ${jwt} to the auth service\n`], "log");
    }
    c.control(T, "placeholder", "angle-brackets", ["MAPBOX_SECRET_TOKEN=sk.eyJ<your-secret-token-payload>.<your-signature>\n"], "env");
    c.control(T, "placeholder", "x-run", ["MAPBOX_DOWNLOADS_TOKEN=sk.xxxxxxxxxxxxxxxx\n"], "txt");
    c.control(T, "reference", "env-reference", ["MAPBOX_ACCESS_TOKEN=${MAPBOX_ACCESS_TOKEN}\n"], "env");
    c.control(T, "reference", "actions-secret", ["          MAPBOX_DOWNLOADS_TOKEN: ${{ secrets.MAPBOX_DOWNLOADS_TOKEN }}\n"], "yml");
    c.control(T, "prose", "token-guidance", ["A Mapbox secret token can upload tilesets, edit styles and read the account; keep it on the server and revoke it from the account page if it leaks.\n"], "md");
  }
  return c.fixtures;
}
