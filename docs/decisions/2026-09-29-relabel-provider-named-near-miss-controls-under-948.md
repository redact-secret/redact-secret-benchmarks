---
decision_id: decision-relabel-provider-named-near-miss-controls-under-948
status: accepted
scope: benchmarks
title: Relabel the provider-named near-miss controls that redact-secret#948 makes credentials
decided_at: 2026-09-29
---

# Relabel the provider-named near-miss controls that redact-secret#948 makes credentials

Status: **accepted** (2026-09-29, on the maintainer's decision that #948 ships in Beta.11, relayed by the Beta.11
orchestrator for the re-bind to product `ec9224d`). Part of the Beta.11 re-bind
([#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376)).

## Context

[redact-secret#948](https://github.com/redact-secret/redact-secret/issues/948) (product PR #994, merged as
`ec9224d9743066fe73d6e61e9843ef52bd853833`) amended the product decision
[`decision-redact-provider-named-credential-assignments`](https://github.com/redact-secret/redact-secret/blob/ec9224d9743066fe73d6e61e9843ef52bd853833/docs/decisions/2026-09-24-redact-provider-named-credential-assignments.md#amendment-a-provider-named-high-signal-name-falls-back-to-generic-token-948).
A provider prefix no longer disqualifies a high-signal credential name, so `generic-token` claims an off-grammar value
under the provider's own variable (`SENTRY_AUTH_TOKEN=<near miss>`) at the generic floors: 8 bytes, redact at 16 bytes
and Shannon entropy 3.0, otherwise warn. The provider detector still decides an on-grammar value. The amendment names
its cost: "the malformed-by-construction controls that motivated the exception are reported again".

The full-suite candidate run at `ec9224d` (`2852d0eb-fcce-4025-864d-597636210c4d`, benchmarks `af180a5`, labels as they
stood) reads exactly those fixtures differently from the `8f97f14` run (`74888ff3-48ed-4459-b2fe-32906a5a95cb`): 177
`must-not-flag` fixtures now carry one `generic-token` finding, and nothing else changed except that one twin lost a
co-detection (`beta8-434b--trigger-dev-token-public-key-prefix-twin`, the #993 public-key exclusion). The 177 split as:

| Kind | Fixtures | Candidate-run reading |
| --- | ---: | --- |
| Negative twins, scored (`twinOf` + contract) | 146 | `clean`, 1 finding: the twin's reading is scoped to its own family, so the finding is `coDetected` |
| Negative twins, T0 (disputed-property history) | 6 | `observed`, unscored |
| Non-twin near-miss controls under the provider's own variable | 25 | `flagged` (unscoped benign false alarm) |

The per-corpus counts equal the product's own rescan (product `docs/audits/evidence/948/README.md` at `ec9224d`).

With the labels unchanged, `eval:classify` (trufflehog 3.97.4, gitleaks 8.30.1) reads **55 stable of 110 in candidate
mode** (documented 50, empirical 5), against 88 at `8f97f14`. Published mode (`@redact-secret/core` 0.1.0-beta.10, which
predates #948) reads 61, unchanged. The 33 families that lost `stable` did so for two reasons:

- **Only because their twins now also get a generic finding (22 families).** The twin's own scoped assertion holds in
  every case, but the differential method compares raw output: a twin that the product used to leave silent, and that
  is now reported as `generic-token`, raises a new `redact-secret-only` (or classification or range) row against the
  silent peer. Those 170 rows have no ledger decision, so each counts as an unresolved contract disagreement:
  atlassian-api-token 3, confluent-cloud-api-secret 2, databricks-personal-access-token 3, fireworks-ai-api-key 2,
  github-token 18, gitlab-token 3, grafana-cloud-access-policy-token 14, grafana-service-account-token 7,
  groq-api-key 4, heroku-api-key 1, langfuse-secret-key 3, langsmith-api-key 3, neon-api-key 3,
  new-relic-user-api-key 7, notion-token 1, openai-token 4, openrouter-api-key 3, perplexity-api-key 2,
  pinecone-api-key 4, replicate-api-token 3, sendgrid-token 9, xai-api-key 3.
- **Because a near-miss control is now a benign false alarm (11 families):** datadog-api-key, discord-bot-token,
  heroku-api-key-legacy, mailgun-api-key, postman-api-key, sentry-org-auth-token, sentry-user-auth-token,
  telegram-bot-token, travisci-api-token, twilio-api-key-secret and twilio-auth-token. Each carries `benign.falseAlarms`
  1–3 plus the metamorphic, mutation and differential rows derived from the same controls (for example
  heroku-api-key-legacy: 3 false alarms, 29 metamorphic, 3 mutation, 7 differential). Most of these families also carry
  flagged twins.

None of this is a product regression: every changed outcome is the amended decision applied to its own stated input.
It is a contract change the corpus has to record, the way
[`2026-09-24-stop-asserting-provider-undecided-format-properties.md`](2026-09-24-stop-asserting-provider-undecided-format-properties.md)
recorded #384's `sk-ant-api01-` change, and not a reason to edit expectations until a metric recovers.

## Decision

1. **Negative twins keep their expectation.** A twin asserts that the product does not report its value as the
   twin's own provider family, and the twin method already scopes its reading to that family
   ([`02-negative-twin.md`](../specs/evaluation-methods/02-negative-twin.md), #82). That is exactly the distinction #948
   needs: "no typed `<provider>` finding; a contextual `generic-token` finding is allowed and recorded as
   `coDetected`". No twin is edited, so every twin keeps discriminating the typed provider detector. Their new
   differential rows are resolved per row in `benchmarks/review-ledger.json` with the classes the corpus already used
   for the same situation after redact-secret#702 (`redact-secret-only/<peer>/co-detection`,
   `classification-disagreement/<peer>/twin-boundary-family-reassignment`, `range-disagreement/<peer>/co-detection`).
   Each note names the twin's family, states that no typed finding for it was reported, and cites #948. A row qualifies
   only when the variant is canonical, the fixture carries `twinOf` and a contract other than `generic-token`, and
   every redact-secret label on the row is `generic-token`.
2. **The 25 near-miss controls are relabelled, not deleted.** Each is `<PROVIDER>_..._KEY|TOKEN|SECRET=<random near
   miss>`, the amendment's stated input, so its "expected silence follows from construction" no longer holds. Each moves
   from `must-not-flag`/T2 on its provider family to `policy`/T3 on `generic-token`. The `must-redact` kind is not
   used, because the measurement protocol keeps project policy apart from provider-documented formats
   ([`measurement-v4.md`](../specs/measurement-v4.md) §2.1). The authored secret span is the value after `<NAME>=` up to
   the line end. `expectedAction` is authored from the amendment's floors, never from scanner output: 24 values are 16+
   bytes with entropy ≥ 3.0 and redact, and `detector-coverage--mailgun-api-key-short-body` (14 bytes) warns. The single
   list is `PROVIDER_NAMED_FALLBACK_948` in `benchmarks/lib/assessment.ts`. `applyProviderNamedFallback948` applies it in
   `fixtures/generated/build.mjs` before classification and fails the build if an input is not `<NAME>=<value>` for the
   recorded name, is not a spanless non-twin control of the recorded family, or does not reach the recorded action. Every
   assessment reason records old → new and cites #948. `benchmarks/fixture-semantics.json` moves the 25 slugs to
   `generic:unclassified-assignment-literal`. Ids stay unchanged, as history.
3. **Replacement near-miss controls restore the cells.** After the relabel, six families fell short of their #206
   cells: datadog-api-key (benign controls 7/8), mailgun-api-key (total 38/40), postman-api-key (39/40),
   sentry-org-auth-token and sentry-user-auth-token (total 38/40, benign controls 12/14), and travisci-api-token (47/48).
   Nine controls in a new corpus key, `beta8-948` (`fixtures/generated/beta8/948.mjs`), keep each family's near-miss
   value shape (truncated, mis-delimited or half-built) but carry it in prose or a log line, never as the value of a
   credential-named assignment, header or flag. Their silence follows from construction under the amended decision. No
   existing corpus gains a fixture. This follows the `beta8-213f` precedent.

## The 25 relabelled controls

Old expectation: `must-not-flag`/T2, contract = family, expected silence. New expectation: `policy`/T3, contract
`generic-token`, secret span = the value, action as listed.

| Fixture | Family (old contract) | Variable | Value bytes | New action |
| --- | --- | --- | ---: | --- |
| `detector-coverage--datadog-api-key-short-key` | datadog-api-key | `DD_API_KEY` | 20 | redact |
| `detector-coverage--heroku-api-key-legacy-short-token` | heroku-api-key-legacy | `HEROKU_API_KEY` | 18 | redact |
| `detector-coverage--mailchimp-api-key-missing-marker` | mailchimp-api-key | `MAILCHIMP_API_KEY` | 32 | redact |
| `detector-coverage--mailchimp-api-key-short-key` | mailchimp-api-key | `MAILCHIMP_API_KEY` | 24 | redact |
| `detector-coverage--mailgun-api-key-short-body` | mailgun-api-key | `MAILGUN_API_KEY` | 14 | warn |
| `detector-coverage--travisci-api-token-short-token` | travisci-api-token | `TRAVIS_API_TOKEN` | 21 | redact |
| `beta8-207--sentry-org-auth-token-missing-secret-near-miss` | sentry-org-auth-token | `SENTRY_AUTH_TOKEN` | 151 | redact |
| `beta8-207--sentry-org-auth-token-missing-payload-near-miss` | sentry-org-auth-token | `SENTRY_AUTH_TOKEN` | 50 | redact |
| `beta8-207--sentry-user-auth-token-half-body-near-miss` | sentry-user-auth-token | `SENTRY_AUTH_TOKEN` | 39 | redact |
| `beta8-207--sentry-user-auth-token-org-prefix-hex-near-miss` | sentry-user-auth-token | `SENTRY_AUTH_TOKEN` | 71 | redact |
| `beta8-207--telegram-bot-token-short-secret-near-miss` | telegram-bot-token | `TELEGRAM_BOT_TOKEN` | 21 | redact |
| `beta8-207--discord-bot-token-two-segments-near-miss` | discord-bot-token | `DISCORD_TOKEN` | 65 | redact |
| `beta8-207--twilio-auth-token-long-value-near-miss` | twilio-auth-token | `TWILIO_AUTH_TOKEN` | 33 | redact |
| `beta8-207--twilio-auth-token-split-value-near-miss` | twilio-auth-token | `TWILIO_AUTH_TOKEN` | 33 | redact |
| `beta8-207--twilio-api-key-secret-short-value-near-miss` | twilio-api-key-secret | `TWILIO_API_SECRET` | 24 | redact |
| `beta8-207--heroku-api-key-legacy-non-hex-uuid-near-miss` | heroku-api-key-legacy | `HEROKU_API_KEY` | 36 | redact |
| `beta8-207--heroku-api-key-legacy-missing-group-near-miss` | heroku-api-key-legacy | `HEROKU_API_KEY` | 31 | redact |
| `beta8-207--confluent-cloud-api-secret-legacy-overlong-value-near-miss` | confluent-cloud-api-secret-legacy | `CONFLUENT_CLOUD_API_SECRET` | 66 | redact |
| `beta8-213d--mailchimp-api-key-short-body-suffix-near-miss` | mailchimp-api-key | `MAILCHIMP_API_KEY` | 28 | redact |
| `beta8-213d--mailgun-api-key-short-body-near-miss` | mailgun-api-key | `MAILGUN_API_KEY` | 20 | redact |
| `beta8-213d--postman-api-key-short-key-near-miss` | postman-api-key | `POSTMAN_API_KEY` | 29 | redact |
| `beta8-259--mailgun-api-key-triplet-short-first-segment-near-miss` | mailgun-api-key-triplet (arrival) | `MAILGUN_API_KEY` | 49 | redact |
| `beta8-259--mailgun-api-key-triplet-short-last-segment-near-miss` | mailgun-api-key-triplet (arrival) | `MAILGUN_API_KEY` | 49 | redact |
| `beta8-259--mailgun-api-key-triplet-uppercase-hex-near-miss` | mailgun-api-key-triplet (arrival) | `MAILGUN_API_KEY` | 50 | redact |
| `beta8-259--mailgun-api-key-triplet-two-segments-near-miss` | mailgun-api-key-triplet (arrival) | `MAILGUN_API_KEY` | 41 | redact |

The rationale is the same for every row: random or secret-shaped material under the provider's own credential variable
is a credential under the amended policy.

## What this gives up

- **These 25 inputs no longer measure provider discrimination as unscoped controls.** They measure the generic policy
  instead. Provider discrimination on the same near-miss properties is still measured by the families' twins, which
  are scoped, and by the nine `beta8-948` controls, whose values carry the same shapes outside a credential name.
- **The published release reads as missing them.** 0.1.0-beta.10 predates #948, so in published mode the 25 are policy
  misses: generic-token reads `policy.exact-span` 25 and `policy.leaked-span` 25, with 223 metamorphic, 25 mutation and
  20 differential rows. Those 20 differential rows are recorded `open`, class
  `differential-coverage-gap/generic-token-948-published`, so the gap stays visible until a release carries #948.
  generic-token was provisional in published mode before this decision and stays provisional.
- **A future product change that narrows #948 would show as misses here**, not as silent controls. The product's stated
  contract decides this, which is what the relabel records.

## Consequences

- Each relabelled fixture's review rows re-key (31 candidate-keyed, 20 published-keyed). Every other fixture keeps its
  ids. The new rows are triaged in the ledger: the candidate rows `resolved` (the product matches the authored span
  exactly; 30 are `redact-secret-only/<peer>/range-matches-corpus`, and 1 is
  `classification-disagreement/gitleaks/peer-legacy-triplet-rule`, where gitleaks' case-insensitive signing-key rule
  labels the uppercase triplet), and the published rows `open` as above.
- The corpus and semantic index change, so every pinned peer snapshot was refreshed (`npm run peers:snapshots:refresh`,
  trufflehog 3.97.4 and gitleaks 8.30.1 from `.peer-bin`).
- The corpus grows from 4,768 to 4,777 fixtures (46 → 47 development categories).

## Verification

`eval:classify` with trufflehog 3.97.4 and gitleaks 8.30.1, candidate `ec9224d`:

| Mode | Labels as before (benchmarks `af180a5`) | After this decision | At `8f97f14` |
| --- | --- | --- | --- |
| Candidate (`ec9224d`) | 55 stable of 110 (documented 50, empirical 5) | 88 stable (documented 63, empirical 25) | 88 (63, 25) |
| Published (0.1.0-beta.10) | 61 stable (38, 23) | 61 stable (38, 23) | 61 (38, 23) |

After this decision the same 88 families are stable in candidate mode as at `8f97f14`, with the same profiles. The only
changes in any family record are:

- the fixture counts of the eight families whose relabelled controls were not replaced (for example twilio-auth-token:
  62 → 60 total, 22 → 20 benign cases). Each still meets its cells.
- generic-token, which gains the 25 policy positives: 68 of 68 exact in candidate mode, actions 62 redact and 6 warn,
  0 unexpected. It is still provisional, on the protected holdout that has not run.

Numbers of record: [`evidence/860/ec9224d/README.md`](../../evidence/860/ec9224d/README.md).

## Application to the #464 corpus (2026-09-30, Beta.12 graduation)

The same rule applies, unchanged, to four #464 controls and one #1012 control built on the input this decision names: random or
secret-shaped material as `<NAME>=<value>` under a provider's own credential variable. They are added to
`PROVIDER_NAMED_FALLBACK_948` (ids unchanged, as history) and move from `must-not-flag`/T2 on their family to
`policy`/T3 on `generic-token`: the four #464 values at `redact` (34+ bytes, entropy above 3.0), the 12-byte AWS value at `warn`.

| Fixture | Family (old contract) | Variable | Value bytes | New action |
| --- | --- | --- | ---: | --- |
| `beta8-464a--daytona-api-key-named-bare-hex-encoded-value` | daytona-api-key | `DAYTONA_API_KEY` | 64 | redact |
| `beta8-464d--browserbase-api-key-bb-test-key-near-miss` | browserbase-api-key | `BROWSERBASE_API_KEY` | 40 | redact |
| `beta8-464f--runpod-api-key-redirect-pizza-30-near-miss` | runpod-api-key | `REDIRECTPIZZA_API_TOKEN` | 34 | redact |
| `beta8-464f--runpod-api-key-s3-secret-rps-near-miss` | runpod-api-key | `RUNPOD_S3_SECRET_KEY` | 48 | redact |
| `beta8-1012a--aws-secret-access-key-truncated-near-miss` | aws-secret-access-key | `AWS_SECRET_ACCESS_KEY` | 12 | warn |

Not relabelled, because they are not this input: `beta8-464a--daytona-api-key-runner-key-unprefixed-encoded-value`
(`RUNNER_API_KEY` names no provider), `beta8-464e--cerebras-api-key-pinecone-key-near-miss` (a Pinecone-shaped value
that the typed `pinecone-api-key` detector reports, not a generic fallback),
`beta8-464e--cerebras-api-key-pinecone-hyphen-key-near-miss` (an SDK keyword argument, not `<NAME>=`) and
`beta8-528b--polar-token-checkout-client-secret-public-id` (a JavaScript object member). Those four are settled as
accepted policy by [`2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md`](2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md). No replacement controls are added; the #206 cells are re-checked by
`npm run profiles:check`. Numbers of record: [`evidence/528/99c8c2b/README.md`](../../evidence/528/99c8c2b/README.md).
