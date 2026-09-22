---
decision_id: decision-tighten-evaluation-accounting-v1-1
status: accepted
scope: benchmarks
title: Tighten evaluation accounting (engine v1.1)
decided_at: 2026-09-19
---

# Tighten evaluation accounting (engine v1.1)

Extends: engine v1.0 qualification, measurement protocol v4

## Context

Measurement protocol v4 made the *definitions* strict: a per-span outcome
lattice, envelope-relative coverage, authored `(kind, tier)` classification,
and no cross-tier aggregation. Those definitions still hold and this record
does not reopen them.

What v4 did not fix is *accounting*. Reading the engine as it stands, several
paths let an observation that was never really made disappear from the
denominator rather than count against the result:

- `qualify.ts:53` computes `complete` from case count, generation errors and
  scanner status only. A run in which every assertion is `review-required`
  is still reported `execution-qualified`.
- `scoring.ts:92` returns T0 rows unscored and `lattice.ts:92` counts them as
  files only. No report states what share of the authored `must-redact`
  surface is currently unmeasurable.
- `assertions.ts:32` returns an empty assertion list for a scanner that is
  `unsupported`, `unavailable` or `error`, so that scanner contributes zero to
  every summary denominator in `summaries()` instead of contributing a gap.
- `lattice.ts:82` computes `positives` and never reads it, so the twin
  denominator that measurement-v4 §4 describes in prose ("twin discrimination
  is bounded by which twins have been authored") is never published as a
  number.
- `lattice.ts:71` `rate()` returns a point estimate for any non-zero
  denominator. A group with three spans reports a rate indistinguishable in
  form from a group with three hundred.
- `execution.ts` runs each scanner exactly once. Reproducibility is asserted
  over case construction, seeds and hashes, but never over the observation
  itself.

There is also a live inconsistency in how `OVERBROAD` is treated.
`assertions.ts:15` fails an absolute assertion on `OVERBROAD`, while
`lattice.ts:52` classifies it as not leaked and `lattice.ts:126` credits it as
a discriminated twin. The assertion layer and the aggregate layer disagree
about the same outcome.

None of this is a detector defect. It is the benchmark reporting better than
it knows.

## Decision

Engine v1.1 adopts one principle and derives its changes from it:

> **Anything unmeasured, unstable or unreviewed consumes denominator rather
> than disappearing from it. The published figure is the worst defensible
> bound, not the point estimate.**

Concretely:

1. **`review-required` stops being free.** Every group reports
   `resolved = pass + fail` against `total`, and `unresolved` is a first-class
   report field. Qualification gains a `resolvedRate` floor, configured in
   `qualification/suite-v1.json` so it is covered by `suiteHash`.
2. **T0 is reported, not omitted.** Every `must-redact` and `policy` group
   carries `measurableShare`. Below the configured floor the group publishes
   `insufficient-evidence` in place of a rate. T0 rows remain unscored — that
   part of v4 is correct — but their existence becomes visible next to the
   numbers they are absent from.
3. **`OVERBROAD` resolves toward the stricter layer.** The assertion layer
   wins: `OVERBROAD` is not a discriminated twin. `isLeaked` keeps its current
   meaning, because leakage and overbreadth are deliberately separate axes in
   v4 §2.4; what changes is that `isCovered` is no longer used as a proxy for
   "acceptable" in twin judgement.
4. **An unavailable scanner is a measured gap.** Non-complete scanners emit
   explicit `not-measured` assertion rows so they appear in summaries instead
   of vanishing.
5. **Twin coverage is published.** `twinCoverage = pairs / positives`, using
   the denominator already computed at `lattice.ts:82`. A discrimination rate
   is withheld while coverage is below the configured floor.
6. **Rates carry an interval.** Leak-direction rates publish a Wilson upper
   bound, coverage-direction rates a Wilson lower bound, alongside the point
   estimate and `n`. Comparison surfaces read the bound.
7. **Observations are replayed.** Each scanner runs `replays` times (default 2)
   over the same scratch tree. Disagreement across replays yields status
   `unstable`, which fails completeness — it is not a pass and not a flake.

## Explicitly out of scope for v1.1

- The outcome lattice itself (`EXACT`/`COVERED`/`OVERBROAD`/`PARTIAL`/`MISS`).
  Changing it means re-authoring corpus truth; that is a protocol v5 question.
- Envelope semantics. v1.1 only *reports* `envelopeWidth`, so a reader can see
  how much acceptance envelopes purchase (`lattice.ts:45` silently turns
  `OVERBROAD` into `COVERED` as an envelope widens). It does not change how
  envelopes are applied.
- Corpus content, tier assignment, and any new detector family.
- Any product claim. This repository measures and records; it does not assert
  product output. Tightening the engine does not authorize a support claim,
  and a number that gets worse under v1.1 is a measurement change until a
  dual-scorer diff says otherwise.

## Rollout

v4 phase 2 proved its mapping by asserting that every v4 outcome equalled its
v3 equivalent. v1.1 uses the same device in the opposite direction: the run
carries **both scorers**, and the report records the v1.0 figure, the v1.1
figure, and the delta per group. The delta is the evidence that a regression is
attributable to stricter accounting rather than to the candidate.

The dual-scorer output is a transitional artifact. It is removed once one
release has been qualified under v1.1 and the baselines have been regenerated.

Report compatibility is enforced rather than documented: a v1.1 report declares
its accounting version, and comparison against a v1.0 baseline is rejected at
schema level unless a declared mapping is present. This also resolves the
standing confusion between the integer `engineVersion: 2` written by
`execution.ts:79` and the string `engineVersion: '1.0.0'` written by
`qualify.ts:59` — v1.1 names the two concepts separately.

## Consequences

- Published figures will get worse on first adoption, in groups with small
  denominators, unresolved review queues, or absent twins. This is the intended
  outcome and the dual-scorer diff is the justification.
- Qualification becomes harder to pass for reasons that are not detector
  defects — an unreviewed differential queue can now block it. That is correct:
  an unreviewed disagreement is an unfinished measurement.
- Scan wall-clock roughly doubles from replay. Generation, hashing and corpus
  loading are unaffected.
- `lattice.ts` stays pure integer and closed-form arithmetic so the browser can
  keep re-verifying rows; Wilson bounds are rounded to a fixed precision
  declared in the suite so report bytes stay deterministic.
- The open questions below were deferred to review when this record was
  proposed; they are now decided.

## Review decisions (issue #26)

The floors were decided from a read-only dry run over the current corpus
(`npm run eval:dry-run`, recorded in
[`docs/reports/2026-09-19/evaluation-engine-v1.1-dry-run.md`](../reports/2026-09-19/evaluation-engine-v1.1-dry-run.md)),
not from the proposal. The dry run is a second scorer over rows an existing run
already produced; it enforces nothing and prints group keys and counts only.

- **`minDenominator: 5` stands.** Every group it withholds has `n ≤ 4`
  (per-suite `must-not-flag/T2` n=1, `must-not-flag/T3` n=2/2/4,
  `must-redact/T2` n=3, `must-redact/T1` n=4). At `n = 4` with zero events the
  Wilson upper bound is already 0.49: the bound says nothing, so the figure is
  withheld rather than printed. No corpus-wide group is affected.
- **`resolvedRateFloor: { default: 0.9, differential: 0 }`, held over scored
  strata.** The dry run shows `resolvedRate` is bimodal today — 1.000 on every
  T1–T3 stratum, 0.000 on every T0 stratum — so the value does not discriminate
  yet and the proposal is kept. What the dry run did decide is *scope*: T0
  strata are unresolved by construction and are already charged through
  `measurableShare` (decision 2) and the review ledger, so holding them to this
  floor as well would charge the same absence twice and make qualification
  impossible while any T0 row exists. The floor applies to scored strata, and a
  method that resolves nothing at all is reported as `<method>/*`. That keeps
  the headline guarantee — a run whose assertions are wholly `review-required`
  is `incomplete` with reason `unresolved-assertions`.
- **`measurableShareFloor: { default: 0.7, policy: 0 }`, down from 0.8.** A T0
  row has a candidate kind but no tier, so the 33 pending `must-redact` files
  are charged in full to *each* tier: `must-redact/T1` is 133/166 = 0.801 and
  `must-redact/T2` is 93/126 = 0.738, while the kind as a whole is 226/259 =
  0.873. At 0.8 the corpus-wide T2 rate of every scanner would be withheld
  because of that double charge, and T1 would sit 0.001 above the floor, one
  pending file from flipping. 0.7 on the double-charged per-tier figure is the
  equivalent of 0.8 on the kind. It still withholds where it should: the
  `detector-coverage` suite, which holds every pending file, is at 0.58 / 0.56
  and publishes `insufficient-evidence`.
- **`twinCoverageFloor: 0.5` stands.** Corpus-wide coverage is 0.286 (T1),
  0.194 (T2) and 0 (policy), so every corpus-wide `twins.rate` is withheld as
  `insufficient-coverage`; `common-formats`, the one suite twins were authored
  for (38/40 and 18/18), publishes. That is exactly the boundary ADR 2026-09-17
  drew in prose, now as a number. `twins.rate` additionally needs
  `pairs >= minDenominator`.
- **Floors gate on the point; publication reads the bound.** A floor compares
  `resolved / total`, `scored / (scored + pending)` and `pairs / positives`
  directly. Gating on the Wilson bound would make every floor a function of `n`
  and fail small, fully measured groups for being small twice.
- **`policy` faces the same `resolvedRate` floor and no `measurableShare`
  floor.** A policy expectation is this project's own masking policy: it can be
  unresolved like any other, but it has no provider evidence to be pending on
  (0 of 55 T0 files carry the `policy` kind). The share is still reported, and
  the floor is an explicit `policy: 0` in the suite rather than a code branch.
- **Replay disagreement fails the scanner for the run.** A scanner that is not
  a function of its input on one file gives no reason to trust it on the
  others, and quarantining one case would mean retaining per-case raw
  divergence. `unstable` discards all findings, records `divergentPaths`, and
  is never re-rolled. Re-running a whole qualification remains allowed.
- **The review ledger is a new `benchmarks/review-ledger.json`.** Promotion
  records describe a product gap travelling `observed → reviewed → promoted`
  with a product-issue handoff. A differential disagreement is never truth and
  has no such destination; filing it as a promotion record would push reviewers
  toward closing disagreements as findings. The engine never writes the ledger.
  It ships empty, so the first v1.1 qualification is `incomplete` with reason
  `unreviewed-queue` — the consequence this record predicted, and the honest
  state of a queue nobody has looked at.
- **`holdout` publishes no intervals.** It stays aggregate counts over resolved
  states. Its `caseCount` is already public, so a bound would add nothing a
  reader cannot compute, while a rate object per stratum would widen a strict,
  aggregate-only schema. The holdout schema gains the `unstable` scanner status
  and nothing else; unknown fields stay rejected.
- **Interval sample size.** A proportion's interval is drawn over independent
  observations, which is not always its arithmetic denominator:
  `leakedByteRate` is bytes over bytes, but bytes inside one span are not
  independent trials, so its interval uses `n = spans`.
- **`interval` as a delta cause.** The bound is an addition beside an unchanged
  point. The interval rule *moves* a figure only when it withholds one for
  `n < minDenominator`; that is what `accountingDelta.cause` records, and what
  makes the §9 no-op proof possible at realistic `n`.

### Ratified non-changes

Both are places where a later reader would plausibly "fix" an apparent
omission. They are deliberate.

- **`isLeaked` is unchanged.** Leakage and overbreadth are separate axes by
  construction (measurement-v4 §2.4, ADR 2026-09-17 decision 3): an overbroad
  finding genuinely does not leave the secret readable, and its cost is already
  charged as `collateralBytes`. Only twin discrimination moves to the strict
  `EXACT`/`COVERED` reading. `isCovered` is kept for the leak axis and documented
  as not an acceptability predicate; `aggregateGroups` is kept frozen as the
  v1.0 scorer for the dual-scorer transition.
- **`collateralRatio` gets no Wilson bound.** It is `collateralBytes /
  secretBytes`, unbounded above (ADR 2026-09-17 decision 2), so a binomial
  interval would be wrong. It reports `{ point, n }` with `bound: null` and
  `direction: null`. `meanFindingsPerFlagged` is the same kind of quantity and
  is treated the same way.

## Review decisions (issue #29)

Decision 5 shipped `twinCoverageFloor: 0.5` without a per-kind shape, and the
first full dry run showed every scored group below it: `must-redact/T1`
0.286, `must-redact/T2` 0.194, `policy/T3` 0.000 (all three withheld as
`insufficient-coverage`, recorded in
[the dry run](../reports/2026-09-19/evaluation-engine-v1.1-dry-run.md)). `policy/T3` is decided
first, deliberately, because reaching 0.5 there means authoring twins for 176
positives — by far the largest cost in scope — and that cost should not be
paid before deciding whether the axis applies.

- **`twinCoverageFloor: { default: 0.5, policy: 0 }`, `policy` exempt.** The
  same shape as the existing `measurableShareFloor: { default: 0.7, policy: 0
  }` exemption (decision 2, review above), and for the same underlying
  reason: `policy` is this project's own masking policy, not a provider
  format (measurement-v4 §2.6, §4). A twin mutates *one structural property
  of a documented or tool-corroborated shape* — prefix namespace, body
  length, alphabet, boundary character, public-vs-secret prefix
  (measurement-v4 §2.5) — and a `policy` span has no such shape to hold one
  property of constant while varying another; that vocabulary is defined
  against a format contract, which is exactly what T3 lacks by construction.
  Measurement-v4 §2.5 itself scopes twin authoring to "every T1/T2
  must-redact fixture" and never mentions `policy`. Twin coverage was never
  proposed to reach into `policy`, so this exemption formalizes an existing
  scope rather than loosening one.
  The counter-argument the issue raised — a policy expectation still has
  near misses a tool should not flag, so a twin might be meaningful there —
  is already measured by the axes `policy/T3` does carry: `leakedSpanRate`
  and `collateralRatio` on the policy group itself, and `falseAlarmRate` on
  the `must-not-flag` groups holding today's near-miss policy controls.
  Twin discrimination would not add information those axes lack; it would
  require inventing a structural-mutation vocabulary for a kind whose
  defining property is the absence of one.
  One implementation note for a future reader: because `accountGroups`
  returns `twins.rate: null` (not `insufficient-coverage`) whenever
  `twins.pairs` is zero (`lattice.ts`/`accounting.ts`, the `!twins.pairs`
  branch runs before the floor comparison), this exemption does not change
  `policy/T3`'s published figure today — it is still `null`, honestly
  reporting "no twins exist" rather than "insufficient coverage of a target
  that applies." The exemption matters for the future: if a `policy` twin is
  ever authored, it fixes what a partial `policy` twin count should mean
  (applicable-and-covered at any count ≥ 1, not held to the `must-redact`
  bar) rather than leaving the question to whichever author touches it next.
  176 `policy` twins were therefore not authored.
- **`must-redact/T1` and `must-redact/T2` twins authored to clear 0.5,
  spread across the suites the dry run showed as currently dark rather than
  concentrated in `common-formats`.** 33 new T1 twins: 17 in `context-edges`
  (every single-secret github-token context except the three multi-span
  ones), 12 in `credential-formats` (`ghp`/`gho`/`ghu`/`gitlab`, 3 samples
  each) and 4 in `token-contexts` (`env`/`json`/`unicode`/`crlf`) — all a
  github-token body one character shorter than the documented 36
  (`length: 35 vs contracted 36`), the same mutation `common-formats`
  already used for the family. 29 new T2 twins: 3 in `credential-formats`
  (`sendgrid`, final segment 42 vs 43), 15 in `detector-coverage`
  (`docker-token`, `linear-token`, `google-api-key`, `notion-token`,
  `atlassian-api-token`, one representative shape each across its three
  context variants, body one character short of its tool-corroborated
  length) and 11 in `sendgrid-regressions` (the `base62` variant across all
  ten contexts, plus `url-safe-bare`, final segment 42 vs 43). Every new
  twin is a `length` mutation chosen from the family's own contract
  (`benchmarks/lib/assessment.ts`), never from a scanner's output
  (measurement-v4 §6), and no real or plausibly live credential value
  appears anywhere in the corpus.
  Result, from the rerun dry run: `must-redact/T1` twin coverage is
  71/133 = 0.534 (pass) and `must-redact/T2` is 47/93 = 0.505 (pass); both
  now publish `twins.rate` with its Wilson bound and `n` instead of
  `insufficient-coverage`. These are v1.1-strict figures (`OVERBROAD` does
  not count as discriminated, decision 3) and are not compared against the
  pre-v1.1 point estimates in the original issue, per measurement-v4 §4 and
  the issue's own instruction: `redact-secret` 0.859 (T1, n 71) / 0.532
  (T2, n 47); `gitleaks` 0.465 (T1) / 0.489 (T2); `trufflehog` 0.915 (T1) /
  0.426 (T2); `flare-redact` 0.859 (T1) / 0.277 (T2). Full bounds and per-run
  detail are in the regenerated [dry run](../reports/2026-09-19/evaluation-engine-v1.1-dry-run.md).
  The target was the corpus-wide figure, not every per-suite one: two of the
  newly-twinned suites clear their own floor as a side effect
  (`context-edges` 17/20, `credential-formats`'s `github-token`/`gitlab-token`
  group 12/21), while `credential-formats`'s `sendgrid` group and all of
  `token-contexts` stay below `minDenominator` on twin pairs alone (3 and 4
  positives respectively — too few to reach `n ≥ 5` regardless of ratio, per
  decision 1's existing reasoning) and `sendgrid-regressions` stays below the
  0.5 ratio (11/30). Both remain visible as per-suite withholds in the dry
  run even though the corpus-wide `must-redact/T1` and `must-redact/T2`
  figures now publish; that is the same small-group behavior decision 1
  already accepted, not a new gap.
