---
decision_id: decision-apply-the-legacy-review-decisions-to-canonical-occurrences-by-content
status: accepted
scope: benchmarks
title: Apply the legacy review decisions to canonical occurrences through a generated mapping by content
decided_at: 2026-10-01
---

# Apply the legacy review decisions to canonical occurrences through a generated mapping by content

## Context

#638, part of #602, refs #607, #608 and #636. After #636 the new qualification path reads no stable family against 127 on the
legacy path, and every one of the 127 is held by `differential.unresolvedContractDisagreements`: the review ledger
(`benchmarks/review-ledger.json`) holds decisions keyed by legacy occurrence ids, and none of the 10,739 canonical differential
occurrences of the methods run is in it. The design principle stands: splitting credential-evidence and credential-eval must not
change Redact Secret's qualification semantics, and the review decisions are benchmarks-owned product policy.

A legacy id is a hash of the legacy case id, its source and the disagreement's evidence. A canonical id is credential-eval's hash of
its own occurrence. They cannot be recomputed from one another. What they share is what the decision was about: the case (its
bytes), the peer scanner, the disagreement property and the variant.

## Decision

1. **A decision applies to a canonical occurrence only when both name the same case, peer, property and bytes.** The mapping
   pairs a legacy review-queue entry with a canonical occurrence when: the legacy fixture is joined to the canonical case by the
   content join the parity report and the axis overlay already use (SHA-256 of the content, expected spans and fixture name, one to one,
   nothing guessed); the occurrence bytes are equal (the legacy `evidence.input.contentHash` equals the canonical variant's
   `content_digest`); the peer scanner is equal; the disagreement property is equal (the legacy word `redact-secret-only` is the
   canonical `reference-only`, the only renamed kind); and the variant is equal. An ambiguous key is never mapped.
2. **The mapping is generated, validated and in the policy revision.** `npm run qualification:ledger-rekey` writes
   `benchmarks/support/public-review-ledger-map.json` from the committed legacy review queue (recomputed exactly as `queue:check` does,
   from the committed peer snapshots), the pinned snapshot and the canonical methods run; `--check` fails when it is stale and
   `--validate` checks its structure against the legacy ledger. It is bound to the snapshot's corpus digest and to the canonical methods
   run's semantic digest, is one to one with the ledger, and is a component of the `rs-policy-1` revision (so a changed mapping or a changed
   legacy decision moves the revision).
3. **The legacy ledger stays the source of every decision.** The mapping stores no status and no note: the adapter resolves a canonical
   occurrence id to the legacy id and reads the decision there. An `open` legacy decision stays unresolved; a decision is never invented
   or inferred for an unmapped occurrence.
4. **A legacy review decision made on a fixture the legacy path kept in its regression corpus applies to the same case in the public
   snapshot.** The evidence release publishes some fixtures (for example the sendgrid trailing-dash fixtures) that the legacy path held in its
   regression corpus. A decision is about a case, not about the population that held it, so the join has a second stage: the legacy
   regression fixtures against the snapshot cases still unpaired, by the same keys. That stage only identifies cases; no count of any
   population reads it, and the axis overlay keeps reading the development fixtures alone.
5. **Unmapped occurrences stay unreviewed and are counted by reason** in the mapping's `derivation` and in the parity report: an
   occurrence of a peer the legacy run never scanned, of a case the join does not pair, of a property the legacy run never observed, of
   bytes that differ, or an ambiguous one. The legacy mutation review entries have no canonical counterpart (the canonical review queue
   holds differential occurrences only; mutation is gated by assertion failures there) and are counted, not mapped.

## Consequences

- Every legacy differential review entry for a peer both paths scanned has a canonical occurrence, and the reverse. What remains
  unreviewed is exactly the occurrences of the two peers the legacy run never scanned (see the decision on the peer scope).
- A repin, a new methods run or a changed legacy decision makes the mapping stale; `--check` and the policy revision say so.
- The legacy ledger and the legacy evaluation engine must stay until the mapping can be regenerated from something else; the legacy
  queue is recomputed to generate it.

## Rejected

- Treating a canonical occurrence as settled because any legacy decision exists for the same case: a decision covers one peer and one
  disagreement property; extending it across them would assert something no one reviewed.
- Writing the legacy decisions into a canonical-keyed copy of the ledger: it duplicates the decisions, lets the two drift, and invites
  a hand edit. The mapping holds identity only.
- Matching by occurrence id or by the case id's slug alone: the ids cannot be recomputed, and a slug can name different bytes.
- Hand-authoring the mapping: it drifts with every repin.
