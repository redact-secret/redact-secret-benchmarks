# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `0af4cb83b571baa86d27a678a351ece2ebc1f3cb`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 0 | 0 | 28 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 16.100 | -7.5% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 13.900 | +6.1% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.598 | -8.3% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.370 | -9.4% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.276 | -1.9% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.963 | -2.1% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.015 | -1.1% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.991 | +2.2% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.031 | +11.3% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.033 | +14.9% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 106.500 | -7.8% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 32.600 | -7.6% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 90.187 | +5.4% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 23.881 | +2.1% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 92.302 | +2.0% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 17.274 | +9.0% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 82.910 | +1.9% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 16.641 | +4.7% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 83.219 | +4.9% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 16.995 | -7.5% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

