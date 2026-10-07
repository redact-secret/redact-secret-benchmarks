---
decision_id: decision-apply-implementation-ready-only-on-the-core-issue
status: accepted
scope: benchmarks
title: Apply implementation-ready only on the core issue, by the core maintainer
decided_at: 2026-10-07
---

# Apply implementation-ready only on the core issue, by the core maintainer

## Context

[#810](https://github.com/redact-secret/redact-secret-benchmarks/issues/810) follows core epic
[redact-secret#999](https://github.com/redact-secret/redact-secret/issues/999). It amends
[`decision-define-benchmark-handoff-states`](2026-09-30-define-benchmark-handoff-states.md), which said a change to
the `implementation-ready` conditions is a new decision that amends it. Core now documents the same five words in
its [contract](https://github.com/redact-secret/redact-secret/blob/main/docs/contracts/contribution/implementation-ready-handoff.md).

## Decision

- `implementation-ready` means "core may code now". It is applied only on the core issue, by the core maintainer,
  in the adoption comment. Core implements detectors; this repository does not.
- The contract comes from the reviewed credential-evidence handoff and core's adoption ruling. A benchmarks dossier
  is a legacy source only where its documented consumer still needs it.
- Condition 5 (benchmark counterpart) stays: this repository names the corpus or fixture slice and evidence path
  that will measure the candidate. Benchmarks composes cases and uploads fixtures to the corpus.
- `verification-needed` (core reports, benchmarks moves its counterpart issue) and `complete` (benchmarks, by the
  evidence PR) are unchanged. `evaluation.owner` is `benchmarks-maintainer`.
- No gate, evidence rule, promotion rule, verdict or support-status rule changes.

## Consequences

- [`docs/specs/contribution-handoff-states.md`](../specs/contribution-handoff-states.md) links core's contract and
  both repositories describe the same five words and owners.
- The issue forms route a beginner to one entry per need; the research form is for legacy dossiers.
