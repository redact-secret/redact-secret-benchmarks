---
decision_id: decision-amend-207-scope-to-348-assignments
status: proposed
scope: benchmarks
title: Amend #207's added scope to 348 family-fixture assignments
decided_at: 2026-09-24
---

# Amend #207's added scope to 348 family-fixture assignments

Status: **proposed. Awaiting maintainer review.** Nothing in this record is in
force until a maintainer accepts it. It changes no fixture, expectation or
contract.

## Context

[Issue #207](https://github.com/redact-secret/redact-secret-benchmarks/issues/207)
asks for 280–320 added family-fixture assignments "unless a reviewed amendment
explains the increase". Its figure of 312 is 12 × 40 minus the 168 fixtures
its baseline table lists. The `beta8-207` corpus
(`fixtures/generated/beta8/207.mjs`, SHA-256 `8b886af5…3fd0c131`) adds **348**
fixtures, each assigned to exactly one family, so 348 assignments. That is 28
above the top of the range.

All counts below come from the corpus, not from the first-run report. Each
family's fixtures are counted in every registered corpus with and without
`beta8-207`, using the same `countProfile` rules as `npm run beta8:profiles`
(`benchmarks/lib/beta8/profiles.ts`), and set against the draft floors each
family was authored toward.

| Family | Profile | Before | Simple 40 gap | Profile total gap | Floor minimum | Added | Above minimum |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `supabase-token` | documented-24 | 8 | 32 | 16 | 16 | 21 | 5 |
| `atlassian-api-token` | empirical-40 | 11 | 29 | 29 | 29 | 29 | 0 |
| `firebase-server-key` | empirical-40 | 11 | 29 | 29 | 29 | 29 | 0 |
| `sentry-org-auth-token` | empirical-40 | 16 | 24 | 24 | 24 | 24 | 0 |
| `sentry-user-auth-token` | empirical-40 | 16 | 24 | 24 | 24 | 24 | 0 |
| `telegram-bot-token` | empirical-40 | 16 | 24 | 24 | 24 | 25 | 1 |
| `discord-bot-token` | empirical-40 | 24 | 16 | 16 | 21 | 23 | 2 |
| `twilio-auth-token` | context-48 | 16 | 24 | 32 | 32 | 33 | 1 |
| `twilio-api-key-secret` | context-48 | 16 | 24 | 32 | 32 | 33 | 1 |
| `heroku-api-key-legacy` | context-48 | 12 | 28 | 36 | 36 | 37 | 1 |
| `confluent-cloud-api-secret-legacy` | context-48 | 11 | 29 | 37 | 37 | 37 | 0 |
| `bearer-token` | context-48 | 15 | 25 | 33 | 33 | 33 | 0 |
| **Total** | | **172** | **308** | **332** | **337** | **348** | **11** |

"Floor minimum" is the smallest number of additions that meets every draft
floor. Positives are the larger of the count floor and the positive-axis
floor, since only fixtures with a `contextAxis` count toward axes. Twins are
the larger of the twin floor and the context-twin floor. Controls are the
larger of the control floor and the control-axis floor. The total is the
larger of the total floor and the sum of the three.

The 36 assignments above 312 come from four sources:

1. **The baseline moved by 4 (312 → 308).** The issue counted `bearer-token`
   as 11, which is its `detector-coverage` fixtures. Three
   `sendgrid-regressions` fixtures and one `accuracy` fixture also target
   `bearer-token`, so the family started at 15.
2. **Profile choice: +24 net (308 → 332).** Five opaque families take the
   48-fixture context profile that #207 requires for Twilio and "other opaque
   values", which is +8 each, +40 in total. `supabase-token` takes the
   24-fixture documented profile after its T0 → T1 re-review, which is −16.
3. **Positive-axis labelling: +5 (332 → 337).** None of the earlier positives
   carry a `contextAxis`, so every family needed at least six new labelled
   positives. Only `discord-bot-token` was already at its total floor. It
   needed 21 additions, not 16.
4. **Authored above the minimum: +11 (337 → 348).** `supabase-token` +5
   (3 positives, 6 controls, 4 of which the 24-fixture total floor already
   forces), `discord-bot-token` +2, and +1 each for `telegram-bot-token`,
   both Twilio families and `heroku-api-key-legacy`. Almost all of them are
   positives or controls on the axes #207 lists: public ids, references,
   placeholders, masked values, wrong companions and unrelated random ids.

Items 1–3 follow from the issue's own rules and the corpus as it stood. Only
item 4 is a choice.

## Proposed decision

- Accept 348 as #207's added scope. Record the reason as items 1–3 above
  (+29, all structural) plus 11 fixtures authored above the floor minimum.
- Do not trim the 11. Removing them changes no draft-profile outcome, but
  #206's enforced counter (`benchmarks/support/profiles.ts`) already reports
  positive/context debt for these families. That counter does not count a
  positive that anchors a twin pair as a positive/context case. At 348,
  `atlassian-api-token` and `firebase-server-key` hold 5 of the 10 untwinned
  positives `stable-empirical` asks for, and `supabase-token` holds 5 of the
  6 `stable-documented` asks for. Trimming would widen that debt.
- Record for follow-up, not as part of this amendment: meeting #206's cells
  for those three families would take about 11 more untwinned positives
  (5 + 5 + 1). The #207 corpus is frozen for this measurement, so those
  additions belong to a later corpus change and a later re-measure.

## Consequences

- #207's second acceptance criterion is met by this record once a maintainer
  accepts it. Until then it stays open.
- The first-run report's estimate ("the minimum that meets every floor is
  about 337; this corpus adds 11 beyond it") is confirmed by count: exactly
  337 and 11.
- The re-measure is in `docs/reports/2026-09-24-beta8-207-remeasure.md`.
