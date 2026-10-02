---
decision_id: decision-switch-credential-qualification-authority-to-the-new-path
status: accepted
scope: benchmarks
title: Switch credential qualification authority to the new path, with the legacy path kept as the oracle and one value to roll back
decided_at: 2026-10-02
---

# Switch credential qualification authority to the new path, with the legacy path kept as the oracle and one value to roll back

## Context

#608, part of #602. The [cutover record](2026-10-01-record-the-cutover-criteria-and-legacy-disposition-for-credential-qualification.md) set seven
criteria and designed the switch as one committed value, reversible, with nothing deleted. By #641 the new path (credential-eval official runs, the
RunArtifact adapter, the product qualification policy) reads **127 stable families against the legacy 127**: the same 127 families, 0 status differences of
135, and 0 unexplained of 35,084 values compared at #641; the report regenerated after #644 (which adds the support matrix, the overview numbers and the review peers) compares 42,611 values, again with 0 unexplained (`docs/generated/qualification-parity.md`). Criterion 5 asked for an owner to accept the new
path's verdict as Redact Secret's qualification of a published release. The owner of this repository did on 2026-10-02, explicitly, for
`@redact-secret/core@0.1.0-beta.12`. Criteria 6 (Next credential pages built from the new outputs) and 7 (a rehearsed rollback) were what the switch itself had to
deliver; the cutover record said so.

## Decision

1. **Authority for credential qualification is the new path**, as of 2026-10-02, for `@redact-secret/core@0.1.0-beta.12`. The acceptance is the owner's,
   given explicitly for the verdict the parity report records. This record is its ADR; it asserts nothing about the product beyond what the report records
   (the repository measures and records: the boundary rule).
2. **One committed value flips it.** `benchmarks/qualification-authority.json`, validated by `schemas/qualification-authority-v1.json` and by the
   `authority:check` gate in the `validate` workflow, holds `authority: "new" | "legacy"` (the cutover record called the values `legacy` and `next`; `next`
   collides with the name of the web framework, so the value is `new`). The same file carries what `new` is authorised for: the policy revision, the
   canonical run of every population and the methods run (by semantic digest), the parity report, this decision, the release and the date. While the value is
   `new`, `authority:check` fails if any of those no longer holds: a repin, a new official run, a policy change, a parity report with an unexplained difference or an
   ADR that is not accepted each make `new` stale until it is authorised again in a reviewed commit. While the value is `legacy` nothing is asked of the new path,
   and the authorisation block stays in place, so rolling back is changing one word.
3. **Exactly one reader in the app.** `web/services/authority.ts` reads the file; every consumer asks `services/credential-source.ts`, which returns the same
   shapes (`Catalog`, `MeasuredRun`, fixture bytes) from either pipeline, so the report, provider, family, detector and fixture pages and `/evaluation/credential/` render
   either without knowing which. `authority:check` fails if any other file names the file (`AUTHORITY_READERS` lists the allowed ones: the shape rules, the gate, the
   service, the schema, the tests, the post-build checks, the docs). A new reader is a decision.
4. **`new` builds the pages from the qualification view and nothing else; it never falls back to the legacy files.** A view that is absent, unreadable, built from other pins or
   not the one the authorisation names yields no numbers, only the reason and the commands. A page that showed legacy numbers under an authority of `new` would misstate where
   they came from. The pages are built over the population the population policy gives the floors and gates (the public evidence snapshot); the regression and policy
   populations keep their own denominators on `/evaluation/qualification/` and are never pooled in.
5. **Every page says which pipeline produced its numbers.** A `PipelineStamp` (a block with stories) is the first thing under the head of every report page and of
   `/evaluation/credential/`: the pipeline, whether it is the authority or the oracle, the population, engine, evidence release, run digest and the release the authority is for. The
   comparison, scanner and runtime pages stay on the legacy files under either authority (re-pointing them would remove the oracle, and they compare scanners on the legacy
   corpora); under `new` the accuracy page carries a stamp that says legacy, oracle.
6. **The legacy path stays intact, as the oracle, for a bounded period.** Nothing is deleted or retired: not `benchmarks/run.ts`, `evaluate.ts`, `classify-support.ts`, the engine, the legacy `web/`
   services and tests, the legacy checks, the existing site. They keep running in CI. The **oracle period ends** when all of the following hold: at least one further published
   release has been qualified through the new path and compared with the legacy path (parity report regenerated, 0 unexplained); the rollback has been rehearsed again against
   that release; and a removal PR lists each legacy file's callers first (`graft callers <symbol> --depth 3`) and is reviewed. It is also reviewed, not ended, on 2027-01-02: if no further release has been
   qualified by then, the maintainer decides whether to keep the oracle, with a new exit condition recorded here. A lapse of time removes nothing.
7. **The rollback was rehearsed in the switch PR** and the evidence is in the cutover record: both values built from one checkout, `check:routes` (which recounts every page against the
   legacy files under `legacy` and against the view under `new`), the web checks, and the legacy classification checks.
8. **CI keeps both states under test.** CI has no qualification view (it is derived from the manual official runs and never committed), so the committed `new` has no data pages to test in a
   browser there. The web job builds and browser-tests the export of the legacy pipeline, built by flipping the one value in the runner's checkout (`web/scripts/with-authority.mjs`,
   never committed, restored afterwards), and then builds the committed state and recounts it ("no view": every page names the new pipeline and says none backs the build). The unit tests choose
   their pipeline by an overlay root (`tests/unit/overlay.ts` pins legacy unless a test chooses), so they mean the same before and after the switch.

## What a page built from the view cannot show, stated rather than filled in

The view carries each case's expected spans and each scanner's outcome and counts, not the bytes of the case or where a scanner's ranges are. A fixture page built from it
says so where the file would be ("The bytes are not recorded"), draws no file, lane or download, counts the ranges a scanner reported without placing them, and shows the twin as a named,
linked fixture without its changed bytes. The accounted rates (leaked, flagged, twin discrimination, with their bounds) are computed over the view's case rows with the same accounting
the legacy bench uses; the diagnostics field is dropped because it needs offsets. Known-gap fixture ids are the legacy corpus's: a finding links to a fixture page only where the
view holds that fixture. The run date shown is the date the canonical run was recorded in `benchmarks/official-runs.json`. None of this changes a verdict.

## Consequences

- Authority for credential qualification is the new path from this commit. The Next app is built from the view, which is generated and never committed. The Next deploy (#643) already builds it
  from the archived canonical RunArtifacts and sets `WEB_REQUIRE_QUALIFICATION=1`, so what `publish-site.yml` publishes under `/next/` is the new-built pages from the next staging push, with the stamps, and a missing or unauthorised
  view fails the publish instead of publishing "no view". The existing site `publish-site.yml` also publishes is untouched: it still shows the legacy status and matrix, as the oracle. The workflow does not read the authority value itself.
- The view carries the support matrix as `supportMatrix` (#644) and the parity report compares it, but the legacy matrix and the candidate diff still run on the legacy engine, and no Next page shows a matrix, so none
  is wired here: a page that needs it reads `view.supportMatrix` through the same seam, with no second computation.
- A repin, a new official run or a policy change makes the authorisation stale and `authority:check` fails until a reviewed commit authorises the new view again. That is the intended
  friction: authority is not inferred.
- Rolling back is one commit that sets `authority` to `legacy`. No data is migrated and nothing is restored. The pages, the stamps and the checks follow.
- The legacy `web/` services, pages and checks are carried for the oracle period and tested in every CI run.
- The pins check (`pins:check`) and the pin-drift job are unchanged and out of scope; they are red for reasons that predate this change.

## Alternatives rejected

- **Switch by deleting or retiring the legacy path.** The epic and the cutover record forbid it before a further release is qualified and the rollback re-rehearsed.
- **An environment variable or a query string that selects the pipeline.** Authority must be one reviewed value in the history, not something a build can be configured into.
- **Fall back to the legacy files when the view is absent.** It hides which pipeline produced a number, the exact failure the stamp exists to prevent.
- **Pool the regression and policy populations into the report pages.** The no-pooling rule of #603 forbids it; they keep their own pages.
- **Re-point the comparison pages too.** They compare scanners on the legacy corpora and stay as the oracle; the stamp says so.
