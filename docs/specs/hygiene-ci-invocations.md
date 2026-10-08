# Script, command and workflow reconciliation (#853)

## Reproduce the invocation graph

Run `npm run hygiene:ci-invocations`. The read-only review writes the graph of
regular tracked files to `results-output/hygiene/ci-invocations.json` and its
review index to `results-output/hygiene/ci-invocations.md`. No report is committed
and no absence of a graph edge approves a deletion.
The CLI omits symbolic links; the current nine are `.claude/skills/` directory
aliases, not script or workflow sources. A symbolic program path would require
separate caller review rather than an absence-of-edges deletion decision.

The graph records root and web npm commands, nested `npm run` calls, pre/post
hooks and installation `prepare`, direct script invocations, helper imports,
literal subprocess npm argv and reusable workflows. Workflow directories,
nested self checkouts and external product checkouts are distinguished. Computed
shell paths and argv are named as unresolved records instead of silently treated
as unused. The JSON includes every edge, duplicate command group, manual alias,
test-only/no-resolved-caller flag and versioned command flag.

The initial reviewed tree has 249 script files and 18 workflows. The actual
count changes with this work; the generated graph reports the exact current
counts. A false orphan found during review, `record-runner.mjs`, is called by
`performance-evaluation.yml` using the nested `benchmarks-repo/scripts/` prefix.
The parser and its synthetic tests now cover that shape.

## Cleanup decisions

- Remove `adoption:expectation-corrections`, the only alias hardcoding the
  archived `product-core-main-1e45cecf` triage and snapshot 2026.10.04.3 output.
  No tracked executable, workflow or document invokes that alias. Its exporter,
  tests, original queue and preservation tag remain. The generic exporter
  requires explicit `--triage`; one obsolete shortcut does not own its reusable
  implementation. To reproduce the historical queue without overwriting it:

  ```sh
  node --import tsx scripts/export-expectation-corrections.ts \
    --triage docs/generated/evidence-adoption/product-core-main-1e45cecf/triage.json \
    --out-json results-output/expectation-corrections.json \
    --out-md results-output/expectation-corrections.md
  ```

- Remove Python setup from `legacy-oracle / engine`. The command is credential
  evaluation with the published Node scanner. Its registry/method/scanner path
  executes no Python; root unit/source jobs still require Python for inventory
  parsers and keep their setup. A local twin evaluation with failing `python`
  and `python3` shims ahead of PATH completed 45 cases / 90 variants with zero
  generation errors, failed assertions or review entries. Job names and engine
  invocation are unchanged. This is a setup cleanup, not evaluator retirement.
- Keep the duplicate `eval` / `eval:discover` commands: `eval` is the supported
  explicit oracle entrypoint, and discovery is the publication entrypoint. Keep
  identical fixture `prepare` and pre-command hooks: they are independent npm
  lifecycle entrypoints, not duplicated jobs within one command.
- Keep `beta8:profiles`: its advisory profile accounting remains a referenced
  contract, not a product status claim. Keep the three `pii:beta11*` commands:
  their frozen population/protected evidence is still the bounded PII oracle.
  A version in the name is a review flag, not proof of obsolescence.
- Shared design tokens now reside in `shared/design-tokens/`. Changes select
  both legacy and new full browser checks and change both data input cache
  keys. Unknown-path fallback alone would not invalidate those cache keys.

## Manual and computed callers reviewed

The graph intentionally flags manual tools without a workflow/npm entrypoint.
These remain runnable owners of retained inputs; they do not cause routine CI
work. The review disposition is retention, with their direct CLI/file contract:

| Flagged tool group | Caller or retained contract |
| --- | --- |
| `adopt-pii-engine`, `record-pii-official-run`, `prepare-pii-evidence-adoption`, `record-deployment-receipt` | Owner-operated adoption/recording lifecycle in PII and evidence-adoption specs. They are not authorisations made by this cleanup. |
| `generate-pii-card-iban-stress`, `observe-pii-card-iban-stress`, `measure-pii-ssn-phone-stress` | Population authoring/observation and retained stress evidence; specialized population ownership remains. |
| `attribute-engine-effect`, `render-view-effect`, `summarize-adoption-replay`, `summarize-representation-effect`, `summarize-review-state-effect`, `summarize-scope-accounting` | Explicit input/output diagnostic CLIs used to interpret retained artifact/report evidence. Ad hoc execution is not an official run. |
| `batch2-readiness`, `report-batch1`, `report-batch2-r2`, `report-batch2-r3`, `render-groups-cde-*` | Historical batch/candidate evidence reproduction and narrative renderers; outputs are retained independently of CI frequency. |
| `check-evaluation-ui`, `job-timing`, `measure-report-growth`, `refresh-detector-finding-types`, `rekey-review-ledger`, `report-untargeted-action-split`, `verify-evaluation-bundle` | Documented/manual verification, metadata maintenance, ledger migration and report tools; preserve the owned inputs and explicit commands. |
| `core-build-cache`, `lib/retention-inventory`, `retained-data-dispositions`, declaration files | Computed workflow imports, actual tool imports, the durable-data inventory command or TypeScript type consumers. They are helpers, not obsolete CLI lanes. |

Inspect a flagged source's usage and the named spec before running it. None of
these is deleted solely because static command resolution cannot find its
manual or computed caller. New review flags remain visible in the generated
index; no allowlist suppresses them.

## Workflow lane contracts

The graph enumerates every workflow and trigger. These reviewed lanes retain
distinct contracts and cannot be merged merely because their setup resembles
another lane:

| Lane | Retained reason / scheduling |
| --- | --- |
| `validate` and reusable/dispatch `legacy-oracle` | Required aggregate, path-selected PR work and complete integration/weekly/dispatch coverage. Oracle retirement has independent gates. |
| `official-runs`, `pii-official-run`, `pii-population-replay` | Dispatch-only exact engine/population identities and recording boundaries. Ordinary CI consumes archived artifacts instead of commissioning new runs. |
| `pii-profile-cost` and `pii-profile-cost-v2` | Dispatch-only v1/v2 frozen protocol, plan, candidate, size, calibration and threshold identities. v2 reads reviewed candidate inputs; v1 retains its original pinned replay. They are not interchangeable receipts. |
| `refresh-peer-snapshots` | Explicit dispatch refresh plus live reproduction, preserving peer snapshot identity. It is separate from routine reuse of committed observations. |
| `execution-plan`, `peer-pii-runtime-throughput`, PII public/comparison reusable workflows | Manual planning, diagnostic/runtime and public/neutral artifact-consumer lanes. Their output/provenance contracts remain separate. |
| `publish-site`, `performance-evaluation`, `codeql`, `scorecard`, `adopt-evidence-snapshot` | Publication, controlled performance, security or adoption contracts; no required check or public/protected boundary is dropped. |

## Actual runtime and cache receipts

All durations below are GitHub API job/step timestamp differences, not billed
minutes. All five full validation samples succeeded. Their workload and hosted
CPUs are not controlled, so variation is reported rather than credited to the
cleanup.

| Job | Before 37836513491 | Before 37822251101 | PR 37842782484 | Integration 37845614212 | Warm view PR 37844520038 |
| --- | ---: | ---: | ---: | ---: | ---: |
| changes | 9s | 11s | 15s | 9s | 12s |
| validate-sources | 73s | 81s | 91s | 91s | 64s |
| unit-tests 1 / 2 / 3 / 4 | 67/103/85/104s | 64/109/42/83s | 46/94/117/70s | 56/94/108/68s | 64/94/90/63s |
| pin-drift | 109s | 120s | 109s | 83s | 105s |
| legacy-results | 92s | 67s | 59s | 107s | 92s |
| view | 40s | 49s | 51s | 47s | 31s |
| legacy engine / scanner-comparison | 39/85s | 65/105s | 53/104s | 65/99s | 50/101s |
| legacy layout / e2e | 290/348s | 313/339s | 329/310s | 310/203s | 322/243s |
| web-build / web-unit | 104/187s | 96/279s | 143/185s | 146/229s | 140/282s |
| new layout / e2e | 225/244s | 319/313s | 468/258s | 307/316s | 254/216s |
| validate aggregate | 2s | 4s | 3s | 3s | 4s |
| Sum of job durations | 2206s | 2459s | 2505s | 2341s | 2227s |

Runs: [before 37836513491](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37836513491),
[before 37822251101](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37822251101),
[PR 37842782484](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37842782484),
[integration 37845614212](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37845614212),
[warm view PR 37844520038](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37844520038).

The PR reuse receipt is [recorded in #853](https://github.com/redact-secret/redact-secret-benchmarks/issues/853#issuecomment-6068979942):
118s/126s of duplicated generation became 9s of installation plus transfer,
109s/117s shorter for that segment. Both consumers downloaded producer artifact
11577918679, 5,719,792 bytes, matching SHA256
`d18a710ef565511f34b36df1b65d0433082f7497b0f36f085250ab8f76b5da0e`.
Their independent route/data recounts, 196 e2e tests and 800 layout stories/pages
passed. Aggregate validation and the subsequent integration run passed too.
The full PR legacy browser jobs total 639s versus 638s/652s before; there is no
robust whole-job/dollar speedup claim. Fresh scanner comparison remains fresh;
routine validation installs no external peer binary, so its external scanner
provisioning cost is zero. Chromium installation remained 18s/18s and 25s/23s
before versus 22s/29s in the PR. Artifact transfer is included in the 9s segment.

### Cold and warm distinguishable caches

Dependency cache and result cache are separate. Npm dependency cache hit receipts
exist in both before runs, the PR and integration run. An existing dependency-cold receipt was subsequently found by checking the
first current-lock run; a duration alone never labels one cold.
Push integration deliberately does not restore the result caches.

The existing cold job was `unit-tests (2)` in
[run 37615788790](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37615788790).
At `2026-10-07T11:43:15.8576909Z` its setup log explicitly said
`npm cache is not found`; at `11:43:54.7456126Z` it saved the dependency key
shown below. That job succeeded, but the aggregate run failed in other jobs.
It is an observed installation receipt, never green full-run acceptance.
The cold source commit `3d2f1ba082b58b059551cc369b251483ff35b29a` and current
root lockfile have identical bytes, SHA256
`91090ff8efbb9a9b6a6ac7804ad2586cf9053346afac8c6116fc0ea25eb55ede`.
Every warm comparison restored that exact dependency key.

| Same unit-tests (2) job | Cache state | npm ci | setup-node / post |
| --- | --- | ---: | ---: |
| 37615788790 / 112773663546 | Explicit miss, key saved | 4s | 4s / 2s |
| 37836513491 / 113514791869, before | Explicit hit and restore | 4s | 3s / 0s |
| 37822251101 / 113465982096, before | Explicit hit and restore | 3s | 3s / 0s |
| 37845614212 / 113545607982, integration | Explicit hit and restore | 4s | 1s / 0s |
| 37844520038 / 113541930675, warm-view PR | Explicit hit and restore | 3s | 2s / 0s |

The ignored archive receipt `results-output/hygiene/ci-cache-receipts.json`
contains source commits, run/job identities, install timestamps, literal log
proof and the lockfile SHA. npm installation took 3–4s in both states; this
supports observed cache costs, not installation or whole-job savings.

In each of
37836513491, 37822251101, 37845614212 and 37844520038, the view job log says
`Cache hit for` and `Cache restored from key` for the exact npm dependency key
`node-cache-Linux-x64-npm-f8fb46b1010cd1dfddbed6d107b1b0e516c24dfb310847e18eba8e96c06b335e`.
Their view-job npm installation took 2s each. View construction took 14s/22s
in the before runs and 22s in integration; the warm-view PR skipped construction
and restored in 2s. The support-matrix publication/validation still ran,
7s/11s before, 10s integration and 11s warm-view PR.

Integration's legacy browser installation/transfer steps took layout 3s/2s
and e2e 2s/1s; both skipped report regeneration. Chromium took layout 20s,
e2e 19s. The warm-view PR's legacy browsers took layout 4s/1s and e2e 3s/1s
for installation/transfer, skipped regeneration, and spent 19s/23s on Chromium.
The integration's separate web dependency installation took layout 13s, e2e 9s;
the warm-view PR took the same 13s/9s. These still run after artifact reuse.
The full browser job times above include static export, independent recount,
Storybook where selected, and browser checks.

There is a verified same-key cold/warm **view-result** pair in existing PR
runs, without commissioning another run:

- Run [37844280894](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37844280894),
  job 113541223564, explicitly missed
  `qualification-view-view-v1-0d129837f42acecb77b60bd9d8e93c56e8e18e59`, built and
  saved that key. Its later cancellation is disclosed, so it is a cache-step
  receipt, not a green full-run acceptance receipt.
- Green run [37844520038](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37844520038),
  job 113542025486, explicitly hit/restored that exact key. Restore took 2s;
  rebuilding and cache-save were skipped. The view job took 31s. Its legacy
  payload cache missed separately; that legacy producer took 92s.

The source bytes bound to the view key are identical. Together with the unit2
dependency-cold receipt, these samples establish observed cold/warm cache
costs and per-job before/after runtimes. The measurements do not isolate hosted
CPU variation or establish a causal whole-run saving. Cache state is named only
where a log proves it; no warm-legacy-result claim is made. #853 requests
observed measurements, not a controlled experiment or every cache-state
combination for every job. No extra dispatch or cache mutation was needed.

## Acceptance status

The invocation graph, all named lane reviews, justified alias/setup cleanup,
preserved check names and fail-closed gates, real before/after job/transfer
receipts, and independent same-run consumer parity are implemented and verified.
The exhaustive graph is a conservative review surface with explicit unresolved
commands. The observed measurement criterion is complete: all-job before/after
runtimes, proven dependency/result cold/warm states, artifact transfer and
scanner installation costs are recorded above. Final integration of this
follow-up remains subject to the combined PR's green required checks; neither
whole-job savings nor causal billing savings are claimed.

## Local workflow validation

`actionlint .github/workflows/validate.yml .github/workflows/legacy-oracle.yml`
passed. Zizmor 1.30.1 reports the same 27 unsuppressed findings against the
base commit and the updated workflow tree: 10 high, 5 medium, 4 low and
8 informational. Existing findings are not represented as a clean security
scan. Scorecard was skipped because `GITHUB_AUTH_TOKEN` was unavailable.
The focused invocation/planner/workflow behavior suite passed all 27 tests.
