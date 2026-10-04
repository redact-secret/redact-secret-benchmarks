---
decision_id: decision-attribute-methods-gate-evidence-of-added-cases-to-canonical-evidence-membership
status: accepted
scope: benchmarks
title: Attribute the methods-run gate evidence of cases with no legacy counterpart to canonical-evidence-membership, and settle none of it
decided_at: 2026-10-04
---

# Attribute the methods-run gate evidence of cases with no legacy counterpart to canonical-evidence-membership, and settle none of it

## Context

#680, part of #690. The candidate `snapshot-2026.10.04` on credential-eval `v0.1.0-alpha.3` adds 499 cases to the 5,950 the legacy oracle holds. The candidate qualification view reads 11 families (18 matrix entries) provisional that the accepted view reads stable. Every reason is a methods-run gate: unresolved differential disagreements with a gate peer (418 occurrences), and, for sendgrid-token, failed metamorphic (63) and mutation (9) assertions of the reference scanner. Each comes from an added case (the unsettled occurrences of common cases are unchanged and none is new). The legacy review ledger holds decisions only for the legacy cases, so the added cases' occurrences read unresolved, which is correct.

The old-versus-new parity report (#607) is the gate `authority:check` reads (0 unexplained). With the candidate view it reported 113 unexplained differences, all of one shape: a methods-run count the legacy path could not hold, because the cases it counts did not exist for it. No rule attributed them. The honest options were to leave the gate red for the owner, to settle the 418 occurrences, or to give the comparison a rule that checks the evidence.

## Decision

1. **Add a rule, not a decision.** `canonical-evidence-membership` (the snapshot holds cases with no legacy counterpart) now also attributes a methods-run figure: a family's `differentialUnresolvedContractDisagreements`, `metamorphicCriticalFailures` or `mutationUnresolvedCritical`, and a gate peer's review-occurrence count, but only when the residual equals, exactly, the unsettled gate occurrences (not mapped to a legacy entry), or the failed reference assertions, of the cases the legacy join leaves unmatched. A residual that is one more or one fewer stays unexplained, and so does a status held by a reason the rule does not attribute.
2. **Settle nothing.** The review ledger is not edited. An occurrence of an added case stays unresolved until a reviewer decides it; the families stay provisional until then. The comparison states that fact and does not hide it (`docs/generated/evidence-adoption/<tag>.comparison.json`, `methods.unsettledGateOccurrences`).
3. **Fragment and decoded cases are reported, not argued away.** The failed sendgrid assertions are on added cases that split a credential across lines or string literals. They are reported with their cause; whether the product is gated on fragment semantics is an owner decision that waits for credential-eval#34 and credential-evidence#150.

## Consequences

The parity gate can reach 0 unexplained for an evidence snapshot that adds cases, without anyone fabricating a review decision. The cost is that a larger corpus can lower the stable count until its occurrences are reviewed; the adoption report shows each such family with the number of unreviewed occurrences. Spec: `docs/specs/qualification-parity.md` (causes), `docs/specs/evidence-adoption.md`.
