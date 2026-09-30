# Regression budgets: REGRESSION

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `4fb78827f1ddf5b3106f25130ca510a836ada186`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 9 | 1 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 3 | 0 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` | regression | 1 | 1.4715447154455386 | +47.2% | 0.250 ratio | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/browser-bundle/quickstart/gzip` (default) | regression | 144501 | 212609 | +47.1% | 7225.050 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/common/gzip` (optional) | regression | 100058 | 136250 | +36.2% | 5002.900 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/full/gzip` (default) | regression | 137639 | 205227 | +49.1% | 6881.950 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 18.200 | +4.6% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 17.700 | +35.1% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.404 | -15.1% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.312 | -11.6% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.224 | -2.7% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.113 | +0.3% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.105 | +7.7% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.074 | +10.7% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.064 | +128.6% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.063 | +122.2% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 36.000 | -68.8% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 23.500 | -33.4% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 23.124 | -73.0% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 7.837 | -66.5% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 25.712 | -71.6% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.795 | -76.1% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 20.639 | -74.6% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 3.690 | -76.8% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 20.235 | -74.5% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 3.617 | -80.3% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 257240 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 326932 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 542656 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

