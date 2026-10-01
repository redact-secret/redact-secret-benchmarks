---
decision_id: decision-web-layout-check-speed-and-ci-image
status: accepted
scope: benchmarks
title: Load each layout target once, wait on conditions not timers, and offer a Docker run that matches CI
decided_at: 2026-10-01
---

# Load each layout target once, wait on conditions not timers, and offer a Docker run that matches CI

## Context

`web/scripts/check-layout.mjs` (#554) was 7.5 to 9.7 minutes of the 9 to 13 minute `web` job, and every PR waits on
it. It laid out 609 targets (531 Storybook stories, the exported pages, the loading and error states) at 320, 375
and 768 px, and for each width it navigated again (`goto`, `waitForSelector`, a fixed 50 ms wait; 100 ms after data
arrived): about 1,800 navigations on four pages. Agents also run Playwright on a Mac with Google Chrome while CI runs
the bundled Chromium on Linux, and several agents share one machine's cores and ports, so a pass locally has not
meant a pass in CI.

## Decision

1. **A plain target is loaded once and measured at each width after `page.setViewportSize`.** Nothing is skipped:
   every story and page is still measured at all three widths, with the same checks (`inspect`, `inspectHeader`).
   Visually identical stories are not skipped either: no rule short of measuring can show that a story cannot overflow.
2. **Layout is settled by a condition, not a timer.** `settleInPage` waits for `document.fonts.ready`, then for the
   document's scroll size to stay unchanged over three animation frames (five after data arrives), capped at 120
   frames so a page that never stops moving is still measured and the shift it causes is reported.
3. **The loading, loaded and error states keep a navigation per width.** They exist only while the page loads, and the
   held or failed request for build-emitted data must be in place before it does. Only 5 targets are states.
4. **The worker count comes from the machine**: `LAYOUT_WORKERS`, else `os.availableParallelism()` (minus one in CI,
   where the Playwright suite runs beside it with two workers), within 2 and 6. A 4 vCPU runner gets 3.
5. **Stories already load through `iframe.html?id=...&viewMode=story`**, the manager UI is never opened. No change.
6. **The check has a self-test** (`web/tests/e2e/layout-check.spec.ts`): synthetic pages with a horizontal overflow, a
   word broken across lines and a layout shift must each be reported, at the widths where they exist, and a clean page,
   a page that overflows at one width only, and a page whose data adds nothing above the table must not be. The
   measuring code moved to `web/scripts/layout-check-lib.mjs` so the test runs the code `check:layout` runs.
7. **`npm run check:docker`, `check:layout:docker` and `test:e2e:docker`** run the web CI steps inside
   `mcr.microsoft.com/playwright:v<pinned Playwright>-noble` (`web/scripts/docker-run.mjs`): bundled Chromium,
   `CI=true`, a 4 CPU and 6 GB cap, no published port, `node_modules` in named volumes, the checkout mounted read-only.
   No CI job runs it; it is for the final local verification.

## Consequences

- The measured speed-up is in the PR that carries this record. The number of navigations falls by about two thirds.
- A page whose layout depends on the width it was LOADED at (not on the width it is resized to) would no longer be
  measured at the other widths as a fresh load would see it. The pages and stories are CSS-driven and React
  `matchMedia` hooks follow resize events, and the first run on the full set reported the same findings as the old one
  (none), but a new page that reads `window.innerWidth` once at load should be checked by a fresh load; add it as a
  state-style target if it does.
- The image runs Node 24 and CI Node 22 (both within the `engines` range); on Apple silicon the image is arm64 while
  CI is amd64 (`DOCKER_PLATFORM=linux/amd64` runs it emulated and slowly).
