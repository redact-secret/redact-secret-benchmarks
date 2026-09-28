import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, LOWER_ALNUM, HEX, at, uuid, guard, indexContexts } from "./434-shared.mjs";
import { DOPPLER_TYPES } from "../../../benchmarks/lib/beta8/434a.ts";

// Issue #434, slice a (category `beta8-434a`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the seven Doppler dp.<type>. token types (handoff redact-secret
// docs/audits/evidence/860/doppler.md at 270faf8; product redact-secret#903). Every value is built
// here from a public `synthetic` seed in the documented shape; nothing is copied from the provider
// page's examples, a scanner test vector or an issued token.
//
// Deliberately not authored (see the field claims in benchmarks/lib/beta8/434a.ts):
//   - an exact-width placeholder made only of alphabet bytes: the handoff accepts it as claimed,
//     so it is neither a positive nor a benign control;
//   - an undocumented future type, or a body of 40–44 that the docs would accept, as a twin.

export function build434a({ fixture, synthetic }) {
  const c = beta8Corpus("434a", { fixture, synthetic });
  const seed = (target, slug) => `beta11:434a:${target}:${slug}`;
  const digest = slug => synthetic(`beta11:434a:digest:${slug}`, 64, HEX);

  for (const t of DOPPLER_TYPES) {
    const T = t.id;
    const P = `dp.${t.code}.`;
    const { check, refuse } = guard("434a", T);
    const widths = [43, 40, 44];
    let n = 0;
    const key = (slug, width = widths[n++ % widths.length], segment = "") => check(`${P}${segment ? `${segment}.` : ""}${synthetic(seed(T, slug), width, ALNUM)}`);
    const contexts = indexContexts({ env: "DOPPLER_TOKEN", name: "Doppler", host: "api.doppler.com", ctor: "DopplerSDK" });
    const k = {};
    for (const x of contexts) {
      k[x.slug] = key(x.slug);
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    }
    const byContext = Object.fromEntries(contexts.map(x => [x.slug, x]));
    const put = (slug, v) => byContext[slug].build(v);

    // Handoff test axes: YAML, a code fence, DOPPLER_TOKEN= in a CI log line, a Kubernetes stringData value, trailing sentence punctuation.
    const yaml = v => ["secrets:\n  provider: doppler\n  token: ", v, "\n  project: billing\n"];
    const fence = v => ["Run it like this:\n\n```sh\ndoppler run --token ", v, " -- npm start\n```\n"];
    const ci = v => ["2026-09-28T09:14:03Z [build 812] env: DOPPLER_TOKEN=", v, " DOPPLER_PROJECT=billing\n"];
    const k8s = v => ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: doppler-token\ntype: Opaque\nstringData:\n  serviceToken: ", v, "\n"];
    const sentence = v => ["The token for staging is ", v, ".\n"];
    k.yaml = key("yaml"); k.fence = key("fence"); k.ci = key("ci-log"); k.k8s = key("k8s"); k.sentence = key("sentence-end");
    c.positive(T, "structured-file", "yaml", yaml({ secret: k.yaml }), "yml");
    c.positive(T, "cli", "code-fence", fence({ secret: k.fence }), "md");
    c.positive(T, "log", "ci-log", ci({ secret: k.ci }), "log");
    c.positive(T, "container-config", "k8s-string-data", k8s({ secret: k.k8s }), "yml");
    c.positive(T, "prose", "sentence-period", sentence({ secret: k.sentence }), "txt");

    if (t.code === "st") {
      // The optional environment segment: 2 and 35 bytes, and segments using - and _.
      const seg2 = synthetic(seed(T, "seg-2"), 2, LOWER_ALNUM);
      const seg35 = synthetic(seed(T, "seg-35"), 35, LOWER_ALNUM);
      k.seg2 = key("segment-2", 43, seg2);
      k.seg35 = key("segment-35", 44, seg35);
      k.segDash = key("segment-dash", 43, "prd-eu");
      k.segUnder = key("segment-underscore", 40, "dev_personal");
      c.positive(T, "env", "segment-2", put("dotenv", { secret: k.seg2 }), "env");
      c.positive(T, "shell-export", "segment-35", put("export", { secret: k.seg35 }), "sh");
      c.positive(T, "structured-file", "segment-dash", put("json-token", { secret: k.segDash }), "json");
      c.positive(T, "prose", "segment-underscore", put("chat-paste", { secret: k.segUnder }), "txt");
      // Segment twins: 1 byte, 36 bytes, an uppercase byte. Each fails the segment grammar and the no-segment reading.
      c.twin(T, "segment-2", "segment-1-byte", put("dotenv", refuse(`${P}${seg2.slice(0, 1)}.${k.seg2.slice(-43)}`)), "segment: 1 byte vs the documented [a-z0-9_-]{2,35}", "boundary", "env");
      c.twin(T, "segment-35", "segment-36-bytes", put("export", refuse(`${P}${seg35}${synthetic(seed(T, "seg-36"), 1, LOWER_ALNUM)}.${k.seg35.slice(-44)}`)), "segment: 36 bytes vs the documented maximum of 35", "length", "sh");
      c.twin(T, "segment-dash", "segment-uppercase", put("json-token", refuse(k.segDash.replace("prd-eu", "Prd-eu"))), "segment: one uppercase byte outside [a-z0-9_-]", "alphabet", "json");
    }

    // One-property twins (handoff near-miss list).
    c.twin(T, "dotenv", "body-39", put("dotenv", refuse(`${P}${synthetic(seed(T, "body-39"), 39, ALNUM)}`)), "length: a 39-byte body vs the documented 40–44", "length", "env");
    c.twin(T, "export", "body-45", put("export", refuse(`${P}${synthetic(seed(T, "body-45"), 45, ALNUM)}`)), "length: a 45-byte body vs the documented 40–44 (an embedded value, never truncated)", "length", "sh");
    c.twin(T, "json-token", "underscore-in-body", put("json-token", refuse(at(k["json-token"], P.length + 12, "_"))), "alphabet: one body byte replaced by _, outside [A-Za-z0-9]", "alphabet", "json");
    c.twin(T, "json-api-key", "hyphen-in-body", put("json-api-key", refuse(at(k["json-api-key"], P.length + 20, "-"))), "alphabet: one body byte replaced by -, outside [A-Za-z0-9]", "alphabet", "json");
    c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`DP.${t.code.toUpperCase()}.${k["bearer-header"].slice(P.length)}`)), `prefix: DP.${t.code.toUpperCase()}. vs the documented lower-case dp.${t.code}.`, "prefix", "http");
    c.twin(T, "x-api-key-header", "uppercase-type", put("x-api-key-header", refuse(`dp.${t.code.toUpperCase()}.${k["x-api-key-header"].slice(P.length)}`)), `prefix: the type spelled ${t.code.toUpperCase()}`, "prefix", "http");
    c.twin(T, "sdk-kwarg", "missing-first-dot", put("sdk-kwarg", refuse(`dp${t.code}.${k["sdk-kwarg"].slice(P.length)}`)), "boundary: the . after dp removed", "boundary", "py");
    c.twin(T, "yaml", "missing-type-dot", yaml(refuse(`dp.${t.code}${k.yaml.slice(P.length)}`)), "boundary: the . after the type removed, so the body follows the type directly", "boundary", "yml");
    c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: an identifier byte glued before dp", "boundary", "md");
    c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before dp", "boundary", "txt");
    c.twin(T, "ci-log", "trailing-glue", ci(refuse(`${k.ci}_x`)), "boundary: _x glued after the body, so the token is embedded in a longer identifier", "boundary", "log");
    c.twin(T, "code-fence", "unknown-type", fence(refuse(`dp.xx.${k.fence.slice(P.length)}`)), "prefix: dp.xx., a type the provider does not document", "prefix", "md");
    if (t.code === "sa") {
      // Sibling precedence (handoff): dp.sa. + a body beginning id. is never a service-account token.
      c.twin(T, "k8s-string-data", "sa-then-id-dot", k8s(refuse(`dp.sa.id.${k.k8s.slice(P.length)}`)), "boundary: dp.sa. followed by id. and a body; . is outside the body alphabet, so this is neither dp.sa. nor dp.said.", "boundary", "yml");
    }

    // Independent benign controls (handoff benign list), per type.
    const tail6 = synthetic(seed(T, "preview"), 6, ALNUM);
    const slugUuid = uuid(synthetic(seed(T, "slug"), 32, HEX));
    c.control(T, "public-id", "cli-preview", [`$ doppler configs tokens\nNAME      SLUG                                   TOKEN\nci-read   ${slugUuid}   dp.${t.code}…${tail6}\n`], "txt");
    c.control(T, "public-id", "token-slug", [`doppler configs tokens revoke ${slugUuid} --project billing --config prd\n`], "sh");
    c.control(T, "placeholder", "x-run", [`Tokens look like \`dp.${t.code}.xxxx\`; paste yours into the CI secret store, never into the repo.\n`], "md");
    c.control(T, "placeholder", "config-wildcard", [`Rotation policy: every dp.${t.code === "st" ? "st.prd" : t.code}.* token older than 90 days is revoked.\n`], "md");
    c.control(T, "reference", "actions-secret", ["      DOPPLER_TOKEN: ${{ secrets.DOPPLER_TOKEN }}\n"], "yml");
    c.control(T, "reference", "cli-env-reference", ["doppler run --token \"$DOPPLER_TOKEN\" -- ./deploy.sh\n"], "sh");
    c.control(T, "prose", "cli-commands", [`Run doppler login, then doppler setup; ${t.role}s start with dp.${t.code}. and are shown once.\n`], "md");
    c.control(T, "near-miss", "prefix-only", [`2026-09-28T09:15:40Z auth: rejected empty token dp.${t.code}. from runner 7\n`], "log");
    c.control(T, "near-miss", "truncated", [`2026-09-28T09:15:41Z auth: rejected truncated value dp.${t.code}.${synthetic(seed(T, "short"), 12, ALNUM)} from runner 7\n`], "log");
    c.control(T, "encoded-value", "digest", [`# audit record\nrevoked_sha256=${digest(T)}\n`], "txt");
  }
  return c.fixtures;
}
