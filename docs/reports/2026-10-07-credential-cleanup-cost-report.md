# Credential cleanup cost report (#651, 2026-10-07)

What the credential cleanup (#653 to #660) did to the wall time and runner-minutes of pull-request validation and of the
staging publish, measured from recorded GitHub Actions runs, and what it cost to measure. It reports a measurement and
asserts nothing about product output. The tool is `scripts/job-timing.mjs`; the numbers below were collected with
`gh run view <id> --json jobs` (job `startedAt` and `completedAt`), wall time is the first job start to the last job end of
the run, and a runner-minute is `ceil(job seconds / 60)` summed over jobs (arithmetic, not a bill; the rate is 1x on
Linux). The run ids are listed at the end so every figure can be re-derived.

## Result in four lines

- **PR validation, wall time:** lower. The median of comparable full runs went from 595 s (n=15, before) to 412 s (n=33, after), because the one 12-minute `web` job became parallel jobs.
- **PR validation, runner-minutes:** higher, not lower. 21 before, 46 after for the same "everything ran" case; 30 when the legacy oracle is skipped; 11 for a docs or tooling change that runs no web job. The split pays job setup several times and the browser suite is now a full job.
- **Staging publish:** four runs after the publish switch (#819) have a median wall of 366 s against 520 s for twelve runs before it, and 7 against 10 runner-minutes. The ranges touch (344 to 426 against 387 to 606) and the removed steps are worth tens of seconds, so this is suggestive and **no saving is claimed**.
- **Measurement is a separate bill:** an official-run replay or control copy is 10 to 15 runner-minutes each, one time per candidate or repin, and is not part of build or validate.

## Baseline named in the epic

Run 37031419902 (PR `fix/631-detector-snapshot`, 2026-10-02): wall 712 s, 24 runner-minutes, one job `web` of 706 s with
these steps: web install, benchmark and evaluation 68 s; static export of the legacy pipeline 40 s; unit and component
coverage 156 s; Chromium install 22 s; layout check 322 s; Playwright suite 33 s; the committed authority built with no
qualification view 20 s. Beside it: `validate-sources` 66 s (34 s of it the legacy evaluation exercise), `scanner-comparison`
84 s (52 s of it support classification), four unit-test shards 30 to 104 s, `pin-drift` 74 s. **One run is one observation.**
It is used here only as the first of fifteen "before" runs.

## PR validate runs: before and after

Selection: every successful `Validate benchmark sources` run of event `pull_request` whose head branch is not `develop`
(those are the release PRs to `main`). Failed, cancelled and in-progress runs are left out, which favours both groups
equally but hides retries. "Before" is created on 2026-10-02 or 2026-10-03 (15 PRs, before #654 closed on 2026-10-05).
"After" is created after #656 closed (2026-10-05 16:49Z), 2026-10-06 to 2026-10-07 (42 PRs). The "after" PRs include
the cleanup PRs themselves and unrelated evidence, PII and repin PRs; the "before" PRs are mostly pin and PII work.

| Group | Runs | Wall, median (range) | Runner-minutes, median (range) |
| --- | --- | --- | --- |
| Before (one `web` job, scanner-comparison in the main workflow) | 15 | 595 s (422 to 725) | 21 (19 to 25) |
| After, all successful PR runs | 42 | 403 s (112 to 2288) | 46 (10 to 54) |
| After, web jobs and the legacy oracle both ran | 33 | 412 s (326 to 2288) | 46 (40 to 54) |
| After, web jobs ran, legacy oracle skipped | 6 | 380 s (282 to 514) | 30 (27 to 32) |
| After, no web job (docs, tooling, evidence) | 3 | 112 s (112 to 156) | 11 (10 to 12) |

Two "after" runs have a wall above 2200 s (37670256927, 37661905217): a hung `web-browser (layout)` runner that reached
its timeout and was re-run. The median is not moved by them; they are in the range because they happened.

### Jobs, medians (range), seconds

| Work | Before | After |
| --- | --- | --- |
| `web` (build, legacy export, unit coverage, layout, Playwright, no-view build) | 554 (416 to 718) | split, below |
| `web-build` (guards, legacy-rollback build and routes, `new` build and routes from the view, site assembly) | | 125 (86 to 145) |
| `web-unit` (Vitest with coverage) | inside `web`, 156 s in the baseline | 207 (123 to 253) |
| `web-browser (layout)` | inside `web`, 322 s in the baseline | 282 (198 to 411) |
| `web-browser (e2e)` (Playwright) | inside `web`, 33 s in the baseline | 268 (187 to 388) |
| `view` (fetch the official RunArtifacts, build the view, matrix and publication checks) | not a job (20 s no-view build) | 45 (12 to 100) |
| `legacy-results` (bench and evaluation for the legacy pages; cached when the inputs are unchanged) | inside `web`, 68 s in the baseline | 79 (9 to 117) |
| `legacy-oracle / web-legacy (layout)` and `(e2e)` | none (the legacy export was one 40 s step) | 358 (236 to 439) and 331 (212 to 857) |
| `legacy-oracle / engine`, `scanner-comparison` | `scanner-comparison` 77 (53 to 94) | 61 (38 to 74) and 92 (62 to 113) |
| `validate-sources` | 73 (51 to 84) | 52 (36 to 82) |
| `pin-drift` | 82 (68 to 111) | 96 (73 to 132) |
| slowest of the four unit-test shards | 79 (56 to 104) | 94 (65 to 139) |

### What changed the workload

- #654 added the `view` job: the authoritative data is now tested from the pinned artifacts (the baseline built `new` with no view).
- #655 moved the legacy measurement into `legacy-oracle.yml`, run only when a legacy input changed. Most recent PRs still touched one (33 of 42), so the common case still pays it. The 6 PRs that did skip it cost 30 runner-minutes.
- #656 split the one `web` job into `web-build`, `web-unit` and `web-browser` (layout, e2e) that run in parallel, which is where the wall time went; each job installs again, which is where the minutes came from.
- The legacy export now has the same browser checks as the shipped one (`web-legacy` layout and e2e), because the rollback is retained: about 12 runner-minutes of rollback verification per full run that the baseline did not run (it built the legacy export once, 40 s).
- The Next site itself grew over the period (case pages, scanner pages, a longer Playwright suite): the Playwright step was 33 s in the baseline and the e2e job is 187 to 388 s now.

### Not comparable, stated plainly

- The "before" window is two days of mostly pin and PII work; the "after" window is a different mix. PR content, not only the pipeline, drives the web build and the oracle trigger.
- The suite behind "Playwright" and "layout" is not the same suite: routes, stories and populations were added. A job-by-job subtraction attributes nothing to the cleanup.
- Pins moved (beta.12 and beta.13 before, beta.14 and alpha.16 after); caches (legacy results, view) hit or miss per PR.
- Runner speed varies by tens of percent between identical jobs (the `pin-drift` job alone ranges 68 to 132 s with no related change).
- Failed and retried runs are excluded; a retry costs more minutes than any single run here.
- Runner-minutes are a per-job `ceil` of seconds, which rounds a 61 s job to two minutes; many short jobs inflate it. Whether minutes are billed at all for this repository is not read from the data.
- Nothing here compares memory, flake rate or maintenance effort.

## Staging publish job

`Publish benchmarks site` on pushes to `develop`, jobs `Publish to staging` plus `pii-public-synthetic / public-synthetic`
(14 to 29 s). "Before" is the twelve successful push runs on 2026-10-07 before #819 (the publish switch), "after" the
four since (#819, #818, #820, #821).

| Group | Runs | Wall, median (range) | Runner-minutes, median (range) |
| --- | --- | --- | --- |
| Before the switch, 2026-10-07 | 12 | 520 s (387 to 606) | 10 (7 to 11) |
| Before the switch, 2026-10-06 and earlier in the window | 13 | 575 s (349 to 955) | 11 (7 to 16) |
| After the switch | 4 | 366 s (344 to 426) | 7 (7 to 8) |

Steps of the runs the #657 agent compared: before, `Classify support` 36 to 61 s (it also held the roadmap, the domain gate
and the PII index); after, `Support matrix from the qualification view` 3 s and `Publish the provider roadmap, the domain
gate and the PII support` 8 s. `eval:candidate` took about 3 s and `eval:qualify` is inside the evaluation step (124 s before in
37644864500, 120 s after in 37662324144, 94 s in 37675158973). The `Publish` (S3) step alone varied 62 to 106 s and the Next
build 34 to 55 s across these runs, which is the size of the whole difference. So the arithmetic of the removed steps is tens of
seconds; the rest is run-to-run variance. The four "after" runs sit at or below the lowest "before" run in three of four, which
is worth watching and is not evidence at n=4. The bulk of the job, the discovery evaluation (`npm run eval`) and `bench --strict`,
is still run by the `new` publish and is a #658 entry point, not removed.

## Measurement costs, separate from build and validate

Official-run workflow (`official-runs.yml`, one dispatch each, maintainer approval):

| Purpose | Run | Wall | Runner-minutes |
| --- | --- | --- | --- |
| Full run at the beta.14 / alpha.16 pins (the accepted evidence replay, #808) | 37630100920 | 348 s | 11 |
| Control copy at the current pins (#657) | 37665271345 | 375 s | 12 |
| Candidate replay at the current pins (#657) | 37666522330 | 461 s | 15 |
| Earlier candidate replay and control copy (pre-repin, now historical) | 37543028377, 37546897867 | 419 s, 368 s | 13, 12 |
| Bounded incomplete-output rehearsal (#762) | 37658464165 | 122 s | 3 |

These happen once per candidate or per repin, they produce evidence, and they are the same order of magnitude as one full PR
validation (46 runner-minutes). An outlier shows the other end: run 37348356470 (a full run with a 2498 s public-evidence job
and a 272 s effect report) was 52 runner-minutes. A diagnostic lane run (#705) is not measured here. None of these is a
cost of building or validating the site, and none was dispatched for this report.

## Limits

- Observational, not an experiment: no controlled A/B of the same commit before and after.
- The sample is small for the publish job (4 after) and uneven for PRs (15 before, 42 after, windows of two days each).
- Only wall time and rounded runner-minutes are measured; no cost in money, no energy, no maintenance time.
- This report makes no claim that the cleanup reduced total runner-minutes. It did not, for the common PR; it reduced the
  wall time of a full validation by roughly a third, and it made rollback verification explicit work (about 12 runner-minutes).
- #660 removes one caller-free command and its files; its effect on CI time is zero by construction (nothing ran it).
  The larger saving, the legacy steps, the oracle jobs and the legacy web checks, is gated on the owner retiring the rollback
  itself ([qualification-cutover.md](../specs/qualification-cutover.md)), and would remove roughly 12 to 18 of the 46 minutes of a full PR run (the two `web-legacy` jobs alone are about 12; the oracle engine, scanner-comparison and legacy-results add a few).

## Run ids

- Baseline: 37031419902.
- Before, PR validate: 37031419902, 37052633971, 37046554453, 37049859931, 37094762704, 37096853134, 37098798515, 37120491574, 37123570060, 37127931025, 37144689362, 37146596539, 37148129835, 37155892068, 37163446997.
- After, PR validate: the 42 successful non-`develop` pull-request runs of `validate.yml` created 2026-10-06 03:19Z to 2026-10-07 18:53Z (`gh run list --workflow validate.yml --event pull_request`, filter conclusion success and branch not `develop`), from 37437381187 to 37670256927.
- Publish, after: 37675158973, 37669687896, 37668356138, 37662324144. Before: 37660018896, 37659411899, 37658196159, 37646691819, 37644864500, 37638015348, 37624371901, 37609031382, 37561682146, 37559346070, 37556017866, 37554222516 (2026-10-07) and 37548202616, 37545211533, 37535896608, 37534817597, 37533680879, 37525629740, 37521574520, 37517869427, 37513643096, 37472782235, 37469322995, 37469314531, 37459624758 (2026-10-06).
- Measurement: 37630100920, 37665271345, 37666522330, 37543028377, 37546897867, 37658464165, 37348356470.
