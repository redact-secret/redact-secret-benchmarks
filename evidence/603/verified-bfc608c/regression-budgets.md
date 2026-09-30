# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8-adapters-v2`; candidate `bfc608cce75f79f6a5cab037d7e558ba629777f6`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 3 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 100 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 212515 | +47.1% | 7225.050 bytes | beta12-bfc608c-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 142525 | +42.4% | 5002.900 bytes | beta12-bfc608c-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 205068 | +49.0% | 6881.950 bytes | beta12-bfc608c-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 17.800 | +2.3% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 14.900 | +13.7% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.474 | -12.6% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.322 | -11.2% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.243 | -2.4% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.944 | -2.4% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.177 | +14.7% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.118 | +15.2% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.065 | +133.3% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.067 | +135.4% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 17.500 | -84.8% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 9.400 | -73.4% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 12.247 | -85.7% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 5.321 | -77.3% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 16.047 | -82.3% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 1.593 | -89.9% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 9.945 | -87.8% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 1.602 | -89.9% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 9.452 | -88.1% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 1.563 | -91.5% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 265924 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 328857 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 544531 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

