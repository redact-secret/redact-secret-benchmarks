import { beta8Corpus } from "./helpers.mjs";

// Issue #213, corpus key 213e (category `beta8-213e`). See docs/specs/beta8-evidence.md.
//
// Context-twin debt for datadog-application-key-legacy, nothing else. The #177
// amendment records that family in `context-constrained` mode, so it is measured
// against the `context-constrained-empirical` cells: 48 fixtures, 10 twin pairs and
// 10 context-twin pairs (`mutationKind: 'context'`). #213d left it at 40 fixtures,
// 8 twin pairs and 2 context twins. This corpus adds four positives, one per new
// context axis, and two context twins of each: 12 fixtures, 8 context-twin pairs.
//
// A context twin keeps its positive's value byte-for-byte and replaces only the
// same-line Datadog application-key marker, by an ordinary 40-hex companion (a
// commit, a revision, a SHA-1 checksum) or by nothing at all. The contract gates
// this bare 40-hex value on that same-line marker (benchmarks/lib/assessment.ts),
// so every twin is must-not-flag. A Datadog word left on another line (DD_SITE,
// `from datadog import`, the api.datadoghq.com host) stays in each twin on purpose:
// it is exactly the context the gate must not borrow. No twin swaps the marker for
// a generic credential keyword (TOKEN, APP_KEY): those are other families' positives,
// not silence this family owes.
//
// Values are `synthetic()` seeds, never provider-issued or scanner-derived. No
// observation record is written or implied. Expectations follow the contract, not
// scanner output.

const LOWER_HEX = "0123456789abcdef";
const TARGET = "datadog-application-key-legacy";

export function build213e({ fixture, synthetic }) {
  const c = beta8Corpus("213e", { fixture, synthetic });
  const key = slug => synthetic(`beta8:213e:${TARGET}:key:${slug}`, 40, LOWER_HEX);
  const positives = new Map();
  const pos = (axis, slug, before, value, after, extension) => {
    positives.set(slug, { before, value, after, extension });
    c.positive(TARGET, axis, slug, [before, { secret: value }, after], extension);
  };
  /** The value is kept byte-for-byte; only `before` (the marker's side of the line) changes. */
  const ctwin = (positiveSlug, slug, before, mutation) => {
    const p = positives.get(positiveSlug);
    if (!p) throw new Error(`#213e ${TARGET}: no positive ${positiveSlug}`);
    if (before === p.before) throw new Error(`#213e ${TARGET}: context twin ${slug} keeps its positive's context`);
    c.twin(TARGET, positiveSlug, slug, [before + p.value + p.after], mutation, "context", p.extension);
  };

  const env = "DD_SITE=datadoghq.com\n";
  pos("env", "dotenv", `${env}DD_APPLICATION_KEY=`, key("dotenv"), "\n", "env");
  ctwin("dotenv", "dotenv-source-commit-context", `${env}SOURCE_COMMIT=`,
    "context: the DD_APPLICATION_KEY name replaced by SOURCE_COMMIT, a deploy commit; DD_SITE stays on the line above; the value is unchanged");
  ctwin("dotenv", "dotenv-bare-line-context", env,
    "context: the DD_APPLICATION_KEY= assignment removed, leaving the value alone on its line under DD_SITE; the value is unchanged");

  const request = "GET /api/v1/monitor HTTP/1.1\nHost: api.datadoghq.com\nDD-API-KEY: ${DD_API_KEY}\n";
  pos("header", "http-request", `${request}DD-APPLICATION-KEY: `, key("header"), "\n", "http");
  ctwin("http-request", "http-content-sha1-context", `${request}X-Content-SHA1: `,
    "context: the DD-APPLICATION-KEY header name replaced by X-Content-SHA1, a body checksum header; the Datadog host stays two lines above; the value is unchanged");
  ctwin("http-request", "http-git-revision-context", `${request}X-Git-Revision: `,
    "context: the DD-APPLICATION-KEY header name replaced by X-Git-Revision, a build revision header; the value is unchanged");

  const module = "import os\n\nfrom datadog import initialize\n\n";
  pos("source-code", "python-constant", `${module}DATADOG_APP_KEY = "`, key("python"), "\"\n", "py");
  ctwin("python-constant", "python-expected-sha1-context", `${module}EXPECTED_SHA1 = "`,
    "context: the DATADOG_APP_KEY constant renamed EXPECTED_SHA1, a download checksum; the datadog import stays two lines above; the value is unchanged");
  ctwin("python-constant", "python-build-revision-context", `${module}BUILD_REVISION = "`,
    "context: the DATADOG_APP_KEY constant renamed BUILD_REVISION, a commit pin; the value is unchanged");

  const output = "$ terraform output -json\n{\n  \"datadog_api_url\": \"https://api.datadoghq.com/\",\n  ";
  pos("tool-output", "terraform-output-json", `${output}"datadog_application_key": "`, key("terraform"), "\"\n}\n");
  ctwin("terraform-output-json", "terraform-deployed-commit-context", `${output}"deployed_commit_sha": "`,
    "context: the datadog_application_key output renamed deployed_commit_sha; the datadog_api_url output stays on the line above; the value is unchanged");
  ctwin("terraform-output-json", "terraform-module-sha1-context", `${output}"module_source_sha1": "`,
    "context: the datadog_application_key output renamed module_source_sha1, a module checksum; the value is unchanged");

  return c.fixtures;
}
