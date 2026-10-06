---
decision_id: decision-record-a-control-copy-at-the-current-pins-for-the-candidate-diff
status: accepted
scope: benchmarks
title: Record a control copy at the current pins for the candidate diff
decided_at: 2026-10-07
---

# Record a control copy at the current pins for the candidate diff

## Context

#657. `qualification:candidate-diff` requires every difference between the candidate and the baseline to be the product build, so the baseline's methods configuration hash must equal the candidate's. The adoption's control replay (run 37469753365) was made on a transient branch before the acceptance repin and holds evaluation evidence `8213183b`; the pin of the acceptance is `1a3be8dd`. A candidate measured at the current pins therefore hashes differently on the methods run and the command refuses, correctly.

## Decision

1. The adoption record keeps its replay as recorded and gains `candidate.replay.replayCopy`: the same published `@redact-secret/core` 0.1.0-beta.13 on the same engine and snapshot, re-measured once at the current pins with `omit_optional=openredaction` (run 37546897867, archive release `official-runs-37546897867`, digest bound in the record). `scripts/candidate-control.mjs` already prefers `replayCopy` over the replay archive, so the candidate diff and the replay report read the copy and nothing else changes.
2. The plain populations of the copy have the same semantic digests as the earlier replay (public, regression, policy); only the methods run moved, by its evaluation evidence. The copy is a measurement, not an acceptance: it is not recorded in `runs[]`, owner acceptance and authority are untouched.
3. A candidate replay takes the scanner roster of the control it is compared with (`--omit-optional`, PR #801).

## Consequences

A later repin that moves the evaluation evidence again makes the copy stale for the same reason; the refusal names it and a new copy is one dispatch of `official-runs.yml` with `omit_optional=openredaction` (about 7 minutes).
