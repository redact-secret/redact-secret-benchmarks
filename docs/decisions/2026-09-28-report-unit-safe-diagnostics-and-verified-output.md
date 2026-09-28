---
decision_id: decision-report-unit-safe-diagnostics-and-verified-output
status: proposed
scope: benchmarks
title: Report unit-safe TP/TN/FP/FN diagnostics and verify the actual sanitized output
decided_at: 2026-09-28
---

# Report unit-safe TP/TN/FP/FN diagnostics and verify the actual sanitized output

## Context

[#380](https://github.com/redact-secret/redact-secret-benchmarks/issues/380)
(parent [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376))
asks for inspectable true/false positive/negative diagnostics.
[Measurement protocol v4](2026-09-17-adopt-measurement-protocol-v4.md)
removed precision, recall and F1 because the corpus is not a representative
sample; bringing back a mixed 2×2 would undo that. Separately, v4 scores
finding *ranges*: a `warn` finding covering a secret is a detection, yet the
product's sanitized output still contains the secret. Nothing measured the
output itself.

## Decision (proposed)

1. Add a separate diagnostics report, schema `unit-diagnostics` v1
   ([spec](../specs/unit-diagnostics.md)), never folded into the v4 report or
   its baselines. v4 headline metrics and `baselines/*.json` are unchanged.
2. Count in two units that never combine: **secret spans** for `must-redact`
   and `policy` (v4 lattice detection, and separately sanitization of the
   actual output); **files** for `must-not-flag` (clean versus flagged, the
   flag split into `warn`/`allow`-only versus `redact`/`block`). Extra
   findings in a positive file are collateral, not true negatives. No
   precision, recall, F1, accuracy or ranking key may appear.
3. Verify the output, not the findings: run `scanAndRedact` (replayed),
   cross-check it against `redact(input, scan(input))`, and accept it only
   when it equals the input with exactly the `redact`/`block` findings
   replaced by the default placeholder. Anything else is a failure state,
   counted in the denominator and never as success. A `warn` is a detection,
   never a sanitization success.
4. Stratify by domain, kind/tier (policy/T3 apart from T1/T2), and scope
   (family strata apart from global untargeted controls); keep published and
   candidate runs in separate files.
5. Tie every report to the pinned corpus (`pin-manifest.json` hashes, one
   corpus identity), the product identity (lockfile hash, or candidate commit
   and artifact SHA-256s) and a content digest that reruns must reproduce.
   Invariants are enforced in code (`reportProblem`) and by the schema.

## Consequences

- A family whose product policy is `warn` reads as full v4 detection and as
  leaked in the output. That is the point: the two readings are different
  questions, and both are shown.
- The report grows with the corpus; adding fixtures changes the corpus
  identity and makes a committed report stale (regenerate), which is
  distinguished from a non-reproducible rerun.
- PII is recorded as not measured here; its case model is owned by the PII
  domain reports.
