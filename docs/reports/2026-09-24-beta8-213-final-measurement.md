# Beta.8 #213 final measurement: 34 restored, 17 newly stable

Issue: [#213](https://github.com/redact-secret/redact-secret-benchmarks/issues/213).
Product counterpart: redact-secret/redact-secret#576 and #731. The portfolio
this replaces as the target reading is
`docs/reports/2026-09-24-beta8-213-portfolio.md`.

## Target

Beta.8 must not regress: all 34 families that were stable at beta.7 stay
stable under the Beta.8 criteria (#177, #205, #206, #239). On top of them,
existing families that were not stable at beta.7 are newly qualified. The
target is at least 49 stable families (34 + 15).

## Measurement identity

| Item | Value |
| --- | --- |
| Product | redact-secret `main` at `99d83c4c4d8070da754fcf021f1be43cdebd7afc`, which includes #750 #751 #752 #753 #755 #757 #758 |
| Benchmarks | `6c619954ee2d87532ded0b455c665a41d289bef4`, clean clone (`dirty: false`) |
| Candidate core tarball | `8b6e759b98201ebfed797a5389eca57a3aa52fef1bc96783d522c60418662520` |
| Candidate node-darwin-arm64 tarball | `4e475b045bea7a882c80c4fdd1b12823e69be49c614c6ca0070d3f40ad877ce3` |
| Candidate wasm tarball | `6df47b87ef0301019284470ea9728b30a0611a0a4d0585494f28ab0b36dc58c1` |
| Lock hash | `cbbb00a192cf384857e286d9e81a8851bb43797d47410a0618e21690ff050363` |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 (printed in the same command as each run) |
| Cases / variants | 8236 / 21317 |
| Candidate run | `fbd7aeb1-e189-4043-8a8f-a1f35cacdaec` |
| Published run (`@redact-secret/core` 0.1.0-beta.7) | `5416735a-88ae-4567-bb43-b703d8858997` |

The candidate declares version 0.1.0-beta.7, because the product has not been
tagged. Its source commit above is the identity.

## Result

| Mode | Stable | Documented | Empirical | Provisional | Pending |
| --- | ---: | ---: | ---: | ---: | ---: |
| Candidate (product `main` 99d83c4) | **51** | 35 | 16 | 5 | 1 |
| Published beta.7 | 40 | 30 | 10 | 16 | 1 |

Every candidate-mode review-queue row has a ledger row (5210 rows, 0 missing).
The 134 open rows all belong to Beta.8 arrival families outside the 57.

### Restored: 34 of 34 beta.7-stable families

All 34 are `stable · documented` in candidate mode. In published beta.7, 30 of
them are stable. The other four (confluent-cloud-api-secret, google-api-key,
heroku-api-key, new-relic-license-key) need the merged product fixes.

### Newly stable: 17

| Family | Profile | What it took |
| --- | --- | --- |
| supabase-token | documented | T1 re-review (#207); product #742; detector-coverage fixtures regenerated in the documented layout |
| discord-bot-token, telegram-bot-token, sentry-org-auth-token, sentry-user-auth-token, firebase-server-key | empirical | corroborated route (#177 amendment); #207 fixtures; #206 debt closed |
| atlassian-api-token | empirical | product #741, #747 |
| twilio-auth-token, twilio-api-key-secret, confluent-cloud-api-secret-legacy | empirical | product #744, #746; context twins now counted by `mutationKind` |
| heroku-api-key-legacy | empirical | product #743 |
| datadog-application-key-legacy | empirical | context-48 fixtures (`beta8-213e`) |
| postman-api-key | empirical | Postman-owned insights-agent rule as a second corroboration class |
| mailgun-api-key, openai-token, databricks-personal-access-token, mailchimp-api-key | empirical | stop asserting provider-undecided properties (ADR below); mailchimp also product #756 |

Seventeen is two more than the 15 in #576's wording. No family was held back to
land exactly on 15.

### Not stable: 6

- **Not eligible under the tier rules:**
  - bearer-token, connection-string, generic-token, otpauth-uri (T3).
  - vercel-token (T0): Vercel documents only the prefix, and no peer has a
    prefixed rule.
- **okta-api-token (T2):** 4 unresolved contradictions. Positives carry the
  disputed `_`, and an Okta staff statement says not to assume a token
  structure, so the disputed-property ADR was deliberately not applied.

## Decisions this measurement depends on

- `docs/decisions/2026-09-24-qualify-empirical-stable-by-corroboration.md`
  amends #177. A T2 family qualifies through independent corroboration plus the
  empirical fixture and behaviour gates, and provider-issued observations become
  optional. The tier stays T2, and the matrix shows the basis.
- `docs/decisions/2026-09-24-settle-peer-coarser-classification-disagreements.md`
  covers same-span rows where only the peer's label is coarser.
- `docs/decisions/2026-09-24-stop-asserting-provider-undecided-format-properties.md`
  stops asserting properties that no provider-owned source decides (Mailgun
  uppercase, OpenAI service-account length, Databricks rotation suffix,
  Mailchimp `-eu6` and g–z body). The product's behaviour on those properties
  is now unmeasured and recorded as such.
- Confluent #739 is a policy decision: the paired key ID is a `companion` span,
  and `product-739` is `policy-decision`.
- Firebase web config (#749): the product now redacts `AIza` keys inside
  `firebaseConfig`, reversing redact-secret#520 B3a. Peers flag them, and
  unrestricted keys gained Gemini access in 2026.

## Still open

- The product's `conformance/benchmark-regressions.json` records for #738–#758
  cite corpora that exist only on this branch. They can be added after
  benchmarks `develop` is promoted to `main` and the product runs
  `benchmark-pins:sync`. Until then the known gaps stay `fixed`, not `verified`.
- `npm run pins:check` reports detector-registry drift against product `main`
  (detectors changed after `2b98027`). Refreshing it moves `sourceRevision`,
  which forces a performance re-baseline (#150 coupling).
- The Beta.8 arrival families (#208, #210–#212) are a separate track and are not
  part of the 57.
