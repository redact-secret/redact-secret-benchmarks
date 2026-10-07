---
decision_id: decision-publish-the-site-from-validated-artifacts-under-the-new-authority-and-keep-the-legacy-steps-as-the-rollback
status: accepted
scope: benchmarks
title: Publish the site from validated artifacts under the new authority, and keep the legacy steps as the rollback
decided_at: 2026-10-07
---

# Publish the site from validated artifacts under the new authority, and keep the legacy steps as the rollback

## Context

#657 (C5 of #651). The support matrix (#731), the candidate diff (#746, #801, #802) and the qualification view (#602) read validated RunArtifacts, but `publish-site.yml` still measured the
credential qualification itself: `eval:qualify` (the engine's development methods and its protected-holdout lifecycle), `eval:candidate` (the saved-baseline comparison of the qualified candidate),
`eval:classify` and `eval:matrix` (the classification and the legacy matrix). The legacy matrix consumers (`eval:publish:matrix`, the provider roadmap, the domain index and the PII index) validate legacy
provenance the view cannot carry (decision of 2026-10-05: no forged provenance), and the committed authority has been `new` since 2026-10-02 with the oracle exit recorded on 2026-10-05 and again for beta.14.

The state of the artifacts at the current pins (core beta.14, credential-eval alpha.16, policy `rs-policy-1:sha256:5c8f6841...`): the four canonical official runs are recorded and archived; the registered candidates and
their control copy (decision of 2026-10-07 on the control copy) were measured on alpha.15 against beta.13, so no candidate replay exists at the current engine pin. A new one is a maintainer dispatch of
`official-runs.yml`, which this change does not make.

## Decision

1. **One seam for the authority.** `scripts/credential-publication.ts authority` is the only place the workflow learns the authority (a listed reader in `AUTHORITY_READERS`; the workflow never names the file). `new` runs the artifact consumers below;
   `legacy` is the rollback (one committed value) and runs the legacy steps exactly as before. The committed file is not written by this change, and the rollback is rehearsed by flipping the value for one command (`web/scripts/with-authority.mjs`).
2. **The qualification is the view; no engine qualification is executed under `new`.** The view is built right after the fetch of the official RunArtifacts, before anything slow runs, so a missing, altered or stale artifact fails the publish first. `eval:qualify` runs
   only under `legacy`. Under `new` the evaluation bundle is published without an embedded qualification and the `/evaluation` holdout page reads the committed frozen report, labelled as frozen (the state `services/evaluation.ts` already defines and CI already builds). The protected-holdout
   kernel and its lifecycle are not touched (the owner kept them on 2026-10-05); only their publication step is conditional.
3. **The support matrix is the view's, published as its own file.** `qualification:matrix --mode published` builds it, and `eval:publish:matrix --from-view` validates it again (`viewMatrixProblems`: `published` and public only, canonical runs of the registry at the current engine,
   the policy revision, taxonomy and official scanner roster of this checkout, allowlisted keys) and writes `public/results/support-matrix-view-v1.json`. The public `support-matrix-v1.json` contract is not changed in shape: under `new` it is not written; under `legacy` it is as before. The roster binding follows #812: every
   recorded population must have measured all the official required scanners and no scanner outside the roster (the optional ones may be present), and the discovery evaluation takes its scanners from the same roster.
4. **The legacy matrix consumers are adapted by validator, not by envelope.** The provider roadmap, the domain gate and the PII index take the support file of their authority (`--matrix`, `--support`, `--credential-support`). Each validates the file with the validator of its kind, picked by the file's own `schema`: the legacy
   matrix with `supportMatrixProblem`, the view matrix with `viewMatrixProblems`; neither accepts the other's file. The roadmap's `supportMatrix` identity gains a second shape (`source: qualification-view`, the policy revision and the canonical population digests) in `schemas/provider-dossiers-v1.json`, so no run id or date is invented.
5. **The candidate is read, never measured.** Under `new` and on staging, `credential-publication.ts candidate` looks the qualified candidate up in `benchmarks/product-candidates.json` by its core tarball sha256 and its product commit. Unregistered or never replayed: nothing is published about it and the step summary says so. A digest at another commit
   (or the reverse): refused. A replayed candidate: the replay archive is fetched with its recorded digest and `qualification:candidate-diff --verify-tarballs` runs on it; every refusal (a differing configuration or roster, bytes that do not hash to the record, a tarball that is not the registered one) fails the publish. The diff proves only that the candidate and its control differ in the product build, which is also true of a replay measured at an older engine against an older release, so the seam adds a freshness binding to the current pins (`candidateDiffFreshnessProblems`): the control is the pinned `redact-secret` release, every population of the control carries the semantic digest of the canonical official run the registry records, and the candidate is a build of that release or a later one. The recorded replays here (alpha.15, a beta.13 control) pass `qualification:candidate-diff` and fail this binding, so they are history and not a candidate statement about beta.14. The result is the internal allowlisted projection
   (counts and labels), kept under `results-output/` and summarised by counts only. It is not placed under `public/`, and `candidate-evidence-v1.json` is not written, because its legacy shape (`candidateProblem`) cannot carry an artifact diff and the page that reads it belongs to C6 (#658). The Candidate page therefore states that no release candidate is recorded. No released observation is reused as a candidate run, and
   released public artifacts never hold a candidate measurement.
6. **What the owner will see change on staging, stated.** (a) The support matrix on staging is the release's, from the view (129 stable of 182 at the accepted pins), not the legacy classification of the qualified candidate (150 stable in the last legacy publish): the difference is the one the parity report attributes (`canonical-evidence-membership`, 0 unexplained) and is the number the Next qualification pages already show. (b) The candidate evidence page shows no candidate until a candidate replay at
   the current pins is registered. (c) The holdout page reads the frozen report. Each is the consequence of not measuring in the publish job what an artifact now carries; none changes production until `main` is promoted by the owner.
7. **Rollback and its evidence.** The legacy steps stay in the workflow, guarded by `authority == 'legacy'`; the legacy matrix generator, publisher and roadmap are exercised on every push by `legacy-oracle.yml`, and the legacy Next export by its `web-legacy` job. `tests/publication-switch.test.mjs` fails if a legacy measurement step runs outside the legacy authority, if
   a consumer takes the other authority's file, or if the rollback flip leaves the committed file different.
8. **Nothing is deleted here.** `eval:qualify`, `eval:candidate`, `eval:classify`, `eval:matrix`, `eval:matrix:drift`, `benchmarks/qualify.ts`, `benchmarks/candidate.ts` and the matrix generators keep their `package.json` hooks (the rollback and the oracle call them). Their removal is #660, after #658 and the rollback's own retirement.

## Consequences

A repin that moves the engine, the policy, the taxonomy or the roster makes a stale view matrix refuse at publication; the fix is the view built at the new pins, never an edit. A candidate replay at the current pins (maintainer-dispatched, product access) is the only thing that makes the staging candidate step publish a diff;
until then it reports `not recorded`. The decision accepts nothing, records no run, flips no authority and changes no threshold.
