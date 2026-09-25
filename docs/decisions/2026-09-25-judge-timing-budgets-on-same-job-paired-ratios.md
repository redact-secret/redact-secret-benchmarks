---
decision_id: decision-judge-timing-budgets-on-same-job-paired-ratios
status: accepted
scope: benchmarks
title: Judge timing regression budgets on same-job paired ratios
decided_at: 2026-09-25
---

# Judge timing regression budgets on same-job paired ratios

Amends [`2026-09-25-introduce-reviewed-performance-regression-budgets.md`](2026-09-25-introduce-reviewed-performance-regression-budgets.md)
for the latency and initialization dimensions and for the review condition.
The rest of that decision is unchanged: the decision model, the dimensions,
memory, size, adapter overhead, the ledger, and baseline immutability.

## Context

[#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143)
shipped timing budgets that compare a candidate's absolute p95 with a frozen
baseline snapshot from another job. It left them `proposed` until
`performance-evaluation.yml` had run at least three times at one pin and the
budgets were re-derived with that runner-to-runner spread.

Six such runs at `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c` are in
[`rerun-noise-linux-x64.json`](../../benchmarks/regression-evidence/rerun-noise-linux-x64.json).
Four agree within 6.4% on every processing median. The other two measured
about 22% and 45% faster on every surface and profile at once. The GitHub-hosted
runner's machine class varies between jobs. Re-deriving as written would put
every timing threshold near 185% and remove every timing verdict. Three runs
alone would have hidden the problem: the first three landed on the same
machine class.

[#303](https://github.com/redact-secret/redact-secret-benchmarks/issues/303)
records the choice: measure the baseline and the candidate in one job and
judge the ratio. The maintainer accepted that this roughly doubles CI
measurement time.

The paired evidence, detailed in
[`docs/reports/2026-09-25-beta9-303-paired-timing-budgets.md`](../reports/2026-09-25-beta9-303-paired-timing-budgets.md):

- **Six same-job A/A runs** (the baseline commit built twice and measured
  against itself), on four CPU models: AMD EPYC 7763, 9V74, 9V45, and Intel
  Xeon Platinum 8573C. The paired processing median ratio stayed within 2.6%
  of 1 on nine of ten rows. Browser small-whole reached 14.7%. The paired p95
  ratio, a ratio of two maxima of twelve samples, moved up to 45%.
- **Four historical revision pairs, each measured paired.** They re-judge
  what the #143 absolute backtest reported. The beta.7 step it read as +28% to
  +64% on every latency row is flat when paired (processing medians −16% to
  +3%): a machine-class shift, not a detector cost. The next step is a real
  +8% to +16%. The 9443419 → 079095e step that #143 read as a Node
  initialization regression alone also slowed processing by 17% to 38% on
  every row.

## Decision

- **Latency and initialization are judged on same-job paired ratios.**
  - `performance-evaluation.yml` builds the candidate and the budgets'
    baseline commit in one job. It measures both with core's own assessment
    in counterbalanced rounds (A B B A ...): six rounds of two fresh-process
    samples per side, on one runner.
  - The judged statistic is the candidate/baseline ratio of the medians.
  - The in-job baseline must be the budgets' baseline commit, or the verdict
    is `invalid-measurement`.
- **Thresholds come from same-job A/A noise.** Per row:
  - the median ratio threshold is `ceil5%(max(10%, 2 × largest A/A median
    ratio deviation))` for latency, and `ceil5%(max(25%, …))` for
    initialization;
  - the p95 ratio is a tail check at `ceil5%(max(15%, 2 × largest A/A p95
    ratio deviation))`, or 50% for initialization;
  - the 1 ms and 2 ms floors are scaled by the in-job baseline statistic.

  The floors are #143's median corroboration and p95 floors.
- **The median ratio decides; the p95 ratio routes tail-only changes to a
  rerun.** A p95 ratio breach with the median inside is
  `invalid-measurement`. #143 made p95 primary and corroborated it by the
  median. With paired data, the p95 of twelve samples is too noisy to be
  primary: it would need thresholds up to 95%.
- **Absolute timings across jobs are informational only.** They are reported
  against the snapshot and never produce a verdict.
- **Memory and size stay absolute.** The six-run study moved memory at most
  5.2%, inside every memory threshold and its 1 MiB floor. Sizes do not
  depend on the machine.
- **Every run records the runner's CPU model.** The paired evidence and the
  A/A study keep it next to run ids, URLs and artifact digests.
- **`reviewed` requires the A/A study.** `npm run performance:budgets:check`
  refuses `reviewStatus: "reviewed"` unless at least three same-job A/A runs
  of the current baseline commit, each with a recorded CPU model, are the
  timing noise source. With six A/A runs on four machine classes, and a
  backtest that separates real slowdowns from machine shifts, the budgets
  become `reviewed`.

## Security boundary

The evidence is timing figures, CPU model names, run identifiers and artifact
digests. No workload, matched value or credential is recorded.

## Consequences

- A timing verdict no longer depends on which machine class a job landed on.
  A candidate on a slower machine than the baseline's is not a regression.
- Each performance run builds core twice and takes about twice as long.
- A baseline promotion needs new A/A runs of the new baseline commit. Its
  timing against the previous baseline is judged by a paired run of the two
  commits, not from stored snapshots.
- The #143 report's timing backtest is superseded by the paired backtest.
  Its absolute figures stay as recorded.
