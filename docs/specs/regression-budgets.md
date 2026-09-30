# Reviewed performance-regression budgets

Issue: [#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143),
part of [#138](https://github.com/redact-secret/redact-secret-benchmarks/issues/138).
Timing follow-up: [#303](https://github.com/redact-secret/redact-secret-benchmarks/issues/303).
Decisions: [`2026-09-25-introduce-reviewed-performance-regression-budgets.md`](../decisions/2026-09-25-introduce-reviewed-performance-regression-budgets.md),
amended for latency and initialization by
[`2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md`](../decisions/2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md).
Baseline and derivation evidence: [`docs/reports/2026-09-25-beta9-143-regression-budgets.md`](../reports/2026-09-25-beta9-143-regression-budgets.md)
and, for paired timing, [`docs/reports/2026-09-25-beta9-303-paired-timing-budgets.md`](../reports/2026-09-25-beta9-303-paired-timing-budgets.md).
Library: `benchmarks/lib/regression-budgets.ts`. CLIs: `scripts/regression-budgets.mjs`
(`npm run performance:budgets:*`) and `scripts/paired-performance.mjs`. Tests: `tests/regression-budgets.test.mjs`.

Status: `reviewStatus: "reviewed"` since #303. `npm run performance:budgets:check`
refuses `reviewed` unless the A/A study holds at least three same-job runs of
the current baseline commit, each with its CPU model recorded.

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
| `invalid-measurement` | the candidate cannot be judged: wrong profile, too few samples, a missing metric, a `--quick` harness run, timing not measured paired against the baseline commit, or a tail-only change (the p95 ratio breaches while the median ratio does not). Rerun it | 2 |
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
| `latency` | same-job paired run (`paired.json` from `performance-evaluation.yml`) | `linux-x64-release`, same job, in-job baseline = the budgets' baseline commit | processing median, candidate/baseline ratio, per surface × workload profile; the p95 ratio is the tail check |
| `initialization` | the same paired run | the same | initialization median ratio per surface × workload profile; the p95 ratio is the tail check |
| `memory` | core `CompleteAssessment` summary (`performance-evaluation.yml`) | `linux-x64-release` | largest observed sample per surface × profile × observable category |
| `size` | WebAssembly: `wasm-sizes.json`, and the quickstart bundle: `quickstart-bundle.json`, both measured from the candidate's own build in `performance-evaluation.yml` (redact-secret#929, #937); the other families: `benchmarks/operational-evidence.json` (#141) | `release-artifacts` | compressed WebAssembly per profile (plus the optional pii builds, baseline-pending), what the quickstart browser bundle fetches, npm tarballs, native addons, wheels, CLI binaries |
| `adapter-overhead` | the `redact-secret-adapters` overhead harnesses | the measuring host (platform, arch, CPU model, runtime line) | adapter traversal per host × workload (as a same-session ratio against the previous adapter release), adapter-core allocation, scanner calls per event, scanned code units per event |

**Timing is judged on same-job paired ratios** (#303). The hosted runner's
machine class varies from job to job: six runs at one pin measured up to 45%
apart on every row at once (`rerun-noise-linux-x64.json`). The workflow
therefore builds the budgets' baseline commit next to the candidate and runs
both through core's assessment in counterbalanced rounds (A B B A ...) on the
one runner, six rounds of two fresh-process samples per side. The machine
cancels out of the candidate/baseline ratio. Absolute latency and
initialization compared with the frozen snapshot are still reported, under
"Absolute timing across jobs (informational, not judged)", and never produce
a verdict. Memory and size stay absolute: the six-run study moved memory by
at most 5.2%, inside every memory threshold and its 1 MiB floor, and sizes do
not depend on the machine.

**Every performance run judges the WebAssembly size rows**
([redact-secret#929](https://github.com/redact-secret/redact-secret/issues/929)).
The beta.10 run judged neither `size/wasm/*/gzip` row, because no size source
was passed, and a common-profile growth shipped without a verdict. The
workflow now also builds the candidate's `common` profile
(`npm run wasm:build:common`) and, after the assessment,
`scripts/measure-wasm-sizes.mjs` measures both profiles' `.wasm` files in that
same checkout: raw, gzip level 9 and brotli quality 11 (the #141 method), with
each file's sha256 and the checkout's commit. Only gzip is budgeted. `evaluate`
rejects sizes measured at another commit. With `--summary` (a performance
run) the `size/wasm/` rows are required: without `--wasm-sizes` they are
`invalid-measurement` (exit 2), never `not-evaluated`. A size source that
covers only WebAssembly leaves the other size families (npm tarballs, addons,
wheels, CLI binaries, the browser bundle) `not-evaluated`, visibly counted in
the report; those are cross-platform release artifacts one Linux job does not
build.

**The quickstart bundle row is what a default quickstart fetches**
([redact-secret#937](https://github.com/redact-secret/redact-secret/issues/937)).
From #937 on, each WebAssembly profile has a `pii` build beside its default
one, and `@redact-secret/core` imports it only when `initialize()` selects
PII. A bundler therefore emits it as a second, lazily loaded asset that a
default page never downloads. `scripts/measure-quickstart-bundle.mjs` packs
the job's build with core's own `scripts/pack-npm-candidate.mjs`, builds the
browser lane of core's `docs/quickstart.md` at that commit with the bundler
version it names, serves the output, and loads it in Chromium. It checks the
page against the documented expected text and records which emitted files
the server was asked for. `size/browser-bundle/quickstart/gzip` is the gzip
total of the fetched files. The total of every emitted asset is reported as
the diagnostic `size/browser-bundle/quickstart/emitted-gzip`, so a lazily
loaded asset is never hidden, but it is never budgeted. The beta.7 quickstart
build behind the baseline value had no lazily loaded asset, so its all-files
total is its fetched total and the baseline is unchanged. With `--summary`
this row is required like the WebAssembly rows: without `--quickstart-bundle`
it is `invalid-measurement` (exit 2).

**The pii builds are optional rows, baseline-pending.** `measure-wasm-sizes.mjs`
also measures `full-pii` and `common-pii` (`<outName>_pii_bg.wasm`) when the
checkout built them, both or neither. A commit from before the split builds
neither, and its evidence says `piiBuilds: absent`. Their rows,
`size/wasm/full-pii/gzip` and `size/wasm/common-pii/gzip`, are `optional`
like `common`. The baseline snapshot never measured them, so `derive` gives
them no trigger and no budget is invented for them. The report lists them
under "Measured rows with no baseline yet" as `baseline-pending`, with the
measured value and no verdict. They get a trigger from `rules.size` only when
a baseline snapshot that carries them is promoted.

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

The dimension reads `redact-secret-adapters/overhead-v1` and `-v2` outputs
alike (#472). v2 only adds fields: per-mode single-event latency and
allocation, `derived.adapterOverheadRatio`, and, under the harness's
`--baseline`, a per-result `baseline` and `change` against the previous
adapter release measured in the same process. The v2 fields are budgeted by
the rules in
[`2026-09-29-judge-adapter-traversal-on-same-session-change.md`](../decisions/2026-09-29-judge-adapter-traversal-on-same-session-change.md):

- **Traversal** is judged on `change.traversal`, as the current/previous
  ratio, median over at least five processes per language (a single process is
  `invalid-measurement`). It is a same-job paired ratio like core timing, with
  the floor in microseconds of the in-process previous-release traversal. The
  snapshot's absolute traversal is reported, not judged.
- **The work gate.** When `change.scannerCallsPerEvent.difference` is not 0 the
  two builds do different work: the traversal trigger is `not-evaluated`, in
  either direction, and the scanner-calls trigger reports the change. A result
  with `baseline.comparable: false` is `invalid-measurement`.
- **Tail.** A p95 ratio of the adapter-core single-event latency above its own
  threshold while the traversal median is inside is tail-only
  (`invalid-measurement`, rerun). p99 is reported, not budgeted.
- **Allocation** is absolute against the snapshot: JavaScript
  `allocatedBytesPerEvent` and Python `peakBytes` of `adapter-core`. The GC
  count is recorded in the snapshot, not budgeted.

A v1 output, or a v2 output without `--baseline`, carries no traversal change
or allocation: those triggers are `invalid-measurement` (missing metric).
The v2 harnesses also add workloads, which changes the workload digest, so a
candidate at the new digest is `invalid-measurement` against a baseline at an
older digest. A baseline promotion that changes the digest is compared row by
row against the previous baseline: rows both carry are judged, and the digest
itself is not a breach.

## How thresholds are derived

`deriveTriggers` computes every trigger from the current baseline snapshot and
the recorded noise. Nothing is hand-edited, and `npm run performance:budgets:check`
fails CI when `benchmarks/regression-budgets.json` differs from what the
derivation produces. `ceil5%` rounds up to the next five percentage points. A
change breaches when it exceeds both the relative threshold times the baseline
value and the absolute floor. For a paired ratio the baseline value is 1, and
the millisecond floor is divided by the in-job baseline statistic. A/A
deviation is `max(r, 1/r) − 1` of a ratio measured with the baseline commit on
both sides.

| Dimension | Relative threshold | Absolute floor | Corroboration | Minimum samples |
| --- | --- | --- | --- | --- |
| latency (paired median ratio) | `ceil5%(max(10%, 2 × row's largest A/A median ratio deviation))` | 1 ms of the in-job baseline median | tail check: a p95 ratio above `ceil5%(max(15%, 2 × row's largest A/A p95 ratio deviation))` and 1 ms with the median inside is `invalid-measurement` | 10 per side |
| initialization (paired median ratio) | `ceil5%(max(25%, 2 × row's largest A/A median ratio deviation))` | 2 ms | tail check at `ceil5%(max(50%, 2 × row's largest A/A p95 ratio deviation))` and 2 ms | 10 per side |
| memory | `ceil5%(max(10%, 2 × max(CI cross-run spread, rerun spread)))` | 1 MiB | — | 5 |
| size | 5% | 4 KiB (compressed wasm, bundle, npm), 16 KiB (addons, wheels, CLI) | — | 1 |
| adapter traversal (same-session ratio, median over ≥5 processes) | `ceil5%(max(15%, 2 × row's largest A/A ratio deviation))` | `max(0.5 µs, 3 × between-process SD)` of the in-process previous-release traversal | tail check: an adapter-core p95 latency ratio above `ceil5%(max(15%, 2 × row's largest A/A p95 ratio deviation))` with the median inside is `invalid-measurement` | 15 repetitions |
| adapter allocation (JavaScript bytes per event, Python peak bytes) | `ceil5%(max(10%, 2 × row's largest A/A ratio deviation))` | 1 KiB | — | 1 |
| adapter calls / code units | any increase | 0 | — | 1 |

The noise inputs are committed under `benchmarks/regression-evidence/`:

- `paired-aa-linux-x64.json` holds six same-job A/A runs of the baseline
  commit on the hosted runner, on four CPU models (AMD EPYC 7763, 9V74, 9V45,
  Intel Xeon Platinum 8573C), reduced by `scripts/paired-performance.mjs collect`
  with run ids, URLs, artifact digests and CPU models. Its per-row largest
  deviations set every latency and initialization threshold.
- `paired-backtest-linux-x64.json` holds same-job paired runs of four
  historical consecutive revision pairs. `backtest` replays the timing
  triggers over them.
- `ci-dispersion.json` holds every committed release-build summary from the
  history of `evidence/603/summary.json` (eight Linux x86_64 runs). From each
  it keeps per-row p95/median dispersion and memory maxima. It sets the memory
  cross-run spread and the memory backtest. Its timing dispersion set the
  #143 thresholds, which #303 replaced.
- `rerun-noise-darwin-arm64.json` measures the *same* published release
  artifacts again and again with core's own per-sample protocol
  (`scripts/measure-regression-noise.mjs`). The median moved at most 3.8%
  between reruns. The p95, which for five samples is their maximum, moved up
  to 21.9%. It now sets only the memory rerun term.
- `rerun-noise-linux-x64.json` reduces six `performance-evaluation.yml`
  runs at the baseline pin on the GitHub-hosted runner
  (`scripts/regression-budgets.mjs runner-reruns`). It is the evidence for
  #303, not a derivation source. Four runs agree within 6.4% on the processing
  median. Two ran 22% and 45% faster across every row, which points to a
  faster runner machine, and two times that spread would disable every
  absolute timing trigger.
- `adapter-overhead-v2-darwin-arm64.json` holds five independent processes per
  language of the adapter harnesses at the v2 workload digest (#472), current
  build only. Each trigger's between-process standard deviation (the traversal
  floor) comes from it. `adapter-overhead-darwin-arm64.json` stays as the
  evidence of the `0.1.0-beta.8` baseline at the v1 digest.
- `adapter-aa-darwin-arm64.json` holds three A/A processes per language of the
  same harness on the same host: the current build timed against a copy of
  itself with `--baseline`. The largest ratio deviation of each row's
  traversal, p95 latency and allocation sets the adapter thresholds above.

### Why timing is judged on the median ratio, with the p95 ratio as a tail check

In the six A/A runs the paired processing median ratio stayed within 2.6% of
1 on nine of ten rows (browser small-whole: 14.7%). The paired p95 ratio,
which for twelve samples is the ratio of two maxima, moved by up to 45%. A
p95-primary trigger would therefore need thresholds of up to 95% and would
miss a uniform 20% slowdown on half the rows. The median ratio is the judged
statistic. The p95 ratio still guards the tail: when it breaches its own,
wider threshold and the median does not, the change is tail-shaped and comes
back as `invalid-measurement`, so a rerun decides whether it is real. #143
judged the p95 corroborated by the median in absolute terms. For a change that
moves the whole distribution, the median ratio decides in both designs.

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
# Judge a candidate (any subset of sources; unsupplied dimensions are not evaluated,
# except the wasm and quickstart-bundle size rows, which --summary requires).
# Timing needs --paired; --summary alone judges memory and reports timing as informational.
npm run performance:budgets:evaluate -- --summary <summary.json> --paired <paired.json> \
  --wasm-sizes <wasm-sizes.json> --quickstart-bundle <quickstart-bundle.json> --operational <operational-evidence.json> --adapter <overhead-v2 series, five processes run with --baseline> \
  --source-commit <40-hex> --json-out r.json --markdown-out r.md

# the candidate build's wasm sizes (in performance-evaluation.yml, after both wasm profiles are built)
node scripts/measure-wasm-sizes.mjs --core <core checkout> --source-commit <40-hex> --out wasm-sizes.json [--markdown-out wasm-sizes.md]
# what the documented browser quickstart fetches (needs the job's addon, js and wasm builds, and core's Playwright Chromium)
node scripts/measure-quickstart-bundle.mjs --core <core checkout> --source-commit <40-hex> --out quickstart-bundle.json [--markdown-out f.md] [--work-dir <dir>]

npm run performance:budgets:check      # ledger, baseline history, derivation drift (CI: validate.yml)
npm run performance:budgets:derive     # rewrite triggers after a new baseline or new noise evidence
npm run performance:budgets:backtest   # memory over the committed Linux history, timing over the committed paired pairs
# paired measurement (in performance-evaluation.yml; A/A when both revisions are the same)
node --import tsx scripts/paired-performance.mjs run --baseline-dir <core> --candidate-dir <core> --rounds 6 --runs 2 --out-dir <dir>
node --import tsx scripts/paired-performance.mjs reduce --dir <dir> --baseline-revision <sha> --candidate-revision <sha> --runner runner.json --out paired.json
node --import tsx scripts/paired-performance.mjs collect --runs <manifest.json> --out benchmarks/regression-evidence/paired-aa-linux-x64.json
npm run performance:noise -- --core-repo <redact-secret checkout> --python <python> --out <file>
```

`.github/workflows/performance-evaluation.yml` builds the candidate (default:
the pin manifest's revision) and the paired baseline (default: the budgets'
baseline commit) in one job, records the runner's CPU model in `runner.json`,
runs the candidate's absolute assessment for the acceptance criteria and
memory, measures the candidate's WebAssembly profiles and what its
quickstart fetches, then the interleaved paired rounds. It then runs
`evaluate` with `--summary`, `--paired`, `--wasm-sizes` and
`--quickstart-bundle` and adds the verdict and both size tables to the job
summary. Dispatch
inputs `baseline_revision`, `candidate_revision` and `rounds` select other
pairs. The same commit on both sides is an A/A run.

**The baseline build is cached by commit**
([#307](https://github.com/redact-secret/redact-secret-benchmarks/issues/307)).
`scripts/build-core.sh` is the one build for both sides.

- **What is cached.** `scripts/core-build-cache.mjs collect` gathers the
  baseline checkout's build outputs: every git-ignored, untracked file outside
  `node_modules`, `target` and `.venv`, plus the release CLI binary. It writes
  a manifest of each file's sha256 and the commit.
- **The key.** `paired-baseline-build-v1-<runner OS>-<arch>-<baseline commit>-<digest>`.
  The digest covers the rustc, cargo, wasm-bindgen, maturin, Node and Python
  versions, the runner image, and the hashes of `build-core.sh` and
  `core-build-cache.mjs`. The key is matched exactly; there are no
  `restore-keys`.
- **Hit, miss, and A/A.** A hit skips the baseline build. A miss builds the
  baseline and saves it. An A/A run builds once and reuses the candidate's
  build for both sides. It no longer carries build-to-build variation, which
  release builds of one commit do not show.
- **Verification.** Every path goes through `restore`. It fails the run on a
  missing, extra or changed file, or a manifest of another commit. It records
  `baselineBuild` (`source`: `cache`, `built` or `shared-with-candidate`, the
  key, and the manifest's sha256) in `paired.json`.
- **Who can write the cache.** The workflow runs only on `workflow_dispatch`
  in this repository, so no pull request or fork run writes an entry it
  restores. GitHub also scopes cache entries to the ref that saved them: a
  branch can read its own and the default branch's entries, so the first run
  on a new ref fills its own.
- **Cost.** A run builds core once after the first fill. On the pair
  f2082ab → 3144bb3 with a warm Cargo cache, the two-side build took 89–90 s
  (runs 36180547649 without the cache, 36184676984 as a cache miss) and a
  cache hit took 53 s. Whole jobs: 287 s, 287 s and 257 s. The interleaved
  measurement, about 105–115 s, is the rest of the doubled cost and is not
  cached.

## Promoting a new baseline

1. Measure the release: the Linux performance run, the #141 size evidence, and
   five adapter-harness processes per language on the adapter profile. Judge
   the promotion's timing with a paired run of the old baseline commit
   against the new one. Snapshots do not carry paired ratios, so the history
   check marks timing between baselines as not evaluated.
   A re-take of only the adapter series (a new workload digest, same product
   commit) passes `--continues <previous id>` to `snapshot`: `check` then
   requires every other metric to equal the previous baseline's, and accepted
   tradeoffs recorded against the previous baseline keep applying. The
   promotion is compared row by row, not refused for the digest change.
2. Write the snapshot with `scripts/regression-budgets.mjs snapshot`, append a
   history record with `supersedes` set to the previous baseline and the
   snapshot's sha256, and set `baseline` to the new id.
3. Run `npm run performance:budgets:check`. Every breach against the previous
   baseline must be accepted in the ledger before the check passes.
4. Dispatch at least three A/A runs of the new baseline commit, collect them
   into `paired-aa-linux-x64.json`, and run `npm run performance:budgets:derive`
   so thresholds move to the new baseline and its A/A noise. Commit the
   snapshot, the history record, the ledger entries, the A/A study and the
   derived budgets together. `reviewed` is refused until the A/A study
   matches the new baseline commit.

## Limitations

- **The A/A study covers six runs on four CPU models.** A machine class not
  seen there could be noisier within one job. Each threshold doubles a
  per-row maximum of six runs and never goes below the policy floors.
- **Paired timing does not see whole-machine effects that change between
  commits.** Both sides share the runner, so a slowdown that appears only on
  one machine class shows up in proportion to that class's share of the
  runs.
- The paired design doubles measurement time. With the baseline build cached
  (#307), the build is paid once per run after the first fill.
- Adapter-overhead budgets are bound to the host that measured them (Apple M4,
  Node 22, CPython 3.14). A candidate from another host is
  `invalid-measurement` by construction. An official adapter profile on Linux
  is future work.
- Detection is reported, not budgeted, by design.
