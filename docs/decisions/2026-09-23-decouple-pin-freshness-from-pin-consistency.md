---
decision_id: decision-decouple-pin-freshness-from-pin-consistency
status: accepted
scope: benchmarks
title: Decouple pin freshness from pin consistency
decided_at: 2026-09-23
---

# Decouple pin freshness from pin consistency

## Context

[Issue #185](https://github.com/redact-secret/redact-secret-benchmarks/issues/185):
every product merge that touches `crates/secret-scan-core/src/detectors` turns
the `pin-drift` job red on `main` and on every open PR until a re-pin and a
performance run land. The measured comparison of the four options is in
[`docs/reports/2026-09-23/pin-drift-detector-merges.md`](../reports/2026-09-23/pin-drift-detector-merges.md).

Detector changes are performance-relevant: a range of detector merges
(`datadog`, `mailgun`, `okta`, plus a small `policy.rs` change) halved
scale-logs throughput, and the fix was in `detectors/pattern.rs`
([`evidence/683/`](../../evidence/683/README.md)). Excluding `detectors/` from
the performance gate would have left the fix unverified.

## Decision

- Pin **consistency** (the pin files and `baseline` agree, #150) stays a
  required check on every push and pull request.
- Pin **freshness** (detectors changed in product `main` since the pin) is not
  required to merge. On a pull request it is an annotation unless that PR edits
  a pin file; on `main` and on a daily schedule it fails.
- Detector changes remain performance-relevant. A re-pin still needs an
  ACCEPTED `performance-evaluation.yml` run at the new pin; no path exclusion
  removes that.
- The re-pin PR and the evaluation dispatch are automated. A REJECTED run is
  never used to recalibrate.
- Thresholds are not re-derived from an ACCEPTED run made against unchanged
  criteria; that run advances a separate verified commit.
- `promotion:check` runs in its own job so a stale pin cannot hide it.

Implementation is tracked in the follow-up issues listed in the report.

## Documentation location

This record is the authority. `docs/specs/performance-acceptance.md` describes
the operational flow when the implementation lands. Not `AGENTS.md`, which is
the boundary rule and agent workflow.

## Consequences

- Unrelated PRs stop inheriting a stale-pin failure.
- A stale pin can sit on `main` up to the schedule interval.
- No change to scoring, gates, or ledger semantics.
