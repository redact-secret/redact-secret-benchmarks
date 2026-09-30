---
decision_id: decision-next-static-export-with-mui
status: accepted
scope: benchmarks
title: Build the redesigned site as a Next.js static export with Material UI, in web/
decided_at: 2026-09-30
---

# Build the redesigned site as a Next.js static export with Material UI, in `web/`

## Context

Epic #543 rebuilds the site UI as Storybook blocks assembled into a Next.js App
Router static site. The existing Vite site must keep publishing unchanged until
cutover, so the new site is built beside it. This record settles the shared
foundation (#547) that the block issues (#544, #545, #546) build on. The design
system's tokens and the sibling `redact-secret-www` (Preact, token-only CSS
Modules) are the visual reference; the boundary rule is unchanged: the site
displays ledger values and asserts nothing about the product.

## Decisions

1. **Next.js App Router with `output: 'export'`.** `trailingSlash: true` and
   `images.unoptimized`. Pages are server components that read the ledger while
   `next build` runs, so the export is plain files for the existing S3/CloudFront
   host. No server runtime, no route handlers.
2. **Material UI for accessibility only.** MUI supplies behaviour and semantics
   that are costly to get right (for now the theme-choice group; menus, dialogs,
   tabs and similar later). It never supplies the look. The MUI theme
   (`web/theme/theme.ts`) is limited to mapping design tokens to palette, shape
   and typography, and to component defaults. It generates CSS variables per
   scheme under `[data-theme="light|dark"]`, the attribute `src/tokens.css` and
   the existing site already use, and it reads the saved choice from the same
   localStorage key, so a saved theme carries across.
3. **Styling is class names from CSS Modules, in a CSS layer.** No `sx`, no
   `styled()` in feature code. `AppRouterCacheProvider` (Storybook:
   `StyledEngineProvider`) is set to `enableCssLayer`, so MUI's emotion styles
   are emitted in `@layer mui`. Every CSS Module wraps its rules in
   `@layer components`. The order `theme, base, mui, components, utilities` is
   declared once in `web/theme/layers.css`, imported first by the layout and the
   Storybook preview (layer order is fixed by first appearance, and Next puts
   stylesheet links before inline styles). Later layers win regardless of
   specificity, so a module class overrides MUI with no `!important`.
   Enforced by `web/scripts/check-no-sx.mjs` (also run from
   `tests/web-conventions.test.mjs`) and, on the built pages, by
   `web/scripts/check-export.mjs`. **Headless alternatives were not needed:**
   the layered approach works with Next.js and MUI as measured in the built
   Storybook (sample story: `ThemeToggle` `CssModuleLayersOverMui`, MUI 13px /
   7px-11px padding is overridden by the module's 14px / 12px).
4. **No first-paint flicker.** MUI's `InitColorSchemeScript` sets `data-theme`
   before paint, emotion styles are server-rendered into the HTML by the App
   Router integration, and colour comes from CSS variables, so a theme change
   is a CSS change with no React re-render of content.
5. **Where it lives: `web/`, a self-contained package with its own
   `package.json` and lockfile.** Not the root package, so the root `npm ci`
   (which `publish-site.yml` runs) does not gain Next, MUI or Storybook, the
   dependency audit keeps separating peer scanner packages from build tooling,
   and the existing install and output stay byte-identical. It builds to
   `web/out` and `web/storybook-static`, never to `dist/`. Until cutover it
   reads `src/tokens.json` and `src/tokens.css` through one import point
   (`web/theme/tokens.ts`, plus the CSS import in `web/app/layout.tsx` and
   `web/.storybook/preview.tsx`); at cutover, with the old UI removed, those
   files move into `web/` and only those imports change.
6. **Storybook framework: `@storybook/nextjs-vite`** (Storybook 10), config in
   `web/.storybook/`, stories beside components in `web/components/<group>/`.
   Same Next primitives (`next/link`, CSS Modules) as the app, on Vite like the
   sibling repo. #544 builds the primitives here.
7. **Preview path: `/next`.** `BASE_PATH` defaults to `/next`; cutover builds
   with `BASE_PATH=` empty. The new site is **not published** while the old UI
   is the site: `publish-site.yml` is not changed and does not build or sync
   `web/`. CI (`validate.yml`, job `web`) builds the export and Storybook and is
   part of the required `validate` aggregate. The preview is not linked from the
   old site and is `noindex`. Publishing a preview at `/next` is a later, separate
   change to `publish-site.yml`, to be reviewed with `ci-hardening` then.
8. **Navigation follows the design spec.** Global entrances in order: Report,
   Comparison (the spec's other tabs stay on the existing site until they move).
   Each section has a local nav (Report: Overview, Providers, Families;
   Comparison: Overview, Features, Runtime) with `aria-current="page"`, skip
   link, and a footer stating the boundary rule. Routes are one table
   (`web/lib/routes.ts`). The spec names the runtime page
   `/comparison/runtime-comparison`; #547 names it `/comparison/runtime`, and the
   issue is followed.
9. **Build-time data only.** `web/lib/ledger.ts` reads committed ledger files
   (`benchmarks/pin-manifest.json`, `benchmarks/support/taxonomy.json`) and,
   through `readOptional`, generated outputs such as `public/results/*.json` that
   exist only after a measurement run. Nothing fetches in the browser; the export
   check fails if a shipped script names a ledger file. Every page states its
   mode (published, the lockfile release, not a candidate build).

## `ci-hardening` review

`publish-site.yml` is unchanged. The one workflow edit is the new `web` job in
`validate.yml`: actions pinned to the same commit SHAs as the file's other jobs,
`permissions: contents: read`, `persist-credentials: false`, `npm ci
--ignore-scripts`, no secrets, no untrusted context in `run:`. `zizmor` on
`validate.yml` reports only artipacked findings on the pre-existing jobs.

## Handoff to #544

- Components: `web/components/<group>/{Component.tsx,Component.module.css,Component.stories.tsx,index.ts}`,
  pure render. The shell group (`SiteHeader`, `SectionNav`, `PageIntro`,
  `ThemeToggle`) shows the pattern. Rules go inside `@layer components`.
- Run locally: `cd web && npm ci && npm run check` (rules, typecheck, build,
  export check, Storybook build); `npm run storybook` for development.
- Not done here and owned by #544: the primitives themselves, the token drift
  test for `web/` (tokens are read from `src/` for now), and `web/CONVENTIONS.md`.
- Pages render placeholders (`web/app/RoutePage.tsx`); #545 and #546 replace them.
