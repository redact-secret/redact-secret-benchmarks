---
decision_id: decision-web-rows-fixture-pages
status: accepted
scope: benchmarks
title: Add the level rows, suite and fixture, detector and findings pages to the static export, and ship a fixture's detail from its suite page
decided_at: 2026-09-30
---

# Add the level rows, suite and fixture, detector and findings pages to the static export, and ship a fixture's detail from its suite page

## Context

#559 (part of #543). The new report pages showed redact-secret only: the family page listed a
family's rows with one outcome, the three headline figures linked to nothing, a row was not a link, and
the hub had no Detectors tile and sent "What changed" to the GitHub milestone. The data was in the run
(`public/results/<suite>.json` carries every scanner's outcome per fixture) but `services/run.ts` kept only
redact-secret's rows. The existing site has a fixture page (bytes, expected spans, per-scanner ranges), a
detector page and a findings inventory that the new site lacked.

The corpus is 5,925 fixtures in 67 suites and 110 detectors. The cost of the export decided the shape: a
page of the new app is about 50 KB of shell (server-rendered emotion styles, header, flight data) and Next writes
three more copies of a page's data as `.txt` files (the existing family pages are 110 KB or more each), so a page
per fixture would be about 5,925 pages and 30,000 files, some 650 MB, and every build would change every file
(the stylesheet hash).

## Decision

1. **The page set.** Every route stays inside the `/next` app.
   - `/report/rows/T1|T2|T3/`: every fixture at one evidence level with one outcome column per scanner. The
     three figures on `/report/` link here with the `?show=` that isolates their rows (`leaked`, `flagged`,
     `twins`).
   - `/report/fixtures/` (the suites) and `/report/fixtures/<suite>/`: a suite's rows. The same URL with
     `?fixture=<id>` is the fixture's page: the exact bytes with one lane per scanner, the expected spans, each
     scanner's reported ranges and why the expectation holds.
   - `/report/detectors/` and `/report/detectors/<id>/`: the detectors by fixture count against the minimum
     sample size, and one detector's groups with the other scanners' figure for the same cell (the run
     summary's own `byDetector` figures), its format evidence, the findings on its fixtures and its rows.
   - `/report/findings/`: the findings inventory, each fixture a link to its page. "What changed" and the hub tile
     lead here; the milestone link moved to this page.
   - The family page keeps redact-secret's column and gains an "Every scanner" control and the level control
     (#560); the family and detector pages and the level and suite pages share one rows view.
   The nav gains Detectors and Findings. The hub's Detectors tile is back.
2. **One page per suite, not per fixture.** A suite page pre-renders the suite's rows and ships one compact
   record per fixture (bytes, expected spans, shared assessment text by index, each scanner's row packed to a
   short string). `?fixture=<id>` chooses the detail: an inline script and `FixtureSync` set `data-fixture` on the
   root element (the technique `?level=` uses), the rows hide, and the client builds the one fixture's lanes with
   the pure `resolveFixtureRecord`. A direct visit to a fixture URL never paints the rows; without script the rows
   show. 67 pages instead of 5,925.
3. **Rows ship compact.** A rows table's data is a dictionary of shared strings, a table of distinct outcome
   words and one small record per row (ids, indexes, a bit-flag number). The client filters by find, show, level and
   scanner scope and expands only the 50 rows it draws (`resolvers/rows.ts`). State lives in the URL (`?q=&show=
   &level=&scanners=&page=`).
4. **Client islands may import the pure resolvers** `filters.ts`, `rows.ts`, `rowdata.ts` and `fixtures.ts`
   (no `node:`, services only as types); a test enforces it. Pages still never import a service, and a client
   component never imports `resolvers/pages.ts`.
5. **Service changes are additive.** `RunScanner` keeps every scanner's rows (with ranges and byte counts) besides
   `productRows`; the catalog gains suites, detectors and the fixture bytes (held apart from the lean catalog); two
   small services read the accounting floor and the detector contracts. Nothing in `public/results`, the ledger or
   the existing site changes.

## Measured

Before (#558 to #560 not yet built): 182 pages, 31 MB, 935 files, `next build` 19.5 s. After: 365 pages,
102 MB, 1,853 files, `next build` 17.5 s on the same machine (a page per fixture, at the size of the existing
pages, would have been about 650 MB). The largest single page is `detector-coverage` at 1.5 MB
of HTML (1,309 fixtures). `check-export-rows.mjs` fails the build above 200 MB or 6,000 files, so growth
of the corpus meets a shard or paginate decision before the host does.

## Consequences

- A fixture's page is one address per suite, not one file per fixture: `/report/fixtures/<suite>/?fixture=<id>`.
  A crawler or a reader without script sees the suite's rows, which link to the fixture.
- The suite pages carry the corpus bytes and the per-scanner ranges in their data (never matched values or raw
  scanner output: a row holds ranges only), the same values the existing site's fixture page shows.
- The largest cost left is the duplicated page data the static export writes (three `.txt` copies of each
  page). A route handler serving each suite's records once as a static file would cut the export by about half
  and needs the "no client fetch" rule changed; it is left as a follow-up rather than decided here.
- Rejected: a page per fixture (size and rebuild cost above), fetching the ledger as JSON in the browser
  (the decision in `2026-09-30-load-web-data-through-services-and-resolvers.md`), and sharding suites into
  numbered pages (a fixture URL would depend on corpus order).
