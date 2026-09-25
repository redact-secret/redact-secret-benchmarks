# Beta.8 operational baseline and derived regression budgets (#143)

**Result.** The `0.1.0-beta.8` baseline freezes 94 budgeted metrics:

| Dimension | Metrics | What they are |
| --- | ---: | --- |
| latency | 10 | Linux p95, corroborated by the median |
| initialization | 10 | Linux p95, corroborated by the median |
| memory | 16 | Linux largest observed sample |
| size | 28 | artifact bytes |
| adapter overhead | 30 | Apple M4 host |

Budgets derived from recorded variance accept a fresh adapter run. They flag
an injected +3.3 µs/event traversal slowdown. In a replay over eight committed
Linux runs, they flag both detector-expansion slowdowns on every surface, and
route the one tail-only jump to "rerun" rather than "regression".

Spec: [`docs/specs/regression-budgets.md`](../specs/regression-budgets.md).
Decision: [`2026-09-25-introduce-reviewed-performance-regression-budgets.md`](../decisions/2026-09-25-introduce-reviewed-performance-regression-budgets.md).
Budgets: `benchmarks/regression-budgets.json` (`reviewStatus: proposed` as
measured here; `reviewed` since #303, which moved timing to same-job paired
ratios: [`2026-09-25-beta9-303-paired-timing-budgets.md`](2026-09-25-beta9-303-paired-timing-budgets.md)).
The figures below are the #143 measurement as recorded.
Baseline: `benchmarks/regression-baselines/0.1.0-beta.8.json`.

## Source revisions and artifacts

| What | Identity |
| --- | --- |
| Product source | `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`. The `v0.1.0-beta.8` tag (`5639a0ea02e0eefbd1533bea23a05c749b529bef`) differs only in `packages/javascript/package.json` and `packages/javascript/src/version.ts` |
| Linux timing and memory | `evidence/603/summary.json`, performance run [36078460497](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36078460497), release builds, 5 fresh-process samples per row, GitHub-hosted `linux-6.17.0-1022-azure` x86_64, workload profiles hash `b4db2cd2…` |
| Sizes | `benchmarks/operational-evidence.json` (#141): artifact-qualification run 36077007675 and candidate tarballs at the same source |
| Adapter code | `redact-secret/redact-secret-adapters` develop `27fc04f690d50d90977c594a95e13774126d7eae`. The package sources the harness measured are byte-identical to it |
| Adapter harness | redact-secret-adapters#11 commit `099c07a0c306cfb35949a76348136869ddd6b411` (merged via PR #22; tree-identical to the measured local work commit `dca9cc3`) |
| Core under the adapters and in the rerun study | published `@redact-secret/core@0.1.0-beta.8` and `redact-secret==0.1.0b8` (release artifacts) |
| Hosts in the adapter run | pino 10.3.1, `@opentelemetry/sdk-trace-base` 2.11.0, opentelemetry-sdk 1.45.0 |
| Peer scanners | none. This is performance evidence, and no gitleaks/trufflehog result is used |

## Measuring host (adapter overhead and rerun noise)

| Property | Value |
| --- | --- |
| Machine | Apple M4, 10 logical CPUs, 24 GiB, macOS (Darwin 25.5.0), on AC power |
| Runtimes | Node 22.16.0, CPython 3.14.7 |
| Load | 1-minute load average 2.4–5.0 during the runs; the workstation was shared with other work |
| Adapter method | 15 repetitions × 400 events per mode, 200 warm-up events per mode, modes interleaved and rotated per repetition, 5 processes per language run alternately |
| Rerun method | core's per-sample protocol (fresh process, one untimed warm-up pass, one timed pass), 5 samples per run, 10 runs per surface and profile, nearest-rank p95 as core computes it |

## Baseline: latency and memory (Linux, ms)

| Surface / profile | processing p95 | processing median | p95 budget | median corroboration |
| --- | ---: | ---: | ---: | ---: |
| browser-wasm / small-whole | 35.30 | 23.20 | +55% | +10% |
| browser-wasm / medium-fixed4096 | 115.50 | 106.00 | +15% | +10% |
| cli / small-whole | 23.40 | 23.11 | +30% | +10% |
| cli / medium-fixed4096 | 85.56 | 83.74 | +15% | +10% |
| node / small-whole | 15.85 | 15.74 | +15% | +10% |
| node / medium-fixed4096 | 90.49 | 88.98 | +15% | +10% |
| python / small-whole | 15.89 | 15.62 | +15% | +10% |
| python / medium-fixed4096 | 81.35 | 80.06 | +20% | +10% |
| rust-core / small-whole | 18.38 | 16.05 | +15% | +10% |
| rust-core / medium-fixed4096 | 79.30 | 78.76 | +15% | +10% |

The p95 budget rows above 15% are the rows whose own committed runs showed
that much p95/median dispersion. Initialization budgets are +50% (+175% to
+210% where a row's dispersion was larger), with a 2 ms floor and a +35% median
corroboration. Memory budgets are +10% to +20% of the largest observed sample,
with a 1 MiB floor. Every value is in `benchmarks/regression-budgets.json`.

## Baseline: adapter overhead (Apple M4, µs per event, median of 5 processes)

| Host / workload | host alone | traversal | core scan | host + adapter + core | scanner calls | traversal budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| pino / log-flat | 1.33 | 1.49 | 77.85 | 79.54 | 9 | +0.50 µs |
| pino + streamWrite / log-flat | 1.34 | 3.70 | 154.91 | 158.56 | 18 | +15% |
| pino / log-nested | 1.66 | 3.14 | 226.72 | 231.62 | 27 | +0.50 µs |
| pino + streamWrite / log-nested | 1.73 | 8.52 | 457.01 | 467.50 | 54 | +15% |
| otel-js / span-attributes | 1.99 | 1.12 | 474.01 | 477.80 | 43 | +575% (+6.45 µs) |
| mask-js / mask-payload | 0.01 | 4.29 | 375.17 | 381.07 | 22 | +15% |
| python logging / log-flat | 4.39 | 4.03 | 118.14 | 117.55 | 9 | +15% |
| python logging / log-nested | 7.22 | 11.72 | 350.40 | 346.87 | 27 | +15% |
| otel-python / span-attributes | 18.18 | 18.64 | 685.28 | 709.88 | 43 | +15% |
| mask-python / mask-payload | 0.04 | 13.15 | 508.16 | 523.79 | 22 | +15% |

"host + adapter + core" minus "host alone" is the adapter's total cost, and
the core's scan is about 96–100% of it. That is why the budget is on
traversal and on the deterministic scanner-call and scanned-code-unit counts,
which trigger on any increase. The core's scan time stays in the latency
dimension. otel-js traversal (about 1 µs, between-process range −0.15 to
3.07 µs) is at the noise floor, so its budget is effectively absolute.

## Baseline: sizes (bytes, 5% budget)

| Artifact | Bytes | Role | Floor |
| --- | ---: | --- | ---: |
| wasm `full`, gzip -9 | 137,639 | default | 4 KiB |
| wasm `common`, gzip -9 | 100,058 | optional | 4 KiB |
| quickstart browser bundle, gzip -9 | 144,501 | default | 4 KiB |
| npm `core` / `wasm` / `node-darwin-arm64`, packed | 39,461 / 254,413 / 424,514 | — | 4 KiB |
| native addons (8 targets) | 709,120 – 1,149,600 | — | 16 KiB |
| Python wheels (8 targets) | 340,669 – 695,123 | — | 16 KiB |
| CLI binaries (6 targets) | 496,640 – 868,280 | — | 16 KiB |

Size history from the npm registry (unpacked bytes) anchors the 5% policy:

| Package | beta.5 → beta.6 | beta.6 → beta.7 | beta.7 → beta.8 |
| --- | ---: | ---: | ---: |
| `@redact-secret/wasm` | +7.5% | +5.2% | +10.3% |
| `@redact-secret/node-darwin-arm64` | +4.3% | +4.0% | +5.9% |
| `@redact-secret/node-linux-x64-gnu` | +4.6% | +4.0% | +7.3% |

## Noise

| Source | What it measured | Largest value |
| --- | --- | --- |
| 8 committed Linux runs | within-run processing p95/median dispersion | 52% (browser small-whole). Half the rows stay under 10% |
| same-artifact reruns | processing median spread across 10 runs | 3.8% (python medium) |
| same-artifact reruns | processing p95 spread across 10 runs | 21.9% (python medium, one 52.9 ms sample among ~43 ms) |
| same-artifact reruns | initialization median spread | 16.3% |
| same-artifact reruns | memory spread | 2.0% |
| adapter harness, 5 processes | traversal spread, median-based | 6.8%, apart from otel-js at the noise floor |
| adapter harness, within one process | adapter-core coefficient of variation across repetitions | up to 46% on a single repetition. The medians stay stable, which is why every adapter figure is median-based |

## Backtest over the committed Linux history (as run for #143)

Superseded for timing by the paired backtest in the #303 report. Measured in
one job each, fdca511 → 2b98027 is flat, so the beta.7 row below was a
runner machine-class shift. 2b98027 → f2082ab is a real +8% to +16%, and
9443419 → 079095e also slowed processing on every row. The table stays as the
#143 absolute backtest reported it.

Each pair is judged with today's thresholds and the earlier run as the
baseline. Improvements are within budget by definition.

| From → to (product) | Regression | Invalid (tail-only) |
| --- | --- | --- |
| 9443419 → 079095e | Node init, both profiles (+106%, +112%) | — |
| 079095e → 41fc366 | — | — |
| 41fc366 → 15fce66 | browser init, medium (+60%) | — |
| 15fce66 → fdca511 | — | — |
| fdca511 → 2b98027 (beta.7 detector expansion) | all 10 latency rows, +28% to +64% | — |
| 2b98027 → f2082ab (next expansion) | 8 latency rows, +22% to +32% | — |
| f2082ab → 3144bb3 (beta.8) | — | rust-core small-whole p95 +20%, median +6.7% |

## Official-runner rerun study (follow-up)

`performance-evaluation.yml` ran six times at the baseline pin
`3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`: the baseline run
[36078460497](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36078460497)
and five develop dispatches,
[36177107404](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36177107404),
[36177116881](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36177116881),
[36177124781](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36177124781),
[36177797166](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36177797166) and
[36177805247](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36177805247).
All six used runner image ubuntu-24.04 20260920.314.1, the same kernel and the
same runtimes. The reduction is
`benchmarks/regression-evidence/rerun-noise-linux-x64.json`, with run ids, URLs,
artifact digests and summary sha256s, produced by
`node --import tsx scripts/regression-budgets.mjs runner-reruns`.

| Runs | Processing median spread | Initialization median spread | Memory spread |
| --- | ---: | ---: | ---: |
| the first four (baseline + three develop) | ≤ 6.4% | ≤ 26.0% | ≤ 2.2% |
| all six | ≤ 91.6% | ≤ 88.7% | ≤ 5.2% |

The last two runs were about 22% and 45% faster than the other four on every
surface and profile at once, while the first four agree within 6.4%. A
uniform shift of that size is a faster runner machine, not rerun noise. Region
does not predict it: eastus hosted one slow and one fast run. The job log does
not name the CPU, so the evidence cannot tell which machine class a run had.
All six runs judge `accepted` against the current budgets, because a faster
machine only lowers timings.

Applying the decision's rule as written (re-derive with this spread) would
give 2 × 91.6%, a threshold near 185% on every latency and initialization
trigger. The backtest would then flag nothing, including both
detector-expansion slowdowns. The same pattern means a baseline and a
candidate measured on different machine classes can differ by 22–82% with no
product change. The backtest's uniform +22% to +64% steps may include such a
shift.

**Review decision at this point: the budgets stay `proposed`.** (Superseded
by #303: timing is now judged on same-job paired ratios, and the budgets are
`reviewed`.) The review condition in the
decision (at least three dispatches at one pin) was met, and three runs alone
would have looked like confirmation: the first three develop dispatches all
landed on the slower class. The six runs show the rerun term on the official
runner is not a noise bound that thresholds can absorb. Promotion needs a
policy change first: bind timing budgets to an identified runner machine class
(record the CPU model in each run, as adapter budgets bind to their host), or
measure baseline and candidate paired in one job. The derivation keeps the
workstation rerun term. The Linux study is recorded as evidence, not used as a
derivation source.

## Validation

- **Out-of-sample run.** A fresh adapter-harness run in each language, taken
  after the baseline, is within budget on all 30 adapter triggers. The largest
  traversal change was +0.29 µs against an allowance of +6.45 µs (otel-js).
  Among the rest it was +0.17 µs against +1.97 µs.
- **Injected regression.** A per-leaf string reversal added to the built
  walker, then removed, raised pino/log-flat traversal from 1.49 to 4.79 µs.
  The verdict was `regression`, exit 1.
- **Measurement failure is kept distinct.** A `--quick` harness output is
  `invalid-measurement` on every adapter trigger, and the CLI exits 2.
- **Self-consistency.** The baseline's own sources evaluate as `accepted`,
  exit 0.

## Reproduce

```sh
# noise (needs a redact-secret checkout and a Python with redact-secret==0.1.0b8)
npm run performance:noise -- --core-repo ../redact-secret --python <python> --runs 10 --samples 5 --out rerun.json
# adapter harness (in redact-secret-adapters, core 0.1.0-beta.8 installed; five times each)
npm run build && node scripts/measure-overhead.mjs --out js-N.json
python scripts/measure-overhead.py --out py-N.json
# here
node --import tsx scripts/regression-budgets.mjs ci-dispersion --commits 50d47f5,c0c156f,41afd0b,f32473f,67cf1b0,89b5761,047638a,a20a345 --out benchmarks/regression-evidence/ci-dispersion.json
npm run performance:budgets:derive && npm run performance:budgets:check && npm run performance:budgets:backtest
```

## Limitations

- **The official runner's machine class varies, and these timing budgets do
  not account for it.** Resolved by #303 (same-job paired ratios). Six runs at one pin spread up to 91.6% on the processing
  median (see "Official-runner rerun study"). The derivation keeps the
  workstation rerun term. A candidate on a slower machine than the baseline
  can surface as a corroborated regression, so a latency or initialization
  breach on the hosted runner should be rerun before anyone acts on it. The
  budgets stay `proposed` until timing is bound to a machine class or
  measured paired.
- The rerun study covers the Node and Python surfaces only. Rust, CLI and
  browser rows use the same rerun term plus their own CI dispersion.
- The adapter budgets bind to the measuring host. Any other host is
  `invalid-measurement` until an official adapter profile exists.
