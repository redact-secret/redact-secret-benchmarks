# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8-adapters-v2`; candidate `0c62fd38bca75c5b28b042dc79789b708ebf1d17`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 9 | 0 | 1 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 3 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 100 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` | accepted-tradeoff | 1 | 1.2857142857175854 | +28.6% | 0.250 ratio | beta14-0c62fd3-browser-wasm-scale-logs-small-whole-init-ratio |
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 244931 | +69.5% | 7225.050 bytes | beta14-0c62fd3-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 168891 | +68.8% | 5002.900 bytes | beta14-0c62fd3-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 235713 | +71.3% | 6881.950 bytes | beta14-0c62fd3-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 19.000 | +9.2% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 25.700 | +96.2% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.513 | -11.3% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.477 | -5.3% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.328 | -1.1% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 5.685 | -6.7% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.131 | +10.3% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.123 | +15.8% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.073 | +159.7% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.097 | +241.6% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 23.100 | -80.0% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 12.200 | -65.4% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 15.803 | -81.5% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 6.005 | -74.3% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 13.852 | -84.7% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 2.287 | -85.6% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 13.799 | -83.0% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 2.045 | -87.1% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 13.304 | -83.2% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 2.042 | -88.9% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 292165 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 359236 bytes | baseline-pending: baseline 0.1.0-beta.8-adapters-v2 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 607712 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

