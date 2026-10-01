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

- No fetching, no `services`, `resolvers`, `app/` or `lib/build-data` imports, no effects, no browser storage.
  `tests/web-tokens.test.mjs` and `check:no-sx` fail on these. A block shows a loading or failed state from props
  (`Skeleton`, `RetryNote`); the page-level client wrapper that loaded the data decides which.
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
- Never `overflow-wrap: anywhere` (it lets a table squeeze cells to a word per
  line); use `break-word`. A table that does not fit scrolls in its region; on a
  phone `DataTable` stacks each row by default.
- Motion: name the properties, `var(--ease-out)`, 160ms, press is
  `scale(var(--press))` on small controls, hover rules sit in
  `@media (hover: hover) and (pointer: fine)`, `prefers-reduced-motion` removes
  transitions and press movement, and controls are `var(--touch)` tall on
  `(pointer: coarse)`.
- The header shows the canonical logo files in `public/` (hash-pinned in
  `scripts/check-header.mjs`); never redraw or recolour the mark.
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
3. `cd web && npm run check` (rules, header, typecheck, build, export check,
   Storybook build, and the Playwright layout check: `PW_CHANNEL=chrome` uses an
   installed Chrome, otherwise `npx playwright install chromium`) and `node --import tsx --test tests/web-tokens.test.mjs` from the root.

## Data layer: services, resolvers, pages

Decision: `docs/decisions/2026-09-30-load-web-data-through-services-and-resolvers.md`.

```
web/app/ (pages)  ->  web/resolvers/  ->  web/services/
web/components/ (blocks): imports none of the three
```

- **Services** (`web/services/`) load at build time: read repository files, validate
  with the validators that already exist, return typed raw data, memoise with `once()`.
  No `fetch`, no network, nothing imported by a client component. The ledger files are never fetched by the browser.
- **Resolvers** (`web/resolvers/`) are pure: raw data in, block props out. All number,
  interval, count and date formatting lives in `resolvers/format.ts` and the resolver
  that uses it. No filesystem, no service import, except `resolvers/pages.ts`, the one
  module a page calls (it awaits services and hands the result to the pure resolvers).
- **Pages** (`web/app/`) are server components: `await resolveXPage()`, compose blocks.
  A client island (a filter, a pager) receives resolved props and may import
  `resolvers/filters.ts`; it never imports a service or `resolvers/pages.ts`.
- A count with no fixtures resolves to `null` (the block shows "No fixtures"). A missing
  measurement resolves to a stated "Not measured" with the command that produces it,
  never a zero and never an invented value. A stable count states its mode.
- Query state lives in the URL and works on a static export: pre-render every route
  (one page per family), pre-render the default view and every level, then let a client
  island read `?q=`, `?show=`, `?page=` and `?level=` after hydration and rewrite them
  with `history` (`app/report/useListQuery.ts`, `LevelSync.tsx`).
- `/comparison/runtime` uses the same panel technique as `?level=`: every reachable
  combination of `?analysis=`, `?domain=` and `?view=` is a pre-rendered panel, and
  `data-analysis`, `data-domain` and `data-view` on the root element (inline script plus
  `RuntimeSync`) pick one; the default panel shows without script. `/comparison/feature`
  keeps its row filter in `?rows=` with a client island, as the lists do. The feature
  claims (`benchmarks/feature-claims.json`) and per-value runtime outcomes do not exist yet:
  those pages render "not recorded" / "not measured yet", never a placeholder value.
- **Rows tables** (level, family, suite and detector pages) ship the first page of their default view in the
  page and, when there are more rows than one page, every row as a build-emitted file
  (`resolvers/rows.ts`: a dictionary of shared strings, a table of outcome words, one small record per
  row; `rowsSource()`). Find, show, level, scanner scope and page stay in the URL (`app/report/RowsView.tsx`,
  `useRowsQuery.ts`, `resolvers/filters.ts`). A client island may import the pure resolvers
  `filters.ts`, `rows.ts`, `rowdata.ts` and `fixtures.ts` (no `node:`, services only as types), never
  `resolvers/pages.ts`. Decisions: `docs/decisions/2026-09-30-add-rows-fixture-detector-and-findings-pages.md`
  and `docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md`.

- `/report/families/<family>/` (#589) adds the provider dossier (`services/dossiers.ts`, validated by `dossiers:check`), the peer rules per
  family (`PeerProfile.rulesByFamily`) and per-level and per-scanner counts (`resolvers/family-detail.ts`, reusing `tally`). Blocks are
  `Family*` in `components/family/`; the page hands them to `FamilyView`, a client component only so the data travels as compact props
  (export budget). A fact the dossier does not record is a "Not recorded" box, never a placeholder. Decision:
  `docs/decisions/2026-10-01-build-the-family-page-from-the-dossier-the-run-and-the-rule-map.md`.

### Fetching build-emitted data

The browser may make exactly one kind of request: a same-origin `GET` of a JSON file the build emitted under
`<basePath>/data/`. Decision: `docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md`.

- The only `fetch` is in `lib/build-data.ts`, called as `fetch(dataUrl(path), { method: 'GET', credentials: 'omit',
  mode: 'same-origin' })`. `dataUrl()` accepts only `BUILD_DATA_PATH` (`lib/data-paths.ts`). No other origin, no
  runtime ledger or API call, no secret, no user data. `check:no-sx` fails anything else, including a route
  handler outside `app/data/` and an import of the helper from a block, service or resolver.
- A file is written by a `force-static` route handler in `app/data/`, from the same page resolver the page uses
  (`resolveRowsFile`, `resolveSuiteRecordsFile`), so its shape is the UI's props. A table that fits one page ships
  whole in its page and gets no file. A new kind of file changes `BUILD_DATA_PATH`, `check-export-rows.mjs` (a test keeps
  the two patterns equal) and the decision record.
- A client wrapper uses `useBuildData(path, check, 'idle' | 'now')`. It returns `idle | loading | ready | error`, `data`,
  a `failure` (`offline`, `unavailable`, `invalid`) and `retry`; a file already loaded this session is `ready` on the
  first render. `check` is the shape guard (and a count the page knows, so a file from another build is refused).
- Loading must not move the page. Keep what is drawn while the next view loads (dim it after a delay, mark it
  `aria-busy`, keep the controls' values), size a skeleton like the content it stands for, say why a load failed and
  offer `RetryNote`, keep the state in the URL, and leave the first page of rows in the HTML for a reader without script.
  `check:layout` holds and fails the request and asserts the table does not move when the data arrives.
- **A fixture's page is `?fixture=<id>` on its suite page** (`/report/fixtures/<suite>/`): the suite page
  pre-renders the first page of rows; the suite's records are one build-emitted file, fetched when a fixture is
  opened, and the detail is built in the browser for the one fixture named (`FixtureSync` and an inline script
  set `data-fixture`, as `?level=` does; `FixtureView` shows the title and a skeleton until the file is in).
  67 pages, not 5,925 (decision: `docs/decisions/2026-10-01-keep-the-fixture-page-on-its-suite-page.md`, #588; the page is the `Fixture*` blocks in
  `components/report`, built by `resolveFixtureRecord`, and `fixtureHref()` is the one place that writes its address). `check:routes` holds what a visitor downloads to limits (`check-export-rows.mjs`: one data file, the largest page,
  the largest rows page); the export's total size and file count are printed, not judged.
- **Peer scanners** get their kind, description and the families their rules target from
  `scanners/peer-registry.json` and `scanners/peer-rule-families.json` (validated by
  `npm run peer-rules:check` and again by `services/peers.ts`); the peer columns state what a scanner's
  rules target and what was recorded, never which scanner is better. Every link on a report page stays
  inside the app (`check:routes` fails a link that leaves `/next/`).
- `/evaluation/scanner/` (#612) shows the scanners the benchmark ran with and each one's environment: pins, install checksums, configuration and
  platform from the validated peer snapshots (`services/scanners.ts`), the mode line and host from the run, `outOfScope` from the registry. Blocks are
  `Scanner*` in `components/evaluation/scanner/` (a folder of folders is a section; each phase of `/evaluation` has its own). A fact the repository does not
  hold is "Not recorded" (#620, #621, #622), never a guess; the tests use synthetic scanners and never assert a version, digest or host.
  `check-export-scanners.mjs` rereads the pins, the run, the checksums and the registry. Decision:
  `docs/decisions/2026-10-01-show-the-scanners-and-their-environments-on-evaluation-scanner.md`.
- Resolver tests live in `web/tests/unit` (`resolvers.test.mjs`, `report-rows.test.mjs`, ...; synthetic
  data only) and also enforce the import direction. `check:routes` compares the built pages with the
  ledger, read independently; CI sets `WEB_REQUIRE_RUN=1` and runs `npm run bench` first.
- Runtime outcomes and per-setting times (#562, #563): `evidence/562/runtime-comparison-<setting>.json` (three
  reports, from `qualification/runtime-comparison-v2.json`) are read by `services/runtime.ts` and validated with
  `validatePeerRuntimeThroughputReport`. A combination with a measurement is pre-rendered once per view
  (`external-pii-all|speed|accuracy`, ...); one without is a single "Not measured yet" panel keyed `analysis-domain`.
  `check:routes` recomputes every outcome, share and time from the committed reports. Decision:
  `docs/decisions/2026-09-30-record-runtime-outcomes-and-time-redact-secret-settings.md`.
- `/comparison/performance` (#569) pre-renders one panel per pair and setting (`?with=`, `?setting=`, picked by `data-peer` and
  `data-setting` on the root, as the runtime page does). Pair times come from `evidence/562` (only the chosen setting's run, both
  sides), redact-secret's own throughput from the accepted run via `services/performance.ts`; the two are never drawn on one axis.
  `check:routes` recomputes every time, spread and mark position (`scripts/check-export-performance.mjs`). Decision:
  `docs/decisions/2026-09-30-show-the-performance-pair-as-same-run-times-with-a-noise-rule.md`.
- `/comparison/accuracy` (#570) pre-renders every reachable pair, level and scope as a panel keyed
  `<data>.<tool>.<level>.<scope>.<peers>` and shows one by `data-acc-key` on the root (inline script plus `AccuracySync`;
  the per-key rules come from `app/comparison/accuracy/panel-css.ts`). Blocks are `Accuracy*` in `components/comparison`; the
  resolver is `resolvers/accuracy.ts` (pure, also read by the client island that lists differing files from the
  build-emitted `data/comparison/accuracy/differences.json` when a list is opened). `check-export-accuracy.mjs` recounts every
  panel and that file from the suite reports. Decision:
  `docs/decisions/2026-09-30-compare-accuracy-one-pair-at-a-time.md`.

## Tests

Decision: `docs/decisions/2026-10-01-test-the-web-app-with-vitest-and-playwright.md`.

- `npm run test` (Vitest, jsdom) runs `tests/unit`; `npm run test:coverage` adds V8 coverage over `app`, `components`, `lib`,
  `resolvers`, `services` and `theme` and fails below 80% of lines, statements, functions and branches. Only stories, `.d.ts`
  and CSS are excluded. `npm run coverage:summary` prints the table by directory.
- Every story is rendered and scanned by axe (`tests/unit/stories.test.tsx`), so a new component's story is its first test.
  Behaviour (keys, controlled state, ARIA) gets a test by role and accessible name, never a snapshot.
- `tests/unit/overlay.ts` builds a repository root that is the real one except for named files, to put a service in a state the
  committed tree is not in (no run published, a snapshot that does not validate). Synthetic content only.
- `npm run test:e2e` (Playwright Test) drives the built export: `npm run build` first. A new route or address variant goes in
  `ROUTES` in `tests/e2e/fixtures.ts`, which runs it through the page matrix (light and dark, 320 and 1280px, axe with no
  serious or critical violation, no sideways scroll, no console output, no off-origin request but web fonts).
  `PW_CHANNEL=chrome` uses an installed Chrome. No sleeps and no retries.

## Before you merge

`develop` moves while a branch is open (repins, release records, go-production). A branch that was green on the base it
forked from can turn `develop` red once merged. #599 did: it merged nine minutes after the beta12 repin (#600), and two
Playwright tests that opened `?show=leaked` and expected a pager found zero leaked rows at T1.

- **Tests do not assert ledger values.** No row, fixture, family, scanner or leaked-span count, and no "this view has more
  than one page", read from the committed ledger or the run. A repin or a new corpus re-keys them. Put the state under test
  in a committed synthetic fixture (`tests/unit/overlay.ts` for services; synthetic props for blocks), or derive it from the
  data at run time (find a view that has the property, and fail with a message saying which input is missing). The e2e
  suite may rely on structure that cannot change without a new page (routes, landmarks, controls), not on counts.
- **Verify on the final base, locally, before the merge:**
  1. `git fetch origin && git rebase origin/develop` (or merge it) right before you push, not when you branched.
  2. From `web/`: `npm run check`, `npm run test:coverage` and, on a fresh `npm run build`, `npm run test:e2e`. Run the
     root checks CI runs too if you touched anything outside `web/`.
  3. Push once. If CI fails on something that passed locally, find why (clean build, worker count, a base that moved)
     before pushing again; do not just retry.
- **A red check is never "known".** If a check fails on your branch, either fix it or name the issue or PR that owns it in
  the PR body, with the evidence that your change did not cause it (the same check red on `develop`'s tip).
- **A merge is done when `develop` is green.** After merging, read the push-triggered runs on `develop`'s merge commit
  (`gh run list --branch develop`) and say what they show. If they are red, fixing it comes before anything else.
