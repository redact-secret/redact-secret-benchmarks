# Beta.9 #140: externally sourced adversarial pack, first run

Issue [#140](https://github.com/redact-secret/redact-secret-benchmarks/issues/140)
asks for the first adversarial suite written outside the detector workflow.
This page records the pack assembled for it and the frozen first run of the
four evaluated scanners. It is a measurement, not a product claim (`AGENTS.md`
boundary rule). It changes no support status, and no product fix came before
it.

## Evidence class: maintainer regression

The pack is [`adversarial/packs/beta9-external-inputs`](../../adversarial/packs/beta9-external-inputs/README.md).
Its inputs come from outside the project: IETF RFC examples, the AWS CLI
documentation, and the detect-secrets, Nosey Parker, Big List of Naughty
Strings and Trojan Source test material, each pinned and licensed in
`sources.json`. The project chose the excerpts, composed 25 of the 80
fixtures, and set every action and range, after reading the product's
contextual-detection spec. The intake record therefore names the project as
author. Under the intake contract
([decision](../decisions/2026-09-22-define-external-adversarial-intake.md))
that makes it **maintainer regression**: it is not externally authored, it is
not independent, and it is not part of support qualification. The proposed
decision that records this default is
[`2026-09-25-classify-project-assembled-external-inputs-as-maintainer-regression`](../decisions/2026-09-25-classify-project-assembled-external-inputs-as-maintainer-regression.md).

The pack's status is `frozen-first-run`. Accepting it is a maintainer
decision.

## Scope

80 fixtures: 38 `must-redact` and 42 `must-not-flag`. Each fixture's #140
category is recorded in `sources.json`:

| #140 category | Fixtures |
| --- | ---: |
| shell, environment, template and SQL references | 19 |
| nested quoting and serialization | 11 |
| token-like benign identifiers | 10 |
| invisible and formatting characters | 9 |
| placeholders, documentation and example values | 8 |
| URLs and query strings | 7 |
| overlapping credentials | 7 |
| prefix truncation and extension | 5 |
| multiline splits | 2 (16 more carry `multiline-structure`) |
| bounded oversized input | 1 (a ~32 KB single line) |
| bounded high finding count | 1 (200 credentials in one file) |

**Not covered: streaming chunk splits.** Intake v1 scores whole fixtures, so
chunk boundaries cannot be expressed.

These numbers describe these 80 fixtures and nothing else. The credential
values are generic OAuth, Basic, JWT, JWK and `secret-token` examples. There
are no provider-prefixed tokens. That is why TruffleHog, whose detectors are
provider-specific, reports almost nothing. Its silence here is outside its
scope, not a measured weakness. Do not read these counts as overall
accuracy, and do not compare them with support-matrix figures.

## First run

Recorded `2026-09-25T13:32:16Z` at benchmark commit
[`d8d32c3`](https://github.com/redact-secret/redact-secret-benchmarks/commit/d8d32c380f7f54255af4e12599a66b9ad7b8c331),
the commit holding the submitted expectations (digest `25472f6c…`).
`scripts/freeze-adversarial-first-run.mjs` scanned each fixture alone, at its
submitted path.

| Scanner | Version | Artifact (sha256) | Configuration |
| --- | --- | --- | --- |
| redact-secret | 0.1.0-beta.8, published from `5639a0e` | npm tarball `b3c2c2cd…` (lock integrity verified) | default detectors |
| Gitleaks | 8.30.1 (suite pin) | binary `ba52fb1b…` | default rules |
| TruffleHog | 3.97.4 (suite pin, provisioned read-only, first on `PATH`) | binary `8c7af13e…` | verification and update disabled |
| flare-redact | 1.6.1 | npm tarball `e68ca1bd…` | secrets only; `pii` and `generic_assignment` disabled |

The installed TruffleHog on this host is 3.97.6. The run used a pinned
3.97.4 from `npm run peers:provision`, and the runner rejects a peer that
differs from `qualification/suite-v1.json`. No `eval:classify`,
`eval:matrix` or `benchmark:candidate` stable count was produced or
reported.

Outcomes are computed by `compareResult` (`benchmarks/lib/adversarial-first-run.ts`)
from byte coverage:

| Scanner | redacted | overbroad | partial | missed | clean | flagged | failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| redact-secret | 13 | 0 | 4 | 21 | 35 | 7 | 0 |
| Gitleaks | 9 | 0 | 3 | 26 | 42 | 0 | 0 |
| TruffleHog | 0 | 1 | 0 | 37 | 42 | 0 | 0 |
| flare-redact | 0 | 7 | 3 | 28 | 41 | 1 | 0 |

`redacted`, `overbroad`, `partial` and `missed` count the 38 `must-redact`
fixtures. `clean` and `flagged` count the 42 `must-not-flag` fixtures. The
first run records only the ranges a scanner reports. It does not record
redact-secret's policy action, so "redacted" includes findings whose action
is `warn`. See the rerun note below.

## redact-secret results for review

None of these is yet a known gap. `benchmarks/known-gaps.json` records begin
at `observed` and require a product issue. No issue has been filed, so each
row below waits for maintainer review under the
[promotion lifecycle](../decisions/2026-09-18-govern-benchmark-promotion.md).
Each may turn out to be a product defect, a policy disagreement, or a wrong
expectation. Because the pack is maintainer regression, an expectation fix
is a material edit and is allowed.

Misses (`must-redact`, nothing covered):

- `access_token`, `code` and `code_verifier` in URL query strings and
  fragments, in RFC 6750 and 6749 examples (`rfc6750-query-access-token`,
  `rfc6749-implicit-fragment-display-break`,
  `rfc6749-authorization-code-location`, `rfc7636-code-verifier`). The same
  token is redacted in JSON (`rfc6750-token-response-json`).
- Form-encoded `refresh_token` and `client_secret` (`rfc6749-refresh-request-body`).
- A percent-encoded userinfo password (`composed-userinfo-password-url`).
- A JWT and a JWK `k` split by RFC display line breaks, and the JWK `k` on a
  single line (`rfc7519-jwt-display-breaks`, `rfc7515-jwk-k-display-break`,
  `composed-jwk-k-single-line`).
- A token inside an escaped JSON string (`composed-json-string-in-json-log`)
  and a percent-encoded query inside JSON (`composed-percent-encoded-url-in-json`).
- detect-secrets' `COMMON_SECRET`. It contains `${`, `{{` and `}}`, and it is
  missed under every assignment shape (`ds-keyword-template-chars-in-secret`,
  `-go-short-assign`, `-reversed-comparison`, `ds-cpp-string-constructor`,
  `ds-objc-at-string`). The template-reference exclusion is the likely
  cause.
- A non-ASCII punctuation password (`ds-keyword-non-ascii-secret`), a
  UTF-8 Basic credential in `Proxy-Authorization` (`rfc7617-basic-utf8-proxy`),
  a zero-width space inside a bearer token (`composed-zero-width-inside-bearer`),
  and an upper-case `SECRET-TOKEN:` scheme (`composed-secret-token-uppercase-scheme`).

Partial coverage:

- The RFC 8959 `secret-token:` URI is redacted without its scheme, in two
  fixtures.
- The authorization `code` next to redacted Basic client credentials is
  missed (`rfc6749-token-request-basic-and-code`).
- The Basic credential in a single-quoted curl header is missed, while the
  JSON `refresh_token` on the same line is redacted
  (`composed-curl-single-quoted-json`).

Flagged benign input (`must-not-flag`). The action comes from the rerun
below:

- `redact`: an HTML-escaped placeholder `&lt;YOURPASSWROD&gt;`, a
  quote-juggled `$PRECOMPILE_PASSWORD` reference, `env.PERKEEP_TEST_PASSWORD`,
  a `getMasterUserPassword()` concatenation, and a public AWS managed-policy
  ARN under a `Password`-named key.
- `warn`: `password = "somefakekey"` and `this.addPassword = "#add-password"`.

## Rerun: redact-secret policy actions

This rerun is separate from the frozen record. It did not change
`first-run.json`. The same beta.8 package was called through `scan()` on
each fixture to read `action`. Five of the 13 "redacted" results are
`warn`, not `redact`: the YAML block-scalar token, both Nosey Parker password
literals, `X_ACCESS_TOKEN=`, and one of the two tokens in
`rfc6750-token-response-json`. So by action, redact-secret redacts 8 of the
38 `must-redact` fixtures in full and warns on 5 more. The first-run schema
has no field for action. That is an open question for the intake contract.

## Reproduce

```sh
npm run peers:provision -- --dir <read-only dir> && export PATH="<dir>:$PATH"
node --import tsx scripts/freeze-adversarial-first-run.mjs --pack=<id>   # a pack at safety-review only
npm run adversarial:check
node --import tsx --test tests/adversarial-first-run.test.mjs
```

## Later adjudication (2026-09-26)

Added after the run; nothing above is rewritten. The counts in this report
are misses of the submitted ranges. [#322](https://github.com/redact-secret/redact-secret-benchmarks/issues/322)
adjudicated three of the 21 misses as outside the product's raw-input
contract: `rfc7519-jwt-display-breaks` and `rfc7515-jwk-k-display-break` are
RFC figures with display-only line breaks, and
`composed-percent-encoded-url-in-json` has no `access_token` parameter under
standard URL parsing (a decode-before-parse consumer is a separate scenario,
#325). They are recorded as historical submitted-range misses, not confirmed
product false negatives. See the pack's `adjudication.json` and the
`product-822` record.
