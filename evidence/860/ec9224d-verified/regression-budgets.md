# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `ec9224d9743066fe73d6e61e9843ef52bd853833`.
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
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 194628 | +34.7% | 7225.050 bytes | beta11-ec9224d-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 127661 | +27.6% | 5002.900 bytes | beta11-ec9224d-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 187248 | +36.0% | 6881.950 bytes | beta11-ec9224d-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 17.900 | +2.9% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 15.600 | +19.1% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.912 | +2.8% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.409 | -7.9% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.559 | +2.6% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.280 | +3.1% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.157 | +12.7% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.118 | +15.2% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.084 | +199.2% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.057 | +101.9% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 30.500 | -73.6% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 24.300 | -31.2% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 22.081 | -74.2% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 7.631 | -67.4% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 25.531 | -71.8% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.707 | -76.6% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 19.667 | -75.8% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 3.855 | -75.7% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 19.044 | -76.0% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 3.717 | -79.8% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 256694 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 318323 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 516065 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

