---
decision_id: decision-web-evaluation-rc
status: accepted
scope: benchmarks
title: Show the release candidate beside the last release on /evaluation/rc, from recorded evidence only
decided_at: 2026-10-01
---

# Show the release candidate beside the last release on /evaluation/rc, from recorded evidence only

## Context

#613 (part of #543, phase P3 of the Evaluation section). The old site's `/workbench/changes` page is the closest
existing surface: it reads the candidate evidence `npm run eval:candidate` writes
(`public/results/candidate-evidence-v1.json`, contract `schemas/candidate-report-v1.json`) and the saved comparison
point `baselines/<version>.json`, and lists what changed. The `release-regression-check` skill defines the
regression view (regressed, fixed, unchanged, new, corpus sections never summed).

The candidate file is generated, git-ignored and written only by the staging publish
(`.github/workflows/publish-site.yml`, step "Measure the qualified redact-secret commit as candidate evidence").
Production never has one by design. A build in CI has none either. Committed `evidence/<issue>/<sha>/candidate-evidence-v1.json`
files are the durable record of past runs for their issues.

## Decision

1. **Route and order.** `/evaluation/rc/`. One h1, then: the two builds (last release and candidate: mode, version
   or short commit, commit link to the product repository, date, run id, scan completeness), what differs (counts
   of fixtures that moved each way and the two before-and-after figures the Workbench leads with), by evidence
   level, the fixtures that moved (linked to the fixture page, with both recorded outcome words), and the
   performance cost.
2. **The candidate is the generated evidence of this build, nothing else.** `services/candidate.ts` reads
   `public/results/candidate-evidence-v1.json` (the same `WEB_RESULTS_DIR` override as the run) and validates it
   with `candidateProblem`. It does not scan `evidence/`: an old committed run is history for its issue, and
   showing it as "the commit in development" would state something the benchmark did not just measure.
3. **No candidate is a designed state, not an empty table.** A build without the file shows "No release
   candidate is recorded": why, how a candidate gets recorded (qualification, then `eval:candidate`, then the next
   build), the command, and the last release for reference. Evidence that fails the contract shows "did not
   validate" with the reason and compares nothing. This is the normal state in CI and on production.
4. **The last release** is the baseline saved for the version the pin manifest names (`baselines/<version>.json`:
   run id, saved date) and that manifest's released product commit. When the evidence was measured against another
   saved baseline, that baseline is shown and a note says the pinned release is a different version. A version with
   no recorded commit says "Not recorded for this version"; the page never infers a commit.
5. **Dates are measurement dates.** The candidate's date is when `eval:candidate` finished; the release's is when
   its baseline was saved. The ledger does not record a product commit's own date, so none is shown.
6. **Classification reuses the Workbench.** Each fixture's move (regressed, improved, other change, unchanged) is
   `changeRows` from `src/evaluation-model.ts` applied to that one fixture, and the two figures are its rows
   "Required secrets left readable" and "False alarms on controls". The page and the old Changes page cannot
   disagree. "Other change" folds same-verdict range changes, project-policy rows that moved and pending (T0) rows
   that moved, each defined beside the table. The fixed corpus (rows with a release outcome) is counted; the
   expanded corpus has no release outcome, is described with its row count and is never added.
7. **Every figure names its mode and run.** A stamp line above each block gives the corpus section, `published
   <version> · run <id>` and `candidate <short commit> · run <id>`. Incomplete, filtered, dirty or failed evidence and
   fixtures with no candidate outcome each raise a note; counts then cover only what was compared.
8. **Performance cost is an explicit "Not recorded".** No performance run names a candidate commit, and the accepted
   run (`benchmarks/performance-criteria.json`) is of the release. The block names that run and says nothing is
   estimated. A before and after is not designed until a record exists to draw it from (follow-up issue).
9. **The moved list is capped at 100 rows per direction**; the group heading keeps the whole count and a line says
   so. A build-emitted file with every row is a follow-up if a candidate ever moves more.
10. **Wording is neutral.** "Regressed" and "Improved" are the Workbench's words and are defined beside their
    counts (what moved, not a judgement); the page says that nothing on it approves or blocks a release. The mode is
    a `StatusBadge` (`info` for candidate, a plain rule for published), so colour is never the cue and neither reads as
    a pass or a fail. This differs from the mockup, which tinted the two chips.
11. **Tests assert no ledger value.** The service and page are tested against synthetic evidence written into the
    overlay (`tests/unit/rc-fixtures.ts`): states and the counts of the rows the test wrote. The Playwright test
    accepts either state and asserts structure. Stories use invented hashes and counts.
12. **Components live in `web/components/evaluation/rc/`.** `tests/web-tokens.test.mjs` now treats a folder that
    holds only groups (`evaluation/`) as a namespace, so each phase's folder is checked like any other group.

## Old to new URLs, for cutover

| Old | New |
| --- | --- |
| `/workbench/changes` (and `?corpus=expanded`) | `/evaluation/rc/` |
| `/workbench` "Since <version>" panel | `/evaluation/rc/` |

The old `/workbench/*` URLs are not redirected now; cutover is not scheduled.

## Consequences

- A staging build reads a candidate with no extra step. Until then the page is the "no candidate recorded" state.
- The breadcrumb names the Evaluation section without a link until the hub (P1) exists; the section nav entry is added
  with the routes.
- Follow-ups: record a performance run for a candidate commit; a history of recorded candidate runs from `evidence/`;
  the full list of moved fixtures as a build-emitted file.
