---
decision_id: decision-protect-holdout-from-statistical-scorer-tuning
status: accepted
scope: benchmarks
title: Protect holdout from statistical scorer tuning with a tuning manifest
decided_at: 2026-09-25
---

# Protect holdout from statistical scorer tuning with a tuning manifest

## Context

[#256](https://github.com/redact-secret/redact-secret-benchmarks/issues/256)
belongs to the cross-repo beta.9 epic
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767).
Beta.9 adds a shadow-only statistical evidence scorer to the product, whose
contract is frozen by
[redact-secret#768](https://github.com/redact-secret/redact-secret/issues/768)
(`decision-freeze-the-shadow-evidence-score-and-confidence-contract`). Its
features, weights and band thresholds will be selected from benchmark
evidence (#254, #255). Until now nothing in this repository was fitted to
the corpus. The holdout lifecycle already guards a frozen candidate, but no
rule said which corpora a scorer may be fitted to, or how to keep holdout
results out of that fitting.

## Decision

The rules are in
[`docs/specs/statistical-tuning.md`](../specs/statistical-tuning.md), and
`npm run tuning:check` enforces them in CI:

1. **Corpus roles.** Only development categories may be used to select
   features, weights or thresholds. Regression categories, accepted
   external adversarial packs and #289 abuse variants are evaluation-only.
   Public holdout controls are engine checks, not scorer evidence. Protected
   holdout is a final check on a frozen candidate. A source is either tuned
   on or evaluated against, never both.
2. **A tuning manifest per configuration** (`tuning/manifests/<id>.json`,
   `schemas/tuning-manifest-v1.json`) binds the frozen product candidate,
   the clean benchmark commit, the feature dataset, the selection procedure
   and seed, and the scoring component hashes. It also records per-category
   corpus hashes and row counts by origin, family and context. That is
   enough to reproduce the configuration. The manifest holds hashes and
   counts only, never weights, thresholds or per-candidate values.
3. **Holdout isolation.** A manifest may name no holdout id, corpus hash,
   seed hash or `holdout/` path, and it attests `holdoutAccess: "none"`.
   Holdout runs use the existing lifecycle budget, and a new scoring
   identity is a new candidate, so the budget is not reset. A scoring change
   prompted by a holdout result contaminates that epoch (`used-for-tuning`)
   before the next run.
4. **Invalidation.** `scoring.identity` is the hash of the component fields.
   Evidence is stale once its tuning manifest hash, scoring identity or
   candidate artifact hash no longer matches, or once its manifest is
   superseded. An active manifest must match the current corpus hashes.
5. **Generated share.** Benchmark-generated rows are at most 0.5 of tuning
   rows, overall and in every family, unless a reviewed override with a
   reason raises the cap.
6. **Strata.** Reports are stratified at least by family and context, and
   counts must add up, so an aggregate improvement cannot hide a regression
   in one stratum. Whether that regression blocks anything is for #257.

## Consequences

- #254 records the feature dataset identity, #255 records the selection
  procedure and emits a tuning manifest per proposed configuration, #289's
  variants stay evaluation-only, and the beta.9 qualification record (#282)
  cites the manifest hash and the holdout epoch separately.
- The product's scoring artifact
  ([redact-secret#798](https://github.com/redact-secret/redact-secret/issues/798))
  records the tuning manifest hash, which links the two repositories without
  a circular dependency.
- Treating any holdout-prompted retune as contamination means a holdout
  failure costs the whole epoch. This is deliberately conservative: the
  alternative lets holdout turn into a slow development set.
- The 0.5 generated-share cap may be hard to meet for families that have
  few authored examples. The override exists so that case is visible and
  reviewed rather than silent.
