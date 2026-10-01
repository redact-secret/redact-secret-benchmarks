---
decision_id: decision-show-the-qualification-view-beside-the-existing-report
status: accepted
scope: benchmarks
title: Show the qualification view on its own Next pages beside the existing report
decided_at: 2026-10-01
---

# Show the qualification view on its own Next pages beside the existing report

## Context

#606, part of #602. The adapter (#605) writes a deterministic qualification view, validated against
`schemas/qualification-view-v1.json`, from the official credential-eval RunArtifacts. The Next app is the first consumer. The
existing report, family and fixture pages are the legacy oracle during parallel validation, and credential-eval must never run
during page rendering.

## Decision

1. **New pages, existing pages untouched.** `/evaluation/qualification/` and `/evaluation/qualification/families/<family>/` are
   built solely from `public/results/qualification-v1.json`. The legacy routes keep reading the legacy files, so the two can be
   compared page by page before any cutover.
2. **Services and resolvers as the conventions say.** `services/qualification.ts` reads the view at build time;
   `resolvers/qualification.ts` is pure; the blocks in `components/qualification/` take formatted props and have stories.
   Next never invokes credential-eval or the adapter.
3. **A view that cannot be used shows no number.** Absent (the normal state in CI): "Not measured" with the commands that
   produce it. Incompatible (not JSON, another schema tag, or a shape this reader does not know) and stale (the populations'
   evidence or engine differ from `benchmarks/official-runs.json`, or a benchmark-owned policy file changed since the view was
   built): refused, with the reason. The family route keeps one page in that case, because `output: export` refuses a dynamic
   route with no params.
4. **Identities and populations stay visible.** The overview shows the view schema, adapter, publication, policy revision and
   each population's evidence, corpus digest, configuration hash, semantic digest, engine and methods; every count names its
   population and no field is a sum across populations or scanners.
5. **Product status and scanner observation are separate sections.** The family page puts the product's support status and the
   evidence it was judged on first, then each scanner's counts per population with no status. A stable count states its mode.
   A method that did not run, and a case that is pending or not measured, are "not measured" or "pending", never zero or a miss.
6. **Fixtures where the view supports them.** The view carries counts, not per-fixture rows, so there is no fixture page. The
   known-gap table lists each record's fixtures with their matches per population. The public population's fixtures match
   nothing until the re-key.
7. **Tests use synthetic views.** The service tests put it in each state with an overlay root; they assert states and
   relations, never a ledger value or a count from a built view.

## Consequences

- The Next credential report, family and fixture pages are not migrated by this change; criterion 6 of the cutover
  (docs/specs/qualification-cutover.md) stays unmet.
- A repin, a new run or a policy change makes the view stale and the page says so until `qualification:view` is run again.

## Rejected

- Rewiring the existing report pages to the view: it would remove the oracle and cannot be built, since the view has no rows.
- Reading the view in the browser: the data is build-time, and the conventions allow no runtime ledger read.
- Showing a partly valid view: a number from a view that failed its checks is a number nobody verified.
