# CI validation: planned from changed paths, artifact-first

Issues: [#654](https://github.com/redact-secret/redact-secret-benchmarks/issues/654), [#655](https://github.com/redact-secret/redact-secret-benchmarks/issues/655) and
[#656](https://github.com/redact-secret/redact-secret-benchmarks/issues/656), of the cleanup epic [#651](https://github.com/redact-secret/redact-secret-benchmarks/issues/651).
Decision: [Run the legacy measurement as an explicit oracle and plan validation from changed paths](../decisions/2026-10-05-run-the-legacy-measurement-as-an-explicit-oracle-and-plan-validation-from-changed-paths.md).
Inventory and what may be removed: [qualification-cutover.md](qualification-cutover.md#file-level-inventory-and-cleanup-order-653). This changes where checks run, never what they assert, and removes nothing.

## What runs, and when

`validate.yml` runs on a pull request (once: the `push` trigger is `develop` and `main` only, so a branch push no longer starts a second, identical run), on a push to `develop` or `main`, on a weekly schedule and on dispatch.
`scripts/ci-plan.mjs` (the `changes` job) plans a pull request from its changed files and writes the plan, and the reason for each choice, to the job summary. **Every other event runs everything**: the integration branch, the release
(`main`), the schedule and a dispatch always run the complete suite, so what a pull request skipped is run again before and after it merges.

| Job | What it does | Runs when |
| --- | --- | --- |
| `validate-sources`, `unit-tests` (4 shards), `pin-drift` | the cheap committed-file gates, the root unit tests, the product pin check | always |
| `legacy-oracle` (`legacy-oracle.yml`) | the legacy engine on the published scanner, the four-scanner comparison on validated peer snapshots (no peer binary), the legacy export's route recount, layout check and Playwright suite | the plan selects the legacy measurement, or the event is not a pull request |
| `legacy-results` | the legacy files the pages that still compare scanners read (`public/results`: the run, the evaluation), measured only on a cache miss | the plan selects the site |
| `view` | the new-authority qualification view from the accepted official RunArtifacts | the plan selects the site |
| `web-build` | `check:no-sx`, `check:header`, typecheck; the legacy export (the rollback state) built and recounted; the committed `new` export built from the view (`WEB_REQUIRE_QUALIFICATION=1`) and recounted against the view; the assembled site root and the publication guards | the plan selects the site |
| `web-unit` | Vitest with coverage, at least 80% of lines, statements, functions and branches | the plan selects the site |
| `web-browser` (`layout`, `e2e`) | Storybook and the layout check; the Playwright suite; both on the `new` export built from the view | the plan selects browser checks |
| `validate` | the required check: the aggregate of every job above | always |

`validate` accepts a job as **success**, or as **skipped only where the plan did not select it**; a failure, a cancellation, a skipped job the plan selected and a missing plan all fail it. The skip is therefore auditable: it is in the plan summary
and in the `validate` log, and a job cannot skip itself into a pass.

## The changed-path dependency map

`scripts/ci-plan.mjs` holds one map, tested in `tests/ci-plan.test.mjs`. It errs towards running: a path it does not recognise, an empty change and a failed diff run everything.

- **Everything:** the two workflows and the composite actions that run the checks, the lockfiles (`package.json`, `package-lock.json`, `web/package*.json`), `tsconfig.json`, `schemas/`, the Dockerfile and the plan itself.
- **The legacy measurement** (the oracle): `benchmarks/` except the files only the view or pages read (`benchmarks/qualification/`, `official-runs*`, `qualification-*`, `evidence-adoption.json`, `support/research-projection.{json,mjs}`, `evidence-case-metadata.json`, `fixture-descriptions.json`, `lib/fixture-metadata.ts`), `scanners/`, `corpora/`, `fixtures/`, `peer-observations/`, `qualification/`,
  `holdout/`, `adversarial/`, `baselines/`, `evidence/`, `src/`, and every script that is not new-path tooling (shared code, generators and the engine's entry points).
  `scripts/research-projection.mjs` and `scripts/evidence-case-metadata.mjs` derive display facts only. A change confined to either projection or its metadata files runs the full site validation without repeating scanners; source gates (including `research:check` and `fixture-metadata:check`) and root unit tests still run.
- **The site build:** `web/`, plus everything the services read: the benchmark files, the corpora, the committed evidence, the legacy site's validators in `src/`, the scripts, and the docs the pages are built from (`docs/specs/qualification/`, `docs/generated/`).
  Prose, the root unit tests and other workflows select neither (the root unit tests always run).
- **Browser checks.** A change that is only components or routes selects the pages and stories it can reach: the import graph from the changed file through components and routes to the pages that render it (routes) and the stories of every component on that path.
  Anything else in `web/` (theme, layout, lib, resolvers, services, configuration, browser tests, the data layer) or any data the pages are built from is the full suite. A unit test alone needs no browser. The selection is handed to the layout check as `LAYOUT_SELECT` and to the page matrix as
  `WEB_BROWSER_SELECT` (`a/b` is that page, `a/b/*` the pages below it; `{"all": true}` is everything). The other Playwright specs name their own pages and always run in a browser job.
- **Unit and component tests** always run in full when the site is selected: a coverage threshold is only meaningful over the whole suite.

## Where the new-authority data comes from (#654)

The committed authority is `new`, so the pages are tested on the export built from the view, not on the legacy pipeline.

- **Source.** The view is built from the canonical official RunArtifacts of `benchmarks/official-runs.json`, which are a release asset of this public repository (`benchmarks/official-run-archive.json`), and from this checkout's benchmark-owned policy and the product
  populations' case metadata (`qualification:export`). The three populations are run class `public`; no candidate, protected or raw holdout data is in the archive.
- **Integrity.** `official-runs:check --bindings` pins the corpus the case metadata is exported from; `official-run-archive.mjs fetch` accepts nothing whose bytes do not hash to the digest the registry records (a missing, extra, linked or altered file exits 1 and leaves nothing a build can read; `tests/official-run-archive.test.mjs`);
  the view builder refuses an artifact whose binding does not match its registry entry; and the Next service refuses a view built from other pins or another policy (`WEB_REQUIRE_QUALIFICATION=1` makes that a failed build). The route check then recounts every page from the view independently of the services.
- **Privilege.** `contents: read`, the default token, no secret, no `pull_request_target`, nothing written back. The archive is public, so a fork's pull request fetches it exactly as a branch of this repository does; there is no second, privileged lane and no synthetic fallback when the fetch fails (it fails the job).
  Genuine contract fixtures stay in the unit tests (`web/tests/unit/qualification-data.ts`, `tests/qualification-adapter.test.mjs`): synthetic, labelled as such, and never counted as a measured result.
- **Reuse.** A pull request whose inputs of the view did not change reuses the view built, and verified, for those inputs (the cache key is a digest of the input files, `keyOf` in the plan). The push to `develop`, the release, the schedule and a dispatch always fetch and verify the archive, so
  the digest check runs on every integration. The legacy results are keyed and reused the same way, by the inputs of the legacy measurement.
- **Rollback.** The legacy pipeline's export is still built and recounted in every `web-build` (`with-authority.mjs legacy`), and its browser checks run in the oracle.

## The oracle (#655)

`legacy-oracle.yml` is the legacy credential measurement kept as the oracle until the exit condition in `benchmarks/qualification-authority.json` is met. Moving it changes when it runs, not whether: it runs when a pull request changes an input of the legacy measurement, on every push to `develop` or `main`, on the weekly schedule
and on dispatch (it can also be dispatched alone). No legacy file is removed or edited. A UI-only or docs-only pull request runs no engine, no classification, no comparison and no benchmark: the legacy files the pages read come from the cache keyed by the legacy inputs.

## Cancellation

A superseded pull request run is cancelled (`concurrency`, per pull request). A push, the schedule and a dispatch each have their own group and are never cancelled, so every tip of `develop` and `main` keeps its run. `validate.yml` deploys nothing; the publish workflows have their own concurrency and
are untouched.

## Reading a run

The `changes` job summary lists, for the legacy measurement, the site and the browser checks, whether each runs and the first files that selected it; the layout job prints `selected: N route prefix(es), M story file(s)` or `layout ok: …` for the full suite. To widen the map, add the path to
`scripts/ci-plan.mjs` and a case to `tests/ci-plan.test.mjs`; a path nobody listed runs everything, so a new directory is never silently skipped.
