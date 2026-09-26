# Same-job paired timing budgets (#303)

**Result.** Latency and initialization budgets are now judged on the
candidate/baseline ratio measured in one job. Six A/A runs on four CPU models
set the thresholds. The median-ratio threshold is 10% on nine of ten latency
rows and 30% on browser small-whole. The budgets are `reviewed`.

A paired backtest over four historical revision pairs overturns part of the
#143 absolute backtest. The beta.7 step it flagged on every latency row
(+28% to +64%) is flat when paired, so it was a machine-class shift. The next
step is a real, smaller slowdown (+8% to +16%). One step #143 read as Node
initialization only also slowed processing on every row.

Issue: [#303](https://github.com/redact-secret/redact-secret-benchmarks/issues/303), follow-up to
[#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143).
Decision: [`2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md`](../decisions/2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md).
Spec: [`docs/specs/regression-budgets.md`](../specs/regression-budgets.md).
Budgets: `benchmarks/regression-budgets.json` (`reviewStatus: reviewed`).

## Why

The #143 decision said the timing budgets become `reviewed` once
`performance-evaluation.yml` has run at least three times at one pin and the
budgets are re-derived with that spread. Six runs at the baseline pin
(`benchmarks/regression-evidence/rerun-noise-linux-x64.json`, and the
"Official-runner rerun study" in the
[#143 report](2026-09-25-beta9-143-regression-budgets.md)) show why that
cannot work:

- the first four runs agree within 6.4% on every processing median;
- two runs were 22% and 45% faster on every row at once;
- two times that spread would put every timing threshold near 185%.

The hosted runner's machine class changes from job to job, and an absolute
comparison across jobs carries it.

## Method

- `performance-evaluation.yml` checks out and builds core twice in one job:
  the candidate (default: the pin manifest's revision) and the paired baseline
  (default: the budgets' baseline commit). The six A/A runs below built it
  twice even though both sides were the same commit, so they also carry
  build-to-build variation. Since #307 the baseline side's build is cached by
  commit, and an A/A run builds once for both sides; see the spec.
- `scripts/paired-performance.mjs run` runs `scripts/assessment-all.mjs` in
  each checkout in counterbalanced order:
  `baseline candidate candidate baseline ...`, six rounds per side.
  - Each invocation takes two fresh-process samples per row, with core's
    warm-up pass.
  - That gives twelve samples per side per row, about 110 s of measurement.
- `reduce` checks that every invocation is a complete assessment of the
  expected commit and that the two sides share workload profiles and profile.
  It keeps every sample and the runner's CPU model (`lscpu`, in `runner.json`).
- `collect` combines runs with their provenance (run id, URL, benchmarks
  commit, artifact id and digest) into a committed study.

## A/A noise (baseline `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c` against itself)

`benchmarks/regression-evidence/paired-aa-linux-x64.json`:

| Run | CPU model | Artifact digest |
| --- | --- | --- |
| [36179717266](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36179717266) | AMD EPYC 7763 64-Core Processor | `sha256:b1b214b20504…` |
| [36179723965](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36179723965) | AMD EPYC 7763 64-Core Processor | `sha256:33fbaab7c926…` |
| [36179730617](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36179730617) | AMD EPYC 7763 64-Core Processor | `sha256:200b9bf80651…` |
| [36180524416](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36180524416) | INTEL(R) XEON(R) PLATINUM 8573C | `sha256:acf395c43ab2…` |
| [36180530313](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36180530313) | AMD EPYC 9V45 96-Core Processor | `sha256:b65c99c47242…` |
| [36180536053](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36180536053) | AMD EPYC 9V74 80-Core Processor | `sha256:e258041acb53…` |

The table shows the largest deviation `max(r, 1/r) − 1` over the six runs,
and the thresholds derived from it:

| Row | processing median dev | processing p95 dev | latency threshold (median / p95 tail) | init median dev | init p95 dev | initialization threshold (median / p95 tail) |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| browser-wasm/scale-logs-medium-fixed4096 | 1.3% | 16.4% | 10% / 35% | 4.1% | 72.2% | 25% / 145% |
| browser-wasm/scale-logs-small-whole | 14.7% | 45.1% | 30% / 95% | 11.2% | 89.0% | 25% / 180% |
| cli/scale-logs-medium-fixed4096 | 1.1% | 2.2% | 10% / 15% | 5.1% | 8.7% | 25% / 50% |
| cli/scale-logs-small-whole | 1.3% | 13.7% | 10% / 30% | 8.0% | 6.4% | 25% / 50% |
| node/scale-logs-medium-fixed4096 | 2.2% | 2.2% | 10% / 15% | 3.2% | 109.2% | 25% / 220% |
| node/scale-logs-small-whole | 1.2% | 19.1% | 10% / 40% | 3.9% | 7.1% | 25% / 50% |
| python/scale-logs-medium-fixed4096 | 0.9% | 28.3% | 10% / 60% | 2.1% | 11.2% | 25% / 50% |
| python/scale-logs-small-whole | 2.0% | 6.6% | 10% / 15% | 6.3% | 3.4% | 25% / 50% |
| rust-core/scale-logs-medium-fixed4096 | 2.6% | 8.6% | 10% / 20% | 30.7% | 57.6% | 65% / 120% |
| rust-core/scale-logs-small-whole | 0.7% | 32.7% | 10% / 70% | 94.3% | 208.2% | 190% / 420% |

The paired median holds across machine classes. The paired p95 of twelve
samples is the ratio of two maxima and moves up to 45%. So the median ratio
is judged, and the p95 ratio only routes tail-only changes to a rerun.

Rust initialization is about 0.01 ms. Its 2 ms floor, divided by the in-job
baseline, dominates its ratio thresholds, as the floor did in #143.

### Old and new thresholds

The judged latency threshold was #143's p95, corroborated by the median
(workstation rerun term). It is now the paired median ratio, with the paired
p95 ratio as the tail check:

| Latency rows | #143 p95 / median corroboration | #303 median ratio / p95 tail |
| --- | --- | --- |
| browser-wasm medium | 15% / 10% | 10% / 35% |
| browser-wasm small | 55% / 10% | 30% / 95% |
| cli medium | 15% / 10% | 10% / 15% |
| cli small | 30% / 10% | 10% / 30% |
| node medium | 15% / 10% | 10% / 15% |
| node small | 15% / 10% | 10% / 40% |
| python medium | 20% / 10% | 10% / 60% |
| python small | 15% / 10% | 10% / 15% |
| rust-core medium | 15% / 10% | 10% / 20% |
| rust-core small | 15% / 10% | 10% / 70% |

Initialization went from #143's `50–210% p95 / 35% median` to a median ratio
of 25% on eight rows, 65% and 190% on the two Rust rows. Memory (16),
size (28) and adapter-overhead (30) triggers are unchanged.

## Paired backtest (`npm run performance:budgets:backtest`)

`benchmarks/regression-evidence/paired-backtest-linux-x64.json`. Each
historical pair was measured paired in one job and judged with today's
thresholds, the older commit as the in-job baseline.

| Pair | Run, CPU | Processing median ratios | Paired verdict | #143 absolute backtest said |
| --- | --- | --- | --- | --- |
| fdca511 → 2b98027 (beta.7) | [36179737305](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36179737305), EPYC 9V74 | −16% to +3% | none | all 10 latency rows, +28% to +64% |
| 2b98027 → f2082ab | [36180541632](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36180541632), Xeon 6973P-C | +8% to +16% | 5 regressions: every medium-fixed4096 row, +11% to +16%; browser small-whole initialization tail-only (rerun) | 8 latency rows, +22% to +32% |
| f2082ab → 3144bb3 (beta.8) | [36180547649](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36180547649), EPYC 7763 | +3% to +9% | none | rust-core small-whole tail-only |
| 9443419 → 079095e | [36180553407](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36180553407), EPYC 7763 | +17% to +38% | 11 regressions: Node initialization +118% and +122%, and 9 of 10 latency rows +24% to +38% | Node initialization only |

The small-whole rows of 2b98027 → f2082ab rose 8% to 10%. That is at or just
under the 10% threshold after the 1 ms floor on that faster machine. Memory is
still replayed over the eight committed absolute runs: no memory trigger fires
on any step.

## Verification

- All six A/A runs, evaluated with `--paired`, are within budget on every
  latency and initialization trigger.
- `evaluate` with `--summary` alone judges memory and reports timing only
  under "Absolute timing across jobs (informational, not judged)".
- A paired run whose in-job baseline is not the budgets' baseline commit is
  `invalid-measurement`.
- `npm run performance:budgets:check` refuses `reviewed` with fewer than three
  A/A runs of the baseline commit.

## Reproduce

```sh
# A/A (repeat at least three times), and a historical pair
gh workflow run performance-evaluation.yml -f baseline_revision=<sha> -f candidate_revision=<sha>
gh workflow run performance-evaluation.yml -f baseline_revision=<older> -f candidate_revision=<newer>
# download each run's performance-evaluation-* artifact, list them in a manifest, then
node --import tsx scripts/paired-performance.mjs collect --runs aa-manifest.json --out benchmarks/regression-evidence/paired-aa-linux-x64.json
node --import tsx scripts/paired-performance.mjs collect --runs bt-manifest.json --out benchmarks/regression-evidence/paired-backtest-linux-x64.json
npm run performance:budgets:derive && npm run performance:budgets:check && npm run performance:budgets:backtest
```

## Limitations

- Six A/A runs on four CPU models bound the per-row noise from a small sample.
  A machine class not seen here could be noisier within one job.
- Each historical pair was measured once. Older candidates fail the pinned
  acceptance-criteria step (accuracy corpus identity) after the paired
  measurement, which does not affect timing.
- As measured here, the workflow built core twice and ran about twice as long.
  #307 caches the baseline side's build by commit, so a run builds core once
  after the cache's first fill.
