---
decision_id: decision-run-the-performance-evaluation-for-real
status: accepted
scope: benchmarks
title: Run the performance evaluation for real and retire the by-construction verdict
decided_at: 2026-09-23
---

# Run the performance evaluation for real and retire the by-construction verdict

## Context

[redact-secret-benchmarks#150](https://github.com/redact-secret/redact-secret-benchmarks/issues/150),
a follow-up from [redact-secret#591](https://github.com/redact-secret/redact-secret/issues/591)
verification: [#136](https://github.com/redact-secret/redact-secret-benchmarks/issues/136)
(paired with [redact-secret#603 (DS11)](https://github.com/redact-secret/redact-secret/issues/603),
recorded in
[`2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md`](2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md))
closed with its first acceptance criterion unmet:
`.github/workflows/performance-evaluation.yml` existed but had never run
(`gh run list --workflow performance-evaluation.yml` returned nothing), and
the recorded 46/46 PASS verdict came from core's older CI output at commit
`944341903d5b85686a056d3218f4c33110d7d57b` (beta.4) — three pre-releases
behind the commit `benchmarks/pin-manifest.json` actually pinned
(`079095e766e4a71e2b7e29413ed17be37bb3315d`, beta.6) — with thresholds
derived from, and evaluated against, that same frozen run. Secondary:
`scripts/check-performance-schema.mjs` validated a live summary against a
hand-maintained pinned copy of core's result contract
(`schemas/performance-assessment-v1.json`) but never read core's own source
at the pinned commit, so a renamed or removed field in core's
`assessment/schema.ts`/`assessment/complete.ts` would not be caught until a
live summary happened to violate the copy's structural checks.

## Decision

- **Dispatched `performance-evaluation.yml` for real** against `main`, the
  first execution ever
  ([run 35861463332](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35861463332)),
  building real release artifacts for all five surfaces at the exact commit
  `benchmarks/pin-manifest.json` pinned at the time
  (`079095e766e4a71e2b7e29413ed17be37bb3315d`). It evaluated **ACCEPTED**,
  46/46 checks, against `benchmarks/performance-criteria.json` as committed
  at measurement time — thresholds fixed from the unrelated, earlier beta.4
  run. That pairing (fresh build vs. pre-existing, independently-derived
  thresholds) is not circular; it is retired here because it is the first
  time this repository has recorded a verdict that is not.
- **Replaced `evidence/603/summary.json`** with this run's real output, and
  committed its `acceptance.json`/`acceptance.md` alongside it as the
  recorded verdict — see [`evidence/603/README.md`](../../evidence/603/README.md).
- **Recalibrated `benchmarks/performance-criteria.json`** from this same
  `summary.json` (`npm run performance:criteria`), so `baseline.sourceCommit`
  now matches the pin (`079095e766e4a71e2b7e29413ed17be37bb3315d`) instead of
  the superseded beta.4 commit. This recalibration is not re-verified against
  itself and evidence/603/README.md does not claim it is: any
  margin-derived threshold set necessarily accepts the run it was computed
  from, so that self-check was never meaningful evidence, only a sanity
  check that derivation ran. The meaningful verdict is the one above, which
  predates this recalibration.
- **Added a real pin-consistency check**:
  `checkPinConsistency` (`benchmarks/lib/pin-drift.ts`, run by
  `npm run pins:check` / `pins:check:local`) now also fails when
  `benchmarks/performance-criteria.json`'s `baseline.sourceCommit` does not
  match `detector-inventory.json`'s `redactSecretRevision` (and therefore
  `pin-manifest.json`'s `pins.redactSecretRevision`) — closing #150's third
  acceptance criterion mechanically, not just by coincidence today.
- **Added a real core-schema drift check**:
  `checkCoreSchemaDrift` (`benchmarks/lib/performance-schema-drift.ts`, run
  as `npm run performance:schema:drift-check` /
  `scripts/check-performance-schema-drift.mjs --core-repo <path>`) reads
  core's actual `assessment/complete.ts` and `assessment/schema.ts` source at
  the pinned commit — already checked out by
  `.github/workflows/performance-evaluation.yml` into `core-repo/` before
  this runs — and fails if `COMPLETE_ASSESSMENT_SCHEMA_VERSION`,
  `REQUIRED_ASSESSMENT_SURFACES`, or the field names of
  `AssessmentDistribution`, `AssessmentMemoryMetric`, `AssessmentProvenance`,
  or `AssessmentMemoryMetrics` have moved against the pinned copy
  (`benchmarks/lib/performance-schema.ts`). It runs as a new workflow step
  immediately after checkout, before any of the five language toolchains are
  built, so drift fails fast instead of after an hour of build time. This
  reads the workflow's own already-checked-out clone rather than a second
  network fetch of core's raw file, which is both cheaper and exactly
  reproducible against what the rest of the job measures. This complements,
  rather than replaces, `completeAssessmentProblem`'s existing runtime
  structural check on the produced summary — that check catches a shape a
  live summary actually contains; this one catches a field or surface that
  moved before any summary is produced at all.
- **Trigger stays manual `workflow_dispatch`.** #150 asked this decision be
  made explicit: this workflow builds five language toolchains from source
  and is not cheap enough to run on every push or every pin update, the same
  trade-off `2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md`
  already recorded for it and core's own "Complete assessment" workflow
  makes for itself. Per this repository's boundary rule (it measures and
  records, it does not assert product output, [`AGENTS.md`](../../AGENTS.md)),
  this repository does not add a release-candidate checklist of its own —
  that checklist, if one requires a fresh dispatch per release candidate,
  belongs to whichever process in `redact-secret/redact-secret` makes the
  release decision `.github/workflows/performance-evaluation.yml`'s header
  comment already states this evaluation "does not publish anything or gate
  a release." A future core-side RC checklist item can point at this
  workflow and at `evidence/603/README.md`'s reproduction command.

## Consequences

- `evidence/603/README.md`, `docs/specs/performance-acceptance.md`, and
  `src/pages/performance.ts` (which reads `benchmarks/performance-criteria.json`
  directly and needed no code change) no longer describe the recorded
  verdict as "by construction"; that phrase is retired from this
  repository's performance-evaluation documentation.
- Every future `performance-evaluation.yml` dispatch is a genuine test:
  its fresh build is checked against thresholds fixed before that
  dispatch, never against thresholds derived from itself in the same run.
- `npm run pins:check` / `pins:check:local` now fail if
  `benchmarks/performance-criteria.json` is recalibrated from a run of one
  commit while `benchmarks/pin-manifest.json` still pins another — the same
  silent-drift failure mode #150 found in the first place.
- This does not change scoring, gates, or ledger semantics (per #132's epic
  non-goals, restated in the prior decision), and producing a performance
  acceptance verdict here is still not a release gate.
