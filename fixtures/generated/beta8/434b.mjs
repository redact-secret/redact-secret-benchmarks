import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, at, uuid, guard, indexContexts } from "./434-shared.mjs";

// Issue #434, slice b (category `beta8-434b`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Trigger.dev environment secret key (tr_<env>_sk_ + 24, tr_<env>_ + 24 or
// + 20) and personal access token (tr_pat_ + 40 of [1-9a-km-z]) (handoff redact-secret
// docs/audits/evidence/860/trigger-dev.md at 270faf8; product redact-secret#904). Every value is
// built here from a public `synthetic` seed in the documented shape.
//
// Deliberately not authored: a tr_oat_ organization token either way (no generator was found,
// so its shape is unknown), and any JWT (tr_uat_ and public access tokens stay with jwt, R7).
// The pk_<env>_ public key is authored as a benign control only outside credential-named
// assignments; in the secret-key position it is a prefix twin.

const ENVS = ["dev", "stg", "prod", "preview"];
const PAT_ALPHABET = "123456789abcdefghijkmnopqrstuvwxyz";

export function build434b({ fixture, synthetic }) {
  const c = beta8Corpus("434b", { fixture, synthetic });
  const seed = (target, slug) => `beta11:434b:${target}:${slug}`;
  const digest = slug => synthetic(`beta11:434b:digest:${slug}`, 64, HEX);

  // ---------------------------------------------------------------- trigger-dev-token
  {
    const T = "trigger-dev-token";
    const { check, refuse } = guard("434b", T);
    // All four env slugs x additional / root-24 / root-20: twelve shapes, one per positive context.
    const shapes = ENVS.flatMap(env => [
      { env, kind: "additional", make: slug => `tr_${env}_sk_${synthetic(seed(T, slug), 24, ALNUM)}` },
      { env, kind: "root-24", make: slug => `tr_${env}_${synthetic(seed(T, slug), 24, ALNUM)}` },
      { env, kind: "root-20", make: slug => `tr_${env}_${synthetic(seed(T, slug), 20, ALNUM)}` },
    ]);
    const contexts = indexContexts({ env: "TRIGGER_SECRET_KEY", name: "Trigger.dev", host: "api.trigger.dev", ctor: "TriggerClient" });
    const configure = v => ["import { configure } from \"@trigger.dev/sdk\";\n\nconfigure({ secretKey: \"", v, "\" });\n"];
    const actions = v => ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    env:\n      TRIGGER_SECRET_KEY: ", v, "\n    steps:\n      - run: npx trigger.dev@latest deploy\n"];
    const dotenvLocal = v => ["# .env.local\nTRIGGER_SECRET_KEY=", v, "\nTRIGGER_API_URL=https://api.trigger.dev\n"];
    const extra = [
      { axis: "source-code", slug: "configure-sdk", ext: "ts", build: configure },
      { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
      { axis: "env", slug: "dotenv-local", ext: "env", build: dotenvLocal },
    ];
    const all = [...contexts, ...extra];
    const k = {};
    all.forEach((x, i) => {
      const shape = shapes[i % shapes.length];
      k[x.slug] = check(shape.make(x.slug));
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    });
    const put = (slug, v) => all.find(x => x.slug === slug).build(v);
    // The context -> shape assignment above: 0 bare-prose dev additional, 1 dotenv dev root-24, 2 export dev root-20,
    // 3 bearer stg additional, 4 x-api-key stg root-24, 5 json-token stg root-20, 6 json-api-key prod additional,
    // 7 sdk-kwarg prod root-24, 8 chat-paste prod root-20, 9 configure preview additional, 10 actions preview root-24,
    // 11 dotenv-local preview root-20.
    const body = v => v.replace(/^tr_[a-z]+_(?:sk_)?/, "");

    c.twin(T, "bare-prose", "additional-body-23", put("bare-prose", refuse(k["bare-prose"].slice(0, -1))), "length: a 23-byte additional-key body vs exactly 24", "length", "md");
    c.twin(T, "bearer-header", "additional-body-25", put("bearer-header", refuse(`${k["bearer-header"]}${synthetic(seed(T, "extra-25"), 1, ALNUM)}`)), "length: a 25-byte additional-key body vs exactly 24", "length", "http");
    c.twin(T, "dotenv", "root-body-23", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 23-byte root body vs exactly 24 or 20", "length", "env");
    c.twin(T, "export", "root-body-19", put("export", refuse(k.export.slice(0, -1))), "length: a 19-byte root body vs exactly 20 or 24", "length", "sh");
    c.twin(T, "json-token", "root-body-21", put("json-token", refuse(`${k["json-token"]}${synthetic(seed(T, "extra-21"), 1, ALNUM)}`)), "length: a 21-byte root body vs exactly 20 or 24", "length", "json");
    c.twin(T, "sdk-kwarg", "root-body-22", put("sdk-kwarg", refuse(k["sdk-kwarg"].slice(0, -2))), "length: a 22-byte root body vs exactly 20 or 24", "length", "py");
    c.twin(T, "x-api-key-header", "root-body-25", put("x-api-key-header", refuse(`${k["x-api-key-header"]}${synthetic(seed(T, "extra-25r"), 1, ALNUM)}`)), "length: a 25-byte root body vs exactly 24 or 20", "length", "http");
    c.twin(T, "json-api-key", "sk-body-21", put("json-api-key", refuse(k["json-api-key"].slice(0, -3))), "length: tr_prod_sk_ + 21, which is neither an additional key (24) nor a root key (the root alphabet excludes _)", "length", "json");
    c.twin(T, "chat-paste", "unknown-env", put("chat-paste", refuse(k["chat-paste"].replace(/^tr_prod_/, "tr_test_"))), "prefix: tr_test_, an env slug outside dev|stg|prod|preview", "prefix", "txt");
    c.twin(T, "configure-sdk", "hyphen-in-body", configure(refuse(at(k["configure-sdk"], "tr_preview_sk_".length + 10, "-"))), "alphabet: one body byte replaced by -, outside [0-9A-Za-z]", "alphabet", "ts");
    c.twin(T, "actions-env", "underscore-in-body", actions(refuse(at(k["actions-env"], "tr_preview_".length + 9, "_"))), "alphabet: one body byte replaced by _, outside [0-9A-Za-z]", "alphabet", "yml");
    c.twin(T, "dotenv-local", "uppercase-prefix", dotenvLocal(refuse(`TR_PREVIEW_${body(k["dotenv-local"])}`)), "prefix: TR_PREVIEW_ vs the documented lower-case tr_preview_", "prefix", "env");
    c.twin(T, "bare-prose", "leading-glue-s", put("bare-prose", refuse(`s${k["bare-prose"]}`)), "boundary: s glued before tr_, so the key is embedded in a longer identifier", "boundary", "md");
    c.twin(T, "dotenv", "leading-glue-x", put("dotenv", refuse(`x${k.dotenv}`)), "boundary: x glued before tr_", "boundary", "env");
    c.twin(T, "export", "trailing-glue", put("export", refuse(`${k.export}_v2`)), "boundary: _v2 glued after the body", "boundary", "sh");
    // A shape that exists as another credential class is a twin, never a control: the public key in the secret-key position.
    c.twin(T, "configure-sdk", "public-key-prefix", configure(refuse(`pk_preview_${synthetic(seed(T, "pk-in-secret"), 20, ALNUM)}`)), "prefix: pk_preview_ + 20, the public key, in the secretKey position", "prefix", "ts");

    const pk = env => `pk_${env}_${synthetic(seed(T, `pk-${env}`), 20, ALNUM)}`;
    c.control(T, "public-id", "public-key-bare", [`The browser bundle uses the public key ${pk("dev")}; it is safe to ship.\n`], "md");
    c.control(T, "public-id", "public-key-html", [`<script>\n  window.__TRIGGER_PUBLIC__ = "${pk("prod")}";\n</script>\n`], "html");
    c.control(T, "public-id", "project-ref", [`trigger.config.ts: project: "proj_${synthetic(seed(T, "proj"), 20, "abcdefghijklmnopqrstuvwxyz")}"\n`], "ts");
    c.control(T, "placeholder", "x-run", ["Set TRIGGER_SECRET_KEY to your key (it looks like tr_dev_sk_xxxxxxxxxx) before running the worker.\n"], "md");
    c.control(T, "placeholder", "ellipsis", ["Your dev key starts with tr_dev_... and your prod key with tr_prod_...\n"], "md");
    c.control(T, "reference", "actions-secret", ["      TRIGGER_SECRET_KEY: ${{ secrets.TRIGGER_SECRET_KEY }}\n"], "yml");
    c.control(T, "reference", "env-reference", ["const client = configure({ secretKey: process.env.TRIGGER_SECRET_KEY });\n"], "ts");
    c.control(T, "near-miss", "identifier", ["if (tr_dev_mode && tr_prod_fallback) {\n  enableVerboseRuns();\n}\n"], "ts");
    c.control(T, "near-miss", "truncated", [`2026-09-28T10:02:11Z worker: rejected truncated value tr_prod_${synthetic(seed(T, "short"), 9, ALNUM)} from runner\n`], "log");
    c.control(T, "encoded-value", "digest", [`# audit record\nrotated_sha256=${digest(T)}\n`], "txt");
    c.control(T, "prose", "key-guidance", ["Each environment (dev, stg, prod, preview) has its own secret key; additional keys carry _sk_ after the env slug.\n"], "md");
  }

  // ------------------------------------------------ trigger-dev-personal-access-token
  {
    const T = "trigger-dev-personal-access-token";
    const { check, refuse } = guard("434b", T);
    const key = slug => check(`tr_pat_${synthetic(seed(T, slug), 40, PAT_ALPHABET)}`);
    const contexts = indexContexts({ env: "TRIGGER_ACCESS_TOKEN", name: "Trigger.dev", host: "api.trigger.dev", ctor: "TriggerClient" });
    const k = {};
    for (const x of contexts) {
      k[x.slug] = key(x.slug);
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    }
    const ci = v => ["jobs:\n  deploy:\n    env:\n      TRIGGER_ACCESS_TOKEN: ", v, "\n    steps:\n      - run: npx trigger.dev@latest deploy --env prod\n"];
    k.ci = key("ci");
    c.positive(T, "ci-config", "actions-env", ci({ secret: k.ci }), "yml");
    const put = (slug, v) => contexts.find(x => x.slug === slug).build(v);

    c.twin(T, "dotenv", "body-39", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 39-byte body vs exactly 40", "length", "env");
    c.twin(T, "export", "body-41", put("export", refuse(`${k.export}${synthetic(seed(T, "extra"), 1, PAT_ALPHABET)}`)), "length: a 41-byte body vs exactly 40", "length", "sh");
    c.twin(T, "bearer-header", "zero-in-body", put("bearer-header", refuse(at(k["bearer-header"], 20, "0"))), "alphabet: one body byte replaced by 0, which the generator alphabet excludes", "alphabet", "http");
    c.twin(T, "x-api-key-header", "l-in-body", put("x-api-key-header", refuse(at(k["x-api-key-header"], 22, "l"))), "alphabet: one body byte replaced by l, which the generator alphabet excludes", "alphabet", "http");
    c.twin(T, "json-token", "uppercase-in-body", put("json-token", refuse(at(k["json-token"], 18, "Q"))), "alphabet: one body byte upper-cased; the generator is lowercase only", "alphabet", "json");
    c.twin(T, "json-api-key", "uppercase-prefix", put("json-api-key", refuse(`TR_PAT_${k["json-api-key"].slice(7)}`)), "prefix: TR_PAT_ vs the documented lower-case tr_pat_", "prefix", "json");
    c.twin(T, "sdk-kwarg", "leading-glue", put("sdk-kwarg", refuse(`x${k["sdk-kwarg"]}`)), "boundary: x glued before tr_pat_", "boundary", "py");
    c.twin(T, "chat-paste", "trailing-glue", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the body", "boundary", "txt");

    c.control(T, "placeholder", "x-run", ["Create a personal access token in the dashboard (tr_pat_xxxxxxxx...) and store it in your CI secrets.\n"], "md");
    c.control(T, "placeholder", "ellipsis", ["trigger.dev login stores a tr_pat_... token in ~/.config; do not commit that file.\n"], "md");
    c.control(T, "reference", "actions-secret", ["      TRIGGER_ACCESS_TOKEN: ${{ secrets.TRIGGER_ACCESS_TOKEN }}\n"], "yml");
    c.control(T, "reference", "env-reference", ["npx trigger.dev@latest deploy --env prod # reads $TRIGGER_ACCESS_TOKEN\n"], "sh");
    c.control(T, "near-miss", "prefix-only", ["2026-09-28T10:04:40Z cli: token must start with tr_pat_, got an empty value\n"], "log");
    c.control(T, "near-miss", "truncated", [`2026-09-28T10:04:41Z cli: rejected truncated token tr_pat_${synthetic(seed(T, "short"), 12, PAT_ALPHABET)}\n`], "log");
    c.control(T, "public-id", "run-id", [`{"id": "run_${synthetic(seed(T, "run"), 25, "abcdefghijklmnopqrstuvwxyz0123456789")}", "status": "COMPLETED", "taskIdentifier": "send-digest"}\n`], "json");
    c.control(T, "public-id", "request-uuid", [`x-request-id: ${uuid(synthetic(seed(T, "req"), 32, HEX))}\n`], "txt");
    c.control(T, "encoded-value", "digest", [`# audit record\npat_sha256=${digest(T)}\n`], "txt");
    c.control(T, "prose", "pat-guidance", ["Personal access tokens act for your user across every project, so revoke them when a laptop is lost.\n"], "md");
  }
  return c.fixtures;
}
