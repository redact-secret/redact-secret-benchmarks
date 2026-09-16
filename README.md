# redact-secret-benchmarks

Independent, reproducible accuracy benchmarks comparing
[redact-secret](https://github.com/redact-secret/redact-secret) against
established secret-scanning tools on identical fixture sets.

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
  through its published packages (`@redact-secret/core` on npm,
  `redact-secret` on PyPI) — never through internal APIs or a path import
  into the main repo's source tree. That means every benchmark run also
  exercises the actual installed-package experience any other consumer gets.

## What this measures

The same question, asked identically of every tool: given a fixed set of
input files with independently reviewed ground truth (a secret is present or
absent, at a known byte range), what does each scanner report?

- [**redact-secret**](https://github.com/redact-secret/redact-secret) — via
  its published CLI/npm/PyPI packages.
- [**Gitleaks**](https://github.com/gitleaks/gitleaks) — MIT, regex/pattern-based,
  local.
- [**TruffleHog**](https://github.com/trufflesecurity/trufflehog) —
  AGPL-3.0 (invoked as an external binary only, never vendored), adds live
  credential verification.

## Ground-truth schema (tool-agnostic)

Unlike `redact-secret`'s own `assessment/fixtures/accuracy-corpus.json`,
which carries a `policyOutcome` (`block`/`redact`/`warn`) specific to its own
policy model, ground truth here is reduced to what every scanner can be
judged against without favoring one tool's concepts over another's:

```json
{
  "id": "fixture-id",
  "path": "relative/file/path",
  "expected": [
    { "start": 0, "end": 0, "note": "human-readable, no matched value" }
  ]
}
```

An empty `expected` array is a negative (false-positive trap) fixture.
Fixtures are materialized as real files in a scratch directory (and, where a
scanner requires it, a scratch git repository with real commits) rather than
fed as in-memory strings, since Gitleaks and TruffleHog scan files/repos, not
raw text.

## Non-goals

- Not a release gate for `redact-secret`, and not affiliated with or a
  criticism of the Gitleaks or TruffleHog projects.
- No live-credential validation against real provider APIs.
- No real, active, or reconstructable credentials anywhere in fixtures,
  results, logs, or commit history — synthetic or explicitly revoked values
  only, on the same terms as the main repo's `SECURITY.md` and
  `conformance/README.md#fixture-safety-review`.

## Run it

Use Node.js 22.12+ (22.x) or 24.x and npm. From a fresh checkout:

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
npm run build                       # Type-check and build a static dashboard snapshot
npm run preview                     # Preview that snapshot
```

Scanner failures always produce a nonzero exit code, but still write a report
with explicit failure status. Optional missing binaries are nonfatal unless
`--strict` is supplied. Run `npm run bench` **before** building to include
current results in the static site. Generated reports and build output are
gitignored; no example numbers masquerade as a real run.

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
  password range; an exact-range mismatch remains FP + FN.
- A true positive is an exact file and range match. A partial overlap is
  both a false positive and a false negative. Duplicate identical ranges
  count once, even when multiple detectors report them.
- Precision = TP / (TP + FP), recall = TP / (TP + FN), and
  F1 = 2TP / (2TP + FP + FN). Zero denominators are `null` (shown as `—`).
  True negatives count clean negative files, not arbitrary non-secret bytes.
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

```text
benchmarks/categories.json     Case suites and corpus registry
benchmarks/detectors.json      Core detector taxonomy snapshot
benchmarks/fixture-detectors.json Explicit fixture-to-detector assignments
benchmarks/run.mjs             Materialization, execution, provenance, atomic reports
benchmarks/lib/scoring.mjs     Ground-truth validation and exact-range scoring
scanners/index.mjs             Published-package / external-process adapters
fixtures/<category>/          Versioned corpus and independent expected ranges
public/results/<category>.json Generated report per category (gitignored)
src/main.ts                   Application shell, history routing and report refresh
src/catalog.ts                Synthetic corpus imports and byte-identity hashes
src/model.mjs                 Catalog validation, route parsing and score projections
src/pages/browse.ts            Overview, detector and exact fixture pages
src/pages/accuracy.ts          Accuracy visualization and fixture explorer
```

The dashboard uses these bookmarkable routes:

- `/benchmark`: overview statistics, scanner comparisons, all 24 detector families,
  and the eight case suites.
- `/benchmark/github-token` (or another detector ID): fixtures targeting that
  detector across case suites. Detectors with no assigned fixtures explicitly
  show no coverage. Positive and negative fixture counts are separate.
- `/benchmark/reference-syntax` (or another case ID): the original complete
  suite, including regression context and source report provenance. SendGrid
  remains a case suite because it is not in the inspected core registry.
- `/fixture/context-edges--unicode`: the exact synthetic input, highlighted
  expected spans, escaped whitespace, per-scanner findings, and a byte-preserving
  fixture download. Slugs are `<case-id>--<fixture-id>` to avoid collisions.
- `/methodology`: scoring and reproduction details.

Vite supports direct links and reloads on these paths. A production static
host must rewrite unknown document paths to `/index.html` while serving assets
and `/results/*.json` normally. Old `#/accuracy`-style bookmarks redirect to
the matching case page. The app is served at the origin root.

To add an accuracy case, create a corpus and register a unique URL-safe `id`,
`title`, `description`, `kind: "accuracy"`, and `corpus` path in
`benchmarks/categories.json`. Add every fixture slug to
`benchmarks/fixture-detectors.json` with its detector IDs (or `[]` for a shared
case without a detector assignment). Classification describes authored test
intent and never depends on which scanner detects a value. Ground truth must
also be authored independently of scanner results. The catalog tests reject
missing, orphaned, or unknown assignments. Registry detector IDs and case IDs
must not collide. Update the snapshot and assignments when adding detectors;
no local upstream checkout is needed to run this repository.

Overview and detector scores are recomputed from selected fixture rows, with
measured-file coverage shown beside each score. Different scanner versions,
modes, lockfiles, and matching rules remain separate. These are latest reports
per case, potentially measured at different times, not a single atomic run.
Reports with stale corpus hashes are excluded, so new fixture bytes never
inherit old scanner ranges. Source case pages retain run timestamps and hashes.
Detector views overlap; do not sum their totals. No per-detector timing is claimed.

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
and unreleased milestone work. The benchmark remains pinned to the published
`0.1.0-beta.1` package; it does not claim to test beta.3 fixes from source.

**Unreleased fixes** adds another **92 fixtures** for the 11 detection-related
closed issues reviewed in milestone 6. The full suite now contains **243 files,
128 expected secret spans, and eight category pages**. Each issue includes
negative examples and positive controls that should survive its exclusion fix.
The [closed-issue coverage matrix](docs/milestone-6-closed-coverage.md) records
the reviewed source revision and separately identifies the three closed issues
requiring Linux acceptance or Python conformance validation. Issue closure is
not treated as runtime verification of unreleased code.

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
