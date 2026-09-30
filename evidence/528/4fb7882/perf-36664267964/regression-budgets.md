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
| `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` | regression | 1 | 1.2677165354323672 | +26.8% | 0.250 ratio | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/browser-bundle/quickstart/gzip` (default) | regression | 144501 | 212609 | +47.1% | 7225.050 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/common/gzip` (optional) | regression | 100058 | 136250 | +36.2% | 5002.900 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/full/gzip` (default) | regression | 137639 | 205227 | +49.1% | 6881.950 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 18.100 | +4.0% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 17.600 | +34.4% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.187 | -22.8% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.194 | -16.1% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.194 | -3.2% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.840 | -4.1% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.066 | +3.9% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.033 | +6.5% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.066 | +137.0% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.064 | +125.0% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 34.000 | -70.6% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 25.400 | -28.0% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 22.831 | -73.3% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 7.783 | -66.7% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 25.589 | -71.7% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.748 | -76.4% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 20.474 | -74.8% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 3.781 | -76.2% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 20.336 | -74.4% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 3.652 | -80.1% |

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

