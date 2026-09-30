# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `da69ebf5090e0fb9519eb07829ff46001ede0de2`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 3 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 211335 | +46.3% | 7225.050 bytes | beta12-da69ebf-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 137879 | +37.8% | 5002.900 bytes | beta12-da69ebf-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 203957 | +48.2% | 6881.950 bytes | beta12-da69ebf-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 13.400 | -23.0% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 14.800 | +13.0% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 1.984 | -30.0% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 1.789 | -31.6% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 4.807 | -24.8% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 4.404 | -27.7% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.990 | -3.5% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.734 | -24.4% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.034 | +22.5% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.035 | +23.5% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 21.500 | -81.4% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 11.500 | -67.4% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 14.210 | -83.4% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 4.953 | -78.8% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 17.548 | -80.6% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 2.263 | -85.7% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 12.821 | -84.2% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 2.229 | -86.0% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 11.831 | -85.1% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 2.210 | -88.0% |

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

