---
decision_id: decision-redesign-benchmark-site
status: accepted
scope: benchmarks
title: Redesign the benchmark site on the Redact Secret design system
decided_at: 2026-09-19
---

# Redesign the benchmark site on the Redact Secret design system

Note: accepted for the redesign branch.

## Context

The site grew as a dashboard: a sidebar of 42 detector links, per-page
disclaimer banners, glyph grids and colour-coded tiers. The Redact Secret design
system (tokens and logo, no components) and the redesign plan ask for a site
that opens on questions, prints the pessimistic bound rather than the observed
rate, and uses the redaction bar itself as the chart.

The boundary rule is unchanged: this repository measures and records. Nothing on
the site asserts product quality, ranks a scanner or grades a result.

## Decisions

1. **Same stack.** Vite, TypeScript and string-template rendering stay. No
   framework, no UI library, no new runtime dependency.
2. **Tokens only.** `src/tokens.css` is a copy of the design system's
   `tokens.json` (vendored as `src/tokens.json`; a test fails on drift).
   `src/style.css` has no hex, no raw px, no shadows and nothing round; the only
   raw lengths are one device hairline and `@media` conditions, which CSS cannot
   take from variables. App measures are `calc()` over the 4px grid.
3. **The browser derives no statistic.** Bounds, n and withheld reasons are read
   from published JSON. A Wilson bound over several suites cannot be read off
   per-suite bounds, so `npm run bench` now also writes `summary.json`:
   cross-suite and per-detector groups accounted once by `accountGroups`. The
   site re-checks that the summary's integer counts add up to its suites, and
   still re-verifies every suite report against the fixture bytes.
4. **Seven components** in `src/components`, with no app imports and no data
   access, so they can move to the design system: Figure, Interval, StatusMark,
   ByteView, RedactionLane, EvidenceCrumb, ActionEmptyState.
5. **Route table of the plan**, with every earlier path redirected.
6. **Report shows published package results only.** Candidate evidence appears
   only in the Workbench.

## Assumptions made where the plan and the system were silent

- **Interval range.** A published rate carries one pessimistic bound. The
  interval is drawn from the observed point to that bound; no optimistic side is
  invented. The plan's mock showed a two-sided range.
- **Few samples** is a display rule: shown when n < 30. The rate itself is
  withheld by the accounting floors, not by this rule.
- **Lane alignment.** The mock sizes lanes in `ch`. 164 fixtures hold non-ASCII
  bytes, so each lane instead repeats its line's displayed text invisibly; a test
  checks the invariant on every line of every fixture.
- **Logo ink.** The two system SVGs differ only by wordmark ink, and each ink
  equals `ink` in its theme. One inline symbol filled from `brand-green` and
  `ink` is the same swap, with no extra token.
- **Policy rows** are reported as information, never as failures: a difference
  there is a difference of opinion.
- **Legacy routes with no direct successor.** `/evaluation/failures` and
  `/evaluation/reviews` go to `/workbench`; `/evaluation/operators` goes to
  `/workbench/method/mutation`, where operator evidence now sits;
  `/evaluation/detector/:id` goes to `/coverage/:id`; `/pending` becomes the
  `t0-fixtures` review group. Review class ids use hyphens, not dots.
- **Coverage's third segment** ("No dedicated fixtures") is the upstream
  detector inventory: every registered family has fixtures, so the segment shows
  families that have no dedicated detector and therefore no dedicated fixtures.
- **Changes** reads `public/results/candidate-evidence-v1.json` when a
  maintainer points `eval:candidate --output-dir` there; otherwise it shows the
  saved baseline against the current run for `redact-secret`.
- **Qualification floors.** Three floors are the qualification evidence's own
  reason codes; three compare a published point to the suite floor. A floor of 0
  is never the value shown. Absent evidence is Not measured, never Met.
- **Green in the chrome** is a 4px rule under the current place. It is 1.7:1 on
  white, so it is never the only cue: the current item also turns from
  `ink-muted` to `ink` and carries `aria-current`.

## Findings recorded, not decided

- Only `eval:qualify` reads `review-ledger.json`. A discovery report
  (`npm run eval`) states every queue entry as `unknown`. The LEDGER health cell
  therefore reads qualification evidence. The checked-in
  `docs/specs/qualification/engine-v1.json` predates the ledger triage and states 424
  unknown entries.
- The per-selection view (`summarize` in `src/model.mjs`) counts a detector's
  pending (T0) rows only from suites that hold the group. `summary.json` matches
  that exactly. Whether pending rows in other suites should consume measurable
  share is an accounting question for `docs/specs/evaluation-engine-v1.1.md`.
- The design system README says all type is Montserrat; its generated
  `tokens.css` sets h2/h3 in Merriweather and body in Roboto. The site follows
  the tokens. The system's generated `tokens.css` also omits the eight status
  tokens that `tokens.json` defines; the site takes them from `tokens.json`.

## Verification

`npm run typecheck`, `npm test`, `npm run test:integration`, and
`scripts/check-evaluation-ui.mjs` (routes, redirects, number parity, 1280 and
360 in both themes, rendered contrast, keyboard reach, empty states).
