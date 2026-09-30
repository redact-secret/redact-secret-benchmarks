---
decision_id: decision-ui-primitive-conventions
status: accepted
scope: benchmarks
title: Set the UI primitive conventions and the token drift test for web/
decided_at: 2026-09-30
---

# Set the UI primitive conventions and the token drift test for `web/`

## Context

#544 builds the primitives that #545 and #546 compose into report and comparison
blocks. The six mockups (report hub, providers, families, comparison hub,
features, runtime) share one visual vocabulary that the existing site defines in
`src/style.css`. The foundation ADR settled the stack; this record settles what
the primitives look like as code and how drift is caught.

## Decisions

1. **Primitive set from the mockups.** Groups: `layout`, `text`, `page`, `data`,
   `feedback`, `nav`, `disclosure`. The set covers every repeated element in the
   six mockups (figure tiles, interval bars, status marks, outcome marks, grouped
   tables, hub tiles and rows, segmented switches, tabs, pager, filters, notes,
   empty states, disclosure rows). Page-specific arrangements stay in #545/#546
   blocks.
2. **MUI only for tabs and toggle groups.** Native `<details>`, `<select>`,
   `<table>` and links already carry the accessibility; MUI adds nothing there.
   `Tabs` and `SegmentedControl` use MUI for roving focus and ARIA state.
3. **Controlled, stateless components.** Interactive primitives take `value` and
   `onChange`; state lives in the parent. Links are preferred over controls where
   the state should be shareable.
4. **Measures live in `web/theme/measures.css`.** The existing site derives shared
   measures and type roles in `src/style.css`, which is not tokens. Copying the
   same derivations (arithmetic on tokens, one device hairline) into `web/`
   keeps CSS Modules free of raw lengths. Imported second, in `@layer theme`.
5. **Drift test at the repository root.** `tests/web-tokens.test.mjs` is pure node
   so it runs in the existing `unit-tests` job without installing `web/`. It
   checks that every `var(--x)` resolves, that CSS has no colour literal, raw
   length, shadow, pill or `!important`, that the MUI theme maps the same colours
   as `tokens.css` in both themes, and that each component has a story, module
   and barrel export and imports no data. Vendored token values themselves stay
   guarded by `tests/design-tokens.test.mjs`. At cutover the token files move
   into `web/`; only two path constants in the new test change.
6. **Existing shell CSS conformed.** The #547 shell modules used a few raw lengths;
   they now use the same measures. No visual change.
7. **Storybook build stays in the `web` CI job.** No workflow change.

## Consequences

New primitives are added by extending a variant first. A design-system token
change reaches `web/` through the vendored copy, and the tests fail if a component
or the theme drifts from it.
