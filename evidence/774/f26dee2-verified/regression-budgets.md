# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `f26dee26a9c2aa3cfff3543d784c02de5054de09`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 7 | 0 | 3 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 0 | 0 | 28 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-ratio` | accepted-tradeoff | 1 | 1.1095238095238096 | +11.0% | 0.100 ratio | beta10-browser-wasm-scale-logs-medium-credential-detector-pack |
| `latency/cli/scale-logs-medium-fixed4096/processing-ratio` | accepted-tradeoff | 1 | 1.1087252909610885 | +10.9% | 0.100 ratio | beta10-cli-scale-logs-medium-credential-detector-pack |
| `latency/python/scale-logs-medium-fixed4096/processing-ratio` | accepted-tradeoff | 1 | 1.1103966433333379 | +11.0% | 0.100 ratio | beta10-python-scale-logs-medium-credential-detector-pack |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 16.300 | -6.3% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 17.900 | +36.6% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.533 | -10.6% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.154 | -17.7% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 5.964 | -6.8% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.682 | -6.7% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.915 | -10.9% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.891 | -8.2% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.032 | +14.7% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.033 | +15.5% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 118.400 | +2.5% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 31.300 | -11.3% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 92.996 | +8.7% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 25.502 | +9.0% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 98.018 | +8.3% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 19.052 | +20.2% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 87.860 | +8.0% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 17.112 | +7.7% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 87.761 | +10.7% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 17.725 | -3.6% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

