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

## Deployment

`publish-site.yml` builds this app and publishes it as the **root of the site**, on staging (`develop`) and, through `npm run go-production`, production
(decision: `docs/decisions/2026-10-02-serve-the-next-export-at-the-site-root.md`, which supersedes the `/next/` preview). The legacy Vite UI is no longer built or published; its source
stays as the oracle. The publish builds the qualification view first (from the archived canonical RunArtifacts, checked against `benchmarks/official-runs.json`), builds the export with
`BASE_PATH=` (empty, the default), `WEB_REQUIRE_RUN=1 WEB_REQUIRE_QUALIFICATION=1` and runs `check:routes`; the second variable makes the "view not built" state a failure, so it applies to
publish and to the CI jobs that build the committed `new` export from the view (`web-build`, `web-browser`, #654). `node scripts/assemble-site.mjs` then makes `dist/`: the export at `/` and `public/results/` at `/results/` (the same step runs in the `web-build` job,
so the publication guards scan what ships). Keep `BASE_PATH` empty and every link root-relative (`check:routes` fails a link that is not a page or file of the export, and a `/next/` string anywhere). Do not add a
`robots` meta: staging's `noindex` is CloudFront's `X-Robots-Tag`, and the same build is production. The CloudFront function of the benchmarks stacks must route `<path>/` to `<path>/index.html` and redirect legacy URLs
by `benchmarks/legacy-url-redirects.json` (`docs/specs/legacy-url-redirects.md`). Before that rule is live, the not-found page resolves an old `/fixture/<suite>--<id>` link itself (`LegacyFixtureLookup`, #594): one records-file request, a known fixture replaced by its `?fixture=` page, anything else a 404 that says why.

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
  inside the app (`check:routes` fails a link that is not a page or file of the export).
- `/evaluation/qualification/` and `/evaluation/qualification/families/<family>/` (#606) show the qualification view the adapter derived from the official
  credential-eval runs (`public/results/qualification-v1.json`, `npm run qualification:view`), beside the report pages' legacy files (the oracle).
  `services/qualification.ts` returns `ready`, `not-built` (the normal state in CI), `incompatible` or `stale` (built from other pins than
  `benchmarks/official-runs.json` or a changed policy file) and a view that is not `ready` shows no number, only why and the commands; with no usable view the
  family route keeps one `view-unavailable` page because `output: export` refuses a dynamic route with no params. Blocks are in `components/qualification/`.
  Every count names its population and none is a sum across populations or scanners; the product's support status is a separate section from the scanners' counts;
  a method that did not run and a pending case are "not measured" and "pending", never zero. The view's per-case rows (`populations[].cases`, additive in v1)
  feed `/evaluation/qualification/families/<family>/cases/<page>/` and `/evaluation/qualification/unattributed/<page>/`: one section per population (the same id in two populations is
  two rows, nothing is counted across them), 50 rows a page as a window over the scope's rows with static Previous and Next links, a row opened with native `<details>` to the case's
  facts, and each scanner's own word (`Pending` and `Not measured` dashed). `resolvers/qualification-cases.ts` is pure; the evidence class is labelled as the artifact's own label, never a status;
  a view without `cases` is incompatible. `scripts/check-export-qualification.mjs` rereads the view and recounts every row on the built pages (without a view it checks the pages say so). The tests build synthetic views (`tests/unit/qualification-data.ts`, put in each state with an overlay root). Decision:
  `docs/decisions/2026-10-01-show-the-qualification-view-beside-the-existing-report.md` and
  `docs/decisions/2026-10-01-carry-per-case-rows-in-the-qualification-view-and-page-them-by-scope.md`.
- **Which pipeline the credential pages are built from (#608).** One committed value, `benchmarks/qualification-authority.json` (`legacy` or `new`), read by `services/authority.ts` and nowhere else in the app;
  every page asks `services/credential-source.ts`, which returns the same `Catalog`, `MeasuredRun` and fixture bytes from the legacy corpora and run files or from the qualification view (`services/credential-bridge.ts`),
  so the report, provider, family, detector, suite, rows and fixture pages and `/evaluation/credential/` render either without knowing which (`resolvers/pages.ts` has one `context()` for them, and the comparison accuracy page, the comparison hub and the scanner page read the same seam: the legacy run under `legacy`, the official run of the report population under `new`, each figure naming its population and run and no populations pooled, #658 and its ADR). Rules: nothing infers the value (no environment variable, no fallback to the other pipeline); under `new` a view that is absent, stale or not the authorised one
  gives no number, only the reason and the commands; every report page opens with a `PipelineStamp` (`RunNotes` renders it, so a page with a run state has one) and never shows a number without it; a fact the view does not hold (a fixture's bytes, where a
  scanner's ranges are) is stated as not recorded, never filled in; the bridge computes the accounted rates over the view's case rows with the legacy accounting, no other maths. A build that publishes sets `WEB_REQUIRE_QUALIFICATION=1` (the same variable `check-export-qualification.mjs` reads; the service refuses an unusable view with it).
  Tests: `tests/unit/overlay.ts` pins every overlay root, and `setup.ts` pins the default root, to `legacy` unless a test chooses (`authorityFile('new')`), so the suite means the same before and after the switch and the legacy path
  stays under test; the new path's tests use a synthetic view (`tests/unit/qualification-data.ts`) and assert no ledger value. `check:routes` recounts the pages against the legacy files under `legacy` (`check-export.mjs`,
  `check-export-rows.mjs`) and against the view under `new` (`check-export-credential.mjs`, and `check-export-comparison.mjs` for the accuracy and scanner pages, whose legacy recounts `check-export-accuracy.mjs` and `check-export-scanners.mjs` stay intact for `legacy`; also checking every report page's stamp and, with no view, that every page says so). CI builds the view from the accepted official RunArtifacts (the `view` job: the public release archive, every file checked against the byte digests of
  `benchmarks/official-runs.json`; a pull request whose view inputs did not change reuses the view built for them) and runs the browser checks (`web-browser`) on the committed `new` export built from it with
  `WEB_REQUIRE_QUALIFICATION=1`. The rollback state, the legacy pipeline's export built with `node scripts/with-authority.mjs legacy -- <command>` (it flips the value for the command and restores it), is built and recounted in every `web-build`, and its
  browser checks run in the legacy oracle (`legacy-oracle.yml`, #655). Locally, run the full checks on both values (`with-authority.mjs`) and, for `new`, with a view built into `public/results/`. Which checks a pull request runs, and why, is `scripts/ci-plan.mjs` ([`docs/specs/ci-validation.md`](../docs/specs/ci-validation.md)). Decision:
  `docs/decisions/2026-10-02-switch-credential-qualification-authority-to-the-new-path.md`; spec: `docs/specs/qualification-cutover.md`.
- **An optional scanner a run did not measure, and where an observation came from (#763, #724).** The view's `scannerRoster.notMeasured` reaches the credential report pages through `CredentialPipeline.view.notMeasured`, `resolvePipelineStamp` and the one block `OptionalScannerNote` (the `PipelineStamp` of every report page, `/evaluation/credential`, `/comparison/accuracy`), the roster of `/evaluation/scanner/` and the full pointer on `/evaluation/qualification/`: the contract sentence, the reason, the last measurement (run, engine, configuration, date; `resolveNotMeasuredRows`) and, when the run registry no longer lists it, the roster's retained record with its archive. No page gives the scanner a row, count or zero. Observation origin (`resolveObservationOrigins`, block `ObservationOrigins`) is provenance from the artifact's non-semantic telemetry and is a block of its own beneath `ScopeAccounting`, never a column of it; `not-recorded` is not `fresh`. Tests build these states from synthetic views (`tests/unit/optional-scanner-pages.test.tsx`) and assert no ledger value. Decision: `docs/decisions/2026-10-07-disclose-the-optional-scanner-on-every-report-and-keep-observation-origin-apart-from-scope-evidence.md`.
- **Which pipeline the PII evaluation is authoritative from (#666).** One committed value, `benchmarks/pii-authority.json` (`legacy` or `new`), read by `services/pii-authority.ts` and nowhere else in the app (`pii:authority:check` fails on any other file that names it), independent of the credential authority: neither service reads the other and a credential value is never authorisation for PII. `loadPiiEvaluation` carries the stamp to `/evaluation/pii/` (the last row of the first status group, "PII authority"). `new` (public/synthetic measurement only; the protected path is pending and never gates it) is refused without a recorded owner authorisation and never falls back to the legacy evaluation; with no published support artifact it reads the pii-eval measurement from the committed durable copies (`committedPiiEvalMeasurement`, product unbound). Tests choose the value in an overlay root (`tests/unit/overlay.ts` pins `legacy` unless a test names the file) and never assert the committed value or an authorisation. Spec: `docs/specs/pii-authority.md`.
- **Review-state disclosure (#680).** Where the accepted evidence release records `maintainer-only` fixtures (credential-evidence ADR 0020), the `PipelineStamp` and `/evaluation/qualification/` carry a `ReviewDisclosure`: the owner's fixed words ("메인테이너 검토 (독립 검토 대기)" / "Maintainer-reviewed (independent review pending)" and the note that it is not yet independently reviewed) and a count read at build time by `services/review-state.ts` from the accepted adoption record's change report (`benchmarks/evidence-adoption.json`), only when the view was built from that release. The internal status name is unchanged; no word says "independent" validation; no count means a build shows no disclosure, never a zero. Decision: `docs/decisions/2026-10-04-accept-snapshot-2026-10-04-3-on-credential-eval-alpha-4.md`.
- `/evaluation/scanner/` (#612) shows the scanners the benchmark ran with and each one's environment: pins, install checksums, configuration and
  platform from the validated peer snapshots (`services/scanners.ts`), the mode line and host from the run, `outOfScope` from the registry. Blocks are
  `Scanner*` in `components/evaluation/scanner/` (a folder of folders is a section; each phase of `/evaluation` has its own). A fact the repository does not
  hold is "Not recorded", never a guess; the tests use synthetic scanners and never assert a version, digest or host.
  `check-export-scanners.mjs` rereads the pins, the run, the checksums and the registry. Decision:
  `docs/decisions/2026-10-01-show-the-scanners-and-their-environments-on-evaluation-scanner.md`.
  Under `new`, "Where it ran" is the MEASUREMENT host of the official run (#620, #621): the engine's stamp from the verified artifact (`OfficialRun.measurement`,
  the view's `populations[].measurement`) and the OS release, CPU, Node and CI image the run driver recorded at execution (`OfficialRun.host`,
  `runs[].measurementHost`), or "Unavailable" for a run recorded before it (never filled in). The header's "Page built" line is the PUBLICATION host
  (`services/build-host.ts`), always labelled apart. `check-export-comparison.mjs` rereads both. Decision:
  `docs/decisions/2026-10-07-record-the-measurement-host-at-execution-and-keep-it-out-of-run-identity.md`.
  The product's own scope (#622) is `scanners/product-scope.json` (`services/product-scope.ts`): statements by kind (credential scope, optional
  personal-data profile, unmeasured surface; never worded as "unsupported" when only not measured), bound to a release and mode line, and compared by the
  resolver with the run's own observation of the product: `Current`, `History` or `Unknown`, never a static value standing in for what was measured.
  Decision: `docs/decisions/2026-10-07-bind-the-product-scope-statements-to-the-measured-release-and-configuration.md`.
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
- `/evaluation/pii/` and `/evaluation/credential/` (#611) render one block set, `DomainView` in `components/evaluation/domain/`, with `resolvers/domains.ts`
  (pure) over `services/domains.ts`. PII is rebuilt from the reviewed protected binding (candidate mode); the credential stable count is the support
  record of the run's own mode and version. A fact the ledger does not hold is a dashed "Not recorded" with its issue, never a zero. Decision:
  `docs/decisions/2026-10-01-explain-how-pii-and-credentials-are-evaluated-on-one-paired-page-design.md`.
- `/evaluation/rc` (#613, #658) shows the candidate beside the last release, read by the authority (`services/candidate.ts`). Under `new` the candidate is the candidate diff of a recorded replay: the internal projection
  `results-output/candidate-diff-from-artifacts.json` (`qualification:candidate-diff`; never under `public/`, so it is not shipped, only its counts reach the page), validated with `candidateDiffArtifactProblems` and bound to the current pins by
  `candidateDiffFreshnessProblems` (the function the publication uses). The page shows counts per population (never a sum across populations), the candidate's registered identity and the control release; it lists no case, family or fixture. States:
  `recorded`, `not-recorded` (the file is absent: the normal state, "No release candidate is recorded"), `invalid` and `stale` (a replay for an earlier release or engine). Under `legacy` (the rollback) `services/candidate-legacy.ts` reads
  `public/results/candidate-evidence-v1.json` (`candidateProblem`) and `baselines/`, as before; neither authority falls back to the other's file. Tests write a synthetic evidence file or a synthetic diff with a synthetic registry into the overlay
  (`tests/unit/rc-fixtures.ts`, `rc-diff-fixtures.ts`) and never read a candidate from the ledger. Blocks are `Rc*` in `components/evaluation/rc/`. Decisions:
  `docs/decisions/2026-10-01-show-the-release-candidate-beside-the-last-release.md` and
  `docs/decisions/2026-10-07-read-the-release-candidate-page-from-the-candidate-diff-under-the-new-authority.md`.
- **Retained legacy imports and file reads (#658).** Every import of `src/` or `benchmarks/` and every service read of a legacy data file is listed in `tests/unit/legacy-imports.test.ts` with a role, an owner and a reason; add yours there or it fails.
  An `oracle` entry is only for a reader the `legacy` authority reaches (the rollback, removed with it by #660); a new service must not read `fixture-index.json`, `fixture-detectors.json`, `scenarios.json`, `peer-observations/`, `baselines/` or `candidate-evidence-v1.json`
  on the `new` path. The inventory is `docs/specs/qualification-cutover.md#the-consumers-after-the-publish-switch-658`.

- `/evaluation` and `/evaluation/method/<method>/` (#614): the six method pages share one schema (head, how it runs, recorded now,
  how to read it, exact inputs) and one table (`EvidenceTable`: scanners across, checks down, a cell is "n of N did not hold",
  no total, no sort). `services/evaluation.ts` (#789) validates the evaluation bundle `public/results/evaluation-bundle-v1.json` (CI writes
  it with `npm run eval:discover` and `npm run eval:publish`; contract `docs/specs/evaluation-report-storage.md`) once by streaming
  (`validateBundle`), keeps the summary, the per-method case counts and the peer review count, and reads the cases of one method
  when its page asks (`casesOf`); it never rebuilds the whole report, and a resolver is handed one method's cases. States: `measured`
  (`source: 'bundle'`), `not-published`, `unusable` (missing, corrupt, mixed or incompatible), `stale` (fixture corpus changed); none
  resolves to zero. Supported legacy: only when no bundle pointer exists, the old whole file `public/results/evaluation-v1.json` is read and
  checked with `evaluationProblem` (`source: 'legacy'`), so the oracle and the rollback stay; a bundle wins when both exist, and a pointer
  whose bundle fails never falls back to the legacy file. Tests build bundles with `BundleWriter` and `commitBundle`
  (`tests/unit/evaluation-bundle-data.ts`), and `tests/unit/evaluation-equivalence.test.ts` holds bundle-derived pages equal to legacy-derived ones. `resolvers/evaluation-methods.ts`
  and `evaluation-hub.ts` are pure, `evaluation-pages.ts` awaits the services. A phase page the hub links is a link only once
  its entry is in the Evaluation section of `lib/routes.ts`: add yours there. Decision:
  `docs/decisions/2026-10-01-show-each-evaluation-method-in-one-fixed-order.md`.
- **The checks behind a method count (#623).** A count over zero (and a "Needs review" cell) links to
  `/evaluation/method/<method>/checks/?row=&scanner=&status=` (`methodChecksHref`, the one place that writes it): the assertions (or, on
  differential, the comparisons) behind exactly that figure, from the same pass that counted them (`collectRows`, `comparisonsByPeer`). The
  page is one per method: its server HTML is the index of lists with their figures; a list is one build-emitted file
  (`data/evaluation/<method>/<row>/<scanner>/<status>/checks.json`, `resolvers/evaluation-checks.ts`) fetched when opened and windowed
  100 a page in the browser (`resolvers/evaluation-checks-view.ts`, `ChecksView`), the fixture-page pattern. A file whose run, list or
  length is not the page's is refused. A family links to its qualification case page only when the view is usable and has it, labelled as
  another report; review decisions are the review ledger's, never the page's. A row that opens nothing says why (`unlisted`).
  `check-export-method-checks.mjs` recounts every list from the bundle. Decision:
  `docs/decisions/2026-10-07-link-method-cells-to-the-checks-behind-each-count.md`.

- `/evaluation/pii/evidence/` (#839) is a separate public pii-evidence population, read at build time by `services/pii-evidence.ts` through the strict comparison consumer and `scripts/pii-evidence-publication.mjs`. Its pure resolver is `resolvers/pii-evidence.ts`; `pii-evidence-pages.ts` is the page-level service boundary. The existing `DomainView` blocks render it. The four benchmark-owned PII views are unchanged and the main PII page links here without appending these rows. Each scanner-neutral metric retains its own denominator; no figure is summed with another population. An absent record says "Not recorded", an invalid identity says "Unusable", and unavailable family projections, PHI/context semantics and protected qualification remain explicit. The independent public index and view sidecars under `public/results/` retain source-file and view digests; the publication source gate recomputes them from the strict consumer. No authority file is read by this path.

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
  `PW_CHANNEL=chrome` uses an installed Chrome. No sleeps and no retries. `PW_PORT` (or `PORT`) moves the suite's server
  off 4173: set it to a private port when another session may be running the suite.
- "No console output" fails on `console.error`/`console.warn`, an uncaught error, a failed request and a 4xx/5xx. One message
  is ignored, by exact text and only for a built `.css` chunk of this origin: Chrome's "The resource ... was preloaded using
  link preload but not used within a few seconds from the window's load event". It is Next's link prefetch preloading the CSS
  of the route a header link leads to, and it prints only when a test keeps a page open about three seconds (a slow runner),
  so it failed pages a PR never touched. `isUnusedPreloadAdvice` in `tests/e2e/fixtures.ts` is the filter and
  `tests/e2e/watch.spec.ts` proves a real error, warning or uncaught error still fails. Do not widen it to other warnings.

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
     root checks CI runs too if you touched anything outside `web/`. The committed authority is `new` and `check`, `check:layout` and `test:e2e` need data pages: run them with a view in
     `public/results/` (the committed value) and on the legacy pipeline (`node scripts/with-authority.mjs legacy -- npm run check`), as the `web-build`, `web-browser` and `legacy-oracle` jobs and `check:docker` do. A pull request that changes only components or routes runs the browser checks for the pages and stories it can reach
     (`LAYOUT_SELECT` for `check:layout`, `WEB_BROWSER_SELECT` for the page matrix, both from `scripts/ci-plan.mjs`); a shared change runs the full suite, and so does every push to `develop` or `main`, the weekly schedule and a dispatch. Run the full suite locally when you touched anything shared.
     Prefer the Docker run for this final verification: `npm run check:docker` (every step of the web CI job after
     install), or `npm run check:layout:docker` / `npm run test:e2e:docker` for one of the two browser checks. It runs in
     the official Playwright image pinned to the repo's Playwright version (`mcr.microsoft.com/playwright:v<version>-noble`),
     on Linux with the bundled Chromium and `CI=true`, which is what CI runs; on a Mac the same checks run on Google Chrome
     (`PW_CHANNEL=chrome`) and a pass there has missed what only CI caught. The container copies the checkout read-only, keeps
     `node_modules` in named volumes (never the host's), publishes no port (several agents never clash) and is capped at
     4 CPUs and 6 GB (`DOCKER_CPUS`, `DOCKER_MEMORY`). `node scripts/docker-run.mjs clean` drops the volumes. A failure's
     traces land in `web/test-results`. See `scripts/docker-run.mjs` for the details and for `DOCKER_PLATFORM=linux/amd64`.
  3. Push once. If CI fails on something that passed locally, find why (clean build, worker count, a base that moved)
     before pushing again; do not just retry.
- **A red check is never "known".** If a check fails on your branch, either fix it or name the issue or PR that owns it in
  the PR body, with the evidence that your change did not cause it (the same check red on `develop`'s tip).
- **A merge is done when `develop` is green.** After merging, read the push-triggered runs on `develop`'s merge commit
  (`gh run list --branch develop`) and say what they show. If they are red, fixing it comes before anything else.
