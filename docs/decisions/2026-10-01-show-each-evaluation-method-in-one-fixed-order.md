---
decision_id: decision-web-evaluation-method-pages
status: accepted
scope: benchmarks
title: Show each evaluation method in one fixed order, with scanners across and checks down, and put the shared run on the hub
decided_at: 2026-10-01
---

# Show each evaluation method in one fixed order, with scanners across and checks down, and put the shared run on the hub

## Context

#614 (part of #543, phase P1 of the Evaluation section). The existing site's `/workbench/method/{twin,benign,
metamorphic,mutation,differential,holdout}` pages (`src/pages/workbench/method.ts`) show the same things on every
page, and much of it is repeated or is not a quantity anyone measured:

- a strip of ten sums (cases, variants, affected failing cases, failed, passing, review-required, not-measured and
  review-queue counts, generation errors, unsupported). The assertion counts are added over five scanners: on the
  twin page 7,689 "failed assertions" is a figure no scanner has;
- the same "Scanner execution" line and the same "Review-required is unscored" paragraph on all six pages;
- the canonical (unaltered) text of every source is checked again in the metamorphic and in the mutation method: 22,795
  identical assertions on the run of 2026-10-01 that both pages count; the authored twin variants (1,230) appear on the
  mutation page as well as on the twin page;
- relation and absolute checks added together, which is why the page needs a note about "relational overlap";
- an operator table that sums pass, fail and review over scanners;
- benign: one row per scanner and taxonomy (60 rows) where the control count is the same in every scanner's row;
- an assertion explorer with 20,865, 10,570, 182,695 and 100,305 rows for four of the methods (80 MB of JSON).

The user likes the old layout but not the redundancy. The design system
(https://claude.ai/artifact/2XX18FwB86Lv5T1C9Y2JjA) and the spec (https://claude.ai/artifact/AdxPhDga62Uay4VvdyRQ7s)
fix the tokens, the header and the boundary rule: record, never rank. The mockup is
https://claude.ai/artifact/PrpXArusL3aM7xfQYgDMFu (hub and all six pages, desktop and phone, light and dark).

## Decision

1. **One page schema for six methods, in a fixed order.** Head (what the method is: name, one sentence, run line),
   then 1 How it runs, 2 Recorded now, 3 How to read it, 4 Exact inputs. Each method differs only in which checks are
   the rows of section 2 and in what its section 4 lists. The three steps of section 1 carry the same labels on every
   page (Input, Change, Check). A figure appears in one of these places and no other.
2. **"Recorded now" has scanners across and checks down, on every page.** A cell is "n of N": the checks that did not
   hold out of the checks scored, for one scanner and one kind of check. No total across rows or scanners, no sort
   (the order is the registry's), no emphasis, no colour. A scanner that did not complete is "Not measured". A check
   that waits for a person (tier T0, a deferred expectation) is counted apart, in one sentence, and in no row. Each
   count is derived from the assertions once, in `resolvers/evaluation-methods.ts`, and shown once.
3. **What each method adds** (the rows):

   | Method | Rows of "Recorded now" | Columns | Adds |
   | --- | --- | --- | --- |
   | twin | pair told apart, positive side, negative twin | scanners | a line for pairs with an unscored side |
   | benign | one per taxonomy in two groups (family axes, untargeted real-world shapes), then flagged by policy action | scanners | untargeted shapes kept apart from every family (#95) |
   | metamorphic | one per transform (`same-detection`), then the transformed text on its own (detected, left alone) | scanners | operators table: generated, not applicable, errors only when one exists |
   | mutation | one per operator whose altered value still matches the format contract, then the altered value on its own | scanners | operators table with scored and deferred; the unscored sentence. Excludes identity and `authored.twin`: those are the twin method |
   | differential | five exclusive ways two tools can differ, then whether family classification could be compared | peers (redact-secret is the reference) | the review-queue sentence |
   | holdout | one per stratum | scanners of the qualification | corpus, lifecycle, independence and hashes in place of suites; its own run, not the discovery run |

   The metamorphic and mutation relation rows and the "on its own" rows are read separately: a scanner that missed the
   value on both sides holds the relation, so the second group tells the two cases apart. Neither is added to the other.
4. **The shared context lives on the hub, once.** `/evaluation/` states the run (id, date, revision), each scanner
   with version, how it was run, whether the observation is fresh or a snapshot and whether it completed, and the four
   rules of reading every page (recorded not judged; read a number in its row; needs review is not a score; a peer is
   not ground truth). A method page's head repeats only the run id, the date and the redact-secret version and mode.
   The hub also lists the six methods with the count of what each reads, and the four pages the other phases own.
5. **A phase page that does not exist is named, not linked.** The hub rows come from `EVALUATION_PHASES` in
   `lib/routes.ts`. A row is a link only when its href is an entry of the Evaluation section's navigation; otherwise it
   is a dashed row saying "Not in this build yet" (`NavRow` without `href`). The export never links a route it does
   not contain, and a phase's owner flips the row by adding its entry to `SECTIONS`, with no change to the hub.
6. **Navigation.** A third global entrance, Evaluation, after Report and Comparison. Its section navigation is
   Overview and Methods; Methods stands for all six pages (`RouteEntry.match = '/evaluation/method/'`, so it is
   current on each). The six methods are switched by a `SegmentedNav` on each page, in the engine's order: twin,
   benign, metamorphic, mutation, differential, holdout.
7. **Not shown.** The assertion explorer and its filters, the review queue as rows, scanner-by-scanner sums, the raw
   JSON of the holdout aggregate and the scanner execution line on each page. A per-case view would repeat the table
   cell by cell for 80 MB of rows; per-family evidence belongs on the family pages. Follow-up: #623.
8. **Data.** `services/evaluation.ts` reads `public/results/evaluation-v1.json` (written by `npm run eval:discover` and
   `npm run eval:publish`, never committed) and checks it with the existing `evaluationProblem` against this
   checkout's corpus hashes, the check the existing site makes in the browser. A report that fails is `unusable` with
   the reason; an absent file is `not-published`. Holdout reads the qualification aggregate embedded in that report,
   else the frozen report `docs/specs/qualification/engine-v1.json`, and the page says which. No ledger logic is
   duplicated: counts are tallies of the assertions the report carries.
9. **States.** With no evaluation published, every section that needs it shows "Not measured" with the commands that
   produce it (`npm run eval:discover`, `npm run eval:publish`; for holdout `npm run eval:qualify`); the fixed copy
   still reads. A figure is never a zero for a missing measurement.
10. **CI.** The `web` job runs `npm run eval:discover -- --scanner=redact-secret` and `npm run eval:publish` after
    `npm run bench`, as the root `validate` job already runs the same evaluation. With the product alone the run is
    under a minute and has no peer, so CI builds the pages with one scanner column and the differential page says no
    peer ran. A full evaluation (all peers) is what `publish-site` writes. Tests assert structure and the derivation
    from a synthetic report (`tests/unit/evaluation-data.ts`), never a figure from the ledger or the run.

## Old to new URLs, for cutover

The old `/workbench/*` URLs are not redirected now. At cutover:

| Old | New |
| --- | --- |
| `/workbench` (the methods list) | `/evaluation/` |
| `/workbench/method/twin`, `benign`, `metamorphic`, `mutation`, `differential`, `holdout` | `/evaluation/method/<method>/` |
| `/results/evaluation-v1.json` (public JSON) | unchanged: the new pages read the same file |
| `/workbench/qualification`, `/workbench/changes`, the review queue | not mapped by this phase |

## Consequences

- A reader sees what a method asks, how it runs, what was recorded and how to read it in the same places on all six
  pages. A number is in one cell; the totals the old strip showed (ten sums per page) are gone, along with the 22,795
  repeated canonical checks and the 1,230 repeated twin variants.
- A scanner that appears later is a new column on every page, with no change to the resolver. More scanners than fit
  scroll inside the table's region, and on a phone the table stacks.
- The CI `web` job gains under a minute and one more generated file. The method pages in CI have one scanner.
- No per-case drill-down in this phase (#623).
