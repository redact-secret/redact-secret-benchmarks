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
- **Not in the published or pinned build.** npm `latest` remains `@redact-secret/core` 0.1.0-beta.14. This repository's
  registry snapshot (`benchmarks/detectors.json`, `detector-inventory.json`, `detector-finding-types.json`) pins
  `0c62fd38bca75c5b28b042dc79789b708ebf1d17`, has no Ory detector or finding type, and `ory` is not a taxonomy family.
- **Admin keys** (`ory_pat_`, `ory_apikey_`, `ory_wak_`) stay blocked: no source gives a body length or alphabet.
  The adopted sibling contract also excludes `ory_lo_`, JWT access tokens and enterprise custom prefixes.

The initial disposition read core `f6f481b` before #1282 merged. Its implementation and adoption blockers are now
resolved. In this owner session on 2026-10-08, the owner authorised pinning the new version and proceeding with
owner approval. This satisfies readiness to proceed; the released build, repin, official replay and exact resulting
policy-revision authorisation remain technical prerequisites. It is not an authorisation for an unspecified revision.

## Decision

1. **Deferred, not out of scope.** The Ory siblings get no contract, corpus, taxonomy family or dossier in this repository
   until all three hold: #1110 has a posted adoption ruling; an `ory-token` detector (types `ory_session_token`,
   `ory_oauth2_token`) is in a core build this repository pins; and the owner is ready to re-authorise the policy revision
   the new contract moves. The work is tracked in #827, with the corpus outline and the start condition.
2. **Coordinate the contract with the build repin.** The other second-wave contracts were authored with their detectors
   in the pinned registry. Ory is now adopted upstream, but the published measurement still reads beta.14 without this
   detector. #827 coordinates the contract, corpus and registry repin to an Ory-capable build, under the owner
   session approval to proceed. Official replay and authorisation for the exact resulting policy revision are still
   required. A core merge alone does not update this repository's measurement or support status.
3. **Issuance does not gate the siblings.** Their adopted shapes are T1 from provider source (the Kratos generator and
   `randx` alphabet, the fosite HMAC strategy). Only the admin keys are issuance-gated; they stay unclaimed (T0) when
   the contract arrives.
4. **#583 closes on this disposition.** Its remaining scope asked for contracts and a measurement *or* an explicit
   deferral, and said not to require every implemented family to be stable. Eight families are implemented and measured;
   Xata, Buildkite and Mapbox stay provisional on their recorded gates, which is a support outcome, not missing corpus work.
5. **No measurement is recorded here.** Nothing is re-keyed, no official run is dispatched, and no authority, run pin or
   owner acceptance is written.

## Consequences

When the registry snapshot moves to a build with the adopted `ory-token` (that repin needs a contract for the new
detector, as the #757 repin did), #827 follows the new-family intake (taxonomy family `ory:network-api-key` for the siblings only, dossier,
one contract per finding type, a seeded corpus in the #860 contexts with one-property twins and benign cookie-name
controls) and measures published mode with trufflehog 3.97.4 first on `PATH`. The adoption ruling is complete; #827
remains deferred for the released build repin, official replay and exact policy-revision authorisation.
