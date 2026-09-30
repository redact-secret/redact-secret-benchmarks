# Regression budgets: REGRESSION

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `da69ebf5090e0fb9519eb07829ff46001ede0de2`.
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
| `size/browser-bundle/quickstart/gzip` (default) | regression | 144501 | 211335 | +46.3% | 7225.050 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/common/gzip` (optional) | regression | 100058 | 137879 | +37.8% | 5002.900 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/full/gzip` (default) | regression | 137639 | 203957 | +48.2% | 6881.950 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 16.400 | -5.7% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 15.400 | +17.6% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.353 | -16.9% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.354 | -10.0% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.218 | -2.8% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.235 | +2.3% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.072 | +4.5% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.052 | +8.5% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.049 | +74.2% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.045 | +60.1% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 43.000 | -62.8% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 23.400 | -33.7% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 24.280 | -71.6% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 8.204 | -64.9% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 26.812 | -70.4% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.762 | -76.3% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 21.481 | -73.6% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 3.767 | -76.3% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 21.127 | -73.4% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 3.711 | -79.8% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 259512 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 326601 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 541050 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

