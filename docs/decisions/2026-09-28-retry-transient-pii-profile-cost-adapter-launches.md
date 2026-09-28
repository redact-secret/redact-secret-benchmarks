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
from a clean one. When every attempt for a cell is exhausted, the thrown
error also carries the last attempt's exit code, signal, and truncated
stdout/stderr, so a still-failing cell is diagnosable from the workflow log
directly rather than only as a bare surface name. `benchmarks/evaluation/domains/pii/profile-cost.ts` and
`scripts/freeze-pii-profile-cost-thresholds.mjs` require the field and reject
a negative or non-integer count.

This amends the implementation freeze: `benchmarks/evaluation/domains/pii/profile-cost.ts`,
`scripts/measure-pii-profile-cost.mjs`, `scripts/freeze-pii-profile-cost-thresholds.mjs`,
and `tests/pii-profile-cost.test.mjs` are re-hashed in
`implementationFreeze.files`, and the plan's `contentCommitment` is
recomputed. No prior official measurement exists to invalidate — all six
prior dispatches failed before producing a usable report — so this amendment
carries no historical-evidence risk.

## Root cause found

The added diagnostic detail (above) surfaced the real cause on the very next
dispatch: `scripts/pii-profile-cost/cli-sample.mjs`'s `run()` writes to the
spawned `redact-secret` binary's stdin via `child.stdin.end(payload)` with no
`'error'` listener on that stream. `--print-pii-activation` is documented and
tested (in the product repo) to exit without reading stdin at all. When the
child closes its end of the pipe before the parent's write lands — a timing
race, more likely to land under CI's scheduling jitter after 20+ minutes of
sustained subprocess churn than on a quiet machine — the write raises `EPIPE`
as an unhandled `'error'` event on the stream, which crashes the whole
adapter process. This is orthogonal to `transientRetryLimit`: retrying the
identical write hits the identical race whenever timing conditions still
hold, which is exactly why all three retries failed identically instead of
one succeeding.

Fixed by adding `child.stdin.on('error', () => {})` before the write.
`EPIPE` here says nothing about the sample's outcome — the child's own exit
code, signal, and stderr (checked immediately after) remain the only
determinant of success — so swallowing it changes no correctness check, only
stops a harmless pipe-close race from crashing the process. Re-hashes
`scripts/pii-profile-cost/cli-sample.mjs`; plan `contentCommitment`
recomputed again.

## A second, unrelated dormant bug

The EPIPE fix cleared all three official `phase=aa` runs and the threshold
freeze on the first try. `phase=candidate` had never executed successfully
before (every prior attempt died in `aa` first) and immediately hit a
different, unrelated bug on its very first real run: "Download the
pre-frozen thresholds" calls `gh run download` with no `-R` and no
`working-directory`, in a job whose checkout puts the repository at
`benchmarks/`, not workspace root — so `gh`'s git-based repository
auto-detection fails with `fatal: not a git repository`. Fixed by passing
`-R "$GITHUB_REPOSITORY"` explicitly, matching the pattern the same file
already uses for its product-repo artifact downloads. Re-hashes
`.github/workflows/pii-profile-cost.yml`; plan `contentCommitment`
recomputed again.

## Consequences

A single flaky launch no longer discards an otherwise-complete run. A
persistently broken adapter (every attempt failing) still fails the run
after 3 attempts per cell, so this cannot mask a real regression as a
"transient" retry away. The retry count is public evidence on every
observation, so a run that needed retries is visibly different from one that
did not.
