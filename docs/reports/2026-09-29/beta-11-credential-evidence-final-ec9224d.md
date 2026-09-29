# Beta.11 credential validation evidence: final report at the re-bound candidate ec9224d (#376)

> **Superseded** by [`beta-11-credential-evidence-final-8b6a5fd.md`](beta-11-credential-evidence-final-8b6a5fd.md): the candidate moved to product main `8b6a5fd` (PR #996); every outcome is equal there. Kept as history.

> This report supersedes [`beta-11-credential-evidence-final.md`](beta-11-credential-evidence-final.md) (candidate
> `8f97f14`), which stays as history. The Beta.11 candidate moved from `8f97f14` to product main `ec9224d` after PR #994,
> which the maintainer decided ships in Beta.11. PR #994 carries #948 (the provider-named `generic-token` fallback, an
> intended output change), #993 (non-secret value exclusions), #902 (linear PII context, output byte-identical) and
> #896 (scripts). Every credential measurement below was repeated at `ec9224d`, except the #382 blind aggregate, which
> is carried over by maintainer decision (§5).
>
> #948 changes 177 `must-not-flag` fixtures by design. The corpus records that contract change in
> [`docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](../../decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md):
>
> - the 152 negative twins keep their family-scoped expectation, and their `generic-token` finding counts as
>   co-detection;
> - 25 near-miss controls under the provider's own credential variable move to `policy`/T3 on `generic-token`;
> - nine replacement controls keep six families at their cells.
>
> The corpus is therefore 4,777 fixtures, not 4,768. With the labels as they stood, candidate mode read 55/110
> stable; after the record it reads 88/110, the same families as at `8f97f14`.

Epic: [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376).
Children [#377](https://github.com/redact-secret/redact-secret-benchmarks/issues/377)–[#382](https://github.com/redact-secret/redact-secret-benchmarks/issues/382)
merged through PRs [#439](https://github.com/redact-secret/redact-secret-benchmarks/pull/439),
[#442](https://github.com/redact-secret/redact-secret-benchmarks/pull/442),
[#452](https://github.com/redact-secret/redact-secret-benchmarks/pull/452),
[#453](https://github.com/redact-secret/redact-secret-benchmarks/pull/453) and
[#454](https://github.com/redact-secret/redact-secret-benchmarks/pull/454).
Machine-readable summary: [`beta-11-credential-evidence-final-ec9224d.json`](beta-11-credential-evidence-final-ec9224d.json).

**Result.** On the current pinned credential corpus, the Beta.11 candidate (product
`ec9224d9743066fe73d6e61e9843ef52bd853833`, re-bound from `8f97f14`) leaks no `must-redact` span at T1 or T2 under v4
(0/947 and 0/465). Every T1/T2 twin pair is discriminated (632/632 and 217/217). v4 false-alarm rates are 0/10 (T1),
1/1,673 (T2) and 4/1,158 (T3). The published `@redact-secret/core@0.1.0-beta.10` leaks 151/947 T1 spans, almost all of
them (150 misses) in the 24 #860 families that the release predates. It also misses the 25 relabelled #948 policy
spans, because it predates #948.

The unit diagnostics add what v4 cannot show:

- 13 `must-redact` spans that the candidate detects (10 T1 New Relic, 2 T2 Mailgun, 1 T2 Okta) stay readable in its
  actual `scanAndRedact` output, because their only action is `warn`. That is product policy
  ([redact-secret#936](https://github.com/redact-secret/redact-secret/issues/936)), not a detector miss.
- One relabelled #948 policy span (`detector-coverage--mailgun-api-key-short-body`, 14 bytes) is `warn` by the
  generic floors and also stays readable.
- The any-flag count of T2 family control files rises from 347 to 492. The 146 twins #948 now reports as
  `generic-token` are co-detections, never own-family, so v4's twin-scoped false-alarm count does not move.

Support status: candidate mode 88/110 stable, published mode 61/110.

All figures come from authored synthetic fixtures. None of them estimates a real-world
detection or false-alarm rate (see [Limitations](#limitations)).

## Identities

| | Published | Candidate |
| --- | --- | --- |
| Product | `@redact-secret/core@0.1.0-beta.10` (npm, package-lock SHA-256 `14dbaa9e…3939`) | `redact-secret` [`ec9224d9743066fe73d6e61e9843ef52bd853833`](https://github.com/redact-secret/redact-secret/commit/ec9224d9743066fe73d6e61e9843ef52bd853833), declared `0.1.0-beta.10`, built by product `npm run benchmark:candidate` |
| Artifacts (SHA-256) | npm registry | core `467111e288a3677e0e13d11f907a33e358a3161bfb1109f6115f80b16c33f74c`, node-darwin-arm64 `9ceabe011fb58b259fe79bc9b25a0ba3b96b6cfc028d9257844207aaf0a083d6`, wasm `c3f5478881e3cac1d038543a331e5d4b3c47bceb076ab71d99f2c43f8d2c7d78` |
| Benchmark revision | diagnostics `b3bdc50cbfd4e8dd2f981e3937efad1cbf182e7b`; classification `5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f` | suite run and classification `5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f` (the #948 relabel); diagnostics `b3bdc50cbfd4e8dd2f981e3937efad1cbf182e7b`; both on branch `beta11/rebind-ec9224d-credentials`, clean |
| Credential corpus | identity `e050384933a3fe0abc1d2aaad0d4fb9a61c3fed5d5f44cf575d495a0f19e811f`, 46 categories, 4,777 fixtures, pinned by `benchmarks/pin-manifest.json` | same |
| Candidate suite run | n/a | `589527ab-8df1-4ae7-a517-26f7567ffb3b`, complete 4,777/4,777, corpus `d88c19f7…3e2f`, `eval:validate` passed |
| Unit diagnostics (schema v1) | digest `868315e2574e55ada10d8e051064963e192d0111c9f96b9672980cc39b70db7f`, rows `56ea4c86…2175` | digest `e3fd073aa724b882d2e587818f7e0dcc31f17ff0e33da8b2f9d96a7f7c0b13b1`, rows `e319bdf7…8a5a` |
| Support classification | run `3cef0f0c-0b23-4612-9b69-13dde0e38501` (published mode, clean) | run `aced36e8-2bb6-434c-84a2-ef2a84444a22` (candidate mode, clean) |
| Fixture index / taxonomy | `085358df…c29e` / `86380e35…60dc` | same |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 (`npm run peers:provision`, checksum-verified `.peer-bin` first on `PATH`); snapshots refreshed for the changed corpus | same |
| Runtime | Node v22.16.0, darwin/arm64 | same |

Compared with the 8f97f14 report:

- **Fixture outcomes.** The only per-fixture changes in the full-suite candidate run are the 177 #948 fixtures and the
  one #993 twin. The per-family detail is in [`evidence/860/ec9224d/README.md`](../../../evidence/860/ec9224d/README.md).
- **Family records.** Every record in both classification modes is unchanged, except fixture counts where relabelled
  controls were not replaced, and generic-token's new policy positives.
- **v4.** Every v4 number is unchanged, except the `policy/T3` rows (25 more spans) and the T2 control denominator
  (1,689 → 1,673).
- **Published side.** Both modes were regenerated because the labels changed. Only the relabelled rows differ.

Diagnostics reports:
[published JSON](beta-11-unit-diagnostics-published-ec9224d.json) ·
[published Markdown](beta-11-unit-diagnostics-published-ec9224d.md) ·
[candidate JSON](beta-11-unit-diagnostics-candidate-ec9224d.json) ·
[candidate Markdown](beta-11-unit-diagnostics-candidate-ec9224d.md).
Both pass `npm run eval:diagnostics:validate`, which recomputes every row.

## v4 headline (authoritative, unchanged in meaning)

These are the [measurement v4](https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/docs/specs/measurement-v4.md)
numbers per kind × tier. Leaked-span rate is spans with any leaked byte over secret spans.
Leaked-byte rate is leaked bytes over secret bytes. Collateral ratio is out-of-envelope
bytes over secret bytes. False-alarm rate is flagged control files over control files,
with a twin scoped to its own family. Twin discrimination is pairs where the positive is
covered and the twin is clean, over pairs. There is no cross-tier total, no precision,
recall or F1, and no credential/PII mixing.

| Group | Mode | Leaked spans | Leaked-span rate | Leaked bytes | Leaked-byte rate | Collateral ratio | Twin discrimination |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `must-redact/T1` | published | 151 / 947 | 15.9% | 11,396 / 73,566 | 15.5% | 0 | 539 / 632 (85.3%) |
| `must-redact/T1` | candidate | 0 / 947 | 0% | 0 / 73,566 | 0% | 0 | 632 / 632 (100%) |
| `must-redact/T2` | published | 3 / 465 | 0.65% | 110 / 32,786 | 0.34% | 0 | 215 / 217 (99.1%) |
| `must-redact/T2` | candidate | 0 / 465 | 0% | 0 / 32,786 | 0% | 0 | 217 / 217 (100%) |
| `policy/T3` | published | 37 / 482 | 7.7% | 1,481 / 22,329 | 6.6% | 0 | 266 / 275 (96.7%) |
| `policy/T3` | candidate | 5 / 482 | 1.0% | 192 / 22,329 | 0.86% | 0 | 271 / 275 (98.5%) |

| Group | Mode | Flagged control files | False-alarm rate |
| --- | --- | ---: | ---: |
| `must-not-flag/T1` | published / candidate | 0 / 10 · 0 / 10 | 0% · 0% |
| `must-not-flag/T2` | published / candidate | 1 / 1,673 · 1 / 1,673 | 0.06% · 0.06% |
| `must-not-flag/T3` | published / candidate | 16 / 1,158 · 4 / 1,158 | 1.4% · 0.35% |

T0 (31 `must-redact`, 19 `must-not-flag` files) is unscored in both modes. The span and
byte counts are the `v4Reference` block of each diagnostics report, and generation checks
them against the diagnostics. The twin pairs come from the same unchanged v4
`aggregateGroups` over the same observations (see [Reproduce](#reproduce)). Of the 151
published T1 leaks, 150 are `MISS`es and 1 is `PARTIAL`, all in #860 arrival families
(Apify, Composio, Convex, Doppler, E2B, Firecrawl, Helicone, Inngest, 1Password,
PostHog, Resend, Trigger.dev, W&B) whose detectors ship after 0.1.0-beta.10. The 25 extra published `policy/T3` leaks
are the relabelled #948 spans, which 0.1.0-beta.10 misses because it predates #948. The candidate reports all 25
exactly, and its 5 policy leaks are the same 5 as at 8f97f14.

## Unit-safe diagnostics (#380): TP/TN/FP/FN with their units

The diagnostics follow the [unit-diagnostics spec](https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/docs/specs/unit-diagnostics.md).
They use two units that are never combined. There is no 2×2 matrix, and no precision,
recall, F1 or ranking. The validator rejects any report that contains them.

- **Secret-span unit** (`must-redact`, `policy`): one unit per authored secret span.
  - *Detection* is the v4 lattice over any finding of any action. EXACT or COVERED is
    the TP-like diagnostic; PARTIAL or MISS is the FN-like one.
  - *Sanitization* is verified on the product's actual `scanAndRedact` output. `removed`
    means no byte of the span survives. A `warn` finding is a detection, never a
    sanitization success.
  - Out-of-envelope findings on positive files are collateral, not true negatives.
- **File unit** (`must-not-flag`): one unit per control file. `clean` is the TN-like
  diagnostic. `flagged` is the FP-like one, split into `warn`/`allow` only versus
  `redact`/`block`.

Every row is `family`-scoped (a declared contract) unless it says `global untargeted`
or `uncontracted`. Global untargeted controls never share a denominator with family
controls. Neither run had a failure state: 0 scan errors, 0 unstable replays, 0
unverified outputs.

### Secret spans: detection and verified output

| Segment | Mode | Spans | Detected (EXACT+COVERED) | PARTIAL | MISS | Output removed | Output leaked: no finding | Output leaked: `warn`-only | Output partial leak | Output leaked bytes / secret bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| must-redact/T1, family | published | 947 | 796 | 1 | 150 | 781 | 150 | 15 | 1 | 12,746 / 73,566 |
| must-redact/T1, family | candidate | 947 | 947 | 0 | 0 | 937 | 0 | 10 | 0 | 400 / 73,566 |
| must-redact/T2, family | published | 465 | 462 | 0 | 3 | 457 | 3 | 5 | 0 | 298 / 32,786 |
| must-redact/T2, family | candidate | 465 | 465 | 0 | 0 | 462 | 0 | 3 | 0 | 114 / 32,786 |
| policy/T3, family | published | 438 | 401 | 0 | 37 | 355 | 37 | 46 | 0 | 3,261 / 20,815 |
| policy/T3, family | candidate | 438 | 433 | 0 | 5 | 392 | 5 | 41 | 0 | 1,770 / 20,815 |
| policy/T3, uncontracted | published | 44 | 44 | 0 | 0 | 40 | 0 | 4 | 0 | 48 / 1,514 |
| policy/T3, uncontracted | candidate | 44 | 44 | 0 | 0 | 40 | 0 | 4 | 0 | 48 / 1,514 |

- Every `redact`/`block` span was fully removed in both modes. No span had mixed actions.
  No positive file had an out-of-envelope finding or replaced output bytes outside its
  envelope, so output collateral is 0.
- Candidate `warn`-only leaks in `must-redact`: `new-relic-license-key` 10 (T1),
  `mailgun-api-key` 2 and `okta-api-token` 1 (T2). All sit under product-936
  (`policy-decision`).
- A leak can come from `warn` or from a miss, so output-verified leaks exceed the v4
  leaked spans. Candidate T1 has 0 v4 leaks and 10 output leaks.
- The one new candidate `warn`-only policy leak is the relabelled
  `detector-coverage--mailgun-api-key-short-body` (14 bytes, below the 16-byte redact floor of the #948 amendment).
- The candidate policy/T3 family segment has 50 spans whose whole plaintext still occurs
  somewhere in the output, 4 more than the 46 leaked in place. The extra 4 are removed in
  place, but the same value appears elsewhere in the file outside any authored span.

### Control files: clean vs flagged, split by action

| Segment | Mode | Files | Clean | Flagged, `warn` only | Flagged, `redact`/`block` | Flagged by own family or unattributed / other family only | v4 flagged (twin-scoped) |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| T1, family | published | 10 | 10 | 0 | 0 | 0 / 0 | 0 |
| T1, family | candidate | 10 | 10 | 0 | 0 | 0 / 0 | 0 |
| T2, family | published | 1,659 | 1,315 | 8 | 336 | 0 / 344 | 1 |
| T2, family | candidate | 1,659 | 1,167 | 4 | 488 | 0 / 492 | 1 |
| T2, global untargeted | published | 14 | 14 | 0 | 0 | n/a | 0 |
| T2, global untargeted | candidate | 14 | 14 | 0 | 0 | n/a | 0 |
| T3, family | published | 942 | 903 | 4 | 35 | 2 / 37 | 8 |
| T3, family | candidate | 942 | 909 | 0 | 33 | 0 / 33 | 2 |
| T3, global untargeted | published | 216 | 208 | 1 | 7 | n/a | 8 |
| T3, global untargeted | candidate | 216 | 214 | 2 | 0 | n/a | 2 |

- In the candidate, every flagged family control is flagged only by another known
  family, never by its own contract's detector. v4 reads a twin flagged that way as
  co-detection, so its false-alarm count (1 at T2, 2 at T3 family) is much lower than
  the any-flag count. Both readings are shown.
- The candidate T2 family any-flag count rose from 347 at 8f97f14 to 492. Of that, +146 are the #948 twins now
  reported as `generic-token` and −1 is the #993 Trigger.dev twin. The relabel moved 25 formerly clean files out of the
  segment and the nine clean `beta8-948` controls into it (1,675 − 25 + 9 = 1,659).
- The global untargeted T3 rows include #378's 120 `real-world-shapes` files. At the
  candidate, 6 of the 7 files that published beta.10 gates on (product-911,
  `generic-token` on secret references) are clean, and the seventh is `warn`-only. No
  untargeted file is gated.

### Published → candidate movement, per unit

Rows are matched by fixture across the two runs over the same corpus.

| Unit and segment | Improvements | Regressions |
| --- | --- | --- |
| Secret spans, must-redact T1 | 155 leaked → removed, 1 partial → removed | none |
| Secret spans, must-redact T2 | 5 leaked → removed | none |
| Secret spans, policy T3 | 37 leaked → removed (24 of them the relabelled #948 spans) | none |
| Control files, T2 family | 1 `redact` → clean (the #993 Trigger.dev public-key twin) | 149 clean → `redact` (all twins: the 3 of 8f97f14, Convex ×2 and Composio ×1, plus 146 #948 twins); 4 `warn` → `redact` (twins: Sentry ×3, Perplexity ×1) |
| Control files, T3 family | 3 `redact` → clean, 3 `warn` → clean | 1 `warn` → `redact` (Twilio context twin) |
| Control files, T3 global untargeted | 6 `redact` → clean, 1 `redact` → `warn` | none |

All 154 control regressions are twins flagged `redact` only by another family (co-detection; for the 146 #948 twins
that family is `generic-token`). None is an own-family false alarm, and v4's twin-scoped false-alarm count does not move
for any of them. The twin tally's co-detected pairs rise in candidate mode from 250 to 314 (T1), 73 to 136 (T2) and 54
to 72 (T3), while discrimination stays 632/632, 217/217 and 271/275.

- Besides the #948 twins, the clean → `redact` twins are the Convex 72- and 98-character body-length twins and
  one Composio twin, as at 8f97f14.
- The `warn` → `redact` escalations are three Sentry org-token twins and one Perplexity
  twin (T2), and one Twilio context twin (T3).
- No secret span regressed from removed to leaked. The relabelled `mailgun-api-key-short-body` span is leaked in both modes (a miss in the published package, a floor `warn` in the candidate), so it is not a movement.

## Acceptance

Past states are pinned to 40-hex permalinks. Living specs link `develop`.

### 1. Baseline and axis audit published without changing support statuses (#377)

Met in [#439](https://github.com/redact-secret/redact-secret-benchmarks/pull/439)
(merge `80a168b3`).

- The frozen baseline is
  [`beta-11-fixture-independence-baseline.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/80a168b39860068e98e3190119827148e147e834/docs/reports/2026-09-28/beta-11-fixture-independence-baseline.md)
  plus its [axis ledger](https://github.com/redact-secret/redact-secret-benchmarks/blob/80a168b39860068e98e3190119827148e147e834/docs/reports/2026-09-28/beta-11-family-axis-ledger.json),
  which selects 15 families and plans 230 files. It is rerunnable with
  `npm run audit:independence`.
- The before state was 61/23/2 stable/provisional/pending in published mode (beta.9)
  and 64/20/2 in candidate mode (`9ab0fa02`).
- The audit found:
  - 976 distinct values among 1,424 positives;
  - 857 raw axes, which fall to 778 once re-wraps of one value are merged;
  - 23 byte-identical clusters;
  - 333 positives that cite only peer rules;
  - 9 twins that change more than one property.
- No status, expectation, envelope, tier or profile floor changed.

### 2. Untargeted benign corpus enlarged and reported by action, with zero per-family credit (#378)

Met in #439.

- The corpus grew from 15 to 120 files: 20 per axis over six axes (config, logs,
  lockfiles/manifests, source, docs, agent output). All are `must-not-flag/T3`
  untargeted, authored before any scan, and never edited afterwards.
- A frozen 60-file baseline subset exists. Report:
  [`378-untargeted-benign-corpus.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/80a168b39860068e98e3190119827148e147e834/docs/reports/2026-09-28/378-untargeted-benign-corpus.md).
- At merge time, published beta.9 and candidate `9ab0fa02` each flagged 8/120 files
  (7 gating, 1 warn-only). The 7 gating files were recorded as product-911.
- Per-family `benignCases`, `benignAxes`, `benignFalseAlarms` and statuses did not move.
- Current state (tables above): published beta.10 gates on 7 of the 216 global
  untargeted T3 files and warns on 1. Candidate ec9224d gates on 0 and warns on 2, the same as 8f97f14 and 1db8ff3.

### 3. Selected families have independent positive and benign evidence plus reviewed one-property twins; improvements and regressions both visible (#379)

Met in [#442](https://github.com/redact-secret/redact-secret-benchmarks/pull/442)
(merge `ff8e620a`).

- **Evidence added.** Category `beta8-379` holds 202 authored fixtures for the 15 ledger
  families: 81 positives, 83 non-twin benign controls and 38 one-property twins. There
  are 26 recorded ledger revisions and per-case rationale in
  [`beta-11-family-evidence-cases.json`](https://github.com/redact-secret/redact-secret-benchmarks/blob/ff8e620a493f9bf7a282d36b1810c4816063f47d/docs/reports/2026-09-28/beta-11-family-evidence-cases.json).
  The independence audit was run
  [before](https://github.com/redact-secret/redact-secret-benchmarks/blob/ff8e620a493f9bf7a282d36b1810c4816063f47d/docs/reports/2026-09-28/beta-11-family-evidence-audit-before.json)
  and [after](https://github.com/redact-secret/redact-secret-benchmarks/blob/ff8e620a493f9bf7a282d36b1810c4816063f47d/docs/reports/2026-09-28/beta-11-family-evidence-audit-after.json).
- **Review queue.** All 345 review rows were triaged under existing classes, with 9
  left open with a basis.
- **Status changes, measured at beta.10 and `b0be64b`.** Stable went from 64 to 61, the
  same in both modes, and nothing was promoted.
  - `github-token`, `new-relic-license-key` and `aws-bedrock-long-term-api-key` dropped
    only while the new review rows were untriaged. They returned to stable after triage.
  - Regressions: `stripe-token`, `heroku-api-key-legacy` and `twilio-auth-token` became
    provisional on real new failures (placeholder false alarms and twin failures).
  - The new evidence also surfaced these failures: 3 T2 Mailchimp misses, 8 policy
    misses, 8 `warn`-only spans and 2 destructive placeholder false alarms. They were
    filed as redact-secret#931–#936.
- **Improvements.** redact-secret#931–#935 and #949 were fixed at 1db8ff3. The
  Mailchimp, Deepgram HTTPie, previous-line Heroku/Confluent/Twilio and
  `postgresql+psycopg` spans are now redacted, and the filler placeholders are silent.
  All of them were `verified` in
  [#454](https://github.com/redact-secret/redact-secret-benchmarks/pull/454) (rerun
  `009a85fa…`; product conformance from redact-secret#961), and product-911 in #457. At
  8f97f14 (run `74888ff3…`) and again at ec9224d (run `589527ab…`; product conformance
  from Artifact qualification run
  [36570726765](https://github.com/redact-secret/redact-secret/actions/runs/36570726765)) all seven records give the
  same outcomes and stay `verified`:
  [`evidence/931/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/364e418cf3e390bccc79de58fd45f80de4029e78/evidence/931/README.md)
  and its siblings.
- **Still open.** product-936 remains `policy-decision`. The LiteLLM `masked_` Cohere
  line stays unreported by product policy, and its expectation is unchanged. It is now
  its own `policy-decision` record, `product-932-masked-key-policy`
  ([#455](https://github.com/redact-secret/redact-secret-benchmarks/pull/455)).
- **Where movement shows now.** The published → candidate movement table above covers
  both directions at the current corpus.
- **The #948 contract change (this re-bind).** 177 `must-not-flag` fixtures read differently at ec9224d by design.
  [`2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f/docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md)
  records it:
  - 152 twins keep their scoped expectation;
  - 25 near-miss controls move to `policy`/T3 on `generic-token`, each with old → new and #948 cited;
  - nine replacement controls keep six families at their cells.

  Before the record, candidate mode read 55 stable. 22 families dropped only on unresolved differential rows from
  their twins' new `generic-token` findings, and 11 on near-miss controls turned benign false alarms. The per-family
  counts are in
  [`evidence/860/ec9224d/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/ddc5cd1629ea095a023f7f39cfd6f723b1ab2ed1/evidence/860/ec9224d/README.md).

### 4. Action-aware output and incremental parity tied to exact artifact identities (#380, #381)

Met.

- **#380 (#439).** Schema `unit-diagnostics-v1` and the `eval:diagnostics` runner
  (spec: [`unit-diagnostics.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/docs/specs/unit-diagnostics.md)).
  This report regenerates both modes on the current corpus. The identities are in the
  table at the top. The first #380 reports
  ([summary at 80a168b](https://github.com/redact-secret/redact-secret-benchmarks/blob/80a168b39860068e98e3190119827148e147e834/docs/reports/2026-09-28-beta11-380-unit-diagnostics.md))
  measured corpus `f06ddd6c…` and candidate `7720ae2a`. They are kept as history, and
  `--check` now reports them stale.
- **#381 (#452, merge `ef34e5c3`).** Evidence:
  [`evidence/860/381/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/ef34e5c3f557e1bfcc914da58ad9f7640fc67795/evidence/860/381/README.md).
  - Inputs: 10 mixed documents with 83 targets from 39 families.
  - Surfaces: Node addon, Node Wasm, browser Wasm, Python, Rust and CLI all agree on
    spans and sanitized bytes, in LF and CRLF.
  - Partitions and streams: every incremental partition and byte stream matches the
    whole-input result. The over-8-KiB-token document fails closed with
    `TOKEN_LIMIT_EXCEEDED`.
  - At 1db8ff3 (core `4681ad42…`, wasm `af063366…`, node `f08aab67…`), 70/71 `must-redact` and 11/12 `policy`
    targets are redacted exactly. The exceptions are the New Relic `warn` (#936) and the Cohere LiteLLM `masked_`
    line (#932 policy).
  - At 8f97f14 the outcomes equal 1db8ff3.
  - **Re-run at ec9224d** (core `467111e2…`, wasm `c3f54788…`, node `9edf22a5…`, wheel `3a720848…`, CLI
    `8e0bfe0f…`, harness `af180a5a`):
    [`evidence/860/381/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/ddc5cd1629ea095a023f7f39cfd6f723b1ab2ed1/evidence/860/381/README.md).
    Cross-surface, partition and stream divergences are 0 on all six surfaces. Only the declared token limit fails
    closed, with no leak before it. The outcomes equal 8f97f14: 70/71 and 11/12, with the same two exceptions.

### 5. New blind aggregate recorded under its independence label, outside public and regression totals (#382)

Met in [#453](https://github.com/redact-secret/redact-secret-benchmarks/pull/453)
(merge `3cd8d652`).

- Records: epoch `beta11-e1`, evidence class `custodian-blind`, procedural separation
  only (not organisational independence).
  [Report](https://github.com/redact-secret/redact-secret-benchmarks/blob/3cd8d6525d8d0b80195f896849b3efbd48ca2764/docs/reports/2026-09-28-beta11-142-blind-evaluation.md) ·
  [aggregate](https://github.com/redact-secret/redact-secret-benchmarks/blob/3cd8d6525d8d0b80195f896849b3efbd48ca2764/docs/reports/2026-09-28-beta11-142-blind-aggregate.json).
- Run identity: candidate 1db8ff3 (façade `4681ad42…`), commitment `a3afabcc…3db3b0`,
  84 fixtures, run `1604909b-…`, one freeze, one run, two replays.
- Results (Wilson 95% intervals):
  - leaked spans 3/66, 4.6% [1.6%, 12.5%], all complete misses (provider-beta11 2,
    provider-established 1);
  - false alarms 0/27 [0, 12.5%];
  - unstable 0/84.
- These numbers are **not** added to any table above, to public qualification or to
  support status. A product change made in response needs a new candidate identity and
  a new epoch.
- **Carried over to ec9224d, not re-measured.** By maintainer decision the `beta11-e1` aggregate is carried to the
  re-bound candidate without a new epoch, as it was to 8f97f14. This departs from the blind-evaluation spec's
  one-run-per-candidate rule. The private fixtures were not read or run.
  - **Basis:** a whole-input and incremental differential of the 1db8ff3, 8f97f14 and ec9224d builds over all 5,001
    public fixtures. 1db8ff3 and 8f97f14 give byte-identical digests. ec9224d differs on 178 fixtures, exactly the 177
    #948 fixtures and the one #993 twin, and on nothing outside those classes.
  - **Known difference:** #948 is a policy change the blind epoch did not measure. A blind near-miss control under a
    provider credential variable would read silent in the carried aggregate and reported at ec9224d.
  - Record:
    [`2026-09-29-beta11-142-blind-carry-over-ec9224d.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/de3d817857e723971d097a21a62f76bb6619d742/docs/reports/2026-09-29-beta11-142-blind-carry-over-ec9224d.md).

### 6. Final report states unit-labelled TP/TN/FP/FN diagnostics and retains the v4 headline; no unsupported real-world accuracy claim

Met by this report.

## Related Beta.11 outcomes

- **#860 family graduation.** [#434](https://github.com/redact-secret/redact-secret-benchmarks/issues/434)
  and [#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436) were
  graduated in #452 at 1db8ff3. Evidence at ec9224d:
  [`evidence/860/ec9224d/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/ddc5cd1629ea095a023f7f39cfd6f723b1ab2ed1/evidence/860/ec9224d/README.md).
  `eval:classify` ran at benchmarks `5b03068a` with the pinned peers (trufflehog 3.97.4,
  gitleaks 8.30.1) and the candidate tarballs above:
  - **Candidate mode (ec9224d):** 88/110 stable (documented 63, empirical 25), 20
    provisional, 2 pending. All 24 #860 families are documented-stable. The same families are stable as at 8f97f14.
  - **Published mode (0.1.0-beta.10):** 61/110 stable (documented 38, empirical 23), 47
    provisional, 2 pending. The 24 new families are provisional because the release
    predates their detectors.
  - **Against 8f97f14:** no family changed status or profile in either mode. The changes are the fixture counts of the
    eight families whose relabelled controls were not replaced, and generic-token, whose 25 new policy positives read
    68/68 exact in candidate mode and 25 misses in published mode (it stays provisional in both).
  - **With the labels unchanged** (benchmarks `af180a5`), candidate mode read 55/110 (documented 50, empirical 5).
- **Performance at ec9224d.** `performance-evaluation.yml` run
  [36578221354](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36578221354)
  concludes ACCEPTED against baseline 0.1.0-beta.8, with the size rows below applied as accepted tradeoffs. Latency
  (10 rows), initialization (10) and memory (16) are all within budget. Median processing ratios are 0.237–0.269 on
  the medium workloads and 0.223–0.839 on the small ones. Two earlier runs are kept with their roles in the evidence
  README:
  - 36570952406 ran before the size rows were accepted and also breached the browser-wasm small-whole initialization
    ratio (1.263).
  - 36577599714 breached that ratio alone (1.597).

  Paired 8f97f14 → ec9224d runs and A/A runs at 40 samples a side show no shift (pooled 0.992, A/A −4.7% to +2.7%).
  Against beta.8, however, both 8f97f14 and ec9224d sit at about 1.1–1.25 on that row, against 1.25 allowed. The
  12-sample official runs breach whenever their sample falls high, which happened in 2 of 3 runs at ec9224d and 1 of 2
  at 8f97f14. This is not recorded as an accepted tradeoff, and the thin headroom needs a maintainer decision. Reports:
  [`evidence/860/ec9224d-verified/`](https://github.com/redact-secret/redact-secret-benchmarks/tree/cbaf7e3ff3fc8cca308438389dc28ba1ccb6f0e1/evidence/860/ec9224d-verified).
- **Accepted size tradeoffs.** These rows are recorded in `benchmarks/accepted-regressions.json`
  for candidate ec9224d only. They carry the maintainer decisions of 2026-09-28 and 2026-09-29, plus the acceptance
  of the Beta.11 WASM and package growth with PR #994 shipping in Beta.11.

  | Trigger | At 8f97f14 | At ec9224d |
  | --- | ---: | ---: |
  | `size/wasm/full/gzip` | 184,422 | 187,248 (+1.5%) |
  | `size/wasm/common/gzip` | 125,295 | 127,661 (+1.9%) |
  | `size/browser-bundle/quickstart/gzip` | 191,801 fetched | 194,628 fetched (+1.5%) |
  | `size/npm/wasm/packed` | 887,249 | 917,465 (+3.4%) |
  | `size/npm/node-darwin-arm64/packed` | 635,892 | 655,692 (+3.1%) |
  | `size/node-addon/aarch64-apple-darwin` | 1,422,800 | 1,460,896 (+2.7%) |

  The base cause is the Beta.9–Beta.11 detector additions. Name-section stripping was rejected to keep debuggability.
  The increment over 8f97f14 is PR #994, whose only core source changes are `generic_token.rs`, `text.rs` (#948, #993)
  and `pii.rs` (#902).

## Limitations

- **No real-world claim.** Every fixture is independently authored synthetic text. The
  corpus is not a sample of production traffic, credentials or documents. No figure here
  estimates a real-world detection, leak or false-alarm rate, and none ranks
  redact-secret against another scanner. More fixtures are more chances to find a
  failure, not proof of accuracy.
- **Families.** Family rows cover declared contracts only. T3 rows measure this
  project's masking policy, not provider fact. T0 is unscored.
- **Twins.** Twin discrimination is bounded by the twins that have been authored (632
  T1 and 217 T2 pairs for 940 and 465 positive files). Un-probeable families are not in
  any twin rate.
- **Control-file readings.** The any-flag control count and v4's twin-scoped false
  alarm answer different questions, and both are shown. A large share of family control
  flags are co-detections by another family.
- **Output verification.** It uses one configuration: built-in policy, default
  detectors, default `<SECRET_n>` placeholder, Node runtime. Other bindings are covered
  only by the #381 parity set.
- **Blind epoch.** `beta11-e1` has procedural separation only. With 66 spans and 27
  controls its intervals are wide. It was measured at 1db8ff3 and is carried to ec9224d
  by maintainer decision, not re-measured. A blind fixture in one of the #990 layouts, or
  an off-grammar value under a provider credential variable (#948), could read
  differently at ec9224d.
- **Unmeasured targets.** Native addon, wheel and CLI size rows for targets other than
  darwin-arm64 were not measured at ec9224d.
- **#948 relabel.** The 25 relabelled controls now measure the generic policy, not provider
  discrimination; the twins and the nine `beta8-948` controls carry the discrimination.
- **Scope.** PII is a separate domain and is not measured here.

## Reproduce

```sh
npm ci && npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog --version → 3.97.4
# product worktree at ec9224d9743066fe73d6e61e9843ef52bd853833 (clean):
npm run benchmark:candidate -- --benchmark-ref 5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at b3bdc50c (clean); write outside the tree, then copy .json/.md in:
npm run eval:diagnostics -- --out=<scratch>/beta-11-unit-diagnostics-published
npm run eval:diagnostics -- --out=<scratch>/beta-11-unit-diagnostics-candidate \
  --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=ec9224d9743066fe73d6e61e9843ef52bd853833
npm run eval:diagnostics:validate -- <scratch>/beta-11-unit-diagnostics-{published,candidate}.json
npm run eval:classify -- --candidate-package=… --candidate-node-package=… --candidate-wasm-package=… \
  --candidate-source-commit=ec9224d9743066fe73d6e61e9843ef52bd853833 --output=<scratch>/support-status-candidate.json
npm run eval:classify -- --output=<scratch>/support-status-published.json
```

Twin discrimination is computed with the same pieces `eval:diagnostics` uses:
`loadPinnedCorpus`, `observeProduct`, `score` and the unchanged v4 `aggregateGroups`.
Group counts are summed per category, exactly as `v4Reference` sums spans. Its
`spans`/`leaked*`/`collateral*`/`flaggedFiles` output equals `v4Reference` in both
reports.

<details><summary>Twin tally script (run from the benchmarks root with <code>node --import tsx</code>; pass the three candidate tarballs for candidate mode)</summary>

```ts
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installCandidate, removeCandidate, piiFindingIdentity } from './scanners/candidate.mjs';
import { findingFamily } from './scanners/families.mjs';
import { aggregateGroups } from './benchmarks/lib/lattice.ts';
import { score } from './benchmarks/lib/scoring.ts';
import { observeProduct } from './benchmarks/lib/unit-diagnostics.ts';
import { loadPinnedCorpus } from './benchmarks/unit-diagnostics.ts';
const [, , core, node, wasm] = process.argv;
const { fixtures } = await loadPinnedCorpus();
const inst = core ? await installCandidate({ core, node, wasm }) : undefined;
const api = await import(inst ? pathToFileURL(path.join(inst.root, 'node_modules/@redact-secret/core/dist/index.js')).href : '@redact-secret/core');
await api.initialize();
const familyOf = (f) => (f.detector === 'pii-domain' && piiFindingIdentity(f.type)) || findingFamily('redact-secret', f.detector, f.type);
const out = {};
for (const category of new Set(fixtures.map(f => f.category))) {
  const complete = [], findings = [];
  for (const f of fixtures.filter(f => f.category === category)) {
    complete.push(f);
    if (f.assessment.tier === 'T0') continue;
    const o = observeProduct(api, f.content, f.expected.filter(e => e.role === 'secret'), familyOf);
    for (const x of o.findings) findings.push({ path: f.path, start: x.start, end: x.end, ...(x.family ? { family: x.family } : {}), action: x.action });
  }
  for (const [key, g] of Object.entries(aggregateGroups(score(complete, findings).rows))) {
    if (!g.twins) continue;
    const t = (out[key] ??= { positives: 0, pairs: 0, discriminated: 0, coDetected: 0 });
    t.positives += g.twins.positives; t.pairs += g.twins.pairs; t.discriminated += g.twins.discriminated; t.coDetected += g.twins.coDetected;
  }
}
console.log(out);
if (inst) await removeCandidate(inst);
```

</details>
