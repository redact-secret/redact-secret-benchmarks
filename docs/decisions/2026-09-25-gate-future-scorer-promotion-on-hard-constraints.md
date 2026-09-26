---
decision_id: decision-gate-future-scorer-promotion-on-hard-constraints
status: accepted
scope: benchmarks
title: Gate future scorer promotion on hard constraints, not a mixed score
decided_at: 2026-09-25
---

# Gate future scorer promotion on hard constraints, not a mixed score

## Context

[#257](https://github.com/redact-secret/redact-secret-benchmarks/issues/257)
belongs to the cross-repo beta.9 epic
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767).
Beta.9 ships an explainable evidence scorer for ambiguous `generic-token`
candidates, and it is shadow-only by redact-secret's
`decision-freeze-the-shadow-evidence-score-and-confidence-contract`. That
decision also says that letting statistical evidence change `Confidence` or
action later needs a new decision. Nothing yet said what evidence such a
decision would need. Without a fixed bar, the usual failure is to pick
whatever single figure (F1, accuracy, a weighted sum) looks best on the day.
A figure like that can hide a leaked-span regression in one family, or a new
evasion route, behind a larger gain somewhere else.

## Decision

The rules are in
[`docs/specs/scorer-promotion-gates.md`](../specs/scorer-promotion-gates.md).
The versioned contract
[`benchmarks/scorer-promotion-contract.json`](../../benchmarks/scorer-promotion-contract.json)
is checked by `npm run scorer-promotion:check` in CI.

1. **Constrained optimisation.** The objective is better discrimination of
   ambiguous candidates (twin discrimination gain ≥ +0.05, with no
   independent false-alarm increase). Every other requirement is a hard
   constraint judged on its own, overall and per stratum. No gate is
   weighted, nothing is combined, and one failure cannot be offset.
2. **Five questions, answered separately.** Q1 coherence and calibration
   for the stated population, Q2 improvement on the targeted population, Q3
   security preserved elsewhere, Q4 resistance to score evasion and
   negative-evidence abuse (#289), Q5 the independent evidence needed
   before enforcement. A release is promotable only when all five pass.
3. **Zero tolerance where security is at stake.** Leaks that happen only
   under the promoted path, leaked-span rate increases, changed outcomes for
   `private-key`/`provider`/`structural` candidates, removed deterministic
   positives and negative evidence applied on a partial grammar match all
   have a bound of zero, and a contract revision cannot loosen them.
4. **Q5 is independent evidence**: a new model identity and a new candidate
   identity (redact-secret#798), identity-consistent evidence, an accepted
   product enforcement decision, a protected-holdout run in an
   uncontaminated epoch, the #142 custodian blind evaluation, the #772
   cross-runtime, incremental and worst-case qualification, and #143
   budgets for latency, initialization, memory and size.
5. **Beta.9 passes without Q5.** Q1–Q4 are informational for beta.9 and
   the evaluator never blocks beta.9.
6. **No secrecy.** No gate depends on weights or cut-offs staying secret.
   The contract holds gate bounds, which are policy, and never scorer
   values.
7. **#289 publishes one closed aggregate**
   (`schemas/score-evasion-aggregate-v1.json`): counts per attack class
   and in total, invariant verdicts, identities and hashes. Q4 reads only
   that aggregate.

## Consequences

- #289 emits the aggregate under the field names in the spec's section 5.
  #282 cites the contract version and records the Q1–Q4 answers for beta.9.
- The producers of the corpus, holdout, runtime and budget metrics are not
  wired to the evaluator yet. The contract fixes the metric names they
  supply, so that wiring needs no new policy.
- The bar is strict. A scorer that improves most families but loses one
  twin pair class, or that leaks one span the legacy path caught, is not
  promotable. That is deliberate: default detection is a security surface,
  and a promotion that fails can stay shadow-only at no cost.
- Holdout delta gates need a legacy reference run in the same epoch, so a
  promotion epoch's run budget has to be planned for two runs.
- Changing a bound needs a new contract version (content hash), and it
  makes the evaluation of an older version non-comparable.
