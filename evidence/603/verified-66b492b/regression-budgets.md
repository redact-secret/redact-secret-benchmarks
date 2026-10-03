# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8-adapters-v2`; candidate `66b492bdff5e6751fc6b5409266916346ed7c723`.
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
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 214214 | +48.2% | 7225.050 bytes | beta13-66b492b-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 142866 | +42.8% | 5002.900 bytes | beta13-66b492b-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 206697 | +50.2% | 6881.950 bytes | beta13-66b492b-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 16.000 | -8.0% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 14.500 | +10.7% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.000 | -29.4% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 1.928 | -26.3% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 4.774 | -25.4% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 4.983 | -18.2% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.908 | -11.6% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.896 | -7.7% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.056 | +99.2% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.058 | +104.9% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 15.500 | -86.6% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 6.500 | -81.6% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 9.973 | -88.3% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 4.123 | -82.4% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 8.286 | -90.8% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 1.274 | -92.0% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 8.091 | -90.1% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 1.256 | -92.1% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 7.736 | -90.2% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 1.241 | -93.2% |

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

