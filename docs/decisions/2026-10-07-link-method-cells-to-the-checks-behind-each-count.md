---
decision_id: decision-link-method-cells-to-the-checks-behind-each-count
status: accepted
scope: benchmarks
title: Link each method count to the checks behind it, from bounded per-list files, and link qualification case pages only as another report
decided_at: 2026-10-07
---

# Link each method count to the checks behind it, from bounded per-list files, and link qualification case pages only as another report

## Context

#623 (parent #543; follows #614, #607 and the #785 bundle storage). The method pages `/evaluation/method/<method>/` (#614) show one
table per method: scanners across, checks down, each cell "n of N did not hold". They read the validated evaluation bundle one method at a
time (#789, `services/evaluation.ts`) and show no row. The old site ended each method page in an assertion explorer over the whole public
report (20,865 twin, 10,570 benign, 182,695 metamorphic, 100,305 mutation rows) and a review queue; a reader of the new pages cannot go
from a count to the checks behind it.

Two existing things look like they could answer that, and neither is the same report:

- **Qualification case pages** (`/evaluation/qualification/families/<family>/cases/<page>/`, #606) page the per-case rows of the
  qualification view: official credential-eval RunArtifacts, one section per population, its own case ids and its own outcome words.
  A method count is an assertion count of the **discovery** run (its run id, its cases hash, its variants). The two never share a run
  and their case identities are not the same; what they share is the detector family a case targets and the fixture corpus (the bundle
  is refused unless its corpus hashes equal this checkout's).
- **The bundle's own case parts** (#785, `public/results/evaluation-bundles/<id>/cases/<method>-NNNN.json`) hold every case of a method,
  but a part is up to 8 MiB and holds every scanner and every check; fetching parts in the browser is the whole-report reconstruction
  the issue rules out, and they are not files the browser may request (`lib/data-paths.ts`).

Measured on this branch (product-only discovery run, the state CI builds; `next build`, darwin): a static page per list and page of 100
checks costs about 64 KB of HTML and 61 KB of `.txt` flight data before its rows (`/evaluation/method/twin/cases/pair/redact-secret/fail/1/`
with a handful of rows). The full publication (four required scanners) records about 85,000 failed assertions and 19,000 complete
comparisons with a difference; by the per-cell counts of the last retained public report that is about 1,800 list pages for the failed
checks alone, so roughly 225 MB of shells before a row, on an export of 321 MB. The same checks as packed JSON are about 200 to 270
bytes each.

## Decision

1. **A cell links to the checks behind that count, and to nothing else.** On every tallied method (twin, benign, metamorphic, mutation) a
   count over zero links to the assertions of that row and that scanner whose status is `fail`, exactly the `n` it shows; a cell with no
   scored check that shows "Needs review" links to its `review-required` assertions, exactly the figure it shows. On differential a
   count over zero links to that peer's complete comparisons with that difference. The table and the lists come from one pass over the
   method's cases (`collectRows`, `comparisonsByPeer` in `resolvers/evaluation-methods.ts`), so a figure and its list cannot disagree.
   A zero, "No check" and "Not measured" link nothing. A row whose counts are another split of the rows above (benign "by policy action",
   differential "Family classification") says so under its label and links nothing; a row whose key cannot be an address says so too.
   The table says once what a count opens.
2. **One bounded file per list, one page per method.** The build writes `data/evaluation/<method>/<row>/<scanner>/<status>/checks.json`
   (`methodChecksDataPath`; `BUILD_DATA_PATH` and `check-export-rows.mjs` gain the pattern, kept equal by `tests/web-conventions.test.mjs`)
   holding one list: its run id and its checks in run order, each packed as case id, source slug, targeted families, variant, variant
   note, check, check note and the id of the source fixture's page when this build has one (a source fixture links only to a page that exists). Every file is under the 2 MB a single fetch may cost (`check-export-rows.mjs` fails a larger one). The
   page `/evaluation/method/<method>/checks/` (five pages; holdout has none, a holdout case cannot be opened) carries the index of the
   method's lists, each with its figure and address, as server HTML; `?row=&scanner=&status=&page=` opens one list, fetched once through
   `lib/build-data.ts` and windowed 100 checks a page with Previous and Next links that keep every filter. This is the fixture-page pattern
   (`2026-10-01-keep-the-fixture-page-on-its-suite-page.md`): one page per shard, the state in the address, the detail built in the
   browser from one bounded file, never from the report. No global file is written and no part of the bundle is fetched.
3. **Filters and identity stay in the address and on the page.** The method, row (the check, or the operator for metamorphic and
   mutation), scanner or peer and status are query fields; the list states them, the discovery run (id and date), the cases hash and the
   accounting version. A file whose run, list or length is not the page's is refused as "not from the same build".
4. **Qualification case pages are linked where the identity matches: the family, as another report.** A check's targeted family links to
   `/evaluation/qualification/families/<family>/cases/1/` only when the qualification view in this build is usable and has that family; the
   list says that page is the official credential-eval runs, per population, other case identities, and that nothing on it is these
   checks or is counted with them. With no usable view the families are named, not linked, and the list says why. No case of one report
   is presented as a case of the other.
5. **Review decisions stay in the ledger.** A list of checks that wait for review, and every differential list, says that whether a check
   or a difference is right is decided in `benchmarks/review-ledger.json`, never on the page. The page shows what the run recorded and no
   decision, no review state and no row of a protected corpus (the bundle is the public allowlist; holdout has no list).
6. **Tests hold structure, binding and recounts, never a ledger value.** Resolver tests (`tests/unit/evaluation-checks.test.tsx`) build a
   synthetic report and check that every link names a list whose file holds exactly the figure it sits on, that every list is linked from
   exactly one cell and listed once in the index, that pages window the file without losing or repeating a check, and that a foreign file
   is refused. `tests/unit/evaluation-equivalence.test.ts` holds the lists from a bundle equal to the lists from the legacy whole file.
   `scripts/check-export-method-checks.mjs` (in `check:routes`) recounts every list from the bundle the pages were built from,
   independently of the resolvers, and checks every file, every cell figure and every index figure against it.

## Consequences

- The export gains five pages and one small file per list (12 files, 500 KB for the product-only CI run); the publication's lists are
  bounded by the same per-file limit and grow with the number of lists, not with pages of shells.
- Without script a reader sees the index of lists and their figures, not the rows: the same trade as a fixture page.
- `output: export` refuses a route with no params, so a build with no list (no usable evaluation, or no count with checks behind it)
  writes one stated file, `data/evaluation/twin/not-published/none/fail/checks.json`, that holds a reason and no check; no page links it
  and the shape guard refuses it as a list. Every checks page then says why there is nothing to list.
- A new method, row or status is a change to `methodCheckLists` (and the classifier it shares with the table) and to the recount in
  `check-export-method-checks.mjs`; a new kind of data file still changes `BUILD_DATA_PATH`, `check-export-rows.mjs` and
  `2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md`.
- Nothing here changes a count, a denominator, the bundle, the review ledger, an authority or a support status.
