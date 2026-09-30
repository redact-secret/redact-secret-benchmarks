# Regression budgets: REGRESSION

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `99c8c2b33e99142620bcc66f115200ca615d6d0a`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 3 | 0 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/browser-bundle/quickstart/gzip` (default) | regression | 144501 | 211130 | +46.1% | 7225.050 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/common/gzip` (optional) | regression | 100058 | 137650 | +37.6% | 5002.900 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/full/gzip` (default) | regression | 137639 | 203748 | +48.0% | 6881.950 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 14.600 | -16.1% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 13.000 | -0.8% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 1.726 | -39.0% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 1.727 | -34.0% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 5.616 | -12.2% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.093 | -16.4% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.884 | -13.9% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.856 | -11.8% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.038 | +36.4% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.040 | +43.0% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 33.400 | -71.1% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 18.700 | -47.0% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 19.333 | -77.4% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 6.442 | -72.5% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 23.351 | -74.2% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.123 | -80.3% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 17.555 | -78.4% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 3.026 | -81.0% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 17.332 | -78.1% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 3.126 | -83.0% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 259264 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 326377 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 540622 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

