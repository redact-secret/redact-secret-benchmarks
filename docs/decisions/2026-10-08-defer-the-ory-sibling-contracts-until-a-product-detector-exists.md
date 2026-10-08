---
decision_id: decision-defer-the-ory-sibling-contracts-until-a-product-detector-exists
status: accepted
scope: benchmarks
title: Defer the Ory sibling contracts and corpus until core ships an adopted ory-token detector, and close the second-wave corpus work without them
decided_at: 2026-10-08
---

# Defer the Ory sibling contracts and corpus until core ships an adopted ory-token detector, and close the second-wave corpus work without them

Status: **accepted** (benchmarks issue #583; follow-up #827; core redact-secret#1110). Extends
[`2026-10-06-author-the-seven-second-wave-contracts-and-leave-the-open-rulings-unclaimed.md`](2026-10-06-author-the-seven-second-wave-contracts-and-leave-the-open-rulings-unclaimed.md).

## Context

#583 is the benchmarks side of the #1014 second wave. Eight of its nine families have contracts, seeded corpora and a
published-mode measurement (Square in #757; Xata, Sourcegraph, Unkey, Buildkite, Pydantic Logfire, Mapbox and Fly in #776;
beta.14 measured in #809). The ninth, the Ory siblings (`ory_st_` session tokens and `ory_at_`/`ory_rt_`/`ory_ac_` Hydra
OAuth2 tokens), was left open with the instruction to determine its current shipped and accepted scope.

Upstream state, re-read 2026-10-08 after core PR #1282 merged:

- **Adopted and implemented on core `main`.** [PR #1282](https://github.com/redact-secret/redact-secret/pull/1282)
  merged at `5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf` and closed #1110. The
  [adoption ruling](https://github.com/redact-secret/redact-secret/blob/5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf/docs/audits/evidence/1110/README.md)
  reconciles the historical #1014 handoff with pinned provider sources and adopts `ory-token`, with finding types
  `ory_session_token` and `ory_oauth2_token`. Core includes implementation, registration and conformance tests;
  independent benchmark measurement and support promotion remain separate.
- **Registry intake ahead of the published build.** npm `latest` remains `@redact-secret/core` 0.1.0-beta.14.
  The registry snapshot now pins `5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf`, including Ory and Baseten, while
  `redactSecretReleaseRevision` remains beta.14 `0c62fd38bca75c5b28b042dc79789b708ebf1d17`. T3 pending
  benchmark contracts and synthetic policy coverage record their registry presence. The reviewed sibling corpus
  and independent measurement are still deferred to #827.
- **Admin keys** (`ory_pat_`, `ory_apikey_`, `ory_wak_`) stay blocked: no source gives a body length or alphabet.
  The adopted sibling contract also excludes `ory_lo_`, JWT access tokens and enterprise custom prefixes.

The initial disposition read core `f6f481b` before #1282 merged. Its implementation and adoption blockers are now
resolved. In the 2026-10-08 owner session, the owner authorised the new-version pin and owner approval. The
registry-only policy revision is `rs-policy-1:sha256:94c247cf72ea74fa1f226af3392764e58a3bf64ad7af5056c3d68926a844f0da`;
its policy-only acceptance records that approval against the actual derived evidence after parity verification.
This approval persists through the authorised work. An Ory-capable published release and its measurement identities
are still unavailable; no future release or run identity is asserted.

## Decision

1. **The full reviewed intake remains in #827.** Adoption and registry intake are complete. The existing taxonomy,
   dossier, T3 pending contract and synthetic policy probes do not complete the provider-backed contracts, dedicated
   corpus or independent measurement. Those remain follow-up work, with no issuance prerequisite for the siblings.
2. **Keep published measurement identity explicit.** The registry-only intake uses the existing T3 pending-contract
   route. Full T1 contract/corpus authoring can proceed from the adopted provider evidence. A published-mode run
   against beta.14 measures its limitations because that package has no Ory detector. A later Ory-capable released
   package needs an exact release repin and official replay under the existing owner approval, recorded against
   the actual resulting policy and evidence identities. A core merge alone does not establish measured support.
3. **Issuance does not gate the siblings.** Their adopted shapes are T1 from provider source (the Kratos generator and
   `randx` alphabet, the fosite HMAC strategy). Only the admin keys are issuance-gated; they stay unclaimed (T0) when
   the contract arrives.
4. **#583 closes on this disposition.** Its remaining scope asked for contracts and a measurement *or* an explicit
   deferral, and said not to require every implemented family to be stable. Eight families are implemented and measured;
   Xata, Buildkite and Mapbox stay provisional on their recorded gates, which is a support outcome, not missing corpus work.
5. **No measurement is recorded here.** Nothing is re-keyed, no official run is dispatched, and no authority, run pin or
   owner acceptance is written.

## Consequences

#827 follows the new-family intake for the existing taxonomy family `ory:network-api-key` (siblings only) and dossier:
one reviewed contract per finding type, a seeded corpus in the #860 contexts with one-property twins and benign
cookie-name controls. It replaces the T3 pending contract and measures published mode with trufflehog 3.97.4 first
on `PATH`, naming the measured release and its absence of a dedicated detector where applicable. Stable support
still requires the conformance and arrival gates plus the measured qualification floors. An Ory-capable published
release is a later repin with actual artifact identities; the registry-only intake does not promise its delivery.
