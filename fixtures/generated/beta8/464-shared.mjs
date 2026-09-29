import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Shared authoring helpers for the Beta.12 #464 slices (categories `beta8-464a`..`beta8-464f`), the
// #860 issuance-research READY credential families (Daytona, ClickHouse Cloud, NVIDIA, Browserbase, Cerebras,
// RunPod). See docs/specs/beta8-evidence.md, "Beta.12 issuance-research slices (#464)".
//
// Every positive, twin and control is authored from the step-3 handoffs in the product repository
// (redact-secret docs/audits/evidence/860/*.md at 8b6a5fde52ecb4dfce13f09c7a947062d21483c7), never
// from product detector code. Every credential-shaped value is built at generation time from a
// public `synthetic` seed; nothing is copied from a provider example, a scanner test vector or an
// issued key, and no complete key-shaped literal appears in any source file.

export const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const LOWER = "abcdefghijklmnopqrstuvwxyz";
export const DIGITS = "0123456789";
export const HEX = "0123456789abcdef";
export const URLSAFE = `${ALNUM}_-`;
export const WORD = `${ALNUM}_`;
export const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
export const UPPER_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Replace the character at `index` of `value` with `ch`. */
export const at = (value, index, ch) => value.slice(0, index) + ch + value.slice(index + 1);

/** `check` fails generation when an authored positive is outside its own contract; `refuse` when a twin value is still inside it. */
export function guard(slice, target) {
  const contract = contracts[target];
  const pattern = new RegExp(contract.pattern);
  const inside = value => pattern.test(value) && (!contract.validate || contract.validate(value));
  return {
    check: value => {
      if (!inside(value)) throw new Error(`beta8-${slice}: authored ${target} positive fails its own contract (${value.slice(0, 8)}...)`);
      return value;
    },
    refuse: value => {
      if (inside(value)) throw new Error(`beta8-${slice}: ${target} twin value still satisfies the contract (${value.slice(0, 8)}...)`);
      return value;
    },
  };
}

/**
 * The nine contexts of the #860 Tier B re-rank probe, which the issuance-research handoffs reuse ("Current coverage on main"): bare prose,
 * `ENV=value`, `export ENV="value"`, `Authorization: Bearer`, `X-API-Key`, JSON `"token"`, JSON
 * `"api_key"`, an SDK keyword argument and a chat sentence. Each returns parts for
 * `beta8Corpus().positive` / `.twin`, parametrised by the provider's own names.
 * `cfg`: { env, name, host, ctor }.
 */
export function probeContexts(cfg) {
  const ctx = (axis, slug, ext, build) => ({ axis, slug, ext, build });
  return [
    ctx("prose", "bare-prose", "md", v => [`Rotated the ${cfg.name} credential this morning; the old one was `, v, ` and it is revoked now.\n`]),
    ctx("env", "dotenv", "env", v => [`# .env\n${cfg.env}=`, v, "\nLOG_LEVEL=info\n"]),
    ctx("shell-export", "export", "sh", v => [`export ${cfg.env}="`, v, "\"\n"]),
    ctx("header", "bearer-header", "http", v => [`GET /v1/status HTTP/1.1\nHost: ${cfg.host}\nAuthorization: Bearer `, v, "\nAccept: application/json\n"]),
    ctx("header", "x-api-key-header", "http", v => [`POST /v1/jobs HTTP/1.1\nHost: ${cfg.host}\nX-API-Key: `, v, "\nContent-Type: application/json\n"]),
    ctx("structured-file", "json-token", "json", v => ["{\n  \"token\": \"", v, "\",\n  \"region\": \"us\"\n}\n"]),
    ctx("structured-file", "json-api-key", "json", v => ["{\n  \"api_key\": \"", v, "\",\n  \"timeout\": 30\n}\n"]),
    ctx("sdk-config", "sdk-kwarg", "py", v => [`client = ${cfg.ctor}(api_key="`, v, "\")\n"]),
    ctx("prose", "chat-paste", "txt", v => [`Here is my ${cfg.name} key `, v, ` can you debug why the request returns 401?\n`]),
  ];
}

/**
 * Author one positive per context, keyed by slug. `keyFor(slug)` builds (and contract-checks) the value.
 * Returns { k, put }: the authored values and a builder that re-renders a context around another value.
 */
export function authorPositives(c, target, contexts, keyFor) {
  const k = {};
  for (const x of contexts) {
    k[x.slug] = keyFor(x.slug);
    c.positive(target, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
  }
  const put = (slug, v) => contexts.find(x => x.slug === slug).build(v);
  return { k, put };
}
