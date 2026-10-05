---
decision_id: decision-read-the-candidate-diff-and-baseline-from-artifacts-and-give-the-legacy-matrix-consumers-no-forged-provenance
status: accepted
scope: benchmarks
title: Read the candidate diff and the saved baseline from artifacts, and give the legacy matrix consumers no forged provenance
decided_at: 2026-10-05
---

# Read the candidate diff and the saved baseline from artifacts, and give the legacy matrix consumers no forged provenance

## Context

C5 (#657, under #651; reuses #579's remaining criterion) asks that the support matrix, the saved-baseline comparison and the candidate diff read validated measurement artifacts instead of the legacy engine. The matrix half landed in #731
(`npm run qualification:matrix`). The rest needed a candidate RunArtifact at the exact registered tarball digest, which a candidate replay (`official-runs.yml` input `candidate`, #698) produces as exploratory, internal `candidate-run-<population>` artifacts with a run
record and a receipt of every installed file. Two questions were open: what the saved baseline is when baselines are legacy slug-keyed files, and how the legacy matrix consumers accept a matrix that is not legacy-shaped.

## Decision

1. **The saved baseline is the control the adoption record binds by archive digest**, fetched and verified, never a legacy `baselines/<version>.json`. Both sides are keyed by the canonical `case_id`, so no baseline re-key is needed; review decisions reach canonical occurrences through the existing generated mapping (#638) and the diff neither reads nor writes the ledger.
2. **The candidate diff is a consumer, not a measurement.** `benchmarks/qualification/candidate-diff.ts` reads the recorded per-case measurement, re-scores nothing, and refuses anything that is not the registered candidate at its exact tarball sha256 set (record and receipt), an exploratory and internal run, bytes that hash to the record, agreeing repeat runs, and sides that differ in the product build only (engine, protocol, configuration, evidence, scanner identities, every peer's per-case results, the case universe). `--verify-tarballs` checks the registered bytes and the receipt's file list. The manifest label `build: released` of a candidate run is a shim artifact; the receipt binds the bytes.
3. **The output is an internal allowlisted projection** (`publication: internal`, `runClass: exploratory`; ids, families, tiers, measurement labels, counts; no span, byte or finding text), refused under `public/`, `web/` and `out/`. Candidate data never enters the published modes of the matrix (an internal run, an unrecorded digest and a candidate build are refused there).
4. **No compatibility envelope for the legacy matrix consumers.** `eval:publish:matrix`, `eval:matrix:drift`, the dossier roadmap, `family-status` and the legacy site validate with `supportMatrixProblem`, which requires legacy provenance (`sourceReport`: a run id, scanner observation provenance, the legacy fixture-index identity). The view carries none of it, and writing placeholder values would claim a measurement that was not made. The view matrix stays its own artifact for new consumers; the legacy consumers read the legacy file until the oracle's exit condition (#660). A test fails if the legacy validator accepts a view matrix. Schema compatibility is added only when a verified consumer needs it.

## Consequences

`publish-site.yml` is unchanged: its legacy steps (`eval:candidate`, `eval:matrix`, `eval:publish:matrix`) remain the oracle for the staging page, and the Next candidate service is unchanged (C6 owns `web/services`). The artifact-based diff is run by the maintainer on the artifacts of a replay; wiring it into a CI job needs a candidate run's artifacts in that job, which this repository does not hold on a push. The decision does not accept, promote or record anything.
Spec: `docs/specs/product-candidate-replay.md`.
