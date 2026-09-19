# Tighten evaluation accounting (engine v1.1)

Date: 2026-09-19 · Status: proposed · Extends: engine v1.0 qualification,
measurement protocol v4

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
- Three open questions are deferred to review, not decided here: the numeric
  floors, whether `policy` groups are held to the same `resolvedRate` floor as
  `must-redact`, and whether replay disagreement should quarantine the single
  unstable case or fail the whole run.
