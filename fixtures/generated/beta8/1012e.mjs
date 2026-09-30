import { beta8Corpus } from "./helpers.mjs";
import { VERCEL_CLASSES } from "../../../benchmarks/lib/beta8/1012e.ts";
import { ALNUM, LOWER_ALNUM, at, authorPositives, guard, other, probeContexts, vercelChecksum } from "./1012-shared.mjs";

// Issue #1012, slice e (category `beta8-1012e`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the three READY Vercel token classes (vcp_, vca_, vcr_ + exactly 56 [A-Za-z0-9]); record
// redact-secret docs/audits/evidence/1013/vercel.md at 4fb7882; product redact-secret#1036. Every value is built here
// from a public `synthetic` seed.
//
// Bodies are 50 synthetic alphanumerics plus the 6-character base62 CRC-32 suffix the record describes. The suffix is
// unresolved, never enforced: two positives per class carry a wrong suffix and are still positives, and no twin or
// control asserts silence on a suffix mismatch. Not authored either way: vci_ and vck_ values (STILL-BLOCKED, ruling
// Q-VC), the legacy unprefixed 24-character token and the vercel:access-token aggregate.

const EXTRA = {
  vcp: { env: "VERCEL_TOKEN", name: "Vercel",
    more: [
      { axis: "cli", slug: "cli-token-flag", ext: "sh", build: v => ["vercel deploy --prod --token ", v, "\n"] },
      { axis: "ci-config", slug: "actions-env", ext: "yml", build: v => ["jobs:\n  deploy:\n    runs-on: ubuntu-24.04\n    env:\n      VERCEL_TOKEN: ", v, "\n    steps:\n      - run: npx vercel deploy --prod\n"] },
      { axis: "env", slug: "suffix-mismatch-dotenv", ext: "env", build: v => ["# .env.local\nVERCEL_TOKEN=", v, "\nVERCEL_ORG_ID=team_acme\n"] },
      { axis: "log", slug: "suffix-mismatch-log", ext: "log", build: v => ["2026-09-29T13:10:44Z deploy: token ", v, " rejected (403)\n"] },
    ] },
  vca: { env: "VERCEL_ACCESS_TOKEN", name: "Vercel App",
    more: [
      { axis: "tool-output", slug: "token-response", ext: "json", build: v => ["{\n  \"access_token\": \"", v, "\",\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600\n}\n"] },
      { axis: "source-code", slug: "fetch-header", ext: "ts", build: v => ["const res = await fetch(\"https://api.vercel.com/v2/user\", { headers: { Authorization: \"Bearer ", v, "\" } });\n"] },
      { axis: "env", slug: "suffix-mismatch-dotenv", ext: "env", build: v => ["VERCEL_ACCESS_TOKEN=", v, "\n"] },
      { axis: "log", slug: "suffix-mismatch-log", ext: "log", build: v => ["2026-09-29T13:12:02Z oauth: access token ", v, " expired\n"] },
    ] },
  vcr: { env: "VERCEL_REFRESH_TOKEN", name: "Vercel App",
    more: [
      { axis: "tool-output", slug: "token-response", ext: "json", build: v => ["{\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600,\n  \"refresh_token\": \"", v, "\"\n}\n"] },
      { axis: "source-code", slug: "refresh-body", ext: "ts", build: v => ["const body = new URLSearchParams({ grant_type: \"refresh_token\", refresh_token: \"", v, "\" });\n"] },
      { axis: "env", slug: "suffix-mismatch-dotenv", ext: "env", build: v => ["VERCEL_REFRESH_TOKEN=", v, "\n"] },
      { axis: "log", slug: "suffix-mismatch-log", ext: "log", build: v => ["2026-09-29T13:14:37Z oauth: refresh token ", v, " revoked\n"] },
    ] },
};

export function build1012e({ fixture, synthetic }) {
  const c = beta8Corpus("1012e", { fixture, synthetic });
  for (const cls of VERCEL_CLASSES) {
    const T = cls.id, m = cls.marker, cfg = EXTRA[m];
    const g = guard("1012e", T);
    const seed = slug => `beta12:1012e:${T}:${slug}`;
    const token = slug => {
      const body50 = synthetic(seed(slug), 50, ALNUM), sum = vercelChecksum(body50);
      const tail = slug.startsWith("suffix-mismatch") ? `${sum.slice(0, 5)}${other(ALNUM, sum[5])}` : sum;
      return g.check(`${m}_${body50}${tail}`);
    };
    const probe = probeContexts({ env: cfg.env, name: cfg.name, host: "api.vercel.com", ctor: "Vercel" });
    const K = authorPositives(c, T, [...probe, ...cfg.more], token);
    const body = v => v.slice(4);

    c.twin(T, "dotenv", "body-55", K.put("dotenv", g.refuse(K.k.dotenv.slice(0, -1))), "length: a 55-byte body vs exactly 56", "length", "env");
    c.twin(T, "export", "body-57", K.put("export", g.refuse(`${K.k.export}${synthetic(seed("extra"), 1, ALNUM)}`)), "length: a 57-byte body vs exactly 56", "length", "sh");
    c.twin(T, "json-token", "hyphen-in-body", K.put("json-token", g.refuse(at(K.k["json-token"], 30, "-"))), "alphabet: one body byte replaced by -, outside [A-Za-z0-9]", "alphabet", "json");
    c.twin(T, "json-api-key", "underscore-in-body", K.put("json-api-key", g.refuse(at(K.k["json-api-key"], 22, "_"))), "alphabet: one body byte replaced by _, outside [A-Za-z0-9]", "alphabet", "json");
    c.twin(T, "bearer-header", "uppercase-prefix", K.put("bearer-header", g.refuse(`${m.toUpperCase()}_${body(K.k["bearer-header"])}`)), `prefix: ${m.toUpperCase()}_ vs the lower-case ${m}_`, "prefix", "http");
    c.twin(T, "sdk-kwarg", "marker-without-underscore", K.put("sdk-kwarg", g.refuse(`${m}${body(K.k["sdk-kwarg"])}`)), `prefix: ${m} with no underscore before the body`, "prefix", "py");
    c.twin(T, "bare-prose", "leading-glue", K.put("bare-prose", g.refuse(`x${K.k["bare-prose"]}`)), `boundary: x glued before ${m}_`, "boundary", "md");

    c.control(T, "public-id", "team-and-project-ids", [`VERCEL_ORG_ID=team_${synthetic(seed("team"), 24, ALNUM)}\nVERCEL_PROJECT_ID=prj_${synthetic(seed("project"), 28, ALNUM)}\n`], "env");
    c.control(T, "public-id", "deployment-url", [`https://acme-web-${synthetic(seed("deploy"), 9, LOWER_ALNUM)}-acme.vercel.app\n`]);
    c.control(T, "placeholder", "x-run", [`${cfg.env}=${m}_xxxxxxxxxxxxxxxxxxxxxxxx\n`], "env");
    c.control(T, "placeholder", "ellipsis", [`Paste the token (${m}_...) into ${cfg.env}.\n`], "md");
    c.control(T, "reference", "env-reference", [`${cfg.env}=\${${cfg.env}}\n`], "env");
    c.control(T, "reference", "actions-secret", [`      ${cfg.env}: \${{ secrets.${cfg.env} }}\n`], "yml");
    c.control(T, "near-miss", "truncated", [`2026-09-29T13:20:51Z auth: truncated token ${m}_${synthetic(seed("short"), 12, ALNUM)}\n`], "log");
    c.control(T, "near-miss", "marker-in-identifier", [`const ${m}_token_prefix = "${m}_";\n`], "ts");
    c.control(T, "prose", "token-guidance", [`Vercel ${m}_ tokens are shown once; store them in the project's environment variables, never in source.\n`], "md");
  }
  return c.fixtures;
}
