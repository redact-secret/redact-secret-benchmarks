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

Upstream state, read 2026-10-08:

- **Not shipped.** `@redact-secret/core` 0.1.0-beta.14 (npm `latest` and `beta`) has no Ory detector; core redact-secret#1110
  says so in its 2026-10-07 disposition and carries the work to beta.15 planning "not a delivery promise".
- **Not on core `main`.** At `f6f481b` (2026-10-07) the tree has no Ory detector source; the only Ory files are a contribution
  example (`docs/contracts/contribution/worked-example-1110.md`, `examples/ory-siblings.handoff.json`), a draft that is
  `state:research-needed` until a maintainer posts the adoption ruling.
- **Not accepted.** #1110 declares the #1014 T1/READY record historical and requires it to be reconciled with the current
  credential-evidence handoff first. credential-evidence and credential-eval carry no Ory record.
- **Not in this repo's registry.** The pinned snapshot (`benchmarks/detectors.json`, `detector-inventory.json`,
  `detector-finding-types.json`) has no Ory detector or finding type, and `ory` is not a taxonomy family.
- **Admin keys** (`ory_pat_`, `ory_apikey_`, `ory_wak_`) stay blocked: no source gives a body length or alphabet.

## Decision

1. **Deferred, not out of scope.** The Ory siblings get no contract, corpus, taxonomy family or dossier in this repository
   until all three hold: #1110 has a posted adoption ruling; an `ory-token` detector (types `ory_session_token`,
   `ory_oauth2_token`) is in a core build this repository pins; and the owner is ready to re-authorise the policy revision
   the new contract moves. The work is tracked in #827, with the corpus outline and the start condition.
2. **Why not author the contract now.** The other second-wave contracts were authored because their detectors were in the
   pinned registry. An Ory contract today would be a family with no product detector: the published measurement can only
   read a miss or a generic-token match, the handoff it would freeze is one core itself calls historical, and the contract
   would move the policy revision and turn `authority:check` red for an owner re-authorisation that buys no product
   evidence. That is cost without measurement.
3. **The gate is core adoption, not issuance.** Earlier text said the siblings wait for the issuance check (#584). They do
   not: the sibling shapes are T1 from provider source (the Kratos generator and `randx` alphabet, the fosite HMAC
   strategy), and #1110 says not to repeat issuance. Only the admin keys are issuance-gated; they stay unclaimed (T0) when
   the contract arrives.
4. **#583 closes on this disposition.** Its remaining scope asked for contracts and a measurement *or* an explicit
   deferral, and said not to require every implemented family to be stable. Eight families are implemented and measured;
   Xata, Buildkite and Mapbox stay provisional on their recorded gates, which is a support outcome, not missing corpus work.
5. **No measurement is recorded here.** Nothing is re-keyed, no official run is dispatched, and no authority, run pin or
   owner acceptance is written.

## Consequences

When #1110 ships and the registry snapshot moves to a build with `ory-token` (that repin needs a contract for the new
detector, as the #757 repin did), #827 follows the new-family intake (taxonomy family `ory:network-api-key` for the siblings only, dossier,
one contract per finding type, a seeded corpus in the #860 contexts with one-property twins and benign cookie-name
controls) and measures published mode with trufflehog 3.97.4 first on `PATH`. If core instead rules the siblings out,
#827 closes as out of scope and the `_candidates-not-yet-families.md` row records that.
