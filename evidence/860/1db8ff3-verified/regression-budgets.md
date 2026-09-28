# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `1db8ff38b16e50c51229eb27025452952bf621e1`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 2 | 0 | 26 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 122544 | +22.5% | 5002.900 bytes | beta11-wasm-common-gzip-provider-detectors |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 179388 | +30.3% | 6881.950 bytes | beta11-wasm-full-gzip-provider-detectors |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 20.000 | +14.9% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 17.000 | +29.8% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 3.026 | +6.9% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.678 | +2.4% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 7.399 | +15.7% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.454 | +5.9% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.182 | +15.1% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.110 | +14.5% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.048 | +72.7% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.046 | +62.9% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 80.500 | -30.3% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 35.600 | +0.8% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 68.526 | -19.9% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 20.680 | -11.6% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 70.479 | -22.1% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 9.105 | -42.5% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 63.522 | -21.9% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 9.025 | -43.2% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 63.077 | -20.5% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 8.921 | -51.5% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

