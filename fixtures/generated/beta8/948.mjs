import { beta8Corpus } from "./helpers.mjs";

// redact-secret#948, corpus key 948 (category `beta8-948`). See
// docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md.
//
// Replacement near-miss controls, nothing else. The product decision
// `decision-redact-provider-named-credential-assignments` was amended for #948:
// random near-miss material under the provider's own credential variable
// (`SENTRY_AUTH_TOKEN=<near miss>`) is a generic-token credential. The 25 near-miss
// controls built on that input were relabelled to policy/T3 on generic-token
// (benchmarks/lib/assessment.ts `PROVIDER_NAMED_FALLBACK_948`), which leaves six
// families short of their #206 cells:
//
//   datadog-api-key          non-twin benign controls 7/8        -> +1 control
//   mailgun-api-key          total fixtures 38/40                -> +2 controls
//   postman-api-key          total fixtures 39/40                -> +1 control
//   sentry-org-auth-token    total 38/40, benign controls 12/14  -> +2 controls
//   sentry-user-auth-token   total 38/40, benign controls 12/14  -> +2 controls
//   travisci-api-token       total fixtures 47/48                -> +1 control
//
// Each replacement keeps the near-miss value shape its relabelled control had (a
// truncated, mis-delimited or half-built value of the family) but carries it in
// ordinary prose or a log line, never as the value of a credential-named assignment,
// header or flag. Expected silence follows from construction: the value is off the
// family's grammar, and the amended decision reaches only a value assigned to a
// credential name. Values are `synthetic()` seeds, never provider-issued or
// scanner-derived.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LOWER_HEX = "0123456789abcdef";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";

export function build948({ fixture, synthetic }) {
  const c = beta8Corpus(948, { fixture, synthetic });
  const s = (target, slug, length, chars) => synthetic(`beta8:948:${target}:${slug}`, length, chars);

  // datadog-api-key (T1): exactly 32 lowercase hex. A 20-hex fragment is a truncated key.
  c.control("datadog-api-key", "near-miss", "truncated-in-prose",
    [`The agent rejected a truncated Datadog value (${s("datadog-api-key", "truncated", 20, LOWER_HEX)}), 20 of the 32 hex characters, during setup.\n`], "md");

  // mailgun-api-key (T2): key- + 32 [a-z0-9]. A 16- or 20-byte body is short.
  c.control("mailgun-api-key", "near-miss", "short-body-in-prose",
    [`Mailgun rejected the pasted value key-${s("mailgun-api-key", "short-prose", 16, LOWER_ALNUM)} because the body is 16 characters, not 32.\n`], "md");
  c.control("mailgun-api-key", "near-miss", "short-body-in-log",
    [`2026-09-29T10:00:00Z WARN mailer: dropped a malformed value key-${s("mailgun-api-key", "short-log", 20, LOWER_ALNUM)} (20-character body) from the import\n`], "log");

  // postman-api-key (T2): PMAK- + 24 hex + "-" + 34 hex. A 33-hex tail is one short.
  c.control("postman-api-key", "near-miss", "short-tail-in-prose",
    [`The import skipped PMAK-${s("postman-api-key", "head", 24, LOWER_HEX)}-${s("postman-api-key", "tail", 33, LOWER_HEX)} because its second part has 33 hex characters, not 34.\n`], "md");

  // sentry-org-auth-token (T2): sntrys_ + base64 JSON facts + "_" + base64 secret.
  const facts = slug => Buffer.from(`{"iat":1727172000.${s("sentry-org-auth-token", `frac:${slug}`, 6, "0123456789")},"url":"https://sentry.io","region_url":"https://us.sentry.io","org":"${s("sentry-org-auth-token", `org:${slug}`, 10, "abcdefghijklmnopqrstuvwxyz")}"}`).toString("base64");
  c.control("sentry-org-auth-token", "near-miss", "missing-secret-in-log",
    [`2026-09-29T10:00:00Z WARN sentry-cli: ignored an incomplete value sntrys_${facts("log")} (no secret part)\n`], "log");
  c.control("sentry-org-auth-token", "near-miss", "missing-payload-in-prose",
    [`A value such as sntrys_${s("sentry-org-auth-token", "payload-less", 43, ALNUM)} lacks the JSON payload, so Sentry cannot read it as an organization token.\n`], "md");

  // sentry-user-auth-token (T2): sntryu_ + 64 lowercase hex.
  c.control("sentry-user-auth-token", "near-miss", "half-body-in-prose",
    [`The copied value sntryu_${s("sentry-user-auth-token", "half", 32, LOWER_HEX)} holds 32 of the 64 hex characters, so the upload step stopped.\n`], "md");
  c.control("sentry-user-auth-token", "near-miss", "org-prefix-hex-in-log",
    [`2026-09-29T10:00:00Z WARN sentry-cli: sntrys_${s("sentry-user-auth-token", "org-hex", 64, LOWER_HEX)} mixes the organization prefix with a personal hex body; ignored\n`], "log");

  // travisci-api-token (T2): 22 [A-Za-z0-9]. A 21-character value is one short.
  c.control("travisci-api-token", "near-miss", "short-in-prose",
    [`Travis CI refused ${s("travisci-api-token", "short", 21, ALNUM)} as it is 21 characters, one short of the 22 the service issues.\n`], "md");

  return c.fixtures;
}
