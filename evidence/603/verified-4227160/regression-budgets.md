# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8-adapters-v2`; candidate `4227160c4dac402d7add53d3f8fe990f693912c1`.
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
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 212502 | +47.1% | 7225.050 bytes | beta12-4227160-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 142515 | +42.4% | 5002.900 bytes | beta12-4227160-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 205059 | +49.0% | 6881.950 bytes | beta12-4227160-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 17.900 | +2.9% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 17.100 | +30.5% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.419 | -14.6% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.699 | +3.1% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.503 | +1.7% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.208 | +1.9% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.171 | +14.1% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.127 | +16.2% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.073 | +161.9% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.074 | +161.6% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 18.800 | -83.7% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 8.500 | -75.9% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 11.586 | -86.5% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 5.071 | -78.3% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 14.028 | -84.5% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 1.506 | -90.5% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 9.337 | -88.5% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 1.634 | -89.7% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 9.267 | -88.3% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 1.466 | -92.0% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 265950 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 328866 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 544527 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

