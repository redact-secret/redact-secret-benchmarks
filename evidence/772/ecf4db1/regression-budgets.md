# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `ecf4db12f4daede7538b128f3504b8c9301eb7a6`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 28 | 0 | 0 | 0 | 0 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 12.900 | -25.9% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 10.500 | -19.8% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.158 | -23.8% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 1.824 | -30.3% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 4.995 | -21.9% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 4.770 | -21.7% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.805 | -21.6% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.769 | -20.7% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.025 | -10.2% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.025 | -11.5% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 78.900 | -31.7% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 19.400 | -45.0% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 65.396 | -23.6% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 18.715 | -20.0% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 66.158 | -26.9% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 12.185 | -23.1% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 60.688 | -25.4% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 13.708 | -13.7% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 63.530 | -19.9% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 12.890 | -29.9% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

