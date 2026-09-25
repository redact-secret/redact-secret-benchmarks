# Regression budgets: REGRESSION

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `d4bab4ede21cae2b25f03a40f466b52dceadfda2`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 20 | 8 | 0 | 0 | 0 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/browser-bundle/quickstart/gzip` (default) | regression | 144501 | 155763 | +7.8% | 7225.050 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/cli/aarch64-pc-windows-msvc` | regression | 496640 | 522240 | +5.2% | 24832.000 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/cli/aarch64-unknown-linux-gnu` | regression | 863848 | 934232 | +8.1% | 43192.400 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/cli/x86_64-pc-windows-msvc` | regression | 547328 | 578560 | +5.7% | 27366.400 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/node-addon/aarch64-unknown-linux-gnu` | regression | 1149600 | 1220048 | +6.1% | 57480.000 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/npm/wasm/packed` | regression | 254413 | 277389 | +9.0% | 12720.650 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/common/gzip` (optional) | regression | 100058 | 111677 | +11.6% | 5002.900 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `size/wasm/full/gzip` (default) | regression | 137639 | 148928 | +8.2% | 6881.950 bytes | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 15.300 | -12.1% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 14.300 | +9.2% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.959 | +4.5% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.805 | +7.2% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.003 | -6.1% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.763 | -5.4% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.918 | -10.6% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.879 | -9.4% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.030 | +5.7% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.031 | +9.9% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 118.500 | +2.6% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 33.400 | -5.4% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 87.271 | +2.0% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 32.287 | +38.0% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 85.966 | -5.0% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 15.551 | -1.9% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 81.771 | +0.5% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 15.890 | -0.0% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 79.201 | -0.1% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 16.117 | -12.3% |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

