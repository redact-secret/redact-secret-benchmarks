import { beta8Corpus } from "./helpers.mjs";
import { VERCEL_CLASSES } from "../../../benchmarks/lib/credential-regressions/1012e.ts";
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
      // Profile completion (Beta.12 graduation, 2026-09-30): more contexts where the record places a vcp_ token -- the CLI
      // --token flag and VERCEL_TOKEN (P3), the CLI auth file, a Turborepo remote-cache token (C5) and the Azure DevOps
      // task input its masker covers (C7).
      { axis: "cli", slug: "cli-env-pull", ext: "sh", build: v => ["vercel env pull .env.local --yes --token=", v, "\n"] },
      { axis: "structured-file", slug: "cli-auth-file", ext: "json", build: v => ["{\n  \"// Note\": \"This is your Vercel credentials file. DO NOT SHARE!\",\n  \"token\": \"", v, "\"\n}\n"] },
      { axis: "env", slug: "turbo-token", ext: "env", build: v => ["TURBO_TEAM=acme\nTURBO_TOKEN=", v, "\n"] },
      { axis: "ci-config", slug: "azure-task-input", ext: "yml", build: v => ["- task: vercel-deployment-task@1\n  inputs:\n    vercelProjectId: prj_placeholder\n    vercelToken: ", v, "\n"] },
      { axis: "shell-export", slug: "docker-env", ext: "sh", build: v => ["docker run --rm -e VERCEL_TOKEN=", v, " acme/deployer:latest\n"] },
    ] },
  vca: { env: "VERCEL_ACCESS_TOKEN", name: "Vercel App",
    more: [
      { axis: "tool-output", slug: "token-response", ext: "json", build: v => ["{\n  \"access_token\": \"", v, "\",\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600\n}\n"] },
      { axis: "source-code", slug: "fetch-header", ext: "ts", build: v => ["const res = await fetch(\"https://api.vercel.com/v2/user\", { headers: { Authorization: \"Bearer ", v, "\" } });\n"] },
      { axis: "env", slug: "suffix-mismatch-dotenv", ext: "env", build: v => ["VERCEL_ACCESS_TOKEN=", v, "\n"] },
      { axis: "log", slug: "suffix-mismatch-log", ext: "log", build: v => ["2026-09-29T13:12:02Z oauth: access token ", v, " expired\n"] },
      // Profile completion (Beta.12 graduation, 2026-09-30): Sign in with Vercel access-token contexts from the record --
      // the authorization-server API (P7), Turborepo's vca_ discriminator (C5) and the Azure DevOps masker (C7).
      { axis: "cli", slug: "introspect-curl", ext: "sh", build: v => ["curl -s https://api.vercel.com/login/oauth/token/introspect -d token=", v, "\n"] },
      { axis: "env", slug: "turbo-token", ext: "env", build: v => ["TURBO_TEAM=acme\nTURBO_TOKEN=", v, "\n"] },
      { axis: "source-code", slug: "python-requests", ext: "py", build: v => ["resp = requests.get(\"https://api.vercel.com/v2/user\", headers={\"Authorization\": \"Bearer ", v, "\"})\n"] },
      { axis: "ci-config", slug: "azure-task-input", ext: "yml", build: v => ["- task: vercel-deployment-task@1\n  inputs:\n    vercelToken: ", v, "\n"] },
      { axis: "structured-file", slug: "session-store", ext: "json", build: v => ["{\n  \"provider\": \"vercel\",\n  \"accessToken\": \"", v, "\"\n}\n"] },
    ] },
  vcr: { env: "VERCEL_REFRESH_TOKEN", name: "Vercel App",
    more: [
      { axis: "tool-output", slug: "token-response", ext: "json", build: v => ["{\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 3600,\n  \"refresh_token\": \"", v, "\"\n}\n"] },
      { axis: "source-code", slug: "refresh-body", ext: "ts", build: v => ["const body = new URLSearchParams({ grant_type: \"refresh_token\", refresh_token: \"", v, "\" });\n"] },
      { axis: "env", slug: "suffix-mismatch-dotenv", ext: "env", build: v => ["VERCEL_REFRESH_TOKEN=", v, "\n"] },
      { axis: "log", slug: "suffix-mismatch-log", ext: "log", build: v => ["2026-09-29T13:14:37Z oauth: refresh token ", v, " revoked\n"] },
      // Profile completion (Beta.12 graduation, 2026-09-30): Sign in with Vercel refresh-token contexts from the record --
      // the token endpoint's refresh grant (P2, P7) and the stores a client keeps the refresh token in.
      { axis: "cli", slug: "refresh-curl", ext: "sh", build: v => ["curl -s https://api.vercel.com/login/oauth/token -d grant_type=refresh_token -d refresh_token=", v, "\n"] },
      { axis: "structured-file", slug: "session-store", ext: "json", build: v => ["{\n  \"provider\": \"vercel\",\n  \"refreshToken\": \"", v, "\"\n}\n"] },
      { axis: "source-code", slug: "python-dict", ext: "py", build: v => ["payload = {\"grant_type\": \"refresh_token\", \"refresh_token\": \"", v, "\"}\n"] },
      { axis: "shell-export", slug: "docker-env", ext: "sh", build: v => ["docker run --rm -e VERCEL_REFRESH_TOKEN=", v, " acme/worker:latest\n"] },
      { axis: "log", slug: "debug-log", ext: "log", build: v => ["2026-09-30T08:01:17Z oauth: stored refresh token ", v, " for user acme\n"] },
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
    // Profile completion (Beta.12 graduation, 2026-09-30): one more one-property twin on an already-twinned positive and
    // five more controls, all from the record's classes (public ids, placeholders, references, prose).
    c.twin(T, "dotenv", "hyphen-separator", K.put("dotenv", g.refuse(`${m}-${body(K.k.dotenv)}`)), `prefix: ${m}- with a hyphen vs ${m}_ with an underscore`, "prefix", "env");
    c.control(T, "public-id", "deployment-id", [`{ "deploymentId": "dpl_${synthetic(seed("dpl"), 24, ALNUM)}", "state": "READY" }\n`], "json");
    c.control(T, "placeholder", "angle", [`${cfg.env}=<${m}_your_token>\n`], "env");
    c.control(T, "placeholder", "masked", [`${cfg.env}=${m}_${"*".repeat(24)}\n`], "env");
    c.control(T, "reference", "process-env", [`const token = process.env.${cfg.env};\n`], "ts");
    c.control(T, "prose", "prefix-table", [`| Prefix | Token |\n| --- | --- |\n| ${m}_ | ${cfg.name} token |\n`], "md");
    c.control(T, "prose", "token-guidance", [`Vercel ${m}_ tokens are shown once; store them in the project's environment variables, never in source.\n`], "md");
  }
  return c.fixtures;
}
