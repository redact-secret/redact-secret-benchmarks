---
decision_id: decision-introduce-reviewed-performance-regression-budgets
status: accepted
scope: benchmarks
title: Introduce reviewed performance-regression budgets derived from recorded variance
decided_at: 2026-09-25
---

# Introduce reviewed performance-regression budgets derived from recorded variance

## Context

[#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143),
part of [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138),
asks for regression budgets over the beta.8 operational baseline. They must
detect meaningful regressions while letting an explicit, reviewed tradeoff
through when detection or safety improves.

Until now this repository judged performance only in absolute terms.
[`performance-criteria.json`](../../benchmarks/performance-criteria.json)
([#136](https://github.com/redact-secret/redact-secret-benchmarks/issues/136),
[#150](https://github.com/redact-secret/redact-secret-benchmarks/issues/150))
sets ceilings at twice the observed p95 and is re-derived at every pin, so a
run can grow steadily and never fail it. Artifact sizes
([#141](https://github.com/redact-secret/redact-secret-benchmarks/issues/141))
carry no threshold at all. The adapters had no overhead evidence until
[redact-secret-adapters#11](https://github.com/redact-secret/redact-secret-adapters/issues/11)
supplied harnesses that separate host, adapter traversal, and core scan time.

The variance on record, detailed in
[`docs/reports/2026-09-25-beta9-143-regression-budgets.md`](../reports/2026-09-25-beta9-143-regression-budgets.md):

- **Eight committed Linux release-build runs.** Within-run p95/median
  dispersion reaches 52%, because with five samples the p95 is the slowest
  sample. Across commits, the detector-expansion releases moved latency by
  22–64% on every surface.
- **Same-artifact reruns of the published beta.8 packages**, run with core's
  own per-sample protocol. The median moved at most 3.8% between runs, and the
  p95 up to 21.9%.
- **Five processes per language of the adapter harnesses.** Median-based
  traversal moved at most 6.8% between processes (otel-js aside, at about
  1 µs). The core's own scan is 96–100% of an adapter's total cost.
- **Artifact sizes.** The only size variance on record is 16 bytes between
  two platforms' builds of one wasm. Release-to-release growth of the wasm and
  native packages from beta.5 to beta.8 was 4.0–10.3%.

## Decision

- **Budgets are change triggers against a frozen baseline, separate from the
  absolute acceptance criteria.** Each trigger resolves to one outcome:
  within budget, a regression, an accepted tradeoff, or an invalid measurement
  that must be rerun. The CLI exits 0, 1 or 2 and CI annotates a regression
  and an invalid measurement differently.
- **Five budgeted dimensions, never combined:** latency, initialization,
  memory, size, and adapter overhead. Detection is reported alongside and never
  budgeted, because it is the benefit side of a tradeoff.
- **Thresholds are derived, not picked**, by `deriveTriggers` in
  [`benchmarks/lib/regression-budgets.ts`](../../benchmarks/lib/regression-budgets.ts).
  The inputs are committed noise evidence under
  `benchmarks/regression-evidence/`, and `npm run performance:budgets:check`
  fails on drift. The per-dimension rules are in
  [`docs/specs/regression-budgets.md`](../specs/regression-budgets.md).
- **A p95 breach must be corroborated by the median.** Otherwise it is
  tail-only and returns `invalid-measurement`, never `regression`. This is what
  keeps a five-sample p95 from failing CI on one slow sample.
- **Size thresholds are policy anchored to release history (5%)**, with
  absolute floors, because size has no measurement noise. The default bundle
  (`full` wasm, quickstart bundle) and the optional `common` profile are
  separate triggers.
- **Adapter overhead is budgeted on what the adapter causes:** traversal,
  scanner calls per event, and scanned code units per event. The core's scan
  time is excluded, since it belongs to the latency dimension. The two counts
  are deterministic and trigger on any increase.
- **A breach never disappears through baseline replacement.**
  - Baselines are immutable, sha256-pinned snapshots of metric values with a
    promotion history.
  - A promotion is judged like any candidate against the baseline it replaces.
  - `npm run performance:budgets:check` fails unless every breach in a
    promotion has an accepted tradeoff for exactly that trigger, baseline, and
    commit.
- **Accepted tradeoffs live in an append-only ledger**,
  [`benchmarks/accepted-regressions.json`](../../benchmarks/accepted-regressions.json).
  Each entry must carry a rationale, a detection or safety benefit linked to a
  redact-secret issue or pull request, and the original measurement.
- **The beta.8 baseline is `0.1.0-beta.8`**, built from three sources: product
  source `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`, identical to the beta.8
  release commit except for version strings; performance run
  [36078460497](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36078460497)
  for timing and memory, and the #141 artifact inventory for sizes; and the
  adapter harnesses over the published `@redact-secret/core@0.1.0-beta.8`
  and `redact-secret==0.1.0b8`.
- **The threshold values ship as `reviewStatus: "proposed"`.** The repeat term
  of the latency noise was measured on one workstation, not on the official
  GitHub-hosted Linux runner. The values become `reviewed` after
  `performance-evaluation.yml` has been dispatched at least three times at one
  pin and the budgets re-derived with that runner-to-runner spread.

## Security boundary

All evidence here is timing, memory and size figures, plus workload
descriptors. Every workload is core's generator output or synthetic adapter
filler with one unmistakably synthetic token built at runtime. No evidence
file contains a matched value.

## Consequences

- `validate.yml` runs `npm run performance:budgets:check` on every push, and
  `performance-evaluation.yml` judges each fresh Linux run against the budgets
  after the acceptance criteria. Neither is a product release gate. This
  repository measures and records.
- A detector expansion that costs latency or size shows up as a `regression`
  until someone records the tradeoff and its detection benefit. The backtest
  shows that this would have happened for the beta.7 and beta.8 expansions,
  on every surface.
- Adapter budgets bind to the Apple M4 / Node 22 / CPython 3.14 host that
  measured them. A candidate from any other host is `invalid-measurement` until
  an official adapter profile is measured.
- A new baseline costs one snapshot, one history record, a derive, and a
  ledger entry for every breach it carries.
