---
decision_id: decision-qualify-t2-empirically
status: accepted
scope: benchmarks
title: Qualify T2 families empirically without changing their provenance
decided_at: 2026-09-24
---

# Qualify T2 families empirically without changing their provenance

## Context

[Issue #177](https://github.com/redact-secret/redact-secret-benchmarks/issues/177)
identified a ceiling in the support model: only a provider-published lexical
contract could qualify a family as stable. Some providers issue credentials
without publishing the complete grammar. Repeated safe observations and
separate corroboration could therefore improve confidence without ever
becoming T1 evidence.

## Decision

- Evidence provenance and support qualification are separate. T1 means
  provider-documented, T2 means observed or separately corroborated, T3 means
  project policy, and T0 means no reviewed positive contract.
- Stable has two profiles: `documented` for T1 and `empirical` for T2. A T2
  family that clears the empirical profile remains T2 and is displayed as
  `Stable · Empirically qualified`.
- Empirical qualification requires five structural-only provider-issued
  observations across two pseudonymous subjects and two issuance dates, two
  corroboration classes, explicit uncertainty and supported-context limits,
  the versioned 40-fixture profile (or the 48-fixture context-constrained
  profile), and zero critical behavioral failures.
- Contradictory observations block qualification. T3 cannot enter the
  empirical profile, regardless of generated fixture volume.
- Qualification is deterministic and offline. Only committed structural
  metadata participates.

## Security boundary

Observation metadata never contains a credential value, hash, reversible
transform, screenshot, raw log, or value-bearing prompt. Fixtures are authored
separately and are never obtained by editing an observed credential.
Validation diagnostics are fixed strings and never interpolate rejected input.

## Consequences

- The matrix and UI publish documented and empirical stable counts separately.
- Existing T2 families remain provisional until safe observations are committed
  and every empirical gate clears; an empty observation registry changes no T2
  family to stable.
- Uncertainty, context limits, contradictions, fixture cells, behavioral
  failures, tier, evidence basis, and qualification profile remain inspectable.
