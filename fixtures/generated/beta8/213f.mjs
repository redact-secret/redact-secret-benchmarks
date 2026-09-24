import { beta8Corpus } from "./helpers.mjs";

// Issue #213, corpus key 213f (category `beta8-213f`). See docs/specs/beta8-evidence.md
// and docs/decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md.
//
// Replacement fixtures, nothing else. That decision stops the benchmark asserting four
// format properties no provider-owned source decides: an uppercase Mailgun key- body,
// OpenAI service-account widths other than 74/74, the Databricks -<digit> rotation
// suffix, and a Mailchimp data-center literal other than us<N>. The fixtures that took
// a side on them stay in their corpora as unscored T0 history and fill no cell
// (benchmarks/lib/assessment.ts `disputedProperty`), which leaves each family short of
// the `stable-empirical` cells (40 fixtures, 10 untwinned positives, 8 twin pairs):
//
//   mailgun-api-key                   37 fixtures, 6 twin pairs   -> +1 positive, 2 twins
//   openai-token                      42 fixtures, 6 twin pairs   -> +1 positive, 2 twins
//   databricks-personal-access-token  33 fixtures, 6 twin pairs,
//                                     9 untwinned positives       -> +4 positives, 3 twins
//   mailchimp-api-key                 36 fixtures, 4 twin pairs   -> +1 positive, 4 twins
//
// Every twin mutates one property every source agrees on (a body width all tools and
// the provider's own examples or code fix, a literal prefix or delimiter every source
// shows, a byte outside every source's alphabet). None touches a disputed property:
// no uppercase, no g-z Mailchimp body byte, no suffix beyond us<N>, no -<digit> rotation suffix, no service-account
// width. Each positive sits on a context axis its family had no positive on (or, for
// Databricks, on the ci-config axis its suffixed 213d positive vacated).
//
// Values are `synthetic()` seeds, never provider-issued or scanner-derived. No
// observation record is written or implied. Expectations follow the contracts, not
// scanner output.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LOWER_HEX = "0123456789abcdef";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";

/** One family's helpers: a value twin keeps its positive's context byte-for-byte and changes one property of the value. */
function family(c, synthetic, target) {
  const s = (slug, length, chars) => synthetic(`beta8:213f:${target}:${slug}`, length, chars);
  const positives = new Map();
  return {
    s,
    pos(axis, slug, before, value, after = "\n", extension) {
      positives.set(slug, { before, value, after, extension });
      c.positive(target, axis, slug, [before, { secret: value }, after], extension);
    },
    vtwin(positiveSlug, slug, value, mutation, kind) {
      const p = positives.get(positiveSlug);
      if (!p) throw new Error(`#213f ${target}: no positive ${positiveSlug}`);
      if (value === p.value || value.includes(p.value)) throw new Error(`#213f ${target}: twin ${slug} keeps its positive's value`);
      c.twin(target, positiveSlug, slug, [p.before + value + p.after], mutation, kind, p.extension);
    },
  };
}

/** `value` with `extra` inserted at `offset`: one byte longer, never containing the original run. */
const widen = (value, offset, extra) => `${value.slice(0, offset)}${extra}${value.slice(offset)}`;

// mailgun-api-key (T2): key- + 32 [a-z0-9] beside a same-line mailgun keyword.
function mailgun(c, synthetic) {
  const f = family(c, synthetic, "mailgun-api-key");
  const body = f.s("key:compose", 32, LOWER_ALNUM);
  f.pos("container-config", "compose-env", "services:\n  notifier:\n    environment:\n      - MAILGUN_DOMAIN=mg.example.invalid\n      - MAILGUN_API_KEY=", `key-${body}`, "\n", "yml");
  f.vtwin("compose-env", "compose-long", `key-${widen(body, 16, f.s("long-extra", 1, LOWER_ALNUM))}`,
    "length: 33-byte body (one extra [a-z0-9] byte at offset 16) vs the 32 every source carries (gitleaks, trufflehog, Nosey Parker, Mailgun's own PHP SDK test key)", "length");
  f.vtwin("compose-env", "compose-delimiter", `key_${body}`,
    "boundary: \"_\" instead of the \"-\" after key, the literal key- every source and Mailgun's own SDK test shows; body unchanged", "boundary");
}

// openai-token (T2): legacy sk- + 20 + T3BlbkFJ + 20 alphanumerics.
function openai(c, synthetic) {
  const f = family(c, synthetic, "openai-token");
  const left = f.s("legacy:compose:a", 20, ALNUM), right = f.s("legacy:compose:b", 20, ALNUM);
  f.pos("container-config", "compose-env", "services:\n  evals-runner:\n    environment:\n      - OPENAI_API_KEY=", `sk-${left}T3BlbkFJ${right}`, "\n", "yml");
  f.vtwin("compose-env", "compose-short", `sk-${left.slice(0, 19)}T3BlbkFJ${right}`,
    "length: 19-character left run, 50 characters in all, below the 51-character minimum OpenAI's own credential broker (openai/codex) requires; marker, right run and alphabet unchanged", "length");
  f.vtwin("compose-env", "compose-alphabet", `sk-${left.slice(0, 10)}.${left.slice(11)}T3BlbkFJ${right}`,
    "alphabet: one \".\" at offset 10 of the left run, outside every source's [A-Za-z0-9] legacy body; widths and marker unchanged", "alphabet");
}

// databricks-personal-access-token (T2): dapi + 32 lowercase hex. No rotation suffix is
// claimed, so no value here carries one.
function databricks(c, synthetic) {
  const f = family(c, synthetic, "databricks-personal-access-token");
  const pat = slug => `dapi${f.s(`pat:${slug}`, 32, LOWER_HEX)}`;
  const host = "https://adb-4417902378212305.5.azuredatabricks.net";
  f.pos("ci-config", "gitlab-ci-variables", `deploy:\n  stage: deploy\n  variables:\n    DATABRICKS_HOST: ${host}\n    DATABRICKS_TOKEN: `, pat("gitlab"), "\n  script:\n    - databricks bundle deploy\n", "yml");
  f.pos("basic-auth", "curl-token-user", `curl -s -u token:`, pat("basic"), ` ${host}/api/2.0/clusters/list\n`, "sh");
  f.pos("log", "debug-log", "2026-09-24T10:00:00Z DEBUG databricks-sdk config resolved auth_type=pat token=", pat("log"), "\n", "log");
  // Twin anchor.
  const body = f.s("pat:compose", 32, LOWER_HEX);
  f.pos("container-config", "compose-env", `services:\n  etl:\n    environment:\n      - DATABRICKS_HOST=${host}\n      - DATABRICKS_TOKEN=`, `dapi${body}`, "\n", "yml");
  f.vtwin("compose-env", "compose-long", `dapi${widen(body, 16, f.s("long-extra", 1, LOWER_HEX))}`,
    "length: 33 hex bytes (one extra at offset 16) vs the 32 every source fixes (gitleaks, trufflehog, Nosey Parker, Purview, Databricks' own docs example and Labs code)", "length");
  f.vtwin("compose-env", "compose-alphabet", `dapi${body.slice(0, 20)}z${body.slice(21)}`,
    "alphabet: one lowercase \"z\" at offset 20, outside the dapi[0-9a-f]{32} body Databricks' own Labs code documents (the Purview non-hex example is settled against it); width unchanged", "alphabet");
  f.vtwin("compose-env", "compose-prefix", `dapx${body}`,
    "prefix: dapx instead of the dapi prefix every source (tools, Purview, Databricks' own docs and Labs code) shows; body unchanged", "prefix");
}

// mailchimp-api-key (T2): 32 lowercase hex + "-us" + one or two digits, beside a
// same-line mailchimp keyword.
function mailchimp(c, synthetic) {
  const f = family(c, synthetic, "mailchimp-api-key");
  const body = f.s("key:url", 32, LOWER_HEX);
  const before = "curl -s 'https://us6.api.mailchimp.com/1.3/?method=ping&apikey=";
  f.pos("url", "v1-apikey-query", before, `${body}-us6`, "'\n", "sh");
  f.vtwin("v1-apikey-query", "long", `${widen(body, 16, f.s("long-extra", 1, LOWER_HEX))}-us6`,
    "length: 33-byte hex body (one extra at offset 16) vs the 32 of Mailchimp's own plugin example and every tool; suffix unchanged", "length");
  f.vtwin("v1-apikey-query", "short", `${body.slice(0, 30)}-us6`,
    "length: 30-byte hex body vs the 32 of Mailchimp's own plugin example and every tool (no source reports 30); suffix unchanged", "length");
  f.vtwin("v1-apikey-query", "sha1-width", `${body}${f.s("sha1-extra", 8, LOWER_HEX)}-us6`,
    "length: 40-byte hex body (a SHA-1 width: 8 extra hex bytes appended) vs the 32 of Mailchimp's own plugin example and every tool (no source reports 40); suffix unchanged", "length");
  f.vtwin("v1-apikey-query", "no-separator", `${body}us6`,
    "boundary: no \"-\" between the body and us6, where Mailchimp's fundamentals page says the data center is appended as key-dc; body and suffix unchanged", "boundary");
}

export function build213f({ fixture, synthetic }) {
  const c = beta8Corpus("213f", { fixture, synthetic });
  mailgun(c, synthetic);
  openai(c, synthetic);
  databricks(c, synthetic);
  mailchimp(c, synthetic);
  return c.fixtures;
}
