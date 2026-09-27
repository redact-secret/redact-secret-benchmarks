---
decision_id: decision-qualify-bounded-t3-credential-policy
status: accepted
scope: benchmarks
title: Qualify bounded T3 credential policy without changing provenance
decided_at: 2026-09-26
---

# Qualify bounded T3 credential policy without changing provenance

## Context

Four generic credential families are intentionally T3 because the project, not
a provider grammar or empirical issuance study, decides part of their supported
boundary. Issue [#365](https://github.com/redact-secret/redact-secret-benchmarks/issues/365)
freezes the baseline and family contracts. The old support aggregate discarded
per-family span lattice results and policy actions, so it could not gate exact
value-only redaction or `warn` versus `redact`/`block`.

## Decision

Add a third stable qualification profile named `policy-qualified`. It is
available only to the four named T3 / `project-policy` families and never
changes their tier or evidence basis.

Qualification requires a bounded trigger, candidate, exact-span, action,
exclusion, and blind-spot contract; positive-context, independent benign-axis,
and context-twin floors; zero exact-span misses, leaks, overbreadth, collateral,
gating control false alarms, unresolved actions, or critical behavioral debt;
and public plus protected holdout evidence for the same frozen candidate.

The evaluator emits counts only. It does not expose values, raw scanner output,
statistical scores, weights, probabilities, or thresholds. Actions remain
separate. A warning never satisfies required redaction and is not converted to
a redact/block false alarm.

Peer scanners do not define this project-policy contract. A differential row
whose product result exactly satisfies the independently authored public
conformance span and action is therefore not assertable as a contract defect
merely because a peer is silent or reports a different boundary. Such rows use
the decided ledger class `differential.policy-qualified-project-policy`; the
product's own exact-span and action gates still fail independently when wrong.

The protected receipt is optional input to ordinary classification. Absence is
a typed `protected-holdout` failure. It attests that holdout was not accessed
before freeze. The beta.9 scorer remains shadow-only. Credential and PII
accounting remain separate.

## Consequences

The matrix and UI show `Stable · Policy qualified` only with no failed gate.
Otherwise the family remains provisional with every failed gate. The generic
assignment family stays provisional until fixtures independently author the
expected `warn` versus `redact` branch; observed output cannot author its own
expectation.
