# Conventions for the new UI (`web/`)

The primitives live in `web/components/<group>/`. Page blocks (#545, #546) compose
them; pages (`web/app/`) assemble blocks. Foundation decisions:
`docs/decisions/2026-09-30-build-the-new-site-as-a-next-static-export-with-mui.md`
and `docs/decisions/2026-09-30-set-the-ui-primitive-conventions.md`.

## Files

One folder per group. One component per file set:

```
components/<group>/Component.tsx
components/<group>/Component.module.css
components/<group>/Component.stories.tsx
components/<group>/index.ts            # barrel: export the component and its prop types
```

Compound parts that are never used apart share a file (`StatTile` + `StatGrid`,
`Tabs` + `TabPanel`, `Chip` + `ChipList`). Names are PascalCase nouns for what the
thing is (`StatTile`), never for where it is used (`ReportHeroTile`). Import from
the barrel: `import { StatTile } from '../components/data'`.

## No state, no data

Components are pure render: props in, elements out.

- No fetching, no `lib/ledger` or `app/` imports, no effects, no browser storage.
  `tests/web-tokens.test.mjs` fails on these.
- Numbers and words are passed in already formatted. A component never derives a
  count, rate or status from other props. The ledger says it; the UI displays it.
- Interactive components are **controlled** (`value` + `onChange`). The parent owns
  the state; a story may keep it in `useState` to show the interaction, the
  component never does. Prefer links (state in the URL) over controls when the
  state should be shareable (`SegmentedNav` before `SegmentedControl`).
- Native elements first (`<details>`, `<select>`, `<table>`, `<a>`). MUI only where
  accessibility behaviour is costly to get right: today `Tabs`, `SegmentedControl`
  and `ThemeToggle`. Dialogs and menus will be MUI-backed when a block needs one.

## Styling

- Style with a class from the component's CSS Module. Never `sx`, never `styled()`
  (`npm run check:no-sx`). Accept a `className` prop and merge it with `cx()`.
- Every rule sits inside `@layer components { ... }`, which outranks MUI's
  `@layer mui`. No `!important`, no specificity hacks.
- Tokens only. Colours, spacing, type and radii come from `src/tokens.css`; shared
  measures (`--hairline`, `--rule-strong`, `--page-max`, type roles such as
  `--text-small-strong`) come from `web/theme/measures.css`, derived from tokens.
  No hex, no raw `px` (except in `@media` conditions), no shadows, nothing round.
  Surfaces are separated by rules, not shadows.
- Dynamic geometry (a bar width, an interval position) passes through a CSS custom
  property set on `style` (`style={{ '--fill': '40%' }}`), and the module reads
  `var(--fill)`. Never a raw pixel value.
- Breakpoints (CSS cannot use variables in `@media`): phone `max-width: 720px`,
  tablet `860px`, wide `1080px`. Every layout works at 360px with no sideways page
  scroll; wide tables scroll inside their own focusable region.
- Colour is never the only cue. A status has its word and a shape (hatched,
  dashed, solid). "Not measured" is dashed and muted, never a colour.
- `tests/web-tokens.test.mjs` is the drift test: undefined variables, colour
  literals, raw lengths, theme mapping, story and barrel presence.

## Stories

Every component has a `Component.stories.tsx` with `title: '<Group>/<Component>'`
and stories for each state that exists:

- default, every variant and tone
- empty (no rows, no items)
- long content (long names, unbroken strings, many rows)
- phone width where layout changes (`parameters: { viewport: ... }`)
- both themes: use the toolbar Theme switch; the a11y addon runs in `error` mode

Story data is synthetic: no real credentials, no real fixture values. Copy stays
neutral: state what the ledger records, never that a product is good or bad
(boundary rule in `AGENTS.md`). A block that shows a stable count states its mode
(published or candidate).

## Adding a primitive

1. Check the inventory (PR body of #544, or `components/*/index.ts`); extend a
   variant before adding a component.
2. Add the four files, keep props minimal and serialisable (text, numbers, nodes).
3. `cd web && npm run check` (rules, typecheck, build, export check, Storybook
   build) and `node --import tsx --test tests/web-tokens.test.mjs` from the root.
