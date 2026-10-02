---
decision_id: decision-carry-per-case-rows-in-the-qualification-view-and-page-them-by-scope
status: accepted
scope: benchmarks
title: Carry per-case rows in the qualification view and show them on paged Next pages by detector family
decided_at: 2026-10-01
---

# Carry per-case rows in the qualification view and show them on paged Next pages by detector family

## Context

#606, part of #602. The qualification view (`schemas/qualification-view-v1.json`) carried counts per family, population and
scanner and no per-case rows, so the Next app had no fixture or case surface built from the new outputs
([the first #606 decision](2026-10-01-show-the-qualification-view-beside-the-existing-report.md) said so). The cutover record
(#608) counted that as a reason criterion 6 was unmet. The legacy site stays the oracle and untouched, the split must not change
what Redact Secret's qualification means, and Next never runs credential-eval or the adapter.

## Decision

1. **The view gains `populations[].cases`, additively, and stays `redact-secret/qualification-view/v1`.** One row per corpus case of
   the population, sorted by id: id, path, kind, tier, group, the corpus family, taxonomy, the artifact's evidence class, targets,
   twin parent and mutation kind, the expected spans, the adapter's product attribution (`detectors`, and which step of the policy's
   fallback made it), and one `results[]` entry per scanner that ran the population. A result is what the artifact recorded:
   the span outcomes with leaked and collateral bytes for a positive, flagged, findings and co-detected for a control, the
   scanner status the artifact names for a case that was not measured, and the number of findings reported. A field that does not apply to the
   measurement is absent, so "pending" and "not measured" never read as zero. No case content is carried (the artifact has none).
2. **No version bump.** The schema tag stays `v1` because the change only adds a property, and `adapter.version` stays `1`: it is a
   component of the product policy revision, and nothing the revision stands for (thresholds, routes, tiers, records, taxonomy,
   ledger decisions, population roles) changed. The property is required, so a view built before it is refused by the Next reader as
   incompatible, with the command that rebuilds it, rather than shown without its case pages. Re-running
   `npm run qualification:parity` on the canonical artifacts after the change reproduces `docs/generated/qualification-parity.json`
   and `.md` byte for byte: 35,024 values compared, 34,678 equal, 346 attributed, 0 unexplained, 123 of 135 families stable, and the
   same policy revision. Removing `cases` from the new view gives the previous view value for value.
3. **Rows are keyed by (population, id) and counted nowhere.** The same id in two populations is two rows on the page, each in its
   own population's section with that population's run identity. No figure is a sum across populations or scanners, and the page
   position line carries no total.
4. **Pages by scope, paged at 50 rows.** `/evaluation/qualification/families/<family>/cases/<page>/` lists the cases whose
   `detectors` name the family (a case of two families is on both pages, as the counts count it); `/evaluation/qualification/unattributed/<page>/`
   lists the cases no detector claims, which the counts keep as `unattributed` and `unmappedFamilies`. A page is a window over the
   scope's rows in population order, with static Previous and Next links, so a page stays small enough to be one request and the
   export needs no client code. A scope with no case keeps one page that says so. With no usable view the routes keep one
   "view unavailable" page, as the other qualification routes do.
5. **A row opens to the case's facts with native `<details>`.** Closed, it shows the case id, kind, tier, group, the evidence class
   (labelled as the artifact's own label, never a support status) and each scanner's word: the outcome (`EXACT`, `EXACT 2 · MISS 1`),
   `Flagged` or `Not flagged`, or the dashed `Pending` and `Not measured`. Opened, it shows the path, corpus family, taxonomy,
   targets, twin parent, attribution step, expected spans and each scanner's measurement at length. The block is
   `components/qualification/QualificationCases` with stories; the resolver is pure (`resolvers/qualification-cases.ts`); the page
   resolver awaits the service; the tests use synthetic views and assert no ledger value.
6. **Why not one page per case.** 6,110 cases would be 6,110 pages with four files each. The existing fixture surface already chose to
   keep a fixture on its suite page (#588); the family scope is the same trade, with the case still addressable by its anchor.
7. **Size is stated, not hidden.** The view grows from about 1.6 MB to 7.7 MB (about 310 KB compressed); it is generated and never
   committed, and it is read once at build time. With a view present the export grows by about 200 MB (HTML plus two flight payloads
   per page). A build without a view, which is every CI build, carries none of it. The check
   (`web/scripts/check-export-qualification.mjs`) reads the view independently of the services and fails if a case row is missing,
   repeated, on the wrong page or in the wrong population.

## Consequences

- #606's missing surface exists, built only from the pre-derived view. The existing report, provider, family and fixture pages keep
  reading the legacy files; nothing legacy changed.
- A repin or a new official run makes the view stale (the existing rule) and the case pages disappear with the rest until the view is
  rebuilt.
- A future consumer may drop the 50-row window or move the rows to a build-emitted data file (the conventions' other pattern) if the
  export total matters; the view field does not change either way.

## Rejected

- A separate cases file beside the view: two files that must agree, validated by two schemas, for a reader that needs both. The
  view is already the one contract.
- A view version bump: no value moved, and a bump would have re-stamped the policy revision for a change that is not policy.
- Per-family case counts or rates on these pages: the counts already exist beside the family and a second derivation is a second
  chance to disagree.
- Showing the evidence class as a status or a route: the route is read from the product contract and empirical overlays, never
  from a case's label.
