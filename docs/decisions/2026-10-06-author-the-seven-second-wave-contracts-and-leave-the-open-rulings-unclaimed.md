---
decision_id: decision-author-the-seven-second-wave-contracts-and-leave-the-open-rulings-unclaimed
status: accepted
scope: benchmarks
title: Author the seven remaining second-wave contracts and corpora, claim only what the provider states, and leave the open rulings unclaimed
decided_at: 2026-10-06
---

# Author the seven remaining second-wave contracts and corpora, claim only what the provider states, and leave the open rulings unclaimed

Status: **accepted** (benchmarks issue #583, slices `583b` to `583h`). Extends
[`2026-10-05-claim-square-stable-widths-under-q8-and-pin-the-registry-ahead-of-the-release.md`](2026-10-05-claim-square-stable-widths-under-q8-and-pin-the-registry-ahead-of-the-release.md)
and [`2026-09-24-stop-asserting-provider-undecided-format-properties.md`](2026-09-24-stop-asserting-provider-undecided-format-properties.md).

## Context

The Square slice left seven registered detectors (Xata, Sourcegraph, Unkey, Buildkite, Pydantic Logfire, Mapbox, Fly) as T3
placeholder contracts. Their #1014 handoffs are READY or conditional on open ruling questions: Q1 (may a checksum post-check
reject a lexically valid key), Q7 (is a body floor a policy), Q9 (standalone and temporary forms) and Q10 (customer-prefixed
keys).

## Decision

1. **One T1 registry contract and one corpus per detector**, authored from the handoff and the provider sources it cites,
   never from product detector code. None adds an arrival family.
2. **Only provider statements are frozen.** Every dependency on an open ruling is a `policy-*` field (research-hypothesis,
   provisional), never T1. A shape that rests on a ruling or on a single source is an unclaimed twin in `DISPUTED_PROPERTIES`
   (read T0): the corpus asserts neither detection nor silence on it. Checksums (CRC32 for Xata, CRC-32C for Unkey) are built
   correctly in the generators and are not in any lexical pattern.
3. **A T0 control cannot collide lexically.** An unclaimed twin may satisfy its own contract's pattern (a checksum mismatch, a
   body just under a floor); it is not scored, so `checkLexicalSeparability` skips fixtures whose assessment tier is T0. T1 and
   T2 controls are unchanged.
4. **Review rows settle under the established classes only** (operator classes for mutation rows, the pending-fixture decision
   for T0 twins, the resolved and open differential classes otherwise); the published release's misses stay open
   `differential-coverage-gap` rows, as for Square.
5. **Published mode is the measurement here.** Peers are the pinned trufflehog 3.97.4 and gitleaks 8.30.1 from
   `npm run peers:provision`. Candidate mode is not measured in this pass.
6. **The authority is untouched.** The policy revision moves with any contract change; re-authorising it is the owner's step, as
   in [`2026-10-06-reauthorise-the-policy-revision-for-the-second-wave-detector-contracts.md`](2026-10-06-reauthorise-the-policy-revision-for-the-second-wave-detector-contracts.md).
   `authority:check` is red until then, by design.

## Consequences

If Q1 is ruled yes, the checksum-mismatch twins of Xata and Unkey become asserted and the lexical-only Xata widths are dropped.
If Q7 is refused, the floor-dependent twins of Buildkite, Pydantic Logfire, Mapbox and Fly move to `DISPUTED_PROPERTIES`. The Ory
siblings (#1110) are not in the registry and wait for the issuance check (#584).
