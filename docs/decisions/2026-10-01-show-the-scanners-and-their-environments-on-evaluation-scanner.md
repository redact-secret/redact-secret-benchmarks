---
decision_id: decision-web-evaluation-scanner-page
status: accepted
scope: benchmarks
title: Show the scanners we evaluated with, and each one's environment, on /evaluation/scanner
decided_at: 2026-10-01
---

# Show the scanners we evaluated with, and each one's environment, on /evaluation/scanner

## Context

#612 (part of #543). The old site never says in one place which scanners the benchmark ran with or in what
environment. A scanner's name and version appear as a column of a report table, its mode line in a caption, its pin in
`qualification/suite-v1.json` or `package.json`, its checksums in `scanners/peer-checksums.json`, its configuration in the
committed peer snapshots and its runner in `evidence/562`. The `/workbench/*` pages list scanner ids next to results
(`Scanner execution: ...`, `Holdout scanners`) and nothing about setup. A reader who wants to quote or reproduce a number has to
assemble the facts. Mockup: https://claude.ai/artifact/1HJUT4fXynKkBTHdQQkrNT.

## Decision

1. **One page, `/evaluation/scanner/`**, part of the new `/evaluation` section. The old `/workbench/*` is untouched.
2. **Order.** A roster (scanner, kind, version, where the version is pinned, the run's mode line), a note on published and
   candidate, then one section per scanner. Every section has the same four groups in the same order: Install and pin, How it ran,
   Where it ran, Rules; then Out of scope, then the comparison pages that include it. Scanners appear in the run's own order
   (the product first); there is no sort, no highlight and no outcome anywhere on the page.
3. **Deliberately not shown.** Counts, rates and leaked spans (they are on `/report` and `/comparison/*`); the description twice
   (the roster carries only the kind); raw JSON (the exact arguments sit in a disclosure); a list of 68 snapshots (one line when they
   agree, the disagreement when they do not).
4. **Sources, all validated before use** (`web/services/scanners.ts`): pins from `qualification/suite-v1.json` and `package.json`
   with the lockfile's integrity hash; install from `scanners/peer-checksums.json` (the archive and SHA-256 `provision-peers.mjs`
   checks); configuration, platform, replays and observation date from the committed peer snapshots, each read through
   `validateSnapshot`; the mode line, the observed version and the host of the fresh observation from the run; rule counts and rule file
   from `scanners/peer-rule-families.json`; the runtime comparison runner from `evidence/562` through `services/runtime.ts`; the
   product's adapter configuration from `scanners/index.mjs`. `check-export-scanners.mjs` reads the pins, the run, the checksums and the
   registry again, independently, after the build.
5. **Kind.** The registry says whether a peer is a repository scanner or a runtime library. The product is not a peer; the
   runtime comparison plan names it a runtime library, and when the plan is absent the kind is "Not recorded".
6. **Out of scope is a reviewed registry field.** `scanners/peer-registry.json` gains `outOfScope`: one to six plain statements per peer,
   each at most 200 characters, validated by `peerRegistryProblems` (no ranking or judgement word) and by `npm run peer-rules:check`.
   The statements restate what `scanners/README.md` and the adapter already say (verification off, engines not measured, processors
   not used). The registry is not part of an adapter's identity, so nothing in the ledger is re-keyed.
7. **Published and candidate.** The page states the run's mode as the report pages do (`modeText`) and explains the two modes once.
   Only redact-secret has a candidate mode; the peers run at their pinned release in both.
8. **Not recorded, with follow-ups.** A fact the repository does not hold is a dashed "Not recorded", never a guess:
   the host (OS release, CPU, Node) of a peer snapshot (#620); the host and CI runner image of the run (#621); the product's own
   out-of-scope statements (#622). The runtime comparison evidence records redact-secret `0.1.0-beta.11` as a local source build while the
   run measures the published `0.1.0-beta.12`; the page shows both as recorded (#572 owns whether to time the published release).
9. **Environment facts are those of the run that built the page.** The "This run" host is read from the suite reports, so a local
   build shows the local machine and the published build shows the CI runner. No test asserts one; the unit tests use synthetic
   scanners, runs and snapshots, and the e2e suite asserts structure only.
10. **Code.** Blocks in `web/components/evaluation/scanner/` (`ScannerRoster`, `ScannerModeNote`, `ScannerProfile`, `ScannerOverview`)
    with stories for default, not recorded, long content and phone; `resolvers/scanners.ts` is pure; `resolvers/pages.ts`
    `resolveScannerPage` awaits the services. `tests/web-tokens.test.mjs` treats a folder of folders as a section so
    `components/evaluation/<phase>/` is checked like any group.
11. **The e2e console watch ignores one benign warning.** Adding this route moved the bundler's CSS chunking: Report and Comparison
    pages no longer share every stylesheet chunk, so a page's header-link prefetch preloads the other section's chunk, and Chrome warns
    after a few seconds that it was "preloaded but not used". In CI that failed 33 matrix tests on pages this change does not touch
    (develop's tip, with the old chunking, passed). The warning is the prefetch working, and any route added to the app can move the
    chunk boundary again, so `tests/e2e/fixtures.ts` skips exactly this message for `_next/static/chunks/*.css` and still fails on every
    other console warning or error.

## Old to new URLs, for cutover

There was no single old page, so there is nothing to redirect: `/workbench/*` keeps its pages, and the scanner facts that were spread over
`/report` peer columns and `/workbench` tables are now reached from `/evaluation/scanner/`. At cutover the Evaluation entry of the global
navigation replaces `/workbench`; a visitor of `/workbench/` goes to `/evaluation/`.

## Consequences

- A reader can see, in one place, the version, install and run settings of every scanner the benchmark ran with.
- A repin changes the page, not the tests. A new peer appears when it is in the registry, the rule map and the run.
- Three follow-up issues name the facts the ledger does not yet hold.
