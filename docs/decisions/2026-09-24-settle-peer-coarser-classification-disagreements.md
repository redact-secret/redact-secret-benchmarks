---
decision_id: decision-settle-peer-coarser-classification-disagreements
status: accepted
scope: benchmarks
title: Settle classification disagreements where only the peer's label is coarser
decided_at: 2026-09-24
---

# Settle classification disagreements where only the peer's label is coarser

Status: **accepted** (maintainer direction, 2026-09-24, #213).

## Context

`classification-granularity-unasserted` rows record a differential disagreement
in which redact-secret and a peer scanner report the same byte range but give it
different family labels. The 2026-09-21 mechanical-classes decision left the
class open because "the corpus authors byte ranges and role, not a required
per-span family label".

That reason no longer holds for the rows below. Every fixture is assigned to the
family it exercises in `benchmarks/fixture-detectors.json`, and the #209/#213
corpora author each positive from that family's contract. The assignment is the
authored label.

By #213, 28 rows of this class were open. Most of them are cases where gitleaks'
catch-all `generic-api-key` rule matches the value before its provider rule does.
These rows kept documented families (cloudflare, huggingface, confluent) and the
#207 families provisional, although redact-secret redacted exactly the authored
span with the right family.

## Decision

A `classification-disagreement` differential row is **not assertable against
redact-secret**, class `differential.peer-coarser-classification`, when all of
the following hold:

1. the variant is `canonical`;
2. redact-secret's ranges, the peer's ranges and the fixture's authored expected
   ranges are identical;
3. every family label redact-secret gives those ranges is one of the families the
   row targets, that is, the fixture's assigned family.

The peer's coarser label is a fact about the peer's rule order. It is not a
disagreement about what must be redacted or how the product attributes it.

All other rows of the class stay `open`, including:
- rows where redact-secret gives the generic label and the peer the specific one;
- rows where the ranges differ from the authored ones, including collateral on a
  public identifier (#739);
- rows on twins or mutated variants.

Those still point at a product attribution or precision question.

## Consequences

- The 17 rows meeting the three conditions on 2026-09-24 move to
  `not-assertable` with `Class: decision=differential.peer-coarser-classification`.
  `npm run ledger:decisions:check` enforces that the class is decided here.
- The 9 remaining rows stay open:
  - langsmith: the product labels `generic-token` and the peer labels the specific family;
  - stripe-webhook: the product labels `stripe-token`, not `stripe-webhook-signing-secret`;
  - the Confluent twin and the Confluent secrets-manager row (#739 collateral).
- Future rows are checked against the same three conditions. None is settled by
  family resemblance.
