---
decision_id: decision-count-public-axes-with-a-product-overlay-and-measure-methods-in-a-second-run
status: accepted
scope: benchmarks
title: Count the public axes with a product-owned overlay, and measure the methods in a second official run
decided_at: 2026-10-01
---

# Count the public axes with a product-owned overlay, and measure the methods in a second official run

## Context

#636, part of #602, refs #607 and #608. The #607 report read 127 legacy-stable families and none on the new path:
13 families held only by `methods.notRun` (the official configuration runs no methods) and 114 by the axis vocabulary
(the public snapshot's group is a scenario id and its controls carry no benign taxonomy). Both are benchmarks-side
policy. The design principle stands: splitting out credential-evidence and credential-eval must not change Redact Secret's
qualification semantics; public evidence is one population; product qualification is benchmarks-owned; an evidence class
is provenance, never a support status.

Two facts about credential-eval shaped the options. A configuration file that names methods is refused by the engine
(`--methods`, `--reference`, `--seed` and `--evidence` select them on the command line), and a run with methods replaces
the corpus cases by generated variants and publishes no per-group figures, so it cannot also be the floors run.

## Decision

1. **The axes are a product-owned overlay, generated and validated.** `benchmarks/support/public-axis-overlay.json` carries,
   per canonical case id of the pinned snapshot, the legacy source-context axis (`<category>/<group>`) of a positive and the
   legacy control axis of a control. It is derived by `npm run qualification:axis-overlay` from the legacy development
   fixtures, joined to the snapshot by the content keys the parity report already uses; nothing is hand-authored. It is bound
   to the snapshot by corpus digest, validated by `--validate`, a component of the `rs-policy-1` revision, and recorded in
   the view. A case it does not name keeps the snapshot's vocabulary. It names axes only: no evidence class, outcome or
   measured count changes, and credential-evidence is untouched.
2. **The adapter counts the two axis views the legacy classifier counted.** The fixture-profile cell uses the fixture group;
   `positiveAxes` uses `<category>/<group>`. The adapter previously used the group for both, which differed from the legacy
   evidence at equal inputs.
3. **The methods are a second official run of the floors population.** Same evidence release, same configuration, same
   scanners; methods `differential`, `metamorphic`, `mutation`, reference `redact-secret`, seed `case-id`, and the product
   evaluation evidence file derived from the contracts and pinned by digest. `benign` and `twin` are not selected (the gates
   read neither, and `benign` refuses controls without a taxonomy). It is a second artifact, never merged with the plain
   one, and the adapter attributes its assertions and review occurrences through the seed case. No change to credential-eval
   and no new engine tag is required, so none is made.
4. **A recorded difference is not a forced one.** The review ledger holds legacy ids, so no canonical differential occurrence
   reads settled, and the methods run also covers peers the legacy run never scanned. The report attributes this as
   `review-occurrence-identity` only when no canonical id of the family's occurrences is in the ledger, and states what
   it needs (a re-key and a peer-set decision) without applying either.

## Consequences

- The axis difference that held 114 families is replaced by differences the report attributes by axis ids: the public snapshot
  is the floors population alone, pending fixtures are not scored, a fixture can be attributed to another family.
- The methods gates are measured. A family with a differential occurrence stays provisional until the ledger decisions are
  re-keyed to canonical ids and the peer set of the gate is decided. Those are two product decisions for the next issue.
- Official runs take longer and the CI step reads a methods artifact of a few hundred MB.
- The overlay must be regenerated when the public snapshot is repinned; the adapter refuses an artifact of another corpus.

## Rejected

- Hand-authoring axes per case, or carrying them in credential-evidence: the axes are product policy, and a hand list drifts.
- A methods-naming configuration file in this repository: the engine refuses it, and the command-line selection is what enters
  the `config_hash`.
- Running `benign` with a taxonomy supplied outside the snapshot: it would put a product vocabulary into the engine's input
  without a pinned snapshot that carries it.
- Treating canonical occurrences as settled because a legacy decision exists for the same case: the decision covered a legacy
  occurrence (its peer set and its identity); extending it is the re-key decision, not an adapter default.
