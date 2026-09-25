# Reviewed performance-regression budgets

Issue: [#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143),
part of [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138).
Decision: [`2026-09-25-introduce-reviewed-performance-regression-budgets.md`](../decisions/2026-09-25-introduce-reviewed-performance-regression-budgets.md).
Baseline and derivation evidence: [`docs/reports/2026-09-25-beta9-143-regression-budgets.md`](../reports/2026-09-25-beta9-143-regression-budgets.md).
Library: `benchmarks/lib/regression-budgets.ts`. CLI: `scripts/regression-budgets.mjs`
(`npm run performance:budgets:*`). Tests: `tests/regression-budgets.test.mjs`.

## What a budget is

A budget is a review trigger over a *change*. It compares a candidate with a
frozen baseline snapshot and says whether the change needs a person to look at
it. It is not an absolute ceiling. That job stays with
[`performance-acceptance.md`](performance-acceptance.md)'s criteria, which
answer "is this run acceptable at all" and are unchanged by this spec.

Every trigger ends in one outcome of the decision model:

| Outcome | Meaning | CLI exit |
| --- | --- | --- |
| `within-budget` | the change is at or below the trigger's threshold, noise included | 0 |
| `accepted-tradeoff` | the change breaches the threshold, and `benchmarks/accepted-regressions.json` records why, with a linked detection or safety benefit | 0 |
| `regression` | the change breaches the threshold and nothing accepts it: fix it, or record the tradeoff | 1 |
| `invalid-measurement` | the candidate cannot be judged: wrong profile, too few samples, a missing metric, a `--quick` harness run, or a tail-only change the median does not corroborate. Rerun it | 2 |
| `not-evaluated` | no candidate source for this dimension was supplied | 0 |

A measured regression anywhere makes the report `regression` (exit 1), even
if another dimension is invalid. Otherwise any invalid measurement makes it
`invalid-measurement` (exit 2). In CI, exit 1 is annotated
**Budget regression** and exit 2 **Measurement invalid, rerun**, so the two
failures are never confused.

## Dimensions

Five dimensions are budgeted. Each is judged and counted on its own, and no
report combines them into a score.

| Dimension | Source | Profile | Triggers |
| --- | --- | --- | --- |
| `latency` | core `CompleteAssessment` summary (`performance-evaluation.yml`) | `linux-x64-release` | processing p95 per surface × workload profile |
| `initialization` | the same summary | `linux-x64-release` | initialization p95 per surface × workload profile |
| `memory` | the same summary | `linux-x64-release` | largest observed sample per surface × profile × observable category |
| `size` | `benchmarks/operational-evidence.json` (#141) | `release-artifacts` | compressed WebAssembly per profile, the quickstart browser bundle, npm tarballs, native addons, wheels, CLI binaries |
| `adapter-overhead` | the `redact-secret-adapters` overhead harnesses | the measuring host (platform, arch, CPU model, runtime line) | adapter traversal per host × workload, scanner calls per event, scanned code units per event |

**Detection** is reported next to them, never budgeted. A detection change is
the benefit side of a tradeoff, not a cost.

The **default bundle and optional profiles are separate triggers**. The
`full` WebAssembly profile is what the default browser entry and the quickstart
bundle ship (`role: default`). `common` is an optional subpath export
(`role: optional`). Growth in an optional profile appears on its own row and is
never folded into the default bundle's number.

**Adapter overhead excludes the core's scan time.** A host with the adapter
over the real core costs roughly the core's scan of the leaves the adapter
hands it. On the beta.8 baseline the core accounts for about 96–100% of the total
(see the report). Budgeting that total would count the latency dimension a
second time. The adapter-attributable quantities are instead:

- traversal: the host plus the adapter over a scanner that finds nothing, minus the host alone;
- the scanner calls it makes per event;
- the code units it hands the core per event.

The last two are deterministic, so they catch double scanning with no noise
at all.

## How thresholds are derived

`deriveTriggers` computes every trigger from the current baseline snapshot and
the recorded noise. Nothing is hand-edited, and `npm run performance:budgets:check`
fails CI when `benchmarks/regression-budgets.json` differs from what the
derivation produces. `ceil5%` rounds up to the next five percentage points. A
change breaches when it exceeds both the relative threshold times the baseline
value and the absolute floor.

| Dimension | Relative threshold | Absolute floor | Corroboration | Minimum samples |
| --- | --- | --- | --- | --- |
| latency | `ceil5%(max(15%, row's CI dispersion, 2 × rerun median spread))` | 1 ms | the processing median must rise more than `ceil5%(max(10%, 2 × rerun median spread))` and 1 ms | 5 |
| initialization | `ceil5%(max(50%, row's CI dispersion, 2 × rerun median spread))` | 2 ms | the initialization median must rise more than `ceil5%(max(25%, 2 × rerun median spread))` and 2 ms | 5 |
| memory | `ceil5%(max(10%, 2 × max(CI cross-run spread, rerun spread)))` | 1 MiB | — | 5 |
| size | 5% | 4 KiB (compressed wasm, bundle, npm), 16 KiB (addons, wheels, CLI) | — | 1 |
| adapter traversal | `ceil5%(max(15%, 2 × between-process spread))` | `max(0.5 µs, 3 × between-process SD)` | — | 15 repetitions |
| adapter calls / code units | any increase | 0 | — | 1 |

The noise inputs are committed under `benchmarks/regression-evidence/`:

- `ci-dispersion.json` holds every committed release-build summary from the
  history of `evidence/603/summary.json` (eight Linux x86_64 runs). From each
  it keeps per-row p95/median dispersion and memory maxima. Each run is a
  different product commit, so only the *within-run* dispersion is noise, and
  it is what sets the per-row p95 threshold.
- `rerun-noise-darwin-arm64.json` measures the *same* published release
  artifacts again and again with core's own per-sample protocol
  (`scripts/measure-regression-noise.mjs`). The median moved at most 3.8%
  between reruns. The p95, which for five samples is their maximum, moved up
  to 21.9%.
- `adapter-overhead-darwin-arm64.json` holds five independent processes per
  language of the adapter harnesses. Each trigger's between-process spread and
  standard deviation come from it.

### Why p95 needs a corroborating median

With five samples, the nearest-rank p95 is the slowest sample. A single slow
sample can move it by 20% or more between reruns of the same artifact, while
the median barely moves. The trigger therefore keeps p95 as the metric people
reason about. A breach counts as a regression only when the median also moved
past its own, tighter threshold. A p95-only breach is sent back as
`invalid-measurement`: the change is tail-shaped, and a rerun decides whether
it is real. The historical backtest in the report shows this routing: the one
tail-only breach in the eight Linux runs lands there, and both real
detector-expansion slowdowns land as regressions on every surface.

### Why size uses policy, not noise

A given source builds to the same artifact. The only size variance on record
is 16 bytes, between the Linux- and macOS-built `full` wasm (#141). A noise
bound on that would flag every byte. The 5% threshold is instead anchored to
release history. Between beta.5 and beta.8, per-release growth of the wasm
and native packages was 4.0–10.3%, all of it detector expansion. Growth at or
above a typical expansion release therefore needs a recorded tradeoff.
Toolchain-level drift never does.

## Accepted tradeoffs

`benchmarks/accepted-regressions.json` is an append-only ledger. An entry
accepts exactly one trigger, against exactly one baseline id, for exactly one
candidate source commit. `npm run performance:budgets:check` rejects an entry
that is missing any of the following:

- a rationale of 40 characters or more;
- a benefit of kind `detection` or `safety`, with a summary and at least one
  `https://github.com/redact-secret/<repo>/(issues|pull)/<n>` link;
- the original measurement: baseline value, candidate value, and unit;
- `decidedAt` and `decidedBy`.

The budget report keeps both the measured values and the final decision
(`acceptedBy`) on every row.

## Baselines, and why a breach cannot be replaced away

`benchmarks/regression-baselines/<id>.json` is an immutable snapshot of every
budgeted metric at one product commit. It holds the values themselves, so
replacing `evidence/603/summary.json` or `operational-evidence.json` later
never moves a baseline. `benchmarks/regression-budgets.json#baselines` is the
history, and each record pins its snapshot's sha256.

`npm run performance:budgets:check` fails when:

- a snapshot changed since it was recorded;
- the current baseline is not the newest record;
- a newer baseline was promoted over an older one while any trigger breached
  between them, unless each breach has an accepted tradeoff for exactly that
  promotion (the trigger, the older baseline's id, and the newer baseline's
  source commit).

Promoting a new baseline therefore goes through the same judgement as any
candidate. A breach is accepted, with its measurement and benefit, or the
promotion is invalid.

## Commands

```sh
# Judge a candidate (any subset of sources; unsupplied dimensions are not evaluated)
npm run performance:budgets:evaluate -- --summary <summary.json> --operational <operational-evidence.json> \
  --adapter <overhead-v1 output or series> --source-commit <40-hex> --json-out r.json --markdown-out r.md

npm run performance:budgets:check      # ledger, baseline history, derivation drift (CI: validate.yml)
npm run performance:budgets:derive     # rewrite triggers after a new baseline or new noise evidence
npm run performance:budgets:backtest   # replay the rules over the committed Linux history
npm run performance:noise -- --core-repo <redact-secret checkout> --python <python> --out <file>
```

`.github/workflows/performance-evaluation.yml` runs `evaluate` on every fresh
Linux summary, right after the acceptance criteria, and adds the verdict to the
job summary.

## Promoting a new baseline

1. Measure the release: the Linux performance run, the #141 size evidence, and
   five adapter-harness processes per language on the adapter profile.
2. Write the snapshot with `scripts/regression-budgets.mjs snapshot`, append a
   history record with `supersedes` set to the previous baseline and the
   snapshot's sha256, and set `baseline` to the new id.
3. Run `npm run performance:budgets:check`. Every breach against the previous
   baseline must be accepted in the ledger before the check passes.
4. Run `npm run performance:budgets:derive` so thresholds move to the new
   baseline values, then commit the snapshot, the history record, the ledger
   entries and the derived budgets together.

## Limitations

- **Runner-to-runner variance on the official Linux profile is not yet
  measured.** Every committed Linux run is a different commit. The
  same-artifact rerun noise was measured on a macOS arm64 workstation, not a
  GitHub-hosted runner, and it stands in for the rerun term until
  `performance-evaluation.yml` has been dispatched repeatedly at one pin.
- The rerun study covers the Node and Python surfaces. Rust, CLI and browser
  rows take their rerun term from those, and their own CI dispersion.
- Adapter-overhead budgets are bound to the host that measured them (Apple M4,
  Node 22, CPython 3.14). A candidate from another host is
  `invalid-measurement` by construction. An official adapter profile on Linux
  is future work.
- Detection is reported, not budgeted, by design.
