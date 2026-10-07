# #762 incomplete-output rehearsal (bounded CI)

Workflow `official-runs.yml` at develop `c7cb5cb4` (PR #815, which added `rehearse_post_engine_failure`). Population `regression-corpus` only, default
four-scanner selection, no `include_openredaction`, no public population, no methods run. Neither run is an official run: nothing was recorded in
`benchmarks/official-runs.json`, no view was built, no pin, authority, ledger or support status changed.

| Step | Run | Inputs | Result | Job time |
| --- | --- | --- | --- | --- |
| Rehearsal | 37658209433 | `populations=regression-corpus`, `rehearse_post_engine_failure=true` | failure, on purpose | 1m19s |
| Retry | 37658464165 | `populations=regression-corpus`, `retry_run_id=37658209433`, flag off | success | 1m57s |

About 3.3 job-minutes plus two 3 s plan jobs (about 5 billed runner-minutes with per-job rounding).

## (a) The failed rehearsal kept the finished output and named the stage INCOMPLETE

- The plain step ended with `official run refused: REHEARSAL: verification failed on purpose after the engine finished (--rehearse-post-engine-failure); the finished engine output is kept and this stage is INCOMPLETE` (exit 4).
- Step results: `Official run, twice...` failure; `Write the plain stage receipt`, the `stage-plain-*` upload and `Methods run` skipped. So no stage artifact and no run record was produced, and nothing was published or reused as a success.
- `Say plainly which stages are INCOMPLETE` annotated the job: `INCOMPLETE: plain stage of regression-corpus: REHEARSAL: verification failed on purpose after the engine finished ...; The engine output is kept in this job's artifact (official-run-regression-corpus); the run is not a success and the stage is not reused.`
- The `always()` upload published artifact `official-run-regression-corpus` (66,655 bytes compressed) holding `artifact-1.json` and `artifact-2.json` (597,512 bytes each, the finished engine output; the byte-copy cleanup runs on success only) and `stage-incomplete.json` (`status: incomplete`, `stage: plain`, `population: regression-corpus`, the reason above, `engineOutputKept`). No `run-record.json`.
- The qualification view and effect report were skipped.

## (b) The retry refused the incomplete evidence explicitly

- `retry-receipts.mjs` offered `official-run-regression-corpus` for the plain stage (`plain=reuse`, `plain_dirs=receipts-in/official-run-regression-corpus`).
- The driver rejected it: `receipt source receipts-in/official-run-regression-corpus not usable for the plain stage: the stage is marked INCOMPLETE (REHEARSAL: ...); its engine output is kept as evidence but never reused`, then `receipt not reused (...): measuring fresh`.
- The stage measured again in full (the documented limitation: post-engine checks are not re-run alone on a kept output), verified, and wrote a stage receipt (`plain regression-corpus engine 66db9b53... artifact sha256:12a61da6...`) uploaded as `stage-plain-regression-corpus`. The run succeeded.
- Reuse of a complete stage with a matching receipt identity was shown in rehearsal 37408443137 and retry 37408577689 (#768); the identity binding to scanner selection is covered by `tests/stage-receipts.test.mjs`. A second retry of this run was not dispatched (cost).
