---
decision_id: decision-reauthorise-the-policy-revision-for-the-second-wave-detector-contracts
status: accepted
scope: benchmarks
title: Re-authorise the policy revision for the second-wave detector contracts without accepting any new evidence, engine or product build
decided_at: 2026-10-06
---

# Re-authorise the policy revision for the second-wave detector contracts without accepting any new evidence, engine or product build

Accepted by the owner of the repository, Milo Kang, on 2026-10-06 (#583, #757; explicit instruction in the working session). This is a re-authorisation of **one value**, the benchmark-owned policy revision. It is not an acceptance of an evidence snapshot, an engine or a product build.

## Context

The registry on product `main` gained eight detectors (Xata, Sourcegraph, Unkey, Buildkite from core #1214; Pydantic Logfire, Square, Mapbox, Fly from core #1227). The registry pin cannot move without a contract, taxonomy row, finding-type mapping and coverage minimum for each, and those are components of the product policy revision (`docs/specs/qualification-adapter.md`, "Product policy revision"). #757 adds them, so the policy revision moved from `rs-policy-1:sha256:c478848b...` (authorised 2026-10-05, [accept snapshot-2026.10.05](2026-10-05-accept-snapshot-2026-10-05-on-credential-eval-alpha-5.md)) to `rs-policy-1:sha256:20f1b70b...`. `authority:check` and the evaluation-evidence assertion of `tests/axis-overlay.test.mjs` failed until the owner re-authorised it, and `pin-drift` on `develop` stayed red for the same reason.

## Decision

1. **The policy revision `rs-policy-1:sha256:20f1b70bde51fc9ac0f866cdf78713f02d1458001cbc35a65fcf942b2874067c` is authorised** in `benchmarks/qualification-authority.json` (`acceptedBy` Milo Kang, `acceptedOn` 2026-10-06). The release, the semantic digests of the four canonical runs and the authority value (`new`) are unchanged.
2. **Kept exactly as accepted:** evidence `snapshot-2026.10.05` (manifest `sha256:510836b0...`), engine credential-eval `v0.1.0-alpha.5`, public run 37296823599 with `@redact-secret/core` 0.1.0-beta.13. Not accepted and not repinned: `snapshot-2026.10.06.2` and engine alpha.13 (newer; alpha.13 changes twin scoping, so its results differ). They wait for a later owner decision.
3. **Nothing was re-measured.** The accepted artifacts of run 37296823599 were downloaded and the view rebuilt from them locally. The three derived inputs (axis overlay, twin-scope map, review-ledger re-key) are byte-identical to the committed ones, so the new policy revision moves no population's semantic digest and no scanner result. The only measured-side input that changed is the evaluation evidence file, derived from the contracts (`npm run qualification:evidence`): it gained the rows of the new detectors, families the public snapshot does not carry. `methodsRun.evaluationEvidence.digest` pins the new file; the digest the recorded methods run was measured with is kept as `measuredWith` and the run record is not rewritten (`official-runs:check` accepts a recorded run's digest only if it is the pinned one or listed there). A methods run made from now on records the new digest.
4. **The legacy oracle was regenerated** at beta.13 with the pinned trufflehog 3.97.4 (`npm run bench`, `npm run eval:classify`) and `docs/generated/qualification-parity.json` rebuilt: 43,358 values compared, 42,533 equal, 825 explained, 0 unexplained.
5. **A cause was added** to recognise the nine second-wave families: `family-not-in-accepted-evidence` (222 differences). A family whose new-side fixture total is 0 and whose accepted populations hold 0 cases is explained as absent from the accepted evidence; the legacy path counts the project's own fixtures of it. The rule never applies to a family with any case on the new side.
6. **The nine new families stay provisional.** The Square contracts are T1 conditional on the open ruling Q8 (`policy-q8-exact-width`); the other seven are T3 placeholders. No new family claims a status the accepted evidence cannot support. A snapshot that carries them is a later evidence adoption by the owner ([evidence-adoption.md](../specs/evidence-adoption.md)).

## Consequences

- `authority:check`, `official-runs:check --bindings` and the axis-overlay test pass on this change, so #757 can merge and `pin-drift` can go green.
- The view reports 123 stable, 20 provisional, 1 pending, 0 unsupported of 144 families (the 10-05 acceptance: 11 provisional; the nine new families and no other change).
- Rollback: revert this change, or set `authority` back to `legacy` (`docs/specs/qualification-cutover.md`).
- Cost: no official run was dispatched.
