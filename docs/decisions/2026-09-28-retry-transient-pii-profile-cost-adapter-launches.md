---
decision_id: decision-retry-transient-pii-profile-cost-adapter-launches
status: accepted
scope: benchmarks
title: Retry a transient PII profile-cost adapter-launch failure instead of failing the whole run
decided_at: 2026-09-28
---

# Retry a transient PII profile-cost adapter-launch failure instead of failing the whole run

## Context

#286's frozen A/A measurement (`337279e2...`, #403) launches a fresh adapter
subprocess per sample: `sampleProtocol.minimumSamplesPerSide` (12) × 2 sides +
`warmupSamples` (2) per (surface, credential profile, PII profile, workload)
cell, across 6 surfaces × up to 2 credential profiles × 4 PII profiles × 2
workloads — several hundred to low-thousands of individual subprocess
launches in one job, with zero retry on a transient launch failure. Six
consecutive official `phase=aa` dispatches all failed, at a different surface
each time (`cli` four times, `chromium-wasm` twice), never the same one
twice. A local reproduction — the exact CI-qualified `cli` binary, the exact
unmodified adapter script, in a matching `ubuntu:24.04` container, including a
40-invocation stress loop — never failed once. redact-secret#883 (closed
2026-09-27, scope-only) separately documents that the product's CLI stdin
path already runs a per-line dispatch whose cost scales with detector count,
plausible cover for occasional slowness under the sustained subprocess load
this measurement itself creates. Nothing points to a defect in this
repository's own code; the failures are consistent with ordinary CI
transience compounding across a very large number of single-shot launches
with no tolerance for one bad one.

## Decision

Add `sampleProtocol.transientRetryLimit: 2` to the frozen plan
(`qualification/pii-profile-cost-v1.json`). `scripts/measure-pii-profile-cost.mjs`
retries a sample whose adapter subprocess exited non-zero or was killed by
signal, up to that limit (3 total attempts), before failing the cell. A
sample that completes but produces invalid output (`parseAdapterSample`
throwing) is never retried — that is a real defect, not a launch failure, and
must still fail closed immediately.

Every observation now carries `transientRetries`, the count actually consumed
for that cell, so a retried run is auditable rather than indistinguishable
from a clean one. `benchmarks/evaluation/domains/pii/profile-cost.ts` and
`scripts/freeze-pii-profile-cost-thresholds.mjs` require the field and reject
a negative or non-integer count.

This amends the implementation freeze: `benchmarks/evaluation/domains/pii/profile-cost.ts`,
`scripts/measure-pii-profile-cost.mjs`, `scripts/freeze-pii-profile-cost-thresholds.mjs`,
and `tests/pii-profile-cost.test.mjs` are re-hashed in
`implementationFreeze.files`, and the plan's `contentCommitment` is
recomputed. No prior official measurement exists to invalidate — all six
prior dispatches failed before producing a usable report — so this amendment
carries no historical-evidence risk.

## Consequences

A single flaky launch no longer discards an otherwise-complete run. A
persistently broken adapter (every attempt failing) still fails the run
after 3 attempts per cell, so this cannot mask a real regression as a
"transient" retry away. The retry count is public evidence on every
observation, so a run that needed retries is visibly different from one that
did not.
