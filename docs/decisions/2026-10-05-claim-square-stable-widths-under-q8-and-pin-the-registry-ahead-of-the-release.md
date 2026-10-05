---
decision_id: decision-claim-square-stable-widths-under-q8-and-pin-the-registry-ahead-of-the-release
status: accepted
scope: benchmarks
title: Claim Square's stable widths under Q8, record the other second-wave detectors as pending, and pin the registry ahead of the release
decided_at: 2026-10-05
---

# Claim Square's stable widths under Q8, record the other second-wave detectors as pending, and pin the registry ahead of the release

Status: **accepted** (benchmarks issue #583, Square slice; #584 for the issuance check). Extends
[`2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](2026-09-29-relabel-provider-named-near-miss-controls-under-948.md)
and [`2026-09-24-stop-asserting-provider-undecided-format-properties.md`](2026-09-24-stop-asserting-provider-undecided-format-properties.md).

## Context

Core PR #1214 (Xata, Sourcegraph, Unkey, Buildkite) and #1227 (Pydantic Logfire, Square, Mapbox, Fly) put eight new
detectors in the product registry on `main`, none in a published artifact (the benchmarks pin `@redact-secret/core`
0.1.0-beta.13). `npm run pins:check` failed on develop because the registry snapshot was not refreshed. Three questions
followed.

1. **Square's length.** The #1014 handoff for Square is READY under R5 with the ruling question Q8 open (may R5 support an
   exact-width grammar when the provider disclaims length validation). Square's page says "don't use token length for
   validation", and its own examples disagree: an `EAAA` + 60 access token (64 in all) against an `EAAl` + 59 access token
   and an `EQAA` + 60 refresh token in the ObtainToken reference, and `sq0csp-` at 43 in the walkthrough against 44 in the
   reference and its generated SDK fixture.
2. **The seven other detectors.** The repository requires a contract, detector-coverage fixtures and an arrival-evidence
   set for every registry id, but this change authors a corpus for Square only.
3. **The pin.** `checkPinConsistency` tied the registry snapshot, the detector inventory, the performance baseline's
   `verifiedCommit` and the runtime-comparison snapshots to one commit. The registry has to move to a `main` commit that
   no release contains, while the published package (and so the performance evaluation and the runtime-comparison
   measurements, which run the published artifact) stays at the beta.13 source.

## Decision

1. **Claim the stable widths, leave the conflicting shapes unclaimed.** `square-token` claims `EAAA` + exactly 60
   `[A-Za-z0-9_-]`; `square-oauth-application-secret` claims `sq0csp-` + 43 or 44 and `sandbox-sq0csb-` + 43 (the Polar
   era-union precedent for 43 or 44). The recommendation on Q8 is **yes**, and the contract carries it as a
   `policy-q8-exact-width` field (`research-hypothesis`, `provisional`): never T1, and a refusal drops both families to
   issuance-gated. Every conflicting width is an *unclaimed twin* recorded in `DISPUTED_PROPERTIES`
   (`EAAA` + 59 and + 61, `EAAl` + 59, `EQAA` + 60, `sq0atp-` + 22, `sq0csp-` + 42 and + 45, `sandbox-sq0csb-` + 42 and
   + 44): the fixture exists, reads T0, and asserts neither detection nor silence. Asserted twins differ by prefix, alphabet
   or boundary only, so `square-token`'s T1 twin dimensions are `alphabet`, `boundary` and `prefix`. The issuance check
   (#584, `docs/specs/square-issuance-check.md`) is how one key the maintainer issues decides the open widths.
2. **Record the seven others as pending, claim nothing.** `xata-api-key`, `sourcegraph-token`, `unkey-root-key`,
   `buildkite-token`, `pydantic-logfire-token`, `mapbox-token` and `fly-token` get a tier-T3, `contextGated`,
   `unprobeable` placeholder contract ("detector present in the registry, benchmark contract/corpus pending (#583)")
   with the handoff as `candidateSource`, the registry-wide detector-coverage minimum and one static calibration row each.
   A placeholder contract has no pattern, so its positives score as policy and none can reach T1 or `stable`. Each is
   replaced by a real contract when its slice lands.
3. **Pin the registry snapshot ahead of the release.** `benchmarks/detectors.json` `sourceRevision` and
   `detector-inventory.json` `redactSecretRevision` move to `3b1a5aa` (product `main`). The published package and its
   source commit are unchanged (`redactSecretReleaseRevision`, `pin-manifest` `releaseSourceRevision`, both `66b492b`).
   `performanceCriteriaVerifiedCommit` and the runtime-comparison snapshots are now checked against the release revision,
   not the registry snapshot, because they measure the published artifact; the registry snapshot must still equal the
   inventory revision and the registry at that commit. `scripts/run-runtime-comparison-docker.sh` and
   `scripts/measure-runtime-comparison.mjs` default to the release revision for the same reason. No performance
   evaluation or runtime re-measurement is needed for a registry-only move, and none was run.
4. **Mode is stated on every count.** Published mode (beta.13) contains none of the eight detectors, so every Square
   fixture is a lag there; the candidate mode is an unpublished build of product `main` at `3b1a5aa` and is never
   published to npm.

## Consequences

- Any registry or contract change moves the benchmark-owned policy revision and the derived evaluation evidence. The
  owner-governed records that pin them (`benchmarks/qualification-authority.json` `new.policyRevision`,
  `benchmarks/official-runs.json` `methodsRun.evaluationEvidence.digest`, the parity report) are not edited by this
  change: re-authorising the new view is the owner's reviewed commit after new official runs. Until then
  `npm run authority:check` and the evaluation-evidence assertion in `tests/axis-overlay.test.mjs` are stale by design.
- A later slice authoring Xata, Sourcegraph, Unkey, Buildkite, Logfire, Mapbox or Fly replaces its placeholder with a
  contract and a corpus; Ory siblings and the other second-wave detectors follow the same route.
