# Regression budgets: REGRESSION

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8-adapters-v2`; candidate `66b492bdff5e6751fc6b5409266916346ed7c723`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 3 | 0 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 100 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/browser-bundle/quickstart/gzip` (default) | regression | 144501 | 214214 | +48.2% | 7225.050 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/common/gzip` (optional) | regression | 100058 | 142866 | +42.8% | 5002.900 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/full/gzip` (default) | regression | 137639 | 206697 | +50.2% | 6881.950 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 17.600 | +1.1% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 16.000 | +22.1% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.333 | -17.6% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.341 | -10.5% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.124 | -4.3% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.202 | +1.8% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.039 | +1.3% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.040 | +7.2% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.069 | +148.7% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.065 | +131.0% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 19.400 | -83.2% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 9.700 | -72.5% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 13.125 | -84.7% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 5.238 | -77.6% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 10.877 | -88.0% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 1.667 | -89.5% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 10.608 | -87.0% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 1.625 | -89.8% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 10.404 | -86.9% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 1.653 | -91.0% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 265752 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 329901 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 547274 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

