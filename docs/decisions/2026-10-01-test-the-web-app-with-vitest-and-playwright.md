---
decision_id: decision-web-test-architecture
status: accepted
scope: benchmarks
title: Test the Next app with Vitest and Playwright, measure V8 coverage over the application code at 80%, and judge the export per page, not in total
decided_at: 2026-10-01
---

# Test the Next app with Vitest and Playwright, measure V8 coverage over the application code at 80%, and judge the export per page, not in total

## Context

#598 (part of #543). Every page of the new site is built. Until now `web/` was checked by build-time scripts
(`check:no-sx`, `check:header`, `check:routes`, `check:layout`) and by six resolver suites that lived in the root
`tests/` directory as `node:test` files. Nothing measured how much of the application code a test runs, nothing
exercised a component or a hook in a DOM, and nothing drove the built site as a reader does (keyboard, history,
failed requests, both themes, a screen-reader-visible accessibility scan). The requirement is at least 80% measured
coverage of lines, statements, functions and branches, enforced in CI, over real application code.

## Decision

1. **Unit and component tests: Vitest, in `web/tests/unit`.** Candidates were `node:test` with `c8` (what the root
   uses), and Vitest. `web/` is TypeScript, TSX, CSS Modules and React client and server components. `node:test` has
   no CSS Module handling, no JSX transform without another loader, no DOM, no `import.meta.glob`, and merging V8
   coverage through source maps for TSX needs extra plumbing. Vitest runs the same Vite pipeline Storybook already
   uses here (Vite is in the tree), resolves CSS Modules to a stable class-name proxy, maps V8 coverage to source,
   enforces thresholds, writes lcov and HTML, and runs files in parallel. New dev dependencies, each exact-pinned:
   `vitest` and `@vitest/coverage-v8` (runner and coverage), `jsdom` (a DOM; `happy-dom` is faster but has had
   escape and sandbox bugs and is less faithful to focus and ARIA), `@testing-library/react`, `/dom`,
   `/user-event` and `/jest-dom` (queries by role and accessible name, real key events; asserting what a reader
   gets, not implementation), and `axe-core` (below). No snapshot tests: assertions name behaviour.
2. **What is tested, and how.**
   - *Resolvers* (pure): the six existing suites move from `tests/web-*.test.mjs` to `web/tests/unit` with the same
     assertions, so `web/` is self-contained and their coverage counts. The root `unit-tests` job no longer runs
     them; the `web` job does.
   - *Services*: the happy path against the real committed corpora and run (what `next build` reads). Every other
     state (no run published, summary that does not validate, snapshot absent or invalid, a fixture index that
     disagrees with the corpora, a rule map that disagrees with the registry) from an overlay of the real tree in
     which one file is absent or changed (`tests/unit/overlay.ts`: symlinks, nothing copied, nothing real touched).
     This is more faithful than a second hand-built corpus, which would drift from the validators. Data is
     synthetic where it is written (an edited summary, a bogus verdict); no credential appears anywhere.
   - *Pages*: every route is rendered from the real data, and its not-published, unusable, candidate and
     report-left-out states from overlays. A missing measurement says so and names the command, never a zero.
   - *Client islands and hooks*: rendered inside the real page they ship in and driven through the address bar,
     `popstate`, `history` and a stubbed `fetch` whose responses come from the real route handlers.
   - *Primitives*: Tabs (arrow keys, Home and End, skipping a disabled tab, roving tabindex, panel linking),
     SegmentedControl, Disclosure, Pager, fields and ThemeToggle by keyboard.
   - *Every story renders* (531) and is checked by axe for structure (names, roles, ARIA validity, labels, list and
     table structure). Stories are the primitives' documentation and enumerate each visual state a block can be
     in, so rendering them is the cheapest way to execute every branch of a pure block. The rules that need a
     whole page or computed layout (`region`, `color-contrast`, `landmark-one-main`, `page-has-heading-one`,
     `scrollable-region-focusable`, `target-size`, `heading-order`) are off for a fragment and run on real pages in
     Playwright; `aria-valid-attr-value` is off for the Tabs stories that have no panel (the parent renders it).
3. **Coverage: V8, over `app`, `components`, `lib`, `resolvers`, `services` and `theme`; 80% of each of lines,
   statements, functions and branches, enforced by `vitest.config.mts` (the run fails below).** The only exclusions
   are `**/*.stories.tsx` (documentation, built and laid out by `check:layout` and smoke-rendered above),
   `**/*.d.ts` (types) and `**/*.css`. Everything else under those six directories is in the denominator, including
   the data files stories import, resolvers and services that are hard to reach. Not measured because they are not
   application code: `scripts/` (build-time checks, each run in CI and tested from the root), `.storybook/`, and the
   `next`, `vitest` and `playwright` configuration. Playwright does not add to the number: it exercises minified
   production code, which maps to no source.
4. **Browser tests: Playwright Test (`@playwright/test`, same version as the `playwright` already used by
   `check:layout`), in `web/tests/e2e`, against the built export.** `tests/e2e/serve.mjs` serves `web/out` like the
   host (base path, directory index, `404.html`, no rewrites), so the suite reuses the export `check:routes`
   already built. `@playwright/test` over a bare `playwright` script gives web-first assertions with auto-retry (no
   sleeps), parallel workers, traces on failure and a JSON report. Retries are off: a pass on the second try is a
   bug. `axe-core` is injected into the page (no wrapper package). `PW_CHANNEL=chrome` uses an installed Chrome;
   CI installs Chromium. The suite never touches the network: web fonts are answered empty, any other off-origin
   request fails the test.
   - *Matrix*: every kind of page and address variant (27) at 320 and 1280px, in light and dark (the theme is on
     System and the OS preference is switched), on one load per page and width: no console output, uncaught error or
     failed request; one visible h1, one main landmark; no sideways scroll; axe over WCAG 2.0 to 2.2 A and AA and
     best practice with no serious or critical violation. Moderate and minor findings are attached to the test as
     annotations, not hidden.
   - *Behaviour*: header, section navigation and the phone bottom bar; 404; skip link; `?level`, `?q`, `?show`,
     `?page`, the pair pickers, `?rows` and `?fixture` with Back and Forward; loading, error, offline and
     stale-build states of the rows, records and difference files by route interception; theme (system, saved
     choice, persistence, no flash); keyboard (a focus ring on every stop, order, controls, no trap, focus not under
     the bottom bar); reduced motion; and no script (the HTML alone paints each page).
5. **CI: the existing `web` job only.** It already builds the export and installs Chromium. The unit run with
   coverage follows `check:routes`; a coverage table by directory goes to the job summary and the lcov and HTML
   report upload as the `web-coverage` artifact. `check:layout` drives one browser on one core, so the Playwright
   suite starts before it in the background (three workers) and is joined after it: the wall time is the longer of
   the two, not the sum. A failing run uploads its traces. Actions are pinned by SHA and the job keeps
   `contents: read`. The existing `check:*` scripts stay: none is superseded (`check:layout` also lays out every
   story and each loading state at three widths, which the suite does not).
6. **Amendment: the export is judged per page and per request, not in total.** `check:routes` failed an export over
   100 MB, 2,300 files or 14 MB of `data/`. Those limits had no external basis: the site is static and deployed to
   S3 and CloudFront, which have no such limit, and they made unrelated work (a new family page) fail for the size
   of everyone else's. They are removed. What a visitor downloads stays limited and unweakened: one data file
   (2 MB), the largest page (1.5 MB) and the largest rows page (320 KB), plus the accuracy page's own limit. The
   totals are still printed, as information. The ADRs that named the removed limits carry an amendment note.

## Measured

On a developer machine under load (so times are an upper bound):

- 815 unit tests in 15 files (531 stories, 95 ported resolver tests, 189 behaviour tests), about 25 s alone;
  130 Playwright tests, about 2.7 minutes with three workers.
- Coverage of the application code (the exclusions above): lines 99.1%, statements 97.8%, functions 97.9%,
  branches 89.9%. With stories in the denominator (only `.d.ts` and CSS left out): 99.1%, 97.9%, 96.7%, 89.9%.
  By directory (lines / branches): `app` 96.7 / 85.2, `components` 99.7 / 97.0, `lib` 100 / 94.7,
  `resolvers` 99.1 / 88.1, `services` 100 / 88.7, `theme` 100 / 100.
- The existing `web` job ran in about 9.3 minutes, 7.5 of them `check:layout`. The CI delta is in the pull request.

## What the tests found

Fixed in small commits: a `role="img"` timing track with an empty label (critical, `role-img-alt`); an empty
column header in the runtime facts table; a data-table region named the same as the section holding it (a
duplicate landmark); in-sentence links told from text by colour alone on the feature and accuracy pages
(serious, `link-in-text-block`); a focused control that could sit under the phone's fixed bottom bar (WCAG 2.2
2.4.11). Deliberate: the Next router starts a prefetch for each visible link and cancels it again; the browser
reports those as aborted requests, which the suite does not count as failures. Without script, a reader whose OS
is dark gets the light theme in full (nothing sets `data-theme`), a consistent and readable page, tested as such.

## Consequences

- `npm run test:coverage`, `npm run test:e2e` (after `npm run build`) and `npm run coverage:summary` in `web/`.
- A new component needs a story (already required), which is also its first unit test. A new route is added to
  `tests/e2e/fixtures.ts` (the browser matrix) and to the route list in `tests/unit/pages.test.tsx`, which fails until it is.
- The root `unit-tests` job runs six fewer files; the `web` job runs them.
- Rejected: Playwright coverage of the minified bundle (no source mapping, and it measures the browser's work, not
  the code's), a snapshot suite (it records output and asserts nothing about behaviour), a second `web-e2e` job
  (it would repeat checkout, install, benchmark and build, about five minutes of billed time, to save wall time the
  background run already saves), and `happy-dom`.
