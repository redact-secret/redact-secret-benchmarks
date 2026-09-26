# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `192c9649deb88e342abc8071fb78e7b1d84ec475`.
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
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 15.300 | -12.1% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 14.400 | +9.9% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.243 | -20.8% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.235 | -14.6% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.008 | -6.1% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.602 | -8.0% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.892 | -13.1% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.908 | -6.5% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.032 | +16.1% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.029 | +2.1% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 109.400 | -5.3% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 29.900 | -15.3% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 88.440 | +3.4% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 23.990 | +2.5% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 89.919 | -0.6% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 16.607 | +4.8% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 82.753 | +1.7% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 16.565 | +4.2% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 81.827 | +3.2% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 16.602 | -9.7% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

