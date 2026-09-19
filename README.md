# redact-secret-benchmarks

Project-maintained, reproducible synthetic benchmarks comparing
[redact-secret](https://github.com/redact-secret/redact-secret) against
established secret-scanning tools on identical fixture sets.

Measurement protocol **v4** ([spec](docs/measurement-v4.md),
[decision record](docs/decisions/2026-09-17-adopt-measurement-protocol-v4.md)):
every fixture declares a **kind** (must-redact, must-not-flag, policy) and an
evidence **tier** (T1 provider-documented, T2 tool-corroborated, T3 project
policy, T0 pending); every secret span may carry an authored **envelope**; each
span is scored on a five-state lattice (EXACT · COVERED · OVERBROAD · PARTIAL ·
MISS). Headline numbers per (kind × tier): **leaked span rate**, **false alarm
rate**, **collateral ratio** and **twin discrimination**. There is no mixed
overall score and no precision/recall/F1. See the
[25-family corpus audit](docs/corpus-audit.md) for evidence tiers and the
generated [release comparison](docs/release-comparison.md) for baselines.

Generated credential JSON is **local build output**, excluded from Git.
`npm ci`, development, builds and tests materialize it automatically from public
deterministic seeds. Commit generator changes and the SHA-256 manifest in
`benchmarks/generated-corpora.json`; never force-add generated JSON. CI rejects
tracked generated inputs. This avoids recurring push-protection false positives
without changing the bytes scanners receive or weakening their test cases.

## Why this is a separate repository

This work is deliberately kept out of `redact-secret/redact-secret`:

- **License isolation.** TruffleHog is AGPL-3.0. This repo shells out to its
  released binary as an arm's-length external process for comparison
  purposes; it never vendors, links, or redistributes TruffleHog source. That
  entanglement — even at arm's length — has no reason to exist anywhere near
  the main product repository or its CI.
- **Governance scope.** The main repo's `assessment/` directory is governed
  by [`decision-define-cross-language-evaluation-protocol`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-12-define-cross-language-evaluation-protocol.md),
  which explicitly places "comparisons against competing products" out of
  scope. Doing this work here avoids reopening or amending that decision.
- **Real external-consumer testing.** This repo depends on redact-secret only
  through its published package (`@redact-secret/core` on npm) — never through internal APIs or a path import
  into the main repo's source tree. That means every benchmark run also
  exercises the actual installed-package experience any other consumer gets.

## Promoting a product regression

This repository owns discovery and evaluation evidence; the product owns the
small, release-blocking behavioral regression. The authoritative lifecycle,
transition evidence, fixed-candidate rerun commands, and two-gate acceptance
rule are in
[`docs/decisions/2026-09-18-govern-benchmark-promotion.md`](docs/decisions/2026-09-18-govern-benchmark-promotion.md).
The product-side placement and provenance rules are linked there. Do not copy a
discovery matrix, generated variants, competitor observations, holdout material,
or raw result bundles into `redact-secret`.

## What this measures

The same question, asked identically of every tool: given a fixed set of
input files with authored, draft ground truth (a secret is present or
absent, at a known byte range), what does each scanner report?

- [**redact-secret**](https://github.com/redact-secret/redact-secret) — via
  its published npm package. CLI and PyPI are not measured here.
- [**Gitleaks**](https://github.com/gitleaks/gitleaks) — MIT, regex/pattern-based,
  local.
- [**TruffleHog**](https://github.com/trufflesecurity/trufflehog) —
  AGPL-3.0 (invoked as an external binary only, never vendored), adds live
  credential verification.

## Ground-truth schema (tool-agnostic)

Ranges use a common representation, but expectations are not automatically
tool-neutral. Each fixture must declare its measurement purpose and rationale;
reviewed format fixtures also require a source-backed contract:

```json
{
  "id": "fixture-id",
  "path": "relative/file/path",
  "content": "postgres://fixture:s3cret@db.example.invalid/app",
  "expected": [
    { "start": 19, "end": 25, "role": "secret",
      "envelope": { "start": 0, "end": 48, "reason": "Whole URI may be redacted; only the password must be." } }
  ],
  "assessment": { "kind": "policy", "tier": "T3", "reason": "…", "contract": "connection-string", "sources": [] }
}
```

An empty `expected` array with `kind: "must-not-flag"` is an authored control;
a control may declare `twinOf`, `mutation` and `mutationKind` to pair with a
positive that differs by exactly one structural property. Envelopes, tiers and
twins are authored from construction and provider evidence, hashed with the
corpus, and never widened in response to scanner output. Fixtures are
materialized in a scratch filesystem directory.

## Non-goals

- This repository does not assert product output; it measures and records.
  An assertion someone wants to write here is a promotion signal.
- Not a release gate for `redact-secret`, and not affiliated with or a
  criticism of the Gitleaks or TruffleHog projects.
- No live-credential validation against real provider APIs.
- No active or provider-issued credentials. Cryptographic controls use a fixed
  public test seed to create a parseable, never-deployed private key and locally
  signed JWT. These public test values must never be used for real systems.

## Run it

The benchmark runner, evaluation engine, methods, operators and shared scoring
code in `benchmarks/` are TypeScript. npm commands use `tsx` to execute them;
`npm run typecheck` strictly checks the benchmarks and UI, and `npm run build`
runs that check before bundling. Existing `npm run bench` and `npm run eval`
arguments are unchanged. Direct invocations need the loader, for example
`node --import tsx benchmarks/evaluate.ts --scanner=redact-secret`.

Use Node.js 22.12+ (22.x) or 24.x and npm. Python 3.11+ is also required
for inventory-parser tests and inventory refresh; refreshing upstream metadata
requires authenticated `gh`. From a fresh checkout:

```sh
npm ci
npm start
```

`npm start` runs all registered benchmarks, writes sanitized JSON results,
and serves the dashboard at **http://127.0.0.1:5174/benchmark** with Vite. The server
fails explicitly if that port is occupied rather than silently changing ports.
Production preview uses **http://127.0.0.1:4174**. The published
npm package for redact-secret is pinned in the lockfile. Gitleaks and
TruffleHog are optional external binaries on `PATH`; absent binaries appear
as **unavailable**, never as zero scores. Install released versions using
the [Gitleaks instructions](https://github.com/gitleaks/gitleaks#installing)
and [TruffleHog instructions](https://github.com/trufflesecurity/trufflehog#installation).
Neither binary is bundled or installed automatically.

For a full comparison on macOS, install both external scanners and run:

```sh
brew install gitleaks trufflehog
npm run compare
```

`compare` first validates fixture identity and runs the unit/redaction tests,
then checks each real scanner against synthetic controls and runs all categories in
strict mode. It prints metric tables and updates the dashboard reports. It
fails if a required binary is missing or an integration control fails.
TruffleHog credential verification remains disabled throughout.

```sh
npm run bench                       # Update all results; the UI polls every 5 seconds
npm run bench -- --category=accuracy # Update one category
npm run bench -- --strict            # Nonzero exit if any scanner is unavailable
npm run dev                         # Serve existing results, or show setup instructions
npm test                            # Scoring, normalization, and installed npm adapter tests
npm run test:integration             # Real scanners: positive/negative controls, Unicode + CRLF
npm run compare                      # Integration checks, then strict comparison of all categories
npm run test:coverage                # Tests + coverage for scoring and scanner adapters
npm run test:redaction               # Published npm scan/redact parity over every registered fixture
npm run fixtures:check               # Verify generated fixtures have not drifted
npm run baseline -- --save 0.1.0-beta.4  # Store (fixture, scanner) → outcome from a complete run
npm run baseline:report              # Regenerate docs/release-comparison.md from baselines/
npm run build                       # Type-check and build a static dashboard snapshot
npm run preview                     # Preview that snapshot
```

Scanner failures always produce a nonzero exit code, but still write a report
with explicit failure status. Optional missing binaries are nonfatal unless
`--strict` is supplied. Run `npm run bench` **before** building to include
current results in the static site. Generated reports and build output are
gitignored; no example numbers masquerade as a real run.

## Interpretation

These are project-maintained regression and structural-coverage corpora, including
fixtures generated from Redact Secret's own detector registry. They are not an
independently reviewed, neutral sample and cannot establish that one product is
better than another. Corpus review status remains draft.

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

## Measurement protocol

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

The [internal evaluation engine](docs/evaluation-engine.md) implements Twin,
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
benchmarks/lib/lattice.ts     Per-span outcome lattice, byte accounting, group aggregation
benchmarks/lib/scoring.ts     Corpus schema 2 validation (roles, envelopes, twins) and row scoring
benchmarks/lib/assessment.ts  Kinds, tiers, provider-first contracts and classification
benchmarks/lib/reporting.ts   Per (kind × tier) groups; no mixed overall score
baselines/<version>.json       (fixture, scanner) → outcome for a released comparison point
scripts/baseline.mjs           Save baselines and generate docs/release-comparison.md
benchmarks/lib/validate-structures.ts Offline key/JWT validation
scanners/index.mjs             Published-package / external-process adapters
fixtures/<category>/          Versioned corpus and independent expected ranges
public/results/<category>.json Generated report per category (gitignored)
public/results/run.json        Run manifest: run id, suites, scanner versions
src/main.ts                   Application shell, history routing and report refresh
src/catalog.ts                Synthetic corpus imports and byte-identity hashes
src/model.mjs                 Catalog validation, route parsing and score projections
src/pages/browse.ts            Overview, detector and exact fixture pages
src/pages/accuracy.ts          Accuracy visualization and fixture explorer
```

The dashboard uses these bookmarkable routes:

- `/benchmark`: overview statistics, scanner comparisons, all 25 detector families,
  and the ten case suites.
- `/benchmark/github-token` (or another detector ID): fixtures targeting that
  detector across case suites. Detectors with no assigned fixtures explicitly
  show no coverage. Positive and negative fixture counts are separate.
- `/benchmark/reference-syntax` (or another case ID): the original complete
  suite, including regression context and source report provenance. SendGrid
  has both a regression case suite and a `/benchmark/sendgrid-token` detector page.
- `/fixture/context-edges--unicode`: the exact synthetic input, highlighted
  expected spans, escaped whitespace, per-scanner findings, and a byte-preserving
  fixture download. Slugs are `<case-id>--<fixture-id>` to avoid collisions.
- `/coverage-gaps`: searchable Gitleaks/TruffleHog detector inventory and
  the six beta.3 fixture failures resolved by beta.4 issues #292–294.
- `/pending`: T0 fixtures, inspectable and unscored.
- `/methodology`: the protocol, its limits and reproduction details, stated once.

Vite supports direct links and reloads on these paths. A production static
host must rewrite unknown document paths to `/index.html` while serving assets
and `/results/*.json` normally. Old `#/accuracy`-style bookmarks redirect to
the matching case page. The app is served at the origin root.

To add an accuracy case, create a corpus and register a unique URL-safe `id`,
`title`, `description`, `kind: "accuracy"`, and `corpus` path in
`benchmarks/categories.json`. Add every fixture slug to
`benchmarks/fixture-detectors.json` with its detector IDs (or `[]` for a shared
case without a detector assignment). Add an assessment rule in
`benchmarks/lib/assessment.ts` and regenerate/check fixtures. Unknown formats
default to T0. Classification describes authored test
intent and never depends on which scanner detects a value. Ground truth must
also be authored independently of scanner results. The catalog tests reject
missing, orphaned, or unknown assignments. Registry detector IDs and case IDs
must not collide. Update the snapshot and assignments when adding detectors;
no local upstream checkout is needed to run this repository.

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

For a new measurement type, add its validation/scoring handler to the runner
and a corresponding page renderer. Keep scanner execution separate from
measurement logic. To add a scanner, implement `version(root)` and
`scan(root, fixtures)` in the scanner registry, returning `{ path, start, end }`.

## Corpus status

The ten-file starter corpus is **draft, pending independent human review**.
It covers synthetic token shapes, context, a Unicode prefix, and negative
controls. It exercises the pipeline, not representative real-world scanner
quality. Synthetic/example filtering can affect results. Do not use this
small corpus to rank tools or make product superiority claims. Only the npm
binding is currently exercised for redact-secret; CLI and PyPI comparisons
can be added as separate adapters.

The separate **GitHub token contexts** category adds four positive text
contexts and two negative controls. Its credential-shaped value is derived
deterministically from a benchmark-only string, never issued by a provider.
The construction is recorded in that corpus's `provenance` field. This is
one token family, not broader provider coverage, and is also pending review.
Keep these categories separate: the original starter values contain obvious
placeholder patterns, whereas the context corpus exercises a fuller token
shape. Different results do not by themselves prove a scanner defect.

The expanded suite adds **71 fixtures** across **Credential formats** (27),
**Context & boundaries** (20), and **Negative controls** (24), bringing the
first expansion to **87 fixture files, 59 expected spans, and five category pages**.
The dashboard includes per-group detection and negative-control summaries.
See [the expanded corpus notes](fixtures/generated/README.md) for generation,
source references, exact coverage, and limitations. Run `npm run fixtures:generate`
after intentionally editing the deterministic corpus builder; `compare`
checks that the checked-in corpora match it before scanning.

`npm run test:coverage` measures code coverage of the scoring/validation and
scanner-adapter modules only. It includes installed-scanner integration tests
and requires all three tools. It does not imply UI coverage, runner coverage,
or real-world credential coverage.

The second expansion adds **SendGrid regressions** (38 files: 30 positives,
8 negatives) and **Reference syntax** (26 files: 20 negatives, 6 paired
literal-secret positives). The full suite now contains **151 fixture files,
95 expected secret spans, and seven category pages**. These pages carry links
to the relevant upstream issues in both the dashboard and JSON exports.

The three original SendGrid misses are tracked in
[#285](https://github.com/redact-secret/redact-secret/issues/285), filed in
milestone 6 after checking existing issues and PRs. See the
[investigation notes](docs/sendgrid-investigation.md) for the reproducer,
source inspection, and the distinction between the installed npm release
and the earlier milestone source review. The benchmark is now pinned to the
published `0.1.0-beta.4` package. The generated
[release comparison](docs/release-comparison.md) is the maintained view; the
[beta.4](docs/beta-4-results.md) and [beta.3](docs/beta-3-results.md)
documents are historical schema-v2 snapshots. The
[beta.5 candidate precision gate](docs/beta-5-results.md) (redact-secret#376)
is separate schema-v4 unpublished-candidate evidence, not another
published-package snapshot.

**Beta.3 regressions** adds another **92 fixtures** for the 11 detection-related
closed issues reviewed in milestone 6. The full suite now contains **243 files,
128 expected secret spans, and eight category pages**. Each issue includes
negative examples and positive controls that should survive its exclusion fix.
The [closed-issue coverage matrix](docs/milestone-6-closed-coverage.md) records
the reviewed source revision and separately identifies the three closed issues
requiring Linux acceptance or Python conformance validation. Issue closure is
not treated as runtime verification; published npm results provide the local
whole-input measurements.

**Detector coverage** adds **248 fixtures** (198 positive spans and 50
negative controls) across all **25 registered detector families**, including
the 15 previously without assigned fixtures. With the reviewed-format suite and
its 56 negative twins the catalog contains **605 files, 386 secret spans, and
ten case suites**. Open
`/benchmark/detector-coverage` or any detector page to inspect the new cases.
Provider prefix variants, six PEM labels, JWT, Bearer headers, five database
schemes, OTP URIs, and generic fields have bare, quoted, and Unicode/CRLF
contexts. All expectations are constructed independently of scanner output.
See [the coverage notes](fixtures/generated/README.md#all-detector-expansion)
for safety, policy scope, and measured limitations.

The published npm redaction tests run `scan`, `redact`, and `scanAndRedact`
over all registered fixtures. They verify pipeline agreement, expected default
placeholder substitution from reported actions/ranges, and preservation of
surrounding text without logging inputs. This is an npm consumer check, not
a claim that upstream Python issue #275 or streaming issue #265 has been
validated here. Detection expectations remain the independent corpus ranges.

## License

MIT — see [LICENSE](./LICENSE). This license covers this repository's own
code and fixtures only; it does not extend to, and this repo does not
redistribute, any third-party scanner's source.


## Competitor detector inventory

`/coverage-gaps` compares the **222 Gitleaks 8.30.1 rules** and **892
TruffleHog 3.97.4 registrations** with the pinned 25-family redact-secret
registry. There are **162** and **843** entries, respectively, with no named
dedicated equivalent. Entries are not deduplicated across tools, providers,
or versions. Commented-out TruffleHog entries are excluded; feature-gated
registrations remain explicitly labeled rather than assumed active.

`benchmarks/detector-inventory.json` stores identifiers, immutable source
links, source hashes, and conservative provider-family mappings. It contains
no external implementation code. A missing dedicated detector does not prove
a runtime false negative: generic/contextual detection may apply. A related
family also does not prove format parity. This registry comparison is separate
from measured fixture failures and is not a product ranking.

```sh
npm run detectors:refresh # Fetch pinned release registries and regenerate metadata
npm run detectors:check   # Fetch the same immutable sources and reject snapshot drift
```

Both commands use Python 3.11+ and `gh`; review the explicit family mappings
in `scripts/refresh-detector-inventory.py` when upgrading versions. The web app
loads only the checked-in snapshot and performs no external scanner queries.

`benchmarks/known-gaps.json` preserves the beta.3 measurements and links six
fixtures to the [beta.4 milestone](https://github.com/redact-secret/redact-secret/milestone/7).
All six now pass with the published beta.4 npm package:

- [#292](https://github.com/redact-secret/redact-secret/issues/292): Windows environment references and SQL bind parameters (two false positives).
- [#293](https://github.com/redact-secret/redact-secret/issues/293): Azure App Service Key Vault references (one false positive).
- [#294](https://github.com/redact-secret/redact-secret/issues/294): nested quoted assignments in plain text (three missed spans; malformed-input scope is explicit).

Issue cards are a historical beta.3 measurement snapshot, not live GitHub
state. Corresponding fixture pages retain their original context and beta.4
follow-up links; current beta.4 results are summarized in
[docs/beta-4-results.md](docs/beta-4-results.md).


### Evaluation Engine browser evidence

The measurement-v4 benchmark and fixture pages remain available. Open `/evaluation`
for separate case/variant/assertion evidence, method and detector views, failures,
review queue, operator coverage and aggregate-only holdout qualification.

```sh
npm run eval
npm run eval:publish
npm run dev
```

To evaluate an immutable unreleased product artifact, use the separate
[`eval:candidate` workflow](docs/candidate-evaluation.md). It installs the
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
