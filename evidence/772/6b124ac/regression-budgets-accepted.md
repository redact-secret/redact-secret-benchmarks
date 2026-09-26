# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `6b124ac50803fe35aad99abbb2dbe89c32f5f284`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 27 | 0 | 1 | 0 | 0 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/cli/aarch64-unknown-linux-gnu` | accepted-tradeoff | 863848 | 930576 | +7.7% | 43192.400 bytes | beta9-cli-aarch64-linux-gnu-detector-pack |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 16.100 | -7.5% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 11.000 | -16.0% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 1.954 | -31.0% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.078 | -20.6% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 5.755 | -10.0% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.240 | +2.4% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.793 | -22.8% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.783 | -19.3% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.024 | -12.4% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.024 | -14.8% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 113.500 | -1.7% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 36.500 | +3.4% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 76.898 | -10.1% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 21.299 | -9.0% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 85.197 | -5.8% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 14.245 | -10.1% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 74.007 | -9.0% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 13.980 | -12.0% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 72.845 | -8.1% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 16.536 | -10.0% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

