---
decision_id: decision-compare-accuracy-one-pair-at-a-time
status: accepted
scope: benchmarks
title: Compare accuracy one pair at a time on /comparison/accuracy, per file, from the run's own rows
decided_at: 2026-09-30
---

# Compare accuracy one pair at a time on /comparison/accuracy, per file, from the run's own rows

## Context

#570 (part of #543). `/report` puts every scanner in one table, which invites ranking. The design adds a companion page that
reads redact-secret and one other tool against the expected answer for the same test files (mockup
https://claude.ai/artifact/6bwvKm8wycrYQJHB3KzVet). The mockup was built from a local preview: its `citing` scope, its peer
list and its corpus size are older than the ledger. The boundary rule applies: the page displays recorded values and never
says which scanner is better.

## Decision

- **Route and address.** `/comparison/accuracy/`, `?data=credentials|pii&with=<tool>&level=T1|T2|T3&scope=all|listed&peers=1`,
  defaults left out. The tool offered first is the first in run order, never chosen by result. The comparison hub's Accuracy
  row points here; `/report` stays in the navigation and is one link away ("All scanners at once").
- **Pre-rendered panels, differences as build-emitted JSON.** Every reachable pair, level and scope is a panel (34 today);
  one key on the root element (`data-acc-key`, set by an inline script before paint and by `AccuracySync`) shows one. The
  panel rules are emitted per key from the page, so a new scanner in the run needs no stylesheet edit. The lists of
  differing files are one build-emitted file, `data/comparison/accuracy/differences.json` (a shared table of files and one
  short list of references per tool), fetched through `lib/build-data.ts` when a reader first opens a list, with a skeleton
  and a retry note (allowed by the same-origin fetch decision, #573). The page names the run and the file count it expects,
  so a file from another build is refused. `check-export-accuracy.mjs` recounts every panel and the file from the suite reports.
- **Files, not spans.** A test file is Hidden (no PARTIAL or MISS span), Partly readable (PARTIAL, no MISS) or Readable (MISS);
  a control is Left alone or Flagged. The page says so; `/report` counts spans, so a file with several secrets counts once
  here. A file either tool has no usable row for is left out and stated, never a pass or a zero.
- **Scope switch = the reviewed rule map, not source citations.** The mockup's "ones citing <tool>" would be derived by
  matching URLs in fixture assessments. The ledger already holds a reviewed, validated map from each peer's own rules to
  credential families (#558, `scanners/peer-rule-families.json`) that `/report` uses for "inputs its rules target". The page
  reuses it ("Ones its rules target"), so the two pages cannot disagree about which inputs are in scope.
- **Shares.** A share is never rounded to 100% or 0% unless every file, or none, is in the state (99.9%, 0.1%). Below 20 files
  it is counts only.
- **Personal data is a labelled preview.** No personal-data accuracy corpus has been run against other tools. The view reads
  the recorded runtime comparison (`evidence/562`, redact-secret at `pii:global,pii:us` against each library at its
  defaults) per text, counts only, with the same "both directions" lists, and says it is a preview. Where the recorded run is
  absent it says Not measured.
- **Project policy (T3)** stays hidden for another tool until `peers=1`, as on `/report`.
- **OpenRedaction** is offered for credentials because the run now includes it (the mockup predates that).

## Consequences

Two symmetric sides, no winner line, no total across questions or levels, no status colour. The data gaps this page cannot
fill (a personal-data accuracy corpus; timing for this pair) are recorded as follow-up issues linked from #543.
