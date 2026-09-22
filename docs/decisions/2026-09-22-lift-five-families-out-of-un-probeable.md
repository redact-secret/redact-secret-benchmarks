---
decision_id: decision-lift-five-families-out-of-un-probeable
status: accepted
scope: benchmarks
title: Lift five families out of un-probeable and widen context coverage for the floor families
decided_at: 2026-09-22
---

# Lift five families out of un-probeable and widen context coverage for the floor families

## Context

Thirteen detector families sat at 8 fixtures on `/coverage`: one shape in the
three detector-coverage contexts, plus five benign controls. No other suite
contained them. [#36](2026-09-20-extend-twins-to-assignment-context.md)
recorded every one of them `un-probeable` on 2026-09-20, because the provider
page it read stated no prefix, length or alphabet. That decision names its own
exit: "Un-probeable is a dated observation, not a permanent verdict. When a
provider publishes a grammar, the record is replaced by a twin and its source."

The redact-secret#575 research issues (#644–#662, second passes dated
2026-09-22) re-checked those families against every provider source class. This
decision applies that research to the corpus. It is the benchmarks side of
[#112](https://github.com/redact-secret/redact-secret-benchmarks/issues/112),
batch 2: twin and benign-axis corpus gaps.

## Decision

1. **The bar for a twin source is a statement on the provider's own domain.**
   This is the same bar the #575 issues research against. It covers docs, the
   provider's OpenAPI spec that renders its docs, and the provider's blog.
   Provider-authored material hosted on github.com (RFCs, changelogs, CLI
   validation code) is not accepted here. Issues #658, #659 and #662 leave that
   question to a maintainer, and a twin must not settle it early.

2. **Five families move from `un-probeable` to twinned.** Each gets a
   `twinSource` and exactly one mutation. All positive tiers stay unchanged: a
   twin source is not a re-tier.

   | Family | Twin | Source (observed 2026-09-22) |
   | --- | --- | --- |
   | `datadog-api-key` | length 31 | Datadog's OpenAPI `ApiKey.key` minLength/maxLength 32 (#644) |
   | `microsoft-entra-client-secret` | length 41 | learn.microsoft.com Purview definition: "up to 40 characters" |
   | `new-relic-user-api-key` | prefix `NRAX-` | docs.newrelic.com: "Most user keys begin with the prefix NRAK-" |
   | `grafana-service-account-token` | prefix `glsx_` | grafana.com 9.1 GA post: "a 'glsa' prefix" |
   | `grafana-cloud-access-policy-token` | prefix `glx_` | grafana.com: "Tokens start with glc_" |

   The twins live in one table (`documentedTwins`,
   `fixtures/generated/detector-coverage.mjs`), which both suites read.

3. **Eight families stay `un-probeable`, with a dated re-check reason that
   cites their research issue.**
   - `discord-bot-token` (#646) and `telegram-bot-token` (#660): exhaustive, no
     provider-domain source.
   - `twilio-api-key-secret` (#661): exhaustive; only the companion SID has a
     documented pattern.
   - `twilio-auth-token` (#662), `sentry-org-auth-token` (#658) and
     `sentry-user-auth-token` (#659): only github.com-hosted provider sources
     exist (point 1).
   - `datadog-application-key` (#645): the documented `ddapp_` prefix belongs
     to a new format this legacy 40-hex contract does not cover.
   - `supabase-token`: unchanged (T0 positives).

4. **`context-edges` takes the 12 scoreable floor families.** Each family's
   value is built to its frozen contract and placed in eight contexts: no
   final newline, single quotes, JSON, YAML, TOML, Python, Markdown and a UTF-8
   BOM. Twins go in the same contexts, with the context held byte-for-byte.
   The key name is the environment variable the family's detector-coverage
   reference control already uses. `supabase-token` is excluded because T0 rows
   are unscored.
   - The context-edges classification now reads the fixture's own detector
     instead of assuming `github-token`.
   - The four keyword-gated Datadog/Twilio families score as `policy`, as they
     already do in detector-coverage.

5. **The Gitleaks adapter drops a decoded row that only repeats a plain row.**
   Gitleaks 8.30.1 base64-decodes a Discord token's first segment and reports
   `generic-api-key` a second time. The second row has the same rule, file,
   lines and start column; its `EndColumn` is 0 after a UTF-8 BOM. Before this
   change, the adapter errored the whole suite on that row. Now it drops the
   row only when a plain row of the same rule starts at the same place. Any
   other decoded row still fails normalization (`scanners/README.md`).

## Verification

`npm run bench -- --strict` against published `@redact-secret/core`
0.1.0-beta.6, with gitleaks 8.30.1 and trufflehog 3.97.4 (run
`2026-09-22T23:32:35.804Z-cd63d9`):

- All five twinned families read `discriminated`, 11 of 11 pairs each (3 in
  detector-coverage, 8 in context-edges).
- All 96 new context-edges positives are `EXACT` or `COVERED`. No finding
  needs `promote-finding`.

**Ledger.** The detector-coverage `sourceHash` changed, which re-keyed its
review-queue ids.
- 364 re-keyed rows were carried over by matching every field except `id` and
  `evidence.input.fixtureHash`.
- 263 new mutation rows take their operator's existing `not-assertable` class
  ([2026-09-21-settle-mechanical-mutation-review-classes](2026-09-21-settle-mechanical-mutation-review-classes.md)).
- 114 new differential rows are resolved as `range-matches-corpus`. Each row
  was checked: redact-secret's range equals the authored span, or the fixture
  is `must-not-flag` and redact-secret stayed silent.

## Consequences

- `/coverage`:
  - The five twinned families rise from 8 to 27 fixtures each.
  - The other seven scoreable floor families rise to 16.
  - The un-probeable line drops from 14 to 9.
- These twins bring the five families to the `minimumTwinPairs >= 5` gate. The
  `positiveContract: T1` gate is still open for all five, and stays a #575
  re-tier question.
- If a maintainer accepts github.com-hosted provider sources, the same table
  extends to both Sentry families (prefix) and `twilio-auth-token` (length 32),
  with no other change.
