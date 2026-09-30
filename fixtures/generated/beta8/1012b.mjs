import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, DIGITS, LOWER_ALNUM, URLSAFE, at, authorPositives, guard, probeContexts } from "./1012-shared.mjs";

// Issue #1012, slice b (category `beta8-1012b`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Google OAuth client secret (GOCSPX- + exactly 28 [A-Za-z0-9_-]); research redact-secret
// docs/audits/evidence/1012/google-oauth2-credential.md at 4fb7882; product redact-secret#1029. Every value is built here
// from a public `synthetic` seed.
//
// Not authored either way: ya29. access tokens and 1// refresh tokens (BLOCKED in the research record) and unprefixed
// pre-GOCSPX secrets. The body class contains _ and -, so a trailing byte only lengthens the run: the 29-byte twin
// covers it and no trailing-glue twin is authored (#84).

export function build1012b({ fixture, synthetic }) {
  const c = beta8Corpus("1012b", { fixture, synthetic });
  const T = "google-oauth-client-secret";
  const g = guard("1012b", T);
  const seed = slug => `beta12:1012b:${T}:${slug}`;
  const clientId = slug => `${synthetic(seed(`${slug}:project`), 12, DIGITS)}-${synthetic(seed(`${slug}:id`), 32, LOWER_ALNUM)}.apps.googleusercontent.com`;
  const key = slug => {
    let body = synthetic(seed(slug), 28, URLSAFE);
    if (slug === "json-client-file") body = at(at(body, 5, "_"), 19, "-");
    return g.check(`GOCSPX-${body}`);
  };

  const probe = probeContexts({ env: "GOOGLE_CLIENT_SECRET", name: "Google OAuth", host: "oauth2.googleapis.com", ctor: "OAuthClient" });
  const clientFile = v => [`{"installed":{"client_id":"${clientId("file")}","project_id":"acme-desktop","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","client_secret":"`, v, "\",\"redirect_uris\":[\"http://localhost\"]}}\n"];
  const tokenCurl = v => [`curl -s https://oauth2.googleapis.com/token -d client_id=${clientId("curl")} -d client_secret=`, v, " -d grant_type=refresh_token -d refresh_token=$REFRESH_TOKEN\n"];
  const flask = v => ["app.config.update(\n    GOOGLE_CLIENT_ID=\"", clientId("flask"), "\",\n    GOOGLE_CLIENT_SECRET=\"", v, "\",\n)\n"];
  const contexts = [...probe,
    { axis: "structured-file", slug: "json-client-file", ext: "json", build: clientFile },
    { axis: "cli", slug: "token-curl", ext: "sh", build: tokenCurl },
    { axis: "source-code", slug: "flask-config", ext: "py", build: flask },
    // Profile completion (Beta.12 graduation, 2026-09-30): the web-application client file, the other layout of the
    // client_secret JSON the research record's contexts name.
    { axis: "structured-file", slug: "json-web-client-file", ext: "json", build: v => [`{"web":{"client_id":"${clientId("web")}","project_id":"acme-web","client_secret":"`, v, "\",\"redirect_uris\":[\"https://acme.example/oauth2/callback\"]}}\n"] },
  ];
  const K = authorPositives(c, T, contexts, key);
  const body = v => v.slice(7);

  c.twin(T, "dotenv", "body-27", K.put("dotenv", g.refuse(K.k.dotenv.slice(0, -1))), "length: a 27-byte body vs exactly 28", "length", "env");
  c.twin(T, "export", "body-29", K.put("export", g.refuse(`${K.k.export}${synthetic(seed("extra"), 1, ALNUM)}`)), "length: a 29-byte body vs exactly 28", "length", "sh");
  c.twin(T, "json-token", "lowercase-prefix", K.put("json-token", g.refuse(`gocspx-${body(K.k["json-token"])}`)), "prefix: gocspx- vs the upper-case GOCSPX-", "prefix", "json");
  c.twin(T, "json-api-key", "underscore-separator", K.put("json-api-key", g.refuse(`GOCSPX_${body(K.k["json-api-key"])}`)), "prefix: GOCSPX_ with an underscore vs GOCSPX- with a hyphen", "prefix", "json");
  c.twin(T, "sdk-kwarg", "dot-in-body", K.put("sdk-kwarg", g.refuse(at(K.k["sdk-kwarg"], 20, "."))), "alphabet: one body byte replaced by ., outside [A-Za-z0-9_-]", "alphabet", "py");
  c.twin(T, "bare-prose", "leading-glue", K.put("bare-prose", g.refuse(`x${K.k["bare-prose"]}`)), "boundary: x glued before GOCSPX-", "boundary", "md");

  // Profile completion: two more one-property twins on already-twinned positives, and two more controls.
  c.twin(T, "dotenv", "prefix-without-hyphen", K.put("dotenv", g.refuse(`GOCSPX${body(K.k.dotenv)}`)), "prefix: GOCSPX with no hyphen before the body", "prefix", "env");
  c.twin(T, "json-token", "truncated-marker", K.put("json-token", g.refuse(`GOCSP-${body(K.k["json-token"])}`)), "prefix: GOCSP- (one letter short) vs GOCSPX-", "prefix", "json");
  c.control(T, "public-id", "project-id", ["GOOGLE_CLOUD_PROJECT=acme-desktop-481516\n"], "env");
  c.control(T, "reference", "environ-lookup", ["client_secret = os.environ[\"GOOGLE_CLIENT_SECRET\"]\n"], "py");
  c.control(T, "public-id", "client-id", [`GOOGLE_CLIENT_ID=${clientId("control")}\n`], "env");
  c.control(T, "public-id", "consent-url", [`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId("url")}&response_type=code&scope=openid%20email\n`]);
  c.control(T, "placeholder", "ellipsis", ["{\n  \"client_secret\": \"GOCSPX-...\"\n}\n"], "json");
  c.control(T, "placeholder", "angle", ["GOOGLE_CLIENT_SECRET=<GOCSPX-your-client-secret>\n"], "env");
  c.control(T, "placeholder", "x-run", ["GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx\n"], "env");
  c.control(T, "reference", "env-reference", ["GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}\n"], "yml");
  c.control(T, "near-miss", "truncated", [`2026-09-29T11:02:40Z auth: rejected client secret GOCSPX-${synthetic(seed("short"), 12, URLSAFE)}\n`], "log");
  c.control(T, "prose", "console-guidance", ["Google OAuth client secrets start with GOCSPX-; the console shows only the last four characters after creation.\n"], "md");
  return c.fixtures;
}
