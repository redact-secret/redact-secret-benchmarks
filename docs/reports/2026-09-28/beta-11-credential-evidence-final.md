# Beta.11 credential validation evidence: final report (#376)

> **Superseded** by [`../2026-09-29/beta-11-credential-evidence-final.md`](../2026-09-29/beta-11-credential-evidence-final.md):
> the Beta.11 candidate was re-bound from `1db8ff3` to product main `8f97f14`. This report stays as history.

Epic: [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376).
Children [#377](https://github.com/redact-secret/redact-secret-benchmarks/issues/377)–[#382](https://github.com/redact-secret/redact-secret-benchmarks/issues/382)
merged through PRs [#439](https://github.com/redact-secret/redact-secret-benchmarks/pull/439),
[#442](https://github.com/redact-secret/redact-secret-benchmarks/pull/442),
[#452](https://github.com/redact-secret/redact-secret-benchmarks/pull/452),
[#453](https://github.com/redact-secret/redact-secret-benchmarks/pull/453) and
[#454](https://github.com/redact-secret/redact-secret-benchmarks/pull/454).
Machine-readable summary: [`beta-11-credential-evidence-final.json`](beta-11-credential-evidence-final.json).

**Result.** On the current pinned credential corpus, the frozen Beta.11 candidate
(product `1db8ff38b16e50c51229eb27025452952bf621e1`) leaks no `must-redact` span at T1
or T2 under v4 (0/947 and 0/465). Every T1/T2 twin pair is discriminated (632/632 and
217/217). v4 false-alarm rates are 0/10 (T1), 1/1,689 (T2) and 4/1,158 (T3). The
published `@redact-secret/core@0.1.0-beta.10` leaks 151/947 T1 spans. Almost all of
those (150 misses) are in the 24 #860 families that the release predates. The unit
diagnostics add what v4 cannot show: 13 `must-redact` spans that the candidate detects
(10 T1 New Relic, 2 T2 Mailgun, 1 T2 Okta) stay readable in its actual `scanAndRedact`
output, because their only action is `warn`. That is product policy
([redact-secret#936](https://github.com/redact-secret/redact-secret/issues/936)), not a
detector miss. Support status: candidate mode 88/110 stable, published mode 61/110.

All figures come from authored synthetic fixtures. None of them estimates a real-world
detection or false-alarm rate (see [Limitations](#limitations)).

## Identities

| | Published | Candidate |
| --- | --- | --- |
| Product | `@redact-secret/core@0.1.0-beta.10` (npm, package-lock SHA-256 `14dbaa9e…3939`) | `redact-secret` [`1db8ff38b16e50c51229eb27025452952bf621e1`](https://github.com/redact-secret/redact-secret/commit/1db8ff38b16e50c51229eb27025452952bf621e1), declared `0.1.0-beta.10`, built by product `npm run benchmark:candidate` |
| Artifacts (SHA-256) | npm registry | core `4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1`, node-darwin-arm64 `02ef4f972317cce7cf161c07a3167f126c78d4b1ceb1074d8785d4ffe71988d7`, wasm `af0633663d713456a82d297f23023280cff05ad5f56489e9e72854601af2b1a1` |
| Benchmark revision | `25ccd99f07faaa0f045e212690a16750af96e78e` (develop after #454), clean | same |
| Credential corpus | identity `36b63ce823c38b1ae6651970c29fff2b2ec32d803f4d04f4d05746a8dfc061f5`, 45 categories, 4,768 fixtures, pinned by `benchmarks/pin-manifest.json` @ `9353089e` | same |
| Candidate suite run | n/a | `d403241f-6c75-4448-ba95-b722c8e069e2`, complete 4,768/4,768, corpus `a89a8d11…6d75`, `eval:validate` passed |
| Unit diagnostics (schema v1) | digest `6c4e0a4d3121156cf4ecb1c38bc83570487739940be1d6df7696e62426fb27c2`, rows `0001ee4b…5594` | digest `cea56b870de969cdc69d17feb8380126ee75a8258244de04cd15490bff7bd009`, rows `c5b6c63f…fdf3` |
| Support classification | run ``1a0cc5ba-1cb9-4191-a05a-62baf4bc1c43` (published mode, clean)` | run ``44874893-9dab-428b-b21d-e16585bed1c3` (candidate mode, clean)` |
| Fixture index / taxonomy | `e893fa62…220c` / `86380e35…60dc` | same |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 (`npm run peers:provision`, checksum-verified `.peer-bin` first on `PATH`) | same |
| Runtime | Node v22.16.0, darwin/arm64 | same |

Measurements ran at `25ccd99f`. Develop then merged
[#455](https://github.com/redact-secret/redact-secret-benchmarks/pull/455), which splits
a known-gap record. It changes no corpus, pin or scorer, so the corpus identity above
still holds.

The core and wasm tarballs are byte-identical to the 1db8ff3 build used by
[#453](https://github.com/redact-secret/redact-secret-benchmarks/pull/453) and
[#454](https://github.com/redact-secret/redact-secret-benchmarks/pull/454). The
node-darwin-arm64 tarball differs, as it did between earlier builds of the same commit:
the native addon build is not bit-reproducible. The core façade SHA-256 `4681ad42…` is
the candidate identity every Beta.11 record uses.

Diagnostics reports:
[published JSON](beta-11-unit-diagnostics-published.json) ·
[published Markdown](beta-11-unit-diagnostics-published.md) ·
[candidate JSON](beta-11-unit-diagnostics-candidate.json) ·
[candidate Markdown](beta-11-unit-diagnostics-candidate.md).
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
| `policy/T3` | published | 12 / 457 | 2.6% | 466 / 21,314 | 2.2% | 0 | 266 / 275 (96.7%) |
| `policy/T3` | candidate | 5 / 457 | 1.1% | 192 / 21,314 | 0.90% | 0 | 271 / 275 (98.5%) |

| Group | Mode | Flagged control files | False-alarm rate |
| --- | --- | ---: | ---: |
| `must-not-flag/T1` | published / candidate | 0 / 10 · 0 / 10 | 0% · 0% |
| `must-not-flag/T2` | published / candidate | 1 / 1,689 · 1 / 1,689 | 0.06% · 0.06% |
| `must-not-flag/T3` | published / candidate | 16 / 1,158 · 4 / 1,158 | 1.4% · 0.35% |

T0 (31 `must-redact`, 19 `must-not-flag` files) is unscored in both modes. The span and
byte counts are the `v4Reference` block of each diagnostics report, and generation checks
them against the diagnostics. The twin pairs come from the same unchanged v4
`aggregateGroups` over the same observations (see [Reproduce](#reproduce)). Of the 151
published T1 leaks, 150 are `MISS`es and 1 is `PARTIAL`, all in #860 arrival families
(Apify, Composio, Convex, Doppler, E2B, Firecrawl, Helicone, Inngest, 1Password,
PostHog, Resend, Trigger.dev, W&B) whose detectors ship after 0.1.0-beta.10.

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
| policy/T3, family | published | 413 | 401 | 0 | 12 | 355 | 12 | 46 | 0 | 2,246 / 19,800 |
| policy/T3, family | candidate | 413 | 408 | 0 | 5 | 368 | 5 | 40 | 0 | 1,756 / 19,800 |
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
- The candidate policy/T3 family segment has 49 spans whose whole plaintext still occurs
  somewhere in the output, 4 more than the 45 leaked in place. The extra 4 are removed in
  place, but the same value appears elsewhere in the file outside any authored span.

### Control files: clean vs flagged, split by action

| Segment | Mode | Files | Clean | Flagged, `warn` only | Flagged, `redact`/`block` | Flagged by own family or unattributed / other family only | v4 flagged (twin-scoped) |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| T1, family | published | 10 | 10 | 0 | 0 | 0 / 0 | 0 |
| T1, family | candidate | 10 | 10 | 0 | 0 | 0 / 0 | 0 |
| T2, family | published | 1,675 | 1,331 | 8 | 336 | 0 / 344 | 1 |
| T2, family | candidate | 1,675 | 1,328 | 4 | 343 | 0 / 347 | 1 |
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
| Secret spans, policy T3 | 13 leaked → removed | none |
| Control files, T2 family | none | 3 clean → `redact` (twins: Convex ×2 in `beta8-436a`, Composio ×1 in `beta8-434g`); 4 `warn` → `redact` (twins: Sentry ×3, Perplexity ×1) |
| Control files, T3 family | 3 `redact` → clean, 3 `warn` → clean | 1 `warn` → `redact` (Twilio context twin) |
| Control files, T3 global untargeted | 6 `redact` → clean, 1 `redact` → `warn` | none |

All eight control regressions are twins flagged `redact` only by another family
(co-detection). None is an own-family false alarm, and v4's twin-scoped false-alarm
count does not move for any of them.

- The 3 clean → `redact` twins are the Convex 72- and 98-character body-length twins and
  one Composio twin.
- The `warn` → `redact` escalations are three Sentry org-token twins and one Perplexity
  twin (T2), and one Twilio context twin (T3).
- No secret span regressed from removed to leaked.

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
  untargeted T3 files and warns on 1. Candidate 1db8ff3 gates on 0 and warns on 2.

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
  `009a85fa…`; product conformance from redact-secret#961).
- **Still open.** product-936 remains `policy-decision`. The LiteLLM `masked_` Cohere
  line stays unreported by product policy, and its expectation is unchanged. It is now
  its own `policy-decision` record, `product-932-masked-key-policy`
  ([#455](https://github.com/redact-secret/redact-secret-benchmarks/pull/455)).
- **Where movement shows now.** The published → candidate movement table above covers
  both directions at the current corpus.

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
  - At 1db8ff3 (core `4681ad42…`, wasm `af063366…`, node `f08aab67…`, plus wheel and
    CLI hashes in the README), 70/71 `must-redact` and 11/12 `policy` targets are
    redacted exactly. The exceptions are the New Relic `warn` (#936) and the Cohere
    LiteLLM `masked_` line (#932 policy).

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

### 6. Final report states unit-labelled TP/TN/FP/FN diagnostics and retains the v4 headline; no unsupported real-world accuracy claim

Met by this report.

## Related Beta.11 outcomes

- **#860 family graduation.** [#434](https://github.com/redact-secret/redact-secret-benchmarks/issues/434)
  and [#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436) were
  graduated in #452. Evidence:
  [`evidence/860/1db8ff3/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/ef34e5c3f557e1bfcc914da58ad9f7640fc67795/evidence/860/1db8ff3/README.md).
  `eval:classify` was re-run for this report at benchmarks `25ccd99f`, with the pinned
  peers and the candidate tarballs above:
  - **Candidate mode (1db8ff3):** 88/110 stable (documented 63, empirical 25), 20
    provisional, 2 pending. All 24 #860 families are documented-stable.
  - **Published mode (0.1.0-beta.10):** 61/110 stable (documented 38, empirical 23), 47
    provisional, 2 pending. The 24 new families are provisional because the release
    predates their detectors.
  - Both counts match the #452 evidence exactly.
- **Performance at 1db8ff3.** `performance-evaluation.yml` run
  [36480959728](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36480959728)
  is ACCEPTED against baseline 0.1.0-beta.8. Latency (10 rows), initialization (10) and
  memory (16) are all within budget. Reports:
  [`evidence/860/1db8ff3-verified/`](https://github.com/redact-secret/redact-secret-benchmarks/tree/ef34e5c3f557e1bfcc914da58ad9f7640fc67795/evidence/860/1db8ff3-verified).
- **Accepted size tradeoffs.** These are maintainer decisions of 2026-09-28 for
  candidate 1db8ff3 only, recorded in `benchmarks/accepted-regressions.json`.

  | Trigger | Measured |
  | --- | ---: |
  | `size/wasm/full/gzip` | 179,388 |
  | `size/wasm/common/gzip` | 122,544 |
  | `size/browser-bundle/quickstart/gzip` | 186,761 fetched |
  | `size/npm/wasm/packed` | 871,030 |
  | `size/npm/node-darwin-arm64/packed` | 629,779 |
  | `size/node-addon/aarch64-apple-darwin` | 1,421,552 |

  The cause is the Beta.9–Beta.11 detector additions. Name-section stripping was
  rejected to keep debuggability.

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
  controls its intervals are wide.
- **Stale record.** product-911 is still recorded as `observed` in
  `benchmarks/known-gaps.json`, although redact-secret#911 is closed and the candidate
  no longer gates on those files. Its lifecycle update belongs to a separate known-gap
  change, and this report does not touch it.
- **Unmeasured targets.** Native addon, wheel and CLI size rows for targets other than
  darwin-arm64 were not measured at 1db8ff3.
- **Scope.** PII is a separate domain and is not measured here.

## Reproduce

```sh
npm ci && npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog --version → 3.97.4
# product worktree at 1db8ff38b16e50c51229eb27025452952bf621e1 (clean):
npm run benchmark:candidate -- --benchmark-ref 25ccd99f07faaa0f045e212690a16750af96e78e \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at 25ccd99f (clean); write outside the tree, then copy .json/.md in:
npm run eval:diagnostics -- --out=<scratch>/beta-11-unit-diagnostics-published
npm run eval:diagnostics -- --out=<scratch>/beta-11-unit-diagnostics-candidate \
  --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=1db8ff38b16e50c51229eb27025452952bf621e1
npm run eval:diagnostics:validate -- <scratch>/beta-11-unit-diagnostics-{published,candidate}.json
npm run eval:classify -- --candidate-package=… --candidate-node-package=… --candidate-wasm-package=… \
  --candidate-source-commit=1db8ff38b16e50c51229eb27025452952bf621e1 --output=<scratch>/support-status-candidate.json
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
    const t = (out[key] ??= { pairs: 0, discriminated: 0 });
    t.pairs += g.twins.pairs; t.discriminated += g.twins.discriminated;
  }
}
console.log(out);
if (inst) await removeCandidate(inst);
```

</details>
