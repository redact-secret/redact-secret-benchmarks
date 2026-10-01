---
decision_id: decision-web-family-page
status: accepted
scope: benchmarks
title: Build the family page from the provider dossier, the run and the peer rule map, and say what is not recorded
decided_at: 2026-10-01
---

# Build the family page from the provider dossier, the run and the peer rule map, and say what is not recorded

> Amended 2026-10-01 (#598, `2026-10-01-test-the-web-app-with-vitest-and-playwright.md`): the export-wide limits named here (total size, file count, the size of `data/`) are removed. They had no external basis: the site is static and deployed to S3 and CloudFront. Only per-page and per-request limits remain: one data file, the largest page, the largest rows page.

## Context

#589 (part of #543). The family page showed a title, the taxonomy description and one fixture table. The mockup
(https://claude.ai/artifact/2jc2hVq4Gc6rfWivgwZUrP) adds a shape strip, format facts with an evidence mark and a read date each,
benchmark counts, open questions, look-alikes and sources. Its prose came from the GitHub provider dossier. The ledger has no
structured form of most of it: a dossier records a verdict, tier, sources, issues, evidence and date in frontmatter and the format
as free prose per family. There is no prefix, segment, alphabet or checksum field, no evidence class per fact, no review state and
no format revision.

## Decision

1. **Show what is recorded, as recorded.** A new service (`services/dossiers.ts`) reads every dossier with the checker CI runs
   (`npm run dossiers:check`) and returns the frontmatter plus each family's labelled notes (`- **Shape:**`, `Sources`, `Issuance`,
   `Collisions`, `Current contract in core`, `Open caveat`). The page shows Shape, Basis, Issuance and the contract link under
   "Format facts", Collisions under "Looks like it, but isn't", and "blocked by" and Open caveat under "Open questions", each
   in the dossier's words (code spans and https links rendered, nothing summarised). A heading with nothing recorded is a dashed
   "Not recorded" box; an unresearched family says so in the research cells. No shape strip, per-fact evidence mark, prefix chip,
   "Draft" or "Format revision" is drawn: each would be invented. Follow-ups: #590 (structured format facts) and #591 (review
   state and format revision).
2. **Benchmark counts reuse the ledger functions.** `resolvers/family-detail.ts` calls `tally` (`resolvers/families.ts`), so the
   counts are the family list's and the rows table's by the counting rule of
   `2026-09-30-count-a-fixture-in-every-family-it-is-related-to.md`. They are shown at every evidence level (the levels partition
   the family's fixtures) and for every scanner of the run on the same fixtures, in run order. A scanner with no row for any of the
   fixtures reads "—" and "Not measured", never zero. The mode (published or candidate) is stated in the section.
3. **Scanner rules are context, not results.** Each peer's own rules that target the family come from
   `scanners/peer-rule-families.json` (`PeerProfile.rulesByFamily`, additive), with the reviewed `basis`. The scanner table names
   under each scanner whether a rule maps to the family, because a scanner with no rule has nothing to report on it. Nothing is
   ordered by count, highlighted or summed.
4. **Route unchanged.** `/report/families/<family>/` is already linked from the lists, the hub and the checks; the mockup's
   `/report/providers?family=` is not used.
5. **Export budget.** The new content travels as one client component's props (`FamilyView`) instead of a server element tree,
   which Next writes again in three files per page. A table with one evidence level is left out (the sentence names the level).
   The fixture rows keep the build-emitted file path of #573; no new fetch.

## Measured

Same machine, clean builds. Before: 87.2 MiB, 2,006 files; family pages 27.8 MiB. After: 94.0 MiB, 2,007 files; 173 family
pages 34.8 MiB (+6.8 MiB, about 40 KB a page across its four copies). A first version that drew the same blocks as server components
cost +21.6 MiB and failed the 100 MiB budget.

## Consequences

- `check:routes` recounts every family page: research record and sources against the dossier frontmatter, peer rules and bases against
  the rule map, per-level and per-scanner counts against the suite reports.
- The export has about 6 MiB of headroom under its 100 MiB budget; the family page is its largest recurring cost per page.
- A dossier with more notes (or #590) grows every page; read `check:routes`' size line before adding.
