# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`.
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
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 194626 | +34.7% | 7225.050 bytes | beta11-8b6a5fd-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 127655 | +27.6% | 5002.900 bytes | beta11-8b6a5fd-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 187246 | +36.0% | 6881.950 bytes | beta11-8b6a5fd-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 15.900 | -8.6% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 15.500 | +18.3% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.253 | -20.4% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.057 | -21.4% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.462 | +1.0% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.158 | -15.3% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.926 | -9.8% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.886 | -8.6% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.049 | +76.4% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.048 | +70.9% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 23.100 | -80.0% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 25.500 | -27.8% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 18.323 | -78.6% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 6.354 | -72.8% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 21.043 | -76.7% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.004 | -81.0% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 15.203 | -81.3% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 3.034 | -80.9% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 15.062 | -81.0% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 2.965 | -83.9% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 248463 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 310056 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 507797 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

