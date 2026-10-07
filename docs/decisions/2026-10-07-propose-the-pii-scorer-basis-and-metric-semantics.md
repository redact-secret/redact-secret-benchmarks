---
decision_id: decision-propose-the-pii-scorer-basis-and-metric-semantics
status: accepted
scope: benchmarks
title: Which scorer defines each PII metric value, how denominators and unresolved memberships are read, and how the two quantities are named
decided_at: 2026-10-07
accepted_on: 2026-10-06
accepted_by: Milo Kang (owner of redact-secret/redact-secret-benchmarks)
acceptance_source: https://github.com/redact-secret/redact-secret-benchmarks/issues/795#issuecomment-6028908779
---

# Which scorer defines each PII metric value, how denominators and unresolved memberships are read, and how the two quantities are named

**Status: accepted by the owner, Milo Kang, on 2026-10-06** (acceptance recorded on the issue: <https://github.com/redact-secret/redact-secret-benchmarks/issues/795#issuecomment-6028908779>; the owner's words there are "#795 수락, 승인" and "수락한다고 이미 했다 ... 구현 해라").
The proposal below was accepted as written. **Scope: the scorer, denominator and metric-label decision only.** The acceptance does not accept any official-run verdict, does not switch PII authority (it stays `legacy`, `benchmarks/pii-authority.json`), writes no `new.authorisation` and no `owner-accepted-verdict`, and touches no protected path.
No threshold, tolerance, membership, suppression or support verdict changes with it. Spec and numbers: [`docs/specs/pii-scorer-basis.md`](../specs/pii-scorer-basis.md), derived record `docs/generated/pii-scorer-basis.json`.

## Context

#795, part of #652; it unblocks the public and synthetic path of #666 and coordinates pii-eval #32, #796 and #665. The committed dual run reports 0 unexplained differences, but the benchmark scorer
(`b11ScoreTable`, owner: benchmarks) and `pii-v1` accounting (owner: pii-eval) use the same ten metric ids for different quantities. The clearest case: `pii-v1` `type-miss-rate` counts every authored valid-type occurrence
with no finding, including benign contexts correctly left unflagged (43/79 on oracle-plan), while the product scorer's `type-miss-rate` counts sensitive cases with no finding (0/36 on the same cells); `sensitive-miss-rate` and
`non-sensitive-flag-rate` have equal counts in every one of the 24 (population, family) cells; the three method-specific metrics are not applicable on converted `schema-only` populations; `measurable-share` is a case share in one
scorer and an axis-assertion share, unresolved included, in the other.

With pii-eval schema 1.4 (#32, ADR 0017 and 0018) all 1,188 memberships are carried: 1,032 located and 156 authored `not-established` with no range, reported `unresolved`. The 156 are a representation matter and are kept apart from the scorer definition.

## Decision (the proposal, accepted as written)

1. **Two named protocols, ten shared ids, distinct quantities.** `pii-v1:<id>` and `b11:<id>` are the quantity ids (`benchmarks/evaluation/domains/pii/metric-basis.mjs`), each with one name, one population, one numerator, one denominator and one owner.
   A consumer shows the quantity name. `pii-v1:type-miss-rate` is named "valid-type occurrence miss rate (generic, every context)"; `b11:type-miss-rate` is "sensitive case without any finding rate". Implemented additively (registry, Next rows, tests); no frozen data was renamed.
2. **Neutral measurement is separate from product projection.** pii-eval owns observations, accounting and replay. Benchmarks owns the population, which cases are scored, the product scorer, the consumer, thresholds, status and publication.
3. **Basis proposed for product qualification:** keep `b11` as the quantity every threshold and support status reads until `pii-v1` can measure the three method-specific metrics on these populations (they are not applicable today) and an owner records the switch; publish
   the `pii-v1` quantities beside it under their own names, never combined and never judged against `qualification/pii-v1.json` thresholds. `sensitive-miss-rate` and `non-sensitive-flag-rate` are the first candidates to read from `pii-v1`, since their counts equal `b11`'s.
4. **Unresolved memberships are carried, not coerced.** A not-established membership is neither valid nor invalid, never a pass or a fail, and is counted (`unresolvedRangeCases`) in every publication. The `b11` reading that counts authored not-established as benign
   in `benign-suppression-rate` is recorded (`coercesNotEstablished`) and left unchanged for verdict continuity; changing it is a separate reviewed policy decision.
5. **`measurable-share` denominator:** `pii-v1` now counts unresolved samples in its denominator (oracle-plan 148/190 before, 148/292 after). It is published as measured; no threshold is applied to it, because its value is now near the 0.5 policy threshold on one population and
   a threshold on it would be a policy change, not a migration.

## Consequences

- Product consumers cannot mistake a generic type miss for a sensitive miss: the numbers they could confuse are shown with distinct names, in the Next rows and, since the acceptance, in the published support matrix itself
  (`piiEvalMeasurement.quantityBasis` and a `quantity` label of the form `pii-v1:<id>` on every published metric, derived from the registry and refused when absent or different).
- Existing support verdicts are unchanged: nothing reads a `pii-v1` number for a verdict; the matrix says so (`quantityBasis.verdictReads: "b11"`, `thresholdsApplied: false`).
- Implemented as accepted: the benchmark-side projection (registry, published labels, Next rows, tests) with parity evidence regenerated against the retained oracle (`scripts/run-pii-population-dual-run.mjs --check`: 0 unexplained differences, recorded dual run equal).
  Criterion `scorer-basis-decided` of #666 is recorded in `benchmarks/pii-authority.json` as met on this decision only.
- If the owner later chooses `pii-v1` for a metric, that is a policy change with its own measured evidence and review, not a migration step.

## Not decided here

PII authority (#666), `new.authorisation`, `owner-accepted-verdict`, any threshold, the verdict of the official run (#796; the run is evidence, its acceptance is the owner's), protected-path items (custodian #71 and #72, ledger).
