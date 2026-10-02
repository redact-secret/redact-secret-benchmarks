---
decision_id: decision-gate-the-differential-on-the-legacy-peers-and-measure-the-others
status: accepted
scope: benchmarks
title: Gate the differential on the legacy peers, and measure and report the other pinned peers
decided_at: 2026-10-01
---

# Gate the differential on the legacy peers, and measure and report the other pinned peers

## Context

#638, part of #602, refs #607, #608 and #636. The legacy differential gate read the review queue of a three-scanner run: the
redact-secret reference against gitleaks and trufflehog (`qualification/suite-v1.json`). The canonical methods run of #636 scans five
scanners and its review queue holds the occurrences of four peers: gitleaks 1,811 and trufflehog 2,457 (the legacy peers), and
flare-redact 2,695 and openredaction 3,776, which the legacy gate never read and for which no one has reviewed a disagreement.
`families[].evidence.differentialUnresolvedContractDisagreements` is a stable gate: an unresolved occurrence holds a family at provisional.

## Decision

1. **The gate reads the legacy peers: gitleaks and trufflehog, each against the redact-secret reference.** This is explicit product policy in
   `benchmarks/support/population-policy.json` (`methods.differential.peers`), validated (a non-empty list of distinct peers, never
   the reference scanner itself), read by the adapter, in the view (`policy.differentialPeers`) and in the policy revision.
2. **flare-redact and openredaction are measured and reported, and are not gate-bearing until reviewed.** The view lists, per
   family, every peer's differential occurrences with how many a legacy decision settles and how many are unresolved
   (`families[].differential`, with `gateBearing` per peer). The parity report carries the same figures. Nothing is dropped from the
   methods run or its artifact.
3. **Why this is the semantics-preserving choice.** The legacy gate never read those two peers, so counting their occurrences would add
   thousands of occurrences with no decision to a gate that never had them and would change which families are stable without any
   change in the product or in what was reviewed. A peer joins the list only through a reviewed decision of its own (its occurrences
   reviewed and mapped or decided) and a policy change, which moves the policy revision.

## Effect, on the canonical runs at the time of this decision

With the mapping of the companion decision, every gitleaks and trufflehog occurrence is settled by a legacy decision (4,142 of 4,142
family-attributed). Of the occurrences the gate does not read, flare-redact (2,617) and openredaction (3,548) are all unreviewed:
every family read stable carries unreviewed occurrences of those two peers, so had they been gate-bearing now none of those families
could read stable, for a reason (an unreviewed peer) that no product change caused.

## Consequences

- Widening the peer list is one reviewed commit to `population-policy.json`; the view and the report show what it would hold back
  before that.
- The peer scope is benchmarks-owned policy and is independent of which scanners credential-eval runs.

## Rejected

- Reading every pinned peer: changes the semantics (above), and an unreviewed disagreement is not evidence about the product.
- Dropping the extra peers from the report: they are measured, and a reader must be able to see what is unreviewed.
- Reading the peers by scanner order or a count threshold: a gate must name its peers.
