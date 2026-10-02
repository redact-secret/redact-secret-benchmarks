---
decision_id: decision-carry-the-support-matrix-in-the-qualification-view
status: accepted
scope: benchmarks
title: Carry the support matrix in the qualification view and compare it with the legacy matrix by attributed difference
decided_at: 2026-10-02
---

# Carry the support matrix in the qualification view and compare it with the legacy matrix by attributed difference

## Context

#607, part of #602. The old-versus-new parity report compared families, evidence, status, outcomes and known gaps but not the
support matrix, the provider x credential-family projection the legacy path writes with `npm run eval:matrix`. The new path
had no matrix at all: it scored detector families and left the projection to each consumer. The authority switch (#608) and
the Next app need the matrix as data, and there is no UI to compare it against, so the data has to be usable on its own.

## Decision

1. **The view gains `supportMatrix`, additively, and stays `redact-secret/qualification-view/v1`.** It is built by
   `buildViewSupportMatrix` (`benchmarks/qualification/support-matrix.ts`) from the view's own `families[]`, the product
   taxonomy and the product contracts, with the same shape as one legacy matrix entry. Status, reason and evidence are carried
   from the detector family that decided the entry, as the legacy matrix carries them; nothing is re-derived. A count of a method
   that did not run is `null`, never `0`. A taxonomy family it cannot place refuses the build, as the legacy build does.
2. **No version bump.** The change adds a property. `adapter.version` stays `1` because nothing the policy revision stands for
   changed; re-running the view on the canonical artifacts gives the same policy revision.
3. **The parity report compares that same field with the legacy matrix** by the report's three classes: every leaf of every
   entry and the status and route counts, with a difference attributed only through the difference the family comparison found
   in the evidence the leaf projects, and unexplained otherwise. The page-level overview numbers and the review queue against the
   legacy ledger, per peer, are compared by the same rule. Nothing is forced to equal.
4. **A policy gate code is a policy-corpus-bounded reason wherever it appears.** `causeOfReason` read a `policy.*-axes` code as an
   axis difference; the code names a policy gate, which the bounded policy corpus changes, so the policy rule now comes first.
   No status attribution of the committed report moved.
5. **Comparison ignores key order.** The view is written with keys in byte order and the legacy files in authoring order; an
   object is equal when its entries are.

## Consequences

- A consumer reads `view.supportMatrix` instead of recomputing it. The existing report, family and fixture pages are untouched.
- The matrix is a view of the families, not new evidence: an entry that differs does so because its detector family does, and the
  report says which cause.
- A view built before this change lacks the field and the parity script refuses it with the rebuild command.

## Rejected

- Computing the new matrix only inside the parity script: the authority switch and the Next app would each recompute it, and the
  report would compare a value no consumer reads.
- Forcing the legacy and new matrices to equal: the difference is the architecture change under evaluation.
