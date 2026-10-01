---
decision_id: decision-web-fixture-page-route
status: accepted
scope: benchmarks
title: Keep a fixture's page on its suite page (?fixture=), and rebuild the page as the fixture mockup
decided_at: 2026-10-01
---

# Keep a fixture's page on its suite page (?fixture=), and rebuild the page as the fixture mockup

> Amended 2026-10-01 (#598, `2026-10-01-test-the-web-app-with-vitest-and-playwright.md`): the export-wide limits named here (total size, file count, the size of `data/`) are removed. They had no external basis: the site is static and deployed to S3 and CloudFront. Only per-page and per-request limits remain: one data file, the largest page, the largest rows page.

## Context

#588 (part of #543). The fixture mockup (https://claude.ai/artifact/JE71WM6PuwCuRA1Qeixr6Q) is titled
`/fixture/<suite>--<id>`, the route the existing site uses, so it implies one route per fixture. The design
spec (https://claude.ai/artifact/AdxPhDga62Uay4VvdyRQ7s) says nothing about fixture routes; it fixes the rule
that every state is an address. The new app serves a fixture as `/report/fixtures/<suite>/?fixture=<id>`
(#559, #575: `2026-09-30-add-rows-fixture-detector-and-findings-pages.md`,
`2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md`).

The export budgets in `web/scripts/check-export-rows.mjs` are 100 MB, 2,300 files, 14 MB of `data/`, 2 MB for
one data file and 1.5 MB for a page. Before this change the export is 87.2 MB in 2,006 files, with `data/` at
8.6 MB. A page per fixture is 5,925 pages of about 50 KB shell and three more files each: about 650 MB and
30,000 files, over every budget but the single-page size.

## Decision

1. **The route stays `/report/fixtures/<suite>/?fixture=<id>`.** The suite page is the shard: 67 pages, one
   records file each (`data/fixtures/<suite>/records.json`), the page of one fixture built in the browser from it.
   A sharded per-fixture design (numbered pages, or a page per family) was weighed and rejected: a fixture's address
   would depend on corpus order, or a fixture in two families would have two pages. No design that gives each
   fixture its own file fits 2,300 files without raising the budget fourfold. `fixtureHref()` in
   `resolvers/rows.ts` is the one place that writes the address, so the family page, the detector pages, the
   findings inventory and the twin links all resolve to it, and the other agent's family page needs nothing from
   this change but that function.
2. **Old `/fixture/<suite>--<id>` links** are a cutover task (#594): a host redirect, which needs no page.
3. **The page follows the mockup.** In order: head (breadcrumb Report / Providers / provider / family / id,
   eyebrow, id, slug, tags), what redact-secret recorded (outcome phrase, sentence, three recorded figures), the
   input and the output as two numbered files with a key, a span table (expected, reported, outcome), the
   near-twin or twins with the changed bytes boxed, why the fixture exists, and the other scanners behind a
   disclosure (table with the twin's outcome beside it, and every scanner's ranges as lanes).
   - The output draws the reported ranges over the input: a solid bar (the bytes under it are not drawn or read
     out), hatched where the range touches a partly exposed secret, and secret bytes no range covers shown in a
     dashed frame. Nothing is re-scored; the marks follow the run's own outcomes.
   - Characters nobody can see (BOM, NUL, zero-width and bidi controls, tab, carriage return, trailing spaces) are
     drawn as named symbols and the file says how many there are. The bytes are exact; "Download exact bytes" is a
     data URL of the same text, with no script.
   - A long file keeps the lines a mark touches with one line of context and counts the rest.
4. **Not recorded is a state.** The corpus holds no title and no "what it tests" sentence (#593): the page is
   titled by the id and the row says "Not recorded" with the group label the corpus does hold. A finding's rule and
   action and the release beside a milestone are not in the run or the records (#595). Nothing is filled in.
5. **Records grow additively.** A record gains its group, axis, expected action, milestone, scenarios and the
   first 12 hex digits of its sha256; shared strings are held once per suite (`SuiteShared.texts`). The shared part
   gains the run's date and mode, each scanner's snapshot dates, the family-to-provider names and the scenario
   titles. `check-export-rows.mjs` recomputes each from the corpora, the fixture index and the run, and each packed
   row from the run's own row.

## Measured

Before: 87.2 MB, 2,006 files, `data/` 8.6 MB, largest data file (`detector-coverage`) 1.06 MB. After: 87.7 MB,
2,006 files, `data/` 9.1 MB, 1.13 MB. All inside the budgets; no budget changed.

## Consequences

- No new route, page or file in the export. A reader without script sees the suite's rows, as before.
- The crumb of a loading fixture is the suite's and the loaded one is the family's; the fixture view reserves two
  crumb lines on a phone so the title does not move when the data arrives (`check:layout`).
- Rejected: a page per fixture (budgets), a per-family or numbered shard (unstable or duplicated addresses), a
  client rewrite of `/fixture/<slug>` on a static host (no such request reaches the app).
