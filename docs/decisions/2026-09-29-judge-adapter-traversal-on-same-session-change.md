---
decision_id: decision-judge-adapter-traversal-on-same-session-change
status: accepted
scope: benchmarks
title: Judge adapter traversal on the harness's same-session change, and budget adapter allocation
decided_at: 2026-09-30
---

# Judge adapter traversal on the harness's same-session change, and budget adapter allocation

Status: **accepted** (2026-09-30, #472). Proposed 2026-09-29; accepted under the repository's decide-don't-defer policy with the refinements marked below.

## Context

[#472](https://github.com/redact-secret/redact-secret-benchmarks/issues/472)
consumes `redact-secret-adapters/overhead-v2`
([redact-secret-adapters#97](https://github.com/redact-secret/redact-secret-adapters/issues/97)).
The adapter harness can now time the previous adapter release against the
current build in one process (`--baseline`). The two builds' modes are
interleaved per repetition, and the host and the core are shared. The result
records a `change` per value. That is the adapter analogue of the same-job
paired ratio that
[#303](2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md) adopted
for core timing, and for the same reason: the machine cancels out.

v2 also records per-mode single-event latency (median, p95, p99) and
allocation (JavaScript: bytes per event from `v8.GCProfiler`; Python:
tracemalloc peak).

A first A/A run, the current build against a copy of itself
([results](https://github.com/redact-secret/redact-secret-adapters/issues/97#issuecomment-5891144222);
one run, Docker on Apple silicon, 25 host × workload rows), gave these
|relative change| values:

| Value | median | p95 | max |
| --- | --- | --- | --- |
| scanner calls per event | 0% | 0% | 0% |
| Python peak bytes | 0% | 0% | 0% |
| JS allocated bytes per event (adapter-core) | 2.2% | 9.1% | 9.1% |
| adapterOverhead | 2.7% | 8.3% | 20.9% |
| traversal | 5.7% | 34.1% | 58.5% |
| adapter-core p95 latency | 6.2% | 19.8% | 38.0% |
| adapter-core p99 latency | 12.9% | 65.3% | 134.2% |

JavaScript traversal is a few microseconds per event and moved by up to about
3 µs in absolute terms. Python traversal stayed within 8.4%.

## Options

1. **Keep judging traversal against the frozen snapshot only.** This needs
   no change, but it inherits machine drift between the snapshot and the
   candidate, which #303 found up to 45% for core timing on hosted runners.
2. **Judge traversal on the same-session `change`, and keep the snapshot for
   reporting.** The machine cancels out. The previous release has to be
   installable, which it is for every published adapter.
3. **Budget the single-run p99 as a tail trigger.** The A/A spread (max 134%)
   would force thresholds too wide to catch anything.

## Decision

Option 2 is adopted:

- Adapter traversal is judged on `change.traversal`: `relative` against
  `ceil5%(max(15%, 2 × A/A spread))`, with the absolute floor
  `max(0.5 µs, 3 × between-process SD)` unchanged. The A/A run moved JavaScript
  traversal by up to about 3 µs and 58% relative on microsecond-scale rows, so
  a single process is never judged: the verdict uses the median `change` over
  at least five processes per language, as the snapshot already does for
  absolute rows, and a row must breach both the relative threshold and the
  absolute floor. It applies only when
  `change.scannerCallsPerEvent.difference` is 0. A candidate whose scanner
  calls moved does different work, so its timing is not like-for-like, and the
  calls trigger already reports the change.
- A result with `baseline.comparable: false` is `invalid-measurement` for its
  traversal trigger.
- Allocation is budgeted like the `memory` dimension, as an absolute value per
  host × workload against the snapshot: JavaScript `allocatedBytesPerEvent`
  and Python `peakBytes` of `adapter-core`, at
  `ceil5%(max(10%, 2 × A/A spread))` with a 1 KiB floor.
- Adapter p95 latency is reported as a tail check in the #303 sense: a
  tail-only breach is `invalid-measurement`. p99 is reported, not budgeted.
- A row whose `scannerCallsPerEvent` differs between the two builds is
  reported as a work change and never as a timing regression, in either
  direction.
- Thresholds come from at least three A/A runs on the adapter profile, as for
  every other dimension. The single run above sets none of them.

## Consequences

- `metricsFromAdapterOverhead` gains paired-change and allocation metrics,
  and `deriveTriggers` gains the matching rules. Neither exists yet: this
  record fixes the rules first.
- The adapter baseline has to be promoted at the v2 workload digest before
  any v2 candidate can be judged, because the digest is part of the profile
  check.
- The limit-boundary workloads (`limit-*-over`) get traversal and allocation
  triggers like any other row, so a slower fail-closed path shows up as a
  regression.

## Re-baseline

The adapter-overhead baseline at the v2 workload digest (`eb6d56…`) is not
taken by this decision. It follows "Promoting a new baseline" in
`docs/specs/regression-budgets.md` (five harness processes per language, a
history record, ledger acceptances and at least three A/A runs), and the
budget rules above have to exist in `deriveTriggers` first, so that the new
rows are derived under the rules they will be judged by. Until then v2 output
is ingested by `metricsFromAdapterOverhead` and a candidate at the new digest
is `invalid-measurement` on the profile check.
