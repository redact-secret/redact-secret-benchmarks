---
decision_id: decision-web-same-origin-build-data-fetch
status: accepted
scope: benchmarks
title: Allow the browser one fetch, a same-origin GET of JSON the build emitted, and ship large rows and records that way
decided_at: 2026-09-30
---

# Allow the browser one fetch, a same-origin GET of JSON the build emitted, and ship large rows and records that way

> Amended 2026-10-01 (#598, `2026-10-01-test-the-web-app-with-vitest-and-playwright.md`): the export-wide limits named here (total size, file count, the size of `data/`) are removed. They had no external basis: the site is static and deployed to S3 and CloudFront. Only per-page and per-request limits remain: one data file, the largest page, the largest rows page.

> Amended 2026-10-07 (#623, `2026-10-07-link-method-cells-to-the-checks-behind-each-count.md`): a fourth kind of file, `evaluation/<method>/<row>/<scanner>/<status>/checks.json`, the checks behind one count of a method table, fetched by `/evaluation/method/<method>/checks/` when a list is opened. `BUILD_DATA_PATH` and `check-export-rows.mjs` carry its pattern; `check-export-method-checks.mjs` recounts what each holds.

## Context

#573 (part of #543). `2026-09-30-load-web-data-through-services-and-resolvers.md` (#556) said the
ledger must not be fetched in the browser, and `web/scripts/check-no-sx.mjs` failed any `fetch`. That kept every
row of a table inside its page. #559 then added the rows, suite, fixture and detector pages, and the export grew to 365
pages, 105 MB and 1,853 files: a suite page embeds every row and every fixture record, and Next writes the
page's data again as three `.txt` files (`index.txt`, `__next._full.txt` and the segment file). `detector-coverage`
was 1.5 MB of HTML plus 1.3 MB of `.txt` for one suite. The #559 record named this as the largest cost left and
named the rule as what blocked it.

The maintainer has decided the rule is relaxed. This record says exactly how far, so that the check scripts can
enforce the new rule instead of dropping the old one.

## Decision

1. **What the browser may fetch.** A same-origin `GET` of a JSON file the build emitted under
   `<basePath>/data/` (today `/next/data/...`), and nothing else. No other origin, no runtime ledger or API call,
   no credentials, no headers or body, no user data, no secret. The site has no runtime API: a route handler may exist
   only under `web/app/data/`, must be `force-static` and answers `GET`; at build it writes a file into the export.
2. **One helper.** `web/lib/build-data.ts` holds the only `fetch` (`fetch(dataUrl(path), { method: 'GET',
   credentials: 'omit', mode: 'same-origin' ... })`). `dataUrl()` accepts only a path that matches `BUILD_DATA_PATH`
   in `web/lib/data-paths.ts` (`rows/<kind>/<id>/rows.json`, `fixtures/<suite>/records.json`) and throws for anything
   else. `check:no-sx` enforces this by source: `fetch` anywhere else, any other network API (XHR, WebSocket,
   EventSource, beacons, SWR, axios, workers), another origin named in the helper, a route handler outside
   `app/data/` or not static, and an import of the helper from a block, service or resolver are violations.
3. **Layers stay.** Services read and validate at build time. Resolvers shape the data, pure. The route handlers in
   `app/data/` call the same page resolvers (`resolveRowsFile`, `resolveSuiteRecordsFile` in `resolvers/pages.ts`) that
   the pages call, so a file and the page beside it cannot disagree about a row. Blocks stay pure: they take props.
   Fetching lives in the helper and in page-level client wrappers (`app/report/RowsView.tsx`,
   `app/report/fixtures/[suite]/FixtureView.tsx`), which hand loaded data to blocks as props.
4. **What moves.**
   - A rows table (level, family, suite, detector) ships the first page of its default view in the page (HTML, and
     as `head` in the props) and, when it has more rows than one page, the path of `rows/<kind>/<id>/rows.json` with
     every row in the compact form of #559. A table that fits one page ships whole and never makes a request:
     `rowsSource()` in `resolvers/rows.ts`. 155 of 173 family tables, 92 of 110 detector tables and 36 of 67 suites fit
     one page, so the export holds 70 rows files (3 levels, 18 families, 31 suites, 18 detectors) and 67 records files.
   - A suite's fixture records (bytes, expected spans, packed per-scanner rows, shared text) ship once per suite as
     `fixtures/<suite>/records.json`, fetched the first time a fixture of that suite is opened. The suite page no
     longer carries them.
   - Kept in the page: headers, headline figures, the first page of rows, frames, and every count the ledger states.
5. **Loading never moves the page.**
   - The first page of rows is real content in the HTML, so nothing is blank and nothing is skeleton on an ordinary visit.
   - The file is fetched when the browser is idle after load (not on a data-saver connection), at once when the address
     asks for another view (`?q=`, `?show=`, `?level=`, `?scanners=`, `?page=`) or when a reader first touches the filter
     bar, and a hover or focus on a fixture link starts the suite's records.
   - Until the file is here the rows already drawn stay on screen. After 240 ms they dim (a load faster than that changes
     nothing visible), the count says "Loading rows", `aria-busy` is set, and the controls keep the choice made. When the
     file arrives the view applies the URL's state in place. No element above the table moves: the layout check asserts it.
   - The fixture view shows the fixture's title at once (it is in the URL) and a skeleton of the regions to come
     (`Skeleton`, `SkeletonBlock`), then the detail.
   - A failure says which it is (offline, file did not arrive, file not from this build), leaves the first page readable and
     offers "Try again" (`RetryNote`). An offline failure clears itself when the browser goes back online. A file whose row or
     fixture count differs from the page's (the site was updated while the tab was open) is refused and the button reloads.
     A failed background prefetch is silent until something needs the data.
   - Loads are cached in memory for the session and in-flight requests are shared, so a second view, another page of the
     same table, or the next fixture of a suite is synchronous. Failures are never cached.
   - Query state stays in the URL (`?q=&show=&level=&scanners=&page=` and `?fixture=`), a page change is a history entry, and
     a shared link reproduces the view.
   - Without script the first page of rows shows with a line saying find, filters and paging need JavaScript; a fixture URL
     shows the suite's rows.
6. **No new dependency.** One hook, `useBuildData`, in the helper. SWR, React Query and similar were rejected: a dependency
   for one kind of request that is cached for a session and never revalidated.
7. **The checks say what is true.** `check:routes` (`check-export-rows.mjs`) now requires exactly the data files the pages name
   (none for a table that fits a page, none orphaned), compares every rows file with the run and the index (ids, scanner
   columns, each outcome word, the flags the filters read, the level) and every records file with the corpora (bytes and expected
   spans) and the run (a packed row exists where the scanner has a row), checks that the first page in the HTML is the first page of
   the file, and holds the export to budgets set from the slimmed export. `check:layout` holds and fails the request for the data
   and inspects the loading, loaded and error states at 320, 375 and 768 px.

Rejected: a prebuild script that writes JSON into `public/` (it bypasses the resolvers and would drift from the page); one file
per fixture (5,925 files); fetching the ledger files (`public/results`) themselves (raw data, not UI props, and another
validation path in the browser); shipping fewer rows in the HTML and growing the table when the file arrives (the table would
move); a runtime API or any other origin (the boundary: the site displays what the build recorded).

## Measured

Same machine, clean builds, `origin/develop` 5554e240 against this change. Transfer is gzip, own origin, cold cache, Chrome
(`Network.loadingFinished`); Google Fonts and Next's router prefetch of linked pages are the same before and after and left out.

| | Before | After |
| --- | --- | --- |
| Pages (HTML) | 366 | 366 |
| Files | 1,853 | 1,990 (137 data files) |
| Export | 104.6 MiB | 81.8 MiB (data 8.2) |
| Suite pages, `report/fixtures/` | 40.9 MiB | 13.5 MiB |
| Level rows pages, `report/rows/` | 3.9 MiB | 0.6 MiB |
| `detector-coverage` page, HTML / `index.txt` | 1,527 KB / 1,274 KB | 156 KB / 22 KB |
| Largest table page | 1.5 MB | 158 KB |
| `next build`, clean | 23 to 31 s | 29 to 32 s |
| First load, suite page `detector-coverage`: document / own total | 109.5 KB / 360 KB | 13.6 KB / 280 KB (rows file 11.2 KB after idle) |
| First load, rows page `rows/T1`: document / own total | 30.6 KB / 282 KB | 13.3 KB / 285 KB (rows file 17.2 KB after idle) |
| Opening one fixture of `detector-coverage` | 360 KB, nothing more | 363 KB (records file 83 KB on first open) |

The export is 22% smaller, not half: a family or detector page is about 155 KB of HTML and three 21 KB `.txt` files whether it
holds 13 rows or 50, because its first page of rows, the inlined MUI styles (25 KB) and the page's flight data are there either
way. The 283 family and detector pages are 51 MiB of the 82 and this change does not touch them; the providers, families and
runtime pages are 1 to 1.2 MB each (four copies with `.txt`) and are the next cost. A suite page is 73% smaller.

## Consequences

- The document a reader waits for shrinks most where the table is largest; the rows arrive behind it, at idle, at the price of
  one request. A reader who never filters still pays for it unless they are on a data-saver connection; the file is 11 to 17 KB
  gzip for the two largest tables.
- `web/CONVENTIONS.md` states the rule; `2026-09-30-load-web-data-through-services-and-resolvers.md` and
  `2026-09-30-add-rows-fixture-detector-and-findings-pages.md` are amended by this record (their "no client fetch" and
  "follow-up" lines point here). The import direction is unchanged: a client wrapper may import the pure resolvers and
  `lib/build-data.ts`, never a service or `resolvers/pages.ts`.
- Data files are not content-hashed. A deploy replaces pages and data together; a tab open across a deploy meets the count check
  above and reloads. A host that caches `data/` for long needs revalidation, the same as for pages.
- The header still shifts once on first load when the web fonts arrive (measured at 0.011 to 0.059 CLS on a rows page before and
  after this change). That is the font swap, not the data, and is left for its own change.
- A new kind of build-emitted file is a change to `BUILD_DATA_PATH`, to `check-export-rows.mjs` (a test keeps the two patterns
  equal) and to this record, never a new `fetch`.
