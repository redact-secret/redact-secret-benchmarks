# redact-secret-benchmarks

Project-maintained, reproducible synthetic benchmarks comparing
[redact-secret](https://github.com/redact-secret/redact-secret) against
established secret-scanning tools on identical fixture sets.

Measurement protocol **v4** ([spec](docs/specs/measurement-v4.md),
[decision record](docs/specs/decisions/2026-09-17-adopt-measurement-protocol-v4.md)):
every fixture declares a **kind** (must-redact, must-not-flag, policy) and an
evidence **tier** (T1 provider-documented, T2 tool-corroborated, T3 project
policy, T0 pending); every secret span may carry an authored **envelope**; each
span is scored on a five-state lattice (EXACT · COVERED · OVERBROAD · PARTIAL ·
MISS). Headline numbers per (kind × tier): **leaked span rate**, **false alarm
rate**, **collateral ratio** and **twin discrimination**. There is no mixed
overall score and no precision/recall/F1. See the
[corpus audit](docs/reports/2026-09-17/corpus-audit.md) for evidence tiers and the
generated [release comparison](docs/generated/release-comparison.md) for baselines.
Full scoring semantics, the fixture schema, and how the app is built are in
[ARCHITECTURE.md](ARCHITECTURE.md) and [CONVENTIONS.md](CONVENTIONS.md); how to
add a case, detector, or scanner is in [CONTRIBUTING.md](CONTRIBUTING.md).

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

The exact fixture schema, envelope/twin/tier authoring rules, and code style
are in [CONVENTIONS.md](CONVENTIONS.md#ground-truth-schema-tool-agnostic).

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
and serves the site at **http://127.0.0.1:5174/report** with Vite. The server
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
npm run baseline -- --save 0.1.0-beta.6  # Store (fixture, scanner) → outcome from a complete run
npm run baseline:report              # Regenerate docs/generated/release-comparison.md from baselines/
npm run build                       # Type-check and build a static dashboard snapshot
npm run preview                     # Preview that snapshot
```

Scanner failures always produce a nonzero exit code, but still write a report
with explicit failure status. Optional missing binaries are nonfatal unless
`--strict` is supplied. Run `npm run bench` **before** building to include
current results in the static site. Generated reports and build output are
gitignored; no example numbers masquerade as a real run.

These are project-maintained regression and structural-coverage corpora, not
an independently reviewed, neutral sample; they cannot establish that one
product is better than another. See
[ARCHITECTURE.md](ARCHITECTURE.md#measurement-protocol-and-interpretation)
for report schema, scoring formulas, and the full measurement protocol.

## Corpus status

Corpus review status remains **draft, pending independent human review**.
Fixtures are project-maintained regression and structural-coverage corpora,
including fixtures generated from Redact Secret's own detector registry —
not an independently reviewed, neutral sample, and not a basis for ranking
tools. Only the npm binding is currently exercised for redact-secret; CLI and
PyPI comparisons can be added as separate adapters.

As of this checkout, the registered corpus totals **1,071 fixture files and
471 expected secret spans across 11 case suites**:

| Case suite | Files | Secret spans |
| --- | ---: | ---: |
| Reviewed credential formats (`common-formats`) | 144 | 60 |
| Detection accuracy (`accuracy`) | 10 | 5 |
| GitHub token contexts (`token-contexts`) | 10 | 4 |
| Credential formats (`credential-formats`) | 42 | 27 |
| Context & boundaries (`context-edges`) | 37 | 23 |
| Negative controls (`negative-controls`) | 24 | 0 |
| SendGrid regressions (`sendgrid-regressions`) | 49 | 30 |
| Reference syntax (`reference-syntax`) | 26 | 6 |
| Beta.3 regressions (`milestone-6-closed`) | 92 | 33 |
| Detector coverage (`detector-coverage`) | 622 | 283 |
| Real-world shapes (`real-world-shapes`) | 15 | 0 |

These totals are summed from `benchmarks/categories.json`'s corpus files; open
`/coverage` to see the live per-detector-family breakdown. Fixture counts
drift as corpora are added, and this table is not regenerated automatically. See
[the expanded corpus notes](fixtures/generated/README.md) for generation,
source references, and per-category limitations, and
[docs/reports/](docs/reports/) for the dated growth history and per-release
results (beta.3 through beta.6, the SendGrid investigation, and the
closed-issue coverage matrix). Durable measurement evidence tied to one
`redact-secret` issue lives in [`evidence/<issue>/`](evidence/README.md), not
in that repository's own frozen-evidence archive — see
[the evidence decision record](docs/specs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md).

`npm run test:coverage` measures code coverage of the scoring/validation and
scanner-adapter modules only, and requires all four tools (Gitleaks and
TruffleHog as binaries on `PATH`; redact-secret and flare-redact as pinned npm
packages). It does not imply UI coverage, runner coverage, or real-world
credential coverage. The published npm redaction tests run `scan`, `redact`,
and `scanAndRedact` over all registered fixtures, verifying pipeline
agreement and default placeholder substitution — an npm consumer check, not a
claim that any upstream product issue has been validated here.

## License

MIT — see [LICENSE](./LICENSE). This license covers this repository's own
code and fixtures only; it does not extend to, and this repo does not
redistribute, any third-party scanner's source.
