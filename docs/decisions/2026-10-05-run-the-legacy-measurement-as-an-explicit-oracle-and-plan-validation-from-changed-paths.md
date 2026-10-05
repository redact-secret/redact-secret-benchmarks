---
decision_id: decision-run-the-legacy-measurement-as-an-explicit-oracle-and-plan-validation-from-changed-paths
status: accepted
scope: benchmarks
title: Run the legacy measurement as an explicit oracle, test the committed authority on the view, and plan validation from changed paths
decided_at: 2026-10-05
---

# Run the legacy measurement as an explicit oracle, test the committed authority on the view, and plan validation from changed paths

## Context

#651, #654, #655, #656. After the authority switch (#608) every pull request still ran the legacy measurement unconditionally (the engine on the published scanner, the four-scanner comparison, a benchmark run and an evaluation for the pages), built and
browser-tested the legacy pipeline's export because CI had no qualification view, ran the layout check and the Playwright suite as one serial job beside a 2 minute coverage run, and ran every job twice for a branch with an open pull request (`on: [push, pull_request]`).
The committed authority, `new`, was built last and with no data, so no populated new-authority route was ever tested in a pull request. The legacy path is the oracle until the exit condition in `benchmarks/qualification-authority.json`
(a further release qualified through both paths, a renewed rollback rehearsal, and the callers listed); moving where it runs is not the retirement the epic gates ([inventory](../specs/qualification-cutover.md#file-level-inventory-and-cleanup-order-653)).

## Decision

1. **The committed authority is tested on the view.** A `view` job builds the qualification view from the canonical official RunArtifacts: the public release archive of this repository, fetched with the read-only default token, every file checked against the byte digests of
   `benchmarks/official-runs.json`, the product populations' case metadata exported from the checkout whose corpus `official-runs:check --bindings` pins. The `new` export is built from it with `WEB_REQUIRE_QUALIFICATION=1`, recounted against the view, and the layout check and the Playwright
   suite run on it. The archive is public and holds only the three run-class-`public` populations, so a fork's pull request uses exactly the same lane with no token and there is no second, privileged lane, no `pull_request_target` and no synthetic fallback; contract fixtures stay in the unit tests and are never counted as a measurement.
2. **The legacy measurement is an explicit oracle workflow.** `legacy-oracle.yml` (callable and dispatchable) holds the engine exercise, the four-scanner comparison on validated snapshots (no peer binary) and the legacy pipeline's export, route recount, layout check and Playwright suite. It runs when a pull request
   changes an input of the legacy measurement, on every push to `develop` or `main`, on a weekly schedule and on dispatch. No legacy file changes. The legacy export is still built and recounted in every site build, so the rollback state is always validated.
3. **Validation is planned from changed paths.** `scripts/ci-plan.mjs` maps changed files to the checks they can affect (one map, tested). A pull request runs the legacy measurement only for its inputs, the site only for the site and what it is built from, and browser checks only on the pages and stories
   a component or route change can reach through the import graph; shared inputs, an unknown path, an empty change and a failed diff run everything. Every event but a pull request runs everything, so the integration branch, the release, the schedule and a dispatch are the full suite.
   The legacy files the pages read, and the view, are reused from a cache keyed by a digest of their input files on a pull request, and always produced (and the archive digest-checked) on every other event.
4. **`validate` stays the one required check and stays a fail-closed aggregate.** It accepts success, or a skip only where the plan did not select the job; a failure, a cancellation, a selected-but-skipped job and a missing plan fail it.
5. **One run per change, and no lost tip.** The `push` trigger is `develop` and `main`, so a branch with a pull request is validated once. A superseded pull request run is cancelled; a push has its own group and is never cancelled, and `validate.yml` deploys nothing.
6. **The site checks are separate jobs.** Unit and component tests, the site build and route recount, and the browser checks (layout and Playwright, each its own job with its own timeout) run in parallel instead of one serial job with a background Playwright process and a polling loop.

## Consequences

- A docs-only or UI-only pull request measures nothing in the legacy path and rebuilds nothing it did not change; a legacy-input change runs all of it. What each pull request skipped is in its plan summary and run again on the merge.
- The wall time and runner-minutes are measured on pull requests and recorded on the issues; one baseline run (37031419902: web 706 s) is not an average, and no saving is claimed from it.
- A cache hit holds exactly what the measurement writes for those input bytes, and the site's own gates (the service's pin and policy check, the route recount) still read the files; the integration branch measures without the cache.
- Nothing about the oracle exit changes: removal is #660, gated by the recorded exit, and the callers are in the inventory.

## Not decided here

- Retiring any legacy file, the oracle exit itself, and the rollback rehearsal against beta.13 (owner decisions, see the cutover record).
- Re-pointing the comparison and scanner pages off the legacy files (C6, #658), after which the legacy results job can be narrowed further.
