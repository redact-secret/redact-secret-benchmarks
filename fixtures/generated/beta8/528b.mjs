import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, URLSAFE, at, authorPositives, guard, other, polarChecksum, probeContexts } from "./528-shared.mjs";

// Issue #528, slice b (category `beta8-528b`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Polar organization access token (polar_oat_ + 43 [A-Za-z0-9]) and the other Polar API
// credentials (seven role prefixes + 43 [A-Za-z0-9_-]); handoff redact-secret docs/audits/evidence/1014/polar.md at
// 4f220ea; product redact-secret#1020. Every value is built here from a public `synthetic` seed.
//
// polar_oat_ bodies are 37 synthetic alphanumerics plus Polar's base62 CRC32 of them, as the provider generator emits.
// POLICY, not T1: the checksum corroborates only. Two polar_oat_ positives carry a deliberately wrong checksum and are
// still positives; no twin or control asserts silence on a checksum failure. The other roles mix era-1 URL-safe bodies
// (with - and _) and era-2 alphanumeric bodies. whsec_ (Stripe's prefix) and the short-lived session prefixes are not
// authored either way.

const ROLE_BY_SLUG = {
  "bare-prose": ["pat", 1], dotenv: ["at_u", 2], export: ["at_o", 1], "bearer-header": ["rt_u", 2], "x-api-key-header": ["rt_o", 1],
  "json-token": ["cs", 2], "json-api-key": ["crt", 1], "sdk-kwarg": ["pat", 2], "chat-paste": ["at_o", 1],
  "python-sdk": ["pat", 1], "oauth-refresh-json": ["rt_o", 2], "client-secret-env": ["cs", 1],
};

export function build528b({ fixture, synthetic }) {
  const c = beta8Corpus("528b", { fixture, synthetic });
  const TO = "polar-token", TA = "polar-api-credential";
  const seed = (t, slug) => `beta12:528b:${t}:${slug}`;
  const oatGuard = guard("528b", TO), apiGuard = guard("528b", TA);
  const oatBody = (slug, valid = true) => {
    const random = synthetic(seed(TO, slug), 37, ALNUM);
    const sum = polarChecksum(random);
    return random + (valid ? sum : `${sum.slice(0, 5)}${other(ALNUM, sum[5])}`);
  };
  const oat = slug => oatGuard.check(`polar_oat_${oatBody(slug, !slug.startsWith("checksum-mismatch"))}`);
  const era1 = slug => { let b = synthetic(seed(TA, slug), 43, URLSAFE); b = at(at(b, 11, "-"), 29, "_"); return b; };
  const api = slug => {
    const [role, era] = ROLE_BY_SLUG[slug];
    return apiGuard.check(`polar_${role}_${era === 1 ? era1(slug) : oatBody(`${TA}:${slug}`)}`);
  };

  // polar_oat_: the nine probe contexts, the SDK constructors, an MCP env block and two checksum-mismatch positives.
  const probeO = probeContexts({ env: "POLAR_ACCESS_TOKEN", name: "Polar", host: "api.polar.sh", ctor: "Polar" });
  const pySdk = v => ["from polar_sdk import Polar\n\nwith Polar(access_token=\"", v, "\") as polar:\n    polar.products.list(organization_id=\"acme\")\n"];
  const tsSdk = v => ["import { Polar } from '@polar-sh/sdk';\n\nconst polar = new Polar({ accessToken: '", v, "' });\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"polar\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@polar-sh/mcp\"],\n      \"env\": { \"POLAR_ACCESS_TOKEN\": \"", v, "\" }\n    }\n  }\n}\n"];
  const mismatchEnv = v => ["# .env.production\nPOLAR_ACCESS_TOKEN=", v, "\nPOLAR_SERVER=production\n"];
  const mismatchLog = v => ["2026-09-29T11:20:04Z billing-worker: polar request failed with token ", v, " (401)\n"];
  const oatContexts = [...probeO,
    { axis: "sdk-config", slug: "python-sdk", ext: "py", build: pySdk },
    { axis: "source-code", slug: "ts-sdk", ext: "ts", build: tsSdk },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "env", slug: "checksum-mismatch-dotenv", ext: "env", build: mismatchEnv },
    { axis: "log", slug: "checksum-mismatch-log", ext: "log", build: mismatchLog },
  ];
  const O = authorPositives(c, TO, oatContexts, oat);
  const oBody = v => v.slice(10);

  c.twin(TO, "dotenv", "body-42", O.put("dotenv", oatGuard.refuse(O.k.dotenv.slice(0, -1))), "length: a 42-byte body vs exactly 43", "length", "env");
  c.twin(TO, "export", "body-44", O.put("export", oatGuard.refuse(`${O.k.export}${synthetic(seed(TO, "extra"), 1, ALNUM)}`)), "length: a 44-byte body vs exactly 43", "length", "sh");
  c.twin(TO, "json-token", "hyphen-in-body", O.put("json-token", oatGuard.refuse(at(O.k["json-token"], 25, "-"))), "alphabet: one body byte replaced by -, outside the era-2 [A-Za-z0-9]", "alphabet", "json");
  c.twin(TO, "json-api-key", "underscore-in-body", O.put("json-api-key", oatGuard.refuse(at(O.k["json-api-key"], 30, "_"))), "alphabet: one body byte replaced by _, outside the era-2 [A-Za-z0-9]", "alphabet", "json");
  c.twin(TO, "bearer-header", "uppercase-prefix", O.put("bearer-header", oatGuard.refuse(`POLAR_OAT_${oBody(O.k["bearer-header"])}`)), "prefix: POLAR_OAT_ vs the lower-case polar_oat_", "prefix", "http");
  c.twin(TO, "bare-prose", "leading-glue", O.put("bare-prose", oatGuard.refuse(`x${O.k["bare-prose"]}`)), "boundary: x glued before polar_oat_", "boundary", "md");
  c.twin(TO, "chat-paste", "trailing-underscore", O.put("chat-paste", oatGuard.refuse(`${O.k["chat-paste"]}_x`)), "boundary: _x glued after the 43-byte alphanumeric body", "boundary", "txt");
  c.twin(TO, "sdk-kwarg", "trailing-hyphen", O.put("sdk-kwarg", oatGuard.refuse(`${O.k["sdk-kwarg"]}-x`)), "boundary: -x glued after the 43-byte alphanumeric body", "boundary", "py");

  c.control(TO, "public-id", "oauth-client-id", [`POLAR_CLIENT_ID=polar_ci_${synthetic(seed(TO, "ci"), 43, URLSAFE)}\n`], "env");
  c.control(TO, "public-id", "checkout-client-secret", [`<script>checkout.open({ clientSecret: "polar_c_${synthetic(seed(TO, "checkout"), 43, ALNUM)}" })</script>\n`], "html");
  c.control(TO, "public-id", "identifier-name", ["class Settings:\n    polar_access_token_id: str\n    polar_oat_scopes: list[str]\n"], "py");
  c.control(TO, "near-miss", "truncated", [`2026-09-29T11:21:40Z billing-worker: rejected truncated token polar_oat_${synthetic(seed(TO, "short"), 12, ALNUM)}\n`], "log");
  c.control(TO, "placeholder", "x-run", ["POLAR_ACCESS_TOKEN=polar_oat_xxxxxxxxxxxx\n"], "env");
  c.control(TO, "placeholder", "ellipsis", ["Create an organization access token (polar_oat_...) under Settings and set POLAR_ACCESS_TOKEN.\n"], "md");
  c.control(TO, "reference", "env-reference", ["POLAR_ACCESS_TOKEN=${POLAR_ACCESS_TOKEN}\n"], "env");
  c.control(TO, "reference", "actions-secret", ["      POLAR_ACCESS_TOKEN: ${{ secrets.POLAR_ACCESS_TOKEN }}\n"], "yml");
  c.control(TO, "prose", "token-guidance", ["Polar organization access tokens start with polar_oat_; the OAuth client id polar_ci_ is public.\n"], "md");

  // The other API roles: every probe context, a Python SDK, an OAuth token response and a client-secret env pair.
  const probeA = probeContexts({ env: "POLAR_OAUTH_TOKEN", name: "Polar", host: "api.polar.sh", ctor: "Polar" });
  const pyPat = v => ["from polar_sdk import Polar\n\npolar = Polar(access_token=\"", v, "\")\n"];
  const oauthJson = v => ["{\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600,\n  \"refresh_token\": \"", v, "\"\n}\n"];
  const csEnv = v => ["POLAR_OAUTH_CLIENT_ID=polar_ci_", `${synthetic(seed(TA, "pair-ci"), 43, URLSAFE)}\nPOLAR_OAUTH_CLIENT_SECRET=`, v, "\n"];
  const apiContexts = [...probeA,
    { axis: "sdk-config", slug: "python-sdk", ext: "py", build: pyPat },
    { axis: "tool-output", slug: "oauth-refresh-json", ext: "json", build: oauthJson },
    { axis: "env", slug: "client-secret-env", ext: "env", build: csEnv },
  ];
  const A = authorPositives(c, TA, apiContexts, api);
  const aBody = (v, prefix) => v.slice(prefix.length);

  c.twin(TA, "bare-prose", "body-42", A.put("bare-prose", apiGuard.refuse(A.k["bare-prose"].slice(0, -1))), "length: a 42-byte body vs exactly 43", "length", "md");
  c.twin(TA, "python-sdk", "body-44", A.put("python-sdk", apiGuard.refuse(`${A.k["python-sdk"]}${synthetic(seed(TA, "extra"), 1, ALNUM)}`)), "length: a 44-byte body vs exactly 43", "length", "py");
  c.twin(TA, "dotenv", "access-token-without-subtype", A.put("dotenv", apiGuard.refuse(`polar_at_${aBody(A.k.dotenv, "polar_at_u_")}`)), "prefix: polar_at_ without the u_/o_ sub-type the OAuth constants require", "prefix", "env");
  c.twin(TA, "sdk-kwarg", "uppercase-prefix", A.put("sdk-kwarg", apiGuard.refuse(`POLAR_PAT_${aBody(A.k["sdk-kwarg"], "polar_pat_")}`)), "prefix: POLAR_PAT_ vs the lower-case polar_pat_", "prefix", "py");
  c.twin(TA, "json-token", "dot-in-body", A.put("json-token", apiGuard.refuse(at(A.k["json-token"], 30, "."))), "alphabet: one body byte replaced by ., outside [A-Za-z0-9_-]", "alphabet", "json");
  c.twin(TA, "chat-paste", "leading-glue", A.put("chat-paste", apiGuard.refuse(`x${A.k["chat-paste"]}`)), "boundary: x glued before polar_at_o_", "boundary", "txt");
  c.twin(TA, "bearer-header", "unknown-role", A.put("bearer-header", apiGuard.refuse(`polar_rx_u_${aBody(A.k["bearer-header"], "polar_rt_u_")}`)), "prefix: polar_rx_u_, a role the provider constants do not define", "prefix", "http");

  c.control(TA, "public-id", "checkout-link-secret", [`POLAR_CHECKOUT_LINK=polar_cl_${synthetic(seed(TA, "cl"), 43, ALNUM)}\n`], "env");
  c.control(TA, "public-id", "client-id-in-url", [`https://polar.sh/oauth2/authorize?client_id=polar_ci_${synthetic(seed(TA, "ci-url"), 43, URLSAFE)}&response_type=code\n`], "txt");
  c.control(TA, "public-id", "setting-names", ["polar_cs_rotation_days = 90\npolar_pat_expiry_warning = True\n"], "py");
  c.control(TA, "near-miss", "truncated", [`2026-09-29T11:23:02Z oauth: refresh failed for polar_rt_u_${synthetic(seed(TA, "short"), 16, URLSAFE)}\n`], "log");
  c.control(TA, "placeholder", "x-run", ["POLAR_OAUTH_CLIENT_SECRET=polar_cs_xxxxxxxxxxxxxxxx\n"], "env");
  c.control(TA, "placeholder", "ellipsis", ["The token endpoint returns an access token (polar_at_u_...) and a refresh token (polar_rt_u_...).\n"], "md");
  c.control(TA, "reference", "env-reference", ["POLAR_OAUTH_CLIENT_SECRET=${POLAR_OAUTH_CLIENT_SECRET}\n"], "env");
  c.control(TA, "reference", "actions-secret", ["      POLAR_OAUTH_TOKEN: ${{ secrets.POLAR_OAUTH_TOKEN }}\n"], "yml");
  c.control(TA, "prose", "role-guidance", ["Polar personal access tokens start with polar_pat_ and OAuth tokens with polar_at_ or polar_rt_ plus u_ or o_.\n"], "md");
  return c.fixtures;
}
