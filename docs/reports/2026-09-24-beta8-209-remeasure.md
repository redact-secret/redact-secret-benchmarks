# Beta.8 #209 re-measure: documented-stable hardening after #205 and #206

Issue: [#209](https://github.com/redact-secret/redact-secret-benchmarks/issues/209).
First run: [`2026-09-24-beta8-209-first-run.md`](2026-09-24-beta8-209-first-run.md).
Layout: `docs/specs/beta8-evidence.md`.

This report re-measures the seven #209 families on the current `develop` tree,
after #240 (#205, observation records) and #241 (#206, fixture profiles and
coverage debt) landed. It also records how the four frozen first-run findings
entered the promotion lifecycle. Nothing here changes a fixture, an expectation,
a contract or a support claim, and the `beta8-209` corpus hash is unchanged
(`ff3b4ff7b6be6065eb20c4e1421bc0978d473bc336819b149a1f52321a3c210d`).

## Measurement

- **Mode:** published. Product: `@redact-secret/core` 0.1.0-beta.7 (npm
  `gitHead` `2b98027bbf38d63f07b75129fe2864ef32ed4732`). Peers: gitleaks 8.30.1
  and trufflehog 3.97.4. The PATH was pinned, and `trufflehog --version` was
  checked in the same shell as every command.
- **Benchmark commit:** `85dc560`, a clean tree. Lock hash `cbbb00a1…0363`.
- `npm run eval:classify`: run `f8d51fd7-fa88-4e34-886b-5622564f8104`.
- `npm run eval` over the seven detectors: run
  `420af8b1-c647-4bbd-9349-e7c13eb1a1f7`.

### Stable count

**4 stable of 57 families** in published mode (documented 4, empirical 0; 52
provisional, 1 pending). The four stable families are `anthropic-token`,
`azure-devops-personal-access-token`, `datadog-application-key` and
`notion-token`. `confluent-cloud-api-secret`, `google-api-key` and
`heroku-api-key` are provisional.

The first run's "34 → 31" is not today's baseline. It was measured on base
`e268493`, before #239 (#177) added the documented-profile floors to
`status-criteria.json`: 6 positives, 4 positive axes, 8 benign controls, 4
control axes and 5 twin pairs. The same command at each merge on `develop`:

| commit | what landed | stable |
| --- | --- | --- |
| `d5438c5` | #239 (#177 documented/empirical floors) | 0 of 57 |
| `722378e` | #238 (#207–#212 corpora, including #209) | 4 of 57 |
| `85dc560` | #240 (#205) + #241 (#206) | 4 of 57 |

Between `722378e` and `85dc560`, every family's status and reason list is
identical. #205 and #206 changed no status. The other 27 families that read
stable before #239 are provisional only because of `documented.*` floors. #209
raised its seven families above those floors, and four of them cleared every
other gate. The three that did not are held only by the findings below: none of
the seven fails a `documented.*` floor.

### beta8-209 fixtures (same pins; unchanged from the first run)

| family | positives exact | twins clean | controls clean | status |
| --- | --- | --- | --- | --- |
| azure-devops-personal-access-token | 4/4 | 3/3 | 3/3 | stable |
| datadog-application-key | 4/4 | 3/3 | 3/3 | stable |
| google-api-key | 3/4 | 3/3 | 3/3 | provisional |
| heroku-api-key | 2/4 | 3/3 | 3/3 | provisional |
| notion-token | 4/4 | 3/3 | 3/3 | stable |
| confluent-cloud-api-secret | 3/4 | 1/4 | 2/2 | provisional |
| anthropic-token | 4/4 | 1/1 | 3/3 | stable |

Every redact-secret assertion failure for these families is on a `beta8-209`
fixture. The provisional reasons, as `eval:classify` reports them:

- `confluent-cloud-api-secret`:
  - twinFailures 4;
  - metamorphic.criticalFailures 7;
  - mutation.unresolvedCritical 8;
  - differential.unresolvedContractDisagreements 10.
- `google-api-key`:
  - metamorphic.criticalFailures 7;
  - mutation.unresolvedCritical 3;
  - differential.unresolvedContractDisagreements 1.
- `heroku-api-key`:
  - twinFailures 2;
  - metamorphic.criticalFailures 14;
  - mutation.unresolvedCritical 4;
  - differential.unresolvedContractDisagreements 2.

### Open ledger rows for the seven families

There are 13 open rows. The other four families have none.

- **10 finding rows**, the same ten the first run opened. They now cite their
  known-gap records (see Findings):
  - 5 `confirmed-twin-false-positive/confluent-cloud-api-secret`;
  - 2 `differential-collateral-public-id/confluent-cloud-api-secret`;
  - 2 `differential-coverage-gap/heroku-api-key`;
  - 1 `differential-coverage-gap/google-api-key`.
- **3 `classification-granularity-unasserted` rows** on Confluent
  (`kafka-client-properties`, `secrets-manager-json`, and
  `kafka-client-properties-checksum-byte-order-twin`, all differential against
  gitleaks). They appeared at integration, when #207 mapped the product label
  in `scanners/families.mjs`. Byte ranges agree; only the family label differs
  (`confluent-cloud-api-secret` against gitleaks `generic-token`). They are not
  a product defect. They wait on a classification-granularity policy decision,
  which is still open for 20 rows repo-wide. They count toward Confluent's 10
  unresolved differential disagreements.

## Profile counters: why they disagree and which one governs

For six of the seven families, `npm run beta8:profiles` says `documented-24`
with no debt. `docs/generated/fixture-profile-coverage.md` (#206) says
positive/context cases 0/6 (Confluent) or 1/6 (the other five). Anthropic has
no debt in either. The difference is one definition:

| counter | positive cases counted as | Confluent | Azure DevOps |
| --- | --- | --- | --- |
| `beta8:profiles` (`benchmarks/lib/beta8/profiles.ts`) | every non-twin secret fixture | 7 | 7 |
| status gate `documented.minimumPositiveCases` (`benchmarks/support/evidence.ts`, #177) | every non-twin secret fixture (differential base) | 7 | 7 |
| #206 `positiveCases` (`benchmarks/support/profiles.ts`) | secret fixtures **with no twin of their own** | 0 | 1 |

#206's unit states the rule: "a positive/context case is a secret-bearing
fixture with no twin". A positive that anchors a twin pair counts only inside
that pair. #209 gave most of its positives a twin, so under #206 almost none of
them count as standalone positive/context cases. Every other cell agrees:
total, controls, twin fixtures, and positive and control axes all meet the
floors. The axes are counted differently (`group` against `contextAxis`), but
both reach at least 4.

Which one governs:

- **Support status** is decided by `status-criteria.json` through
  `classifyFamilySupport` (#177). That counter includes twin-anchored positives,
  and all seven families pass it.
- **Fixture-profile debt** is #206's. `stable-documented` ships with
  `enforcement: reported`, and none of the seven contracts claims
  `fixtureProfile` explicitly. So #206's debt is published but does not bind a
  status today. The #206 decision names flipping `enforcement` as the ratchet,
  "taken when #207/#209 raise the families".
- **`beta8:profiles`** is advisory. Its own header says it transcribes #206's
  draft floors and "#206 owns the enforced gate". It is now out of step with
  #206's definition and should either adopt it or be retired. That is a
  follow-up, not part of this change.

Real remaining debt for the seven families, all in one cell: #206
positive/context cases. Confluent is short 6. Azure DevOps, Datadog, Google,
Heroku and Notion are short 5 each. Anthropic is short 0. Clearing it takes
standalone (twin-free) positives on existing or new context axes. If #206's
`stable-documented` enforcement flipped today, six of the seven would move to
provisional. Observation records (#205) are not required for T1 documented
families, and none is committed for them.

A side note on #206's arithmetic: `twinPairs` counts twin fixtures, not distinct
anchors. Confluent's 10 checksum/alphabet/length/prefix twins hang off fewer
positives, so the unit's identity (total = positives + controls + 2 × pairs)
does not hold for it: 0 + 8 + 20 ≠ 25.

## Findings: promotion

Three findings were promoted through `promote-finding` (observed → reviewed →
promoted), one `benchmarks/known-gaps.json` record per product behaviour. Each
product issue carries:

- the safe reproduction (fixture ids, corpus hash, candidate identity and
  offsets);
- a canonical case drafted from scratch;
- the proposed `productManifestRecordId`.

Before filing, the product repository was searched. The existing Confluent and
Heroku issues (redact-secret#309, #312, #714) are closed implementation records
that do not cover these behaviours, so new issues were opened.

| # | finding | record | product issue | direction |
| --- | --- | --- | --- | --- |
| 1 | Confluent checksum not validated: 3 checksum twins flagged | `product-738` | [redact-secret#738](https://github.com/redact-secret/redact-secret/issues/738) | false positive |
| 2 | Confluent public key ID flagged as `generic-token` in a JSON `"apiKey"` field | `product-739` | [redact-secret#739](https://github.com/redact-secret/redact-secret/issues/739) | false positive |
| 3 | Heroku 41-character `HRKU-<uuid>` generation missed | `product-740` | [redact-secret#740](https://github.com/redact-secret/redact-secret/issues/740) | false negative |
| 4 | Google Firebase web-config `apiKey` suppressed by design | `product-520`, at `observed` | [redact-secret#520](https://github.com/redact-secret/redact-secret/issues/520) (linked, closed) | false negative, disputed |

Details:

- **Reviewed evidence:**
  - Confluent: the docs.confluent.io API-key overview and #234.
  - Heroku: devcenter changelog-items/3175 and 2842, the oauth article, and #235.

  Each expectation predates the scanner run and was authored independently of
  it.
- **Candidate:** `@redact-secret/core` 0.1.0-beta.7, `sourceCommit` `2b98027…`
  (the npm `gitHead`, an ancestor of product `main`; `pins:check` passes).
- **Finding 2 probe:** `generic-token` fires on any `apiKey`/`API_KEY`
  assignment of a 16-character upper-alphanumeric value. `{"key": …}`,
  `{"apiKeyId": …}` and `CONFLUENT_CLOUD_API_KEY=` stay clean. The issue leaves
  the direction to the product: either pairing-aware suppression, or a recorded
  `generic-token` policy decision.
- **Finding 4 (decision pending):** by user decision this is not promoted, and
  no exclusion is added. `product-520` stays at `observed`, with the note:
  awaiting maintainer decision between a product gap and a documented scope
  exclusion (redact-secret#520 B3a). **google-api-key cannot return to stable
  until a person makes this decision.**

The ten finding rows in `benchmarks/review-ledger.json` stay `open`. Only their
notes changed: they now name the record and product issue in place of "needs a
promote-finding pass".

### Stale detector-coverage Confluent positives

`detector-coverage--confluent-cloud-api-secret-prefixed-shape-{bare,quoted,unicode-crlf}`
are flat random bodies that fail the provider checksum. They are scored as
retained policy/T3 expectations with an expected span, and today the product
matches them EXACT. They get no known-gap record, because they are not a
product defect. But they contradict finding 1:

- the checksum twins assert silence on a checksum-invalid `cflt` value;
- these rows assert masking of one.

Once redact-secret#738 is fixed, these three rows will miss. Metamorphic
failures count every kind, policy included, so Confluent would stay
provisional. A benchmark-side decision is needed first: retire these retained
expectations, or regenerate them checksum-valid under a recorded decision. That
decision is not taken here, because it would edit fixtures and expectations.
redact-secret#738 names it so the product side is not surprised by the rerun.

## What it takes to return to, or stay, stable

- **anthropic-token (stable).** Stays stable while its behavioural gates hold.
  No #206 debt.
- **azure-devops-personal-access-token (stable).** Stays stable. It carries
  #206 debt of 5 standalone positives, which binds only if `stable-documented`
  is enforced.
- **datadog-application-key (stable).** Stays stable. #206 debt: 5 standalone
  positives (binding only on enforcement).
- **notion-token (stable).** Stays stable. #206 debt: 5 standalone positives
  (binding only on enforcement).
- **heroku-api-key (provisional).** Returns to stable when redact-secret#740 is
  fixed, a fixed-candidate rerun shows both `-g1` positives EXACT, and the two
  open heroku rows are resolved. #206 debt: 5 (not binding).
- **google-api-key (provisional).** Blocked on a person's decision about the
  Firebase web config (redact-secret#520 B3a):
  - if it is a product gap, promote `product-520`, fix, and rerun;
  - if it is a scope exclusion, record a documented exclusion and review the
    open row against it.

  #206 debt: 5 (not binding).
- **confluent-cloud-api-secret (provisional).** Needs all of the following:
  - fixes for redact-secret#738 (checksum) and redact-secret#739 (key-ID
    collateral, fixed or recorded as a policy decision);
  - a benchmark decision on the three retained prefixed-shape policy rows;
  - a classification-granularity policy decision that closes its 3
    `classification-granularity-unasserted` rows;
  - a fixed-candidate rerun.

  #206 debt: 6 (not binding).

## Gates (this change)

The following pass:

- `npm run typecheck`;
- `npm test` (470/470);
- `npm run fixtures:check`;
- `npm run profiles:check` (73 families, 3 generated files, no drift);
- `npm run queue:check` with trufflehog 3.97.4 and gitleaks 8.30.1;
- `npm run ledger:decisions:check`;
- `npm run promotion:check` (all product issues reachable, manifest
  cross-reference consistent);
- `npm run pins:check`;
- `npm run build` (chunk-size warning only).

`tests/inventory.test.mjs` pins the list of known-gap issue numbers and the
fixture count. It was updated for the four new records (64 → 72 fixtures).

## Human decisions still open

1. Firebase web config: product gap or documented scope exclusion
   (redact-secret#520 B3a). This blocks google-api-key.
2. Retained Confluent prefixed-shape policy rows against the checksum contract.
   This blocks confluent-cloud-api-secret after the fix.
3. Classification-granularity policy: 20 open rows repo-wide, 3 on Confluent.
4. Whether `beta8:profiles` adopts #206's positive/context-case definition, and
   when `stable-documented` enforcement flips.

The hands-on corroboration from the first run (Confluent scope and final
character, Heroku `AA`/alphabet/older generations, Datadog alphabet) is still
open. None of it blocks the contracts.
