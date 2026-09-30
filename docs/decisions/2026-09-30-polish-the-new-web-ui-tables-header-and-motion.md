---
decision_id: decision-web-ui-polish
status: accepted
scope: benchmarks
title: Polish the new web UI: tables never squeeze, the header uses the canonical logo, motion is small and gated
decided_at: 2026-09-30
---

# Polish the new web UI: tables never squeeze, the header uses the canonical logo, motion is small and gated

## Context

#554 (part of #543). The first pass of `web/` (#544 to #547) rendered, on a
phone, tables whose cells held one word per line and clipped at 320px, a header
with a CSS triangle instead of the logo, and controls with no press, hover-gating
or touch-size rules. The acceptance criteria ask for no page overflow and no
mid-word breaks at 320/375/768 in any story, a header and logo that match the
design system with a check that fails on drift, and a design-engineering pass.

## Decisions

1. **A word is never broken to narrow a column.** `overflow-wrap: anywhere`
   lets a table shrink each cell to its longest fragment, which is the cause of
   the one-word-per-line rows. Cells now use `break-word` (min-content stays at
   the longest word), so a table that does not fit scrolls inside its own
   focusable region. Only a token longer than the cell cap (48ch: a hash, a path)
   breaks. The same swap applies to every text primitive that used `anywhere`.
2. **`DataTable` stacks on a phone by default.** Below 720px each row becomes a
   labelled block (label column 40%, value beside it). Stacking was opt-in, so
   the primitive's default was the broken layout; it is now opt-out
   (`stackOnPhone={false}`) for tables whose columns only read side by side,
   which scroll at natural width. Story variants for the hard case: `Default`
   (stacked), `ScrollingOnPhone`, `WideStackedOnPhone`, `NarrowPhoneLongContent`.
   Stacked cells wrap their content in one `span`, so a value with several inline
   parts (`<b>361</b> of 1,068 <small>note</small>`) is one box, not three flex
   items.
3. **The runtime matrix scrolls rather than squeezes.** `RuntimeQuestionTable`
   keeps a fixed layout so blocks align, but its minimum width is now
   `--cols` times a 176px column share, so a tool name always fits and the region
   scrolls.
4. **Two global layout rules.** `:where(body *) { min-width: 0 }` (zero
   specificity) stops a flex or grid item growing past its container for one long
   word. Regions that hold visually hidden labels are `position: relative`, so
   those labels scroll with the region instead of widening the page.
5. **The header renders the canonical logo files.** `web/public/logo-light.svg`
   and `logo-dark.svg` are byte-identical to the design system's Logos group and
   pinned by hash in `web/scripts/check-header.mjs`. `SiteHeader` shows one by
   theme (the choice or the OS), sized by `--logo-w` (64px) with height `auto`.
   The header follows the existing site's shell: a green rule under the current
   entrance, entrances beside the logo from tablet up, and on a phone a second
   row for the entrances (not sticky, so it does not take a third of the screen).
   The logo image carries no alt text; the link carries the label.
6. **Motion follows `emil-design-eng`, scaled to a reference site.** Press
   feedback is `scale(0.97)` on small pressable controls (not on tiles and rows,
   where it reads as a bug); transitions name their properties, use one strong
   ease-out curve, and stay at 160ms; every hover rule is gated by
   `(hover: hover) and (pointer: fine)`; `prefers-reduced-motion` removes
   transitions and press movement while colour changes stay instant; on coarse
   pointers each control is at least `--touch` (48px) tall. Nothing animates on a
   keyboard action or on page load. Curves and press scale are measures in
   `measures.css`, not literals.
7. **Two checks, in the `web` CI job.**
   - `check:header` (pure node, also run by `tests/web-header.test.mjs` in the
     root unit tests): canonical files by hash, both files rendered, no drawn
     mark, tokens only in the header CSS.
   - `check:layout` (Playwright, Chromium): every story and every exported page at
     320, 375 and 768px; fails on page overflow (naming the box that sticks out),
     on an ordinary word (up to 24 characters) split across lines, and, on the
     exported pages, on a logo that is not the `--logo-w` size or aspect. It reads
     the built `storybook-static` and `out`, so nothing new is served.
8. **Playwright is a `web/` dev dependency only**, pinned exactly, installed with
   `--ignore-scripts`; CI downloads Chromium with
   `npx playwright install --with-deps chromium`. Locally `PW_CHANNEL=chrome`
   uses an installed Chrome, so no browser download is needed.

## Alternatives considered

- Keep `anywhere` and add `min-width` to each table: fixes tables, leaves every
  other primitive able to squeeze a word, and needs a new number per block.
- Inline the logo as an SVG symbol from tokens (as `src/logo.ts` does): the
  design system calls this the same swap, but the check for "canonical asset"
  becomes a comparison of path data in TypeScript rather than a file hash.
- Always scroll (never stack): keeps columns aligned but hides the second half of
  a row at 320px, so a reader sees a value without its label.
- `axe` for contrast: the Storybook a11y addon already runs in `error` mode in
  both themes; nothing was added.

## Consequences

Any new story that overflows at 320px, or whose words break, fails CI with the
story id and the offending box. A change to the logo files fails until the design
system's hash is updated here in the same PR. Story screenshots are reviewed
locally and not committed.
