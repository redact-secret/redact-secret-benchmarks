---
decision_id: decision-stop-asserting-provider-undecided-format-properties
status: accepted
scope: benchmarks
title: Stop asserting provider-undecided format properties
decided_at: 2026-09-24
---

# Stop asserting provider-undecided format properties

Status: accepted, on maintainer direction of 2026-09-24. Amends
[Qualify T2 families as empirically stable through independent corroboration](2026-09-24-qualify-empirical-stable-by-corroboration.md)
([#177](https://github.com/redact-secret/redact-secret-benchmarks/issues/177)),
whose examples listed the Databricks rotation suffix as a contradiction that
"stays unresolved". Part of
[#213](https://github.com/redact-secret/redact-secret-benchmarks/issues/213).

## Context

This repository has a rule, restated during the #209 and #213 work: do not turn
a disputed property into an expectation. Several fixtures older than that rule
break it. Each one takes a side on a format property that the sources dispute
and that no provider-owned source decides. For example, a twin asserts silence
on an uppercase Mailgun body, which gitleaks and Nosey Parker would flag.

The corroboration decision lets a contradiction be `bounded` only when the
contract excludes the disputed shape and no fixture asserts it. Because these
fixtures assert it, the contradiction has to stay `unresolved`, and an
unresolved contradiction blocks the family. So four families were held back by
assertions the benchmark never had evidence for.

The two research passes over the T2 records (commits `419ad16` and `d8ba0d3`,
2026-09-24) looked for a provider-owned source for each of these disputes and
recorded that none exists. That is what "searched and not found" means below.

## Decision

A contradiction is re-scoped under this decision when both of these hold:

1. no provider-owned code, documentation or example decides it; and
2. a research pass has recorded it as searched-and-not-found.

For such a contradiction, the benchmark stops asserting the property.

- **The contract states that the property is outside its claim.** The
  family's `uncertainty` says so (and `supportedContexts` or the contract
  `pattern` drops it where it was claimed), and the contradiction becomes
  `bounded`, with a `bound` that names the re-scoped fixtures.
- **Each fixture whose expectation depends only on that property is
  re-scoped, not deleted.** It stays in its corpus as history, but its
  assessment is tier T0 (pending, unscored), with the reason `Not asserted:
  disputed property — <property>`. It fills no fixture cell: the #206 cells
  (`benchmarks/support/profiles.ts`) and the support-status floors
  (`benchmarks/support/evidence.ts`) both skip it. This follows the repo's
  existing representation of a non-asserted fixture: T0 pending, as for the
  `sk_org_`, `whsec_`, `xwfp-` and `lin_oauth_` fixtures. The single list of
  re-scoped fixtures is `DISPUTED_PROPERTIES` in
  `benchmarks/lib/assessment.ts`.
- **A positive whose secret span depends on the disputed property is
  re-scoped the same way.**
- **Where re-scoping drops a family below its floors** (twin pairs,
  positives, axes, total fixtures), replacement fixtures on undisputed
  properties are authored in a new corpus key, `213f`
  (`fixtures/generated/beta8/213f.mjs`). No existing corpus gains a fixture.
- **Differential review-queue rows on a re-scoped fixture** fall under the
  existing `differential.t0-pending-fixture` class
  ([2026-09-22 decision](2026-09-22-settle-differential-disagreements-on-pending-fixtures.md)):
  `not-assertable`, since the corpus declines to say who is right.

This is not relabelling to pass. Every re-scoped fixture's property is now
**unmeasured** for its family, and that is visible in three places: the T0
reason on the fixture, the family's `uncertainty` in
`benchmarks/support/empirical-observations.json` (carried into the support
matrix), and the `bound` on the contradiction. Nothing here says the product
is right or wrong about the property.

## Applied to

| Family | Disputed property | Sources searched (record, `419ad16` / `d8ba0d3`) | Fixtures re-scoped to T0 | Replacements in `beta8-213f` |
| --- | --- | --- | --- | --- |
| `mailgun-api-key` | Whether a `key-` body may carry an uppercase letter. gitleaks and Nosey Parker are case-insensitive; trufflehog and the contract are lowercase-only. 1 of 31 measured candidates had an uppercase letter. | Mailgun's `http_signing_key` API reference (placeholder only), the mailgun-php v4.5.2 webhook test (lowercase key), the Help Center validation article, the validator demo, and redact-secret#582's discovery pass. `d8ba0d3` also checked the php, js, go, ruby, java and python SDKs: none has a key regex. | `detector-coverage` `mailgun-api-key-private-api-key-alphabet-{bare,quoted,unicode-crlf}-twin` (3 twins) | 1 positive (`compose-env`, container-config axis); a 33-byte-body length twin and a `key_` delimiter twin |
| `openai-token` | The `sk-svcacct-` service-account widths. gitleaks#1780's revoked samples are 74/74, gitleaks#1467 says the width varies with the account name, gitleaks#2240 claims about 51, leaktk samples are 45/46 and 49/50, and Trivy#10794 reports an offset of 80. | openai/codex's credential broker (prefixes, the `T3BlbkFJ` watermark, a 51-character minimum, variable body), the OpenAI staff forum post (prefix only) and redact-secret#657's passes. `419ad16`: "no provider source fixes svcacct length". `d8ba0d3`: OpenAI code treats bodies as variable length. | `common-formats` `openai-token-svcacct-{plain,unicode-crlf}-twin` (2 twins, 73/74) | 1 positive (legacy `compose-env`, container-config axis); a 19/20 length twin (50 characters, below codex's own 51-character minimum) and a `.` alphabet twin |
| `databricks-personal-access-token` | The `-<digits>` rotation suffix: whether it exists (plenoai, CredSweeper and secrets-patterns-db have none), how many digits it has (gitleaks and trufflehog allow one, Nosey Parker `-[0-9]+`), and whether it belongs in the secret span. | Databricks' PAT page and legacy tokens CLI docs (a 32-character digits-only example, no suffix), the Databricks Labs pylint plugin v0.5.0 (`dapi[0-9a-f]{32}`, no suffix), Microsoft Purview, and redact-secret#582's pass (19 of 62 candidates carried a one-digit suffix, and no source explains it). `d8ba0d3`: no provider-owned source. | `detector-coverage` `databricks-personal-access-token-rotated-shape-{bare,quoted,unicode-crlf}` (3 positives whose span includes `-2`) and their `-twin`s (3 two-digit-suffix twins); `beta8-213d` `databricks-personal-access-token-actions-env` (positive whose span includes `-2`) | 4 unsuffixed positives (ci-config, basic-auth, log, container-config axes); 33-hex length, `z` alphabet and `dapx` prefix twins |
| `mailchimp-api-key` | Whether a data-center literal other than `us<N>` is ever issued. keyhacks admits any `[0-9a-z]{2,5}` suffix; the contract's twin asserted silence on `-eu6`. | Mailchimp's fundamentals page (shows only `us6`, "key-dc"), the mailchimp/wordpress 2.1.0 example (`-us19`), and redact-secret#582's pass (all 115 candidates are `-us`). `d8ba0d3`: no provider-owned source for `-eu6`. | `detector-coverage` `mailchimp-api-key-single-digit-datacenter-{bare,quoted,unicode-crlf}-twin` (3 twins) | 1 positive (`v1-apikey-query`, url axis); 33-byte and 30-byte length twins and a missing-`-` boundary twin |

The Databricks contract `pattern` narrows from `^dapi[0-9a-f]{32}(?:-[0-9])?$`
to `^dapi[0-9a-f]{32}$`. The suffix was claimed only on tool agreement, and
the tools disagree on it. `supportedContexts` drops "optional -<one digit>
rotation suffix inside the span". The Mailchimp context now reads "suffix -us +
one or two digits (no other data-center literal is claimed)". The OpenAI,
Mailgun and Mailchimp patterns do not change: they already claim only the
positives' shape, and the re-scoped twins asserted silence outside it.

**Not applied to `okta-api-token`.** The maintainer excluded it. Its positives
themselves contain the disputed `_`, and an Okta staff statement says not to
assume any structure, so re-scoping the twins alone would not stop the family
asserting the property. Its four contradictions stay `unresolved`.

## What this gives up

- **The product's behaviour on these four properties is unmeasured.** That
  covers uppercase Mailgun bodies, non-74/74 service-account keys, suffixed
  Databricks tokens and non-us Mailchimp keys. A product regression on any of
  them would not show up in any gate. The T0 fixtures still run, so their
  observations stay inspectable, but they are never scored.
- **A later provider source re-opens the question.** If Mailgun, OpenAI,
  Databricks or Mailchimp publish a grammar that decides one of these
  properties, the contradiction becomes `settled` and the property goes back
  into the claim. The re-scoped fixtures, or new ones, are then scored again
  (their ids re-key, and the next sweep adjudicates them).
- **Stricter peers read as disagreements, not errors.** For example, gitleaks
  flagging an uppercase Mailgun body is no longer evidence either way.

## Consequences

Editing `detector-coverage` and `common-formats` re-keys every review-queue id
sourced from those corpora, in both the published-package and the candidate
keying. The re-keyed ids are carried mechanically (status and note), matched on
every field except `id` and `evidence.input.fixtureHash`, as in `f5f1c73` and
`7efe9ed`. Genuinely new rows are triaged with the existing templates.

`beta8-213f` has 17 fixtures. After re-scoping, the families' #206 cells read
(total / untwinned positives / controls / twin pairs / positive axes):

- `mailgun-api-key`: 40 / 12 / 16 / 8 / 11
- `openai-token`: 45 / 15 / 15 / 8 / 8
- `databricks-personal-access-token`: 40 / 12 / 15 / 9 / 14
- `mailchimp-api-key`: 41 / 13 / 14 / 8 / 14

Every cell meets `stable-empirical`. No 213f twin fails, and every 213f
positive is exact, on both the published package and the candidate.

`eval:classify` was run with trufflehog 3.97.4 and gitleaks 8.30.1, from
`38af4b4` (before) to this change (after):

| Mode | Before | After | Newly stable |
| --- | --- | --- | --- |
| Published (`@redact-secret/core` 0.1.0-beta.7) | 37 / 57 | 40 / 57 | `databricks-personal-access-token`, `mailgun-api-key`, `openai-token` |
| Candidate (integration/beta8-fixes `0cf09a4`) | 47 / 57 | 51 / 57 | the same three, plus `mailchimp-api-key` |

No family's status goes down. `mailchimp-api-key` stays provisional in
published mode on beta.7 product findings only: a benign false alarm, 7
metamorphic failures, 1 mutation and 2 differential rows, all generic-token on
`YOUR_API_KEY`. The candidate fixes them. `okta-api-token` stays provisional in
both modes on its four unresolved contradictions, as decided above.
