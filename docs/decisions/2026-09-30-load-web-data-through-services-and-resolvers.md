---
decision_id: decision-web-data-layer
status: accepted
scope: benchmarks
title: Load web data through build-time services and pure resolvers, and carry query state in the URL of a static export
decided_at: 2026-09-30
---

# Load web data through build-time services and pure resolvers, and carry query state in the URL of a static export

## Context

#556 (part of #543). The Next static export in `web/` has blocks that take
formatted props (`web/components/report/types.ts`) and routes that rendered
placeholders. Something has to read the ledger, turn it into those props, and
serve filter, search, level and paging state from a host that only serves files.

The data the existing site shows is produced by `npm run bench` into
`public/results/` (one report per suite, `run.json`, `summary.json`), plus
committed files: the taxonomy, the fixture corpora and semantic index, and the
known-gaps ledger. The existing site fetches the generated files in the browser
and re-validates them. The publish workflow runs the bench before it builds, and
the bench takes about 15 seconds (peer results come from committed snapshots).

## Decision

Three layers, one direction: **pages -> resolvers -> services**. Blocks import
none of them.

1. **Services** (`web/services/`) load data at build time. They read repository
   files, validate them with the validators that already exist (`reportProblem`,
   `summaryProblem`, `fixtureIndexProblems`, `validateKnownGaps`, `buildCatalog`),
   return typed raw data and memoise per build. No `fetch`, no network, no client
   import: `check:no-sx` scans them for fetching and the export check fails if a
   ledger file name reaches a shipped script.
2. **Resolvers** (`web/resolvers/`) are pure functions from raw data to block
   props. All formatting (numbers, percentages, intervals, counts, dates) happens
   here, in `en-US`. A count with no fixtures resolves to `null`, which blocks draw
   as "No fixtures"; a missing measurement resolves to a stated "Not measured", never a
   zero. Only `resolvers/pages.ts` imports services; the others are unit-tested with
   synthetic data (`tests/web-resolvers.test.mjs`, which also enforces the layering).
3. **Pages** (`web/app/`) are server components that call a page resolver and
   compose blocks. A small client island is allowed where the URL must change what
   is shown; it receives resolved props and may import `resolvers/filters.ts`
   (pure, no `node:`), never a service.

The site displays what the run recorded. Bounds and rates are the run summary's,
accounted once at bench time; no resolver derives one. Every stable count states
its mode (published or candidate) beside the run date.

**Source of run data.** The services read `public/results/*.json` and re-validate
each suite report against the fixture bytes and the summary against its suites,
exactly as the existing site does in the browser. The web CI job runs
`npm run bench` before the build, as the publish workflow does. When the files are
absent (a fresh clone) the pages render "No benchmark results for this checkout"
with the command, and `check:routes` fails only when `WEB_REQUIRE_RUN=1` (CI). The
committed `baselines/` were rejected as a fallback: they cover only the corpora that
existed when a release was saved (41 of 67 suites match today's fixtures), so they
would show a different, older count than the published site under a current label.

**Static-export query state.**

- `/report/families/<provider>--<family>/` is one pre-rendered route per taxonomy
  family (`generateStaticParams`, `dynamicParams = false`), including families with
  no fixtures. The family id's colon becomes `--`, and the build fails if two ids
  share a slug. An unknown id is a 404 served as `404.html` by the host.
- `/report/?level=T1|T2|T3`: the three levels are three pre-rendered panels. An inline
  script and a tiny client component set `data-level` on the root element and a CSS
  rule picks the visible panel, so a direct visit to a level URL paints the right
  level with no flash of another. Without script the default level shows.
- `/report/providers/`, `/report/families/`: the whole list is pre-rendered; a client
  island reads `?q=` and `?show=` after hydration and rewrites them with
  `history.replaceState`, so a shared link reproduces the view and typing costs no
  request. The first paint is always the default (the whole list), which is also
  what search engines and script-less readers get.
- Family rows page with `?page=N` the same way (`pushState`, so Back returns to the
  previous page); every row is in the page as data, the first page is HTML.
  Rows that need a look come first, then corpus order.

Rejected: reading `searchParams` in the server component (not available in a static
export), a redirect service worker, a per-level route with a client redirect (a flash
of another level), and fetching JSON on the client (the ledger must not be fetched in
the browser).

## Consequences

- A page cannot show a number that no service read and no validator checked.
- The web CI job now installs the root dependencies (which materialise the fixture
  corpora) and runs the bench (about 15 s) before building.
- Services import the existing site's `src/model.mjs`, `src/pages/data.ts` and
  `benchmarks/lib/*` (`allowImportingTsExtensions`; a `.d.ts` types `model.mjs`).
  `src/catalog.ts` cannot be imported (Vite `import.meta.glob`), so
  `services/catalog.ts` reads the corpora and calls the same `buildCatalog`.
- Data the ledger does not hold yet is a stated gap, not a guess: no per-fixture peer
  rows, no rule-to-family map for peers, no detector or findings pages in the new
  site. Each has a follow-up issue linked to #543.
- A fixture counts in every family it is related to; at provider level it counts
  once; a global fixture (no family) is in no row and is counted in a footnote. This
  differs from the existing report tree, which puts multi-family fixtures in one
  shared bucket.
