# Architecture

How the benchmark runner, evaluation engine, and site are built, and how a
report is scored. For the fixture schema and authoring rules, see
[CONVENTIONS.md](CONVENTIONS.md). For how to extend the registry, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Measurement protocol and interpretation

Report schema v4 exports `scanner.groups` keyed `<kind>/<tier>` plus classified
rows. There are no scanner-wide totals or rates, and no precision, recall or F1
anywhere; the dashboard rejects a report that contains them. T0 rows preserve
actual ranges but carry no outcome or byte fields. Legacy v1/v2/v3 reports are
rejected; regenerate with `npm run bench`.

Each secret span is scored against the deduplicated findings on its file:
`EXACT` (a finding equals it), `COVERED` (one finding contains it within the
envelope), `OVERBROAD` (contains it beyond the envelope), `PARTIAL` (overlap,
no single containing finding) or `MISS`. A secret straddled by two findings is
`PARTIAL` and leaked. Leaked span rate = PARTIAL + MISS spans ÷ secret spans;
collateral ratio = redacted bytes outside every envelope ÷ secret bytes; false
alarm rate = flagged controls ÷ controls; twin discrimination = pairs where the
positive is covered and the twin is clean ÷ pairs. Exact-range agreement is
kept only as `diagnostics.exact` marked non-comparable.

- Files are materialized in a fresh temporary directory and removed afterward.
  The current adapters scan the filesystem, so no git history is needed.
- Ground truth and normalized findings use **UTF-8 bytes, `[start, end)`**.
  The npm adapter converts its public UTF-16 offsets to UTF-8. External
  adapters locate the reported value within the reported file and line;
  ambiguous or unmappable findings fail the scanner instead of guessing.
  TruffleHog's normalized PostgreSQL output is matched to a unique original
  URI by credential/host/port identity, source line, and reported database.
  It retains the scanner's whole-URI span rather than borrowing the expected
  password range; the authored URI envelope makes that finding `COVERED`.
- Duplicate identical ranges count once, even when multiple detectors report
  them. Coverage is evaluated per finding, never against the union.
- `npm run bench` stamps one run id into every suite report and writes
  `public/results/run.json`. Cross-suite views aggregate only reports sharing
  the newest run id and name any stale suite as a partial run.
- Gitleaks uses default directory rules; environment rule overrides are removed.
  TruffleHog uses `--no-verification --no-update` and includes unverified
  results. No credential verification is requested. These flags are not an
  OS-level network sandbox; use an isolated environment if required.
- Results contain ranges and counts, never matched values or raw scanner
  output. Scanner output stays in memory. Processes have a 120-second timeout
  and 16 MiB output cap. Failures suppress raw stdout/stderr.
- Reports record scanner versions, corpus and lockfile SHA-256, git revision,
  working-tree status, runtime, and time. The single elapsed measurement
  includes adapter overhead and is diagnostic, **not a speed benchmark**.

## Architecture and extension

The [internal evaluation engine](docs/specs/evaluation-engine.md) implements Twin,
Benign, Metamorphic, Mutation and Differential evaluation over the existing
corpora and scanner adapters. Run `npm run eval` for a sanitized discovery report
in `results-output/evaluation.json`, or select a method/detector/scanner, for
example `npm run eval -- --method=twin,benign --scanner=redact-secret`.
Uncertain mutations and scanner disagreements enter a review queue; neither
peer consensus nor this discovery run establishes stable support. Holdout and
public plugin compatibility remain outside this initial implementation.

```text
benchmarks/categories.json     Case suites and corpus registry
benchmarks/detectors.json      Core detector taxonomy snapshot
benchmarks/fixture-detectors.json Explicit fixture-to-detector assignments
benchmarks/run.ts             Materialization, execution, provenance, atomic reports
benchmarks/lib/lattice.ts     Per-span outcome lattice, byte accounting, v1.0 group aggregation (frozen scorer)
benchmarks/lib/accounting.ts  Engine v1.1 accounting: Wilson bounds, floors, measurable share, twin coverage, dual-scorer delta
benchmarks/review-ledger.json Reviewed state of queued disagreements; written by review, never by the engine
benchmarks/lib/scoring.ts     Corpus schema 2 validation (roles, envelopes, twins) and row scoring
benchmarks/lib/twin-probe.ts  Per-family twin probe: discriminated, not discriminated, un-probeable
benchmarks/lib/assessment.ts  Kinds, tiers, provider-first contracts and classification
benchmarks/lib/beta8/          Beta.8 per-issue contracts, arrival families and profiles (#207–#212; docs/specs/beta8-evidence.md)
benchmarks/lib/reporting.ts   Per (kind × tier) groups; no mixed overall score
benchmarks/lib/adversarial-intake.ts External adversarial intake: lifecycle, synthetic-only, frozen expectations and first run, qualification
benchmarks/lib/evidence-classes.ts Public adversarial / protected holdout / maintainer regression queries and independence wording
adversarial/                  External adversarial packs, contributor guide, and the synthetic sample (#139)
baselines/<version>.json       (fixture, scanner) → outcome for a released comparison point
scripts/baseline.mjs           Save baselines and generate docs/generated/release-comparison.md
benchmarks/lib/validate-structures.ts Offline key/JWT validation
scanners/index.mjs             Published-package / external-process adapters
fixtures/<category>/          Versioned corpus and independent expected ranges
public/results/<category>.json Generated report per category (gitignored)
public/results/run.json        Run manifest: run id, suites, scanner versions
public/results/summary.json    Cross-suite and per-detector groups for the run, accounted once at bench time
benchmarks/lib/run-summary.ts  Builds summary.json with the same accountGroups that accounts each suite
src/main.ts                   Data loading, history routing and report refresh
src/shell.ts                  Top bar, global search, theme switch, bottom tabs at 360px
src/tokens.css, tokens.json   Redact Secret design tokens, copied from the design system (a test fails on drift)
src/style.css                 App styles: tokens only, no hex, no raw px, no shadows
src/components/*.ts           Figure, Interval, StatusMark, ByteView, RedactionLane, EvidenceCrumb, ActionEmptyState
src/catalog.ts                Synthetic corpus imports and byte-identity hashes
src/model.mjs                 Catalog validation, route table with legacy redirects, report re-validation
src/evaluation-model.ts       Evaluation evidence checks; review-ledger classes, change rows, qualification floors
src/support-model.ts          Re-validates the published support matrix before a page may render it
public/results/support-matrix-v1.json  Generated support matrix the Support page reads (gitignored)
src/pages/*.ts                Report, Coverage, Support, Suite, Evidence (fixture), How to read
src/pages/workbench/*.ts      Workbench home, review group, changes, qualification, method
```

The site has two entrances in one app, Report for readers and Workbench for
maintainers, and these bookmarkable routes:

- `/report`: three answers (leaked, false alarms, twin discrimination) as the
  published pessimistic bound with its observed fraction and n. `?level=T2` and
  `?level=T3` switch the evidence level; T1 is first. Other scanners are
  reference rows in run order, never ranked. Production reads the published
  package; staging reads the qualified `main` candidate and labels it
  unreleased (#201).
- `/coverage`: detector families by fixture count, with the minimum
  sample size drawn on every bar. `?show=thin` keeps the families at that
  minimum; `?show=inventory` is the Gitleaks/TruffleHog inventory of families
  with no dedicated detector.
- `/coverage/github-token` (or another detector ID): that detector's groups,
  reference scanners and rows.
- `/support`: the support status of every provider × credential family, read
  from the generated `support-matrix-v1.json` — no status is written into the
  site. Each status says what it means to a reader who has not read the
  qualification profile, every family's evidence (tier, provider source, twin
  coverage, unresolved critical items) opens in place, and unsupported families
  stay listed with the reason they are not detected. `?status=provisional` (or
  another status) filters. `npm run support:check:ui` fails CI if the site
  carries a status the matrix cannot.
- `/suites/reference-syntax` (or another case ID): the complete suite with its
  own published groups and run provenance.
- `/fixture/context-edges--unicode`: the evidence view. Green marks the bytes
  that must be redacted, an ink underline the envelope, and one lane per
  scanner what it covered: solid, hatched (partly exposed) or a dashed empty
  frame (missed). Includes the reproduce command and a byte-preserving
  download. Slugs are `<case-id>--<fixture-id>` to avoid collisions.
- `/workbench`: run health in five "n of m" sentences, the review queue grouped
  by ledger class, and summaries of changes and qualification floors.
- `/workbench/review/<class>`: one review group with representative entries and
  a ledger fragment to copy into a pull request. The site writes no file.
- `/workbench/changes`: saved baseline against the current run, or candidate
  evidence when `eval:candidate` writes to `public/results`. `?corpus=expanded`.
- `/workbench/qualification`: each floor, whether it is met, and the actual value.
- `/workbench/method/twin` (or benign, metamorphic, mutation, differential,
  holdout): evaluation evidence per method.
- `/how-to-read`: the protocol, glossary, limits and reproduction, stated once.

Every pre-redesign path (`/benchmark`, `/benchmark/<id>`, `/coverage-gaps`,
`/evaluation…`, `/pending`, `/methodology`, and `#/…` hashes) redirects to its
replacement. The site reads bounds from the published JSON and derives none:
per suite from each suite report, across suites from `summary.json`.
Setting `VITE_PUBLIC_ROUTES_ONLY=1` at build time drops the Workbench routes.

Vite supports direct links and reloads on these paths. A production static
host must rewrite unknown document paths to `/index.html` while serving assets
and `/results/*.json` normally. The app is served at the origin root.

Overview and detector scores are recomputed from selected fixture rows, with
measured-file coverage shown beside each score. Different scanner versions,
modes, lockfiles, and matching rules remain separate, and only reports sharing
the newest run id are aggregated; anything else is named as a partial run.
Reports with stale corpus hashes are excluded, so new fixture bytes never
inherit old scanner ranges. Fixture lists default to rows with signal (changed
since the newest baseline, or not clean). Detector views overlap; do not sum
their totals. No per-detector timing is claimed.

Fixture content is bundled from the checked-in synthetic corpora so the exact
case is inspectable even before running scanners. This intentionally exposes
only authored synthetic inputs; result JSON still contains ranges and counts,
never matched values or raw scanner output.

## Competitor detector inventory

`/coverage-gaps` compares the pinned Gitleaks and TruffleHog registries with
the redact-secret registry (`benchmarks/detectors.json`); the counts of
entries with no named dedicated equivalent are shown on that page and refresh
whenever the pinned tool versions or the registry change. Entries are not
deduplicated across tools, providers, or versions. Commented-out TruffleHog
entries are excluded; feature-gated registrations remain explicitly labeled
rather than assumed active.

`benchmarks/detector-inventory.json` stores identifiers, immutable source
links, source hashes, and conservative provider-family mappings. It contains
no external implementation code. A missing dedicated detector does not prove
a runtime false negative: generic/contextual detection may apply. A related
family also does not prove format parity. This registry comparison is separate
from measured fixture failures and is not a product ranking. See
[CONTRIBUTING.md](CONTRIBUTING.md#refreshing-the-competitor-detector-inventory)
for the refresh/check commands.

`benchmarks/known-gaps.json` preserves point-in-time benchmark findings and
their lifecycle (`observed` → `reviewed` → `promoted`) as they're raised
against the product; see
[docs/decisions/2026-09-18-govern-benchmark-promotion.md](docs/decisions/2026-09-18-govern-benchmark-promotion.md)
for the authoritative lifecycle and
[CONTRIBUTING.md](CONTRIBUTING.md#promoting-a-product-regression) for the
promotion workflow. Issue cards on fixture pages are historical measurement
snapshots, not live GitHub state.

## Evaluation Engine browser evidence

The measurement-v4 benchmark and fixture pages remain available. Open `/evaluation`
for separate case/variant/assertion evidence, method and detector views, failures,
review queue, operator coverage and aggregate-only holdout qualification.

```sh
npm run eval
npm run eval:publish
npm run dev
```

## Support status per family

`/support` shows every provider × credential family with the status its
evidence decided. The page reads one generated artifact and authors nothing;
see [docs/specs/support-ui.md](docs/specs/support-ui.md).

```sh
npm run eval:classify          # evidence per detector      -> results-output/support-status.json
npm run eval:matrix            # projected onto the taxonomy -> results-output/support-matrix.json
npm run eval:publish:matrix    # validated, then published   -> public/results/support-matrix-v1.json
npm run support:check:ui       # CI gate: the site carries no status the matrix cannot
```

For a release candidate, `npm run eval:matrix:drift -- --baseline=<path>`
diffs the freshly generated (or published) matrix against a saved baseline
and emits the record a release gate can check — regressions, improvements,
new-and-unclassified families, and stale provider provenance. This
repository never decides what the drift means for a release; see
[docs/specs/support-matrix-drift.md](docs/specs/support-matrix-drift.md).

To evaluate an immutable unreleased product artifact, use the separate
[`eval:candidate` workflow](docs/specs/candidate-evaluation.md). It installs the
candidate in a temporary consumer and emits candidate evidence without changing
the published scanner or qualification suite.

Discovery remains local at `results-output/evaluation.json`. `eval:publish` validates
current development/regression sources and writes an allowlisted, schema-validated
`public/results/evaluation-v1.json`. Build after publication to include the report.
The browser validates the public contract and current fixture hashes. Missing,
incompatible or stale reports produce an actionable empty state.

To include qualification evidence, refresh and generate it through the engine:

```sh
npm run eval:milestone
npm run eval:qualify -- --output=results-output/qualification/engine-v1.json
npm run eval:validate -- results-output/qualification/engine-v1.json
npm run eval:publish -- --qualification=results-output/qualification/engine-v1.json
```

The default manifest uses repeatable public conformance controls. Protected holdout
runs retain their existing custodian lifecycle and budgets; do not run them merely
to refresh a UI. Qualification is separately dated aggregate evidence, and
`execution-qualified` describes infrastructure execution with `supportClaims: false`.

## Accounting (engine v1.1)

Anything unmeasured, unstable or unreviewed consumes denominator rather than
disappearing from it, and the published figure is the worst defensible bound
([spec](docs/specs/evaluation-engine-v1.1.md),
[decision](docs/decisions/2026-09-19-tighten-evaluation-accounting-v1-1.md)).
Every rate is `{ point, bound, n, direction }` with a Wilson bound on the
pessimistic side, or the reason it is withheld (`insufficient-evidence`,
`insufficient-coverage`). Each scanner is replayed over the same scratch tree
and a disagreement is `unstable`, never a pass. A scanner that did not complete
emits `not-measured` assertion rows. Floors live in the `accounting` block of
`qualification/suite-v1.json` and are covered by `suiteHash`.

```sh
npm run bench && npm run eval
npm run eval:dry-run                       # read-only: what each floor withholds today, and the v1.0 -> v1.1 delta
npm run eval:dry-run -- --measurableShareFloor=0.8   # try a floor before proposing it
```

Qualification additionally requires that no scored stratum falls below the
`resolvedRate` floor and that every review-queue entry has a row in
`benchmarks/review-ledger.json`. An `open` row is a legitimate standing state;
an entry with no row is a disagreement nobody has looked at and reports
`incomplete` with reason `unreviewed-queue`. Reports carry `accountingVersion`;
records under different accounting versions are only compared when one of them
carries the `accountingDelta` mapping.

Affected cases are unique evaluation case IDs within the displayed selection,
including across scanners; one source fixture can participate in several methods.
Failed assertions can overlap the same case. Review-required assertions, mutation
review entries and differential disagreements are unscored. The queue is read-only:
no UI action changes authored expectations or resolves review decisions. Full raw
discovery evidence remains local; the public projection excludes fixture bytes,
raw findings/ranges, arbitrary error/configuration text, seeds and source paths.
Holdout has no fixture links, case records or inferred detector attribution.

Optional browser QA uses an externally installed Playwright (no frontend dependency):
start `npm run preview -- --port 4173` after building, then run
`PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-evaluation-ui.mjs`.
It exercises desktop/mobile routes, reloads, filters, review separation and missing/
stale/malformed data, and saves screenshots under `results-output/ui-verification/`.
The preview host uses SPA fallback; production hosting must likewise serve
`index.html` for application routes.
