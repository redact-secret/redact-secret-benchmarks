# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 10 | 0 | 0 | 0 | 0 |
| initialization | 10 | 0 | 0 | 0 | 0 |
| memory | 16 | 0 | 0 | 0 | 0 |
| size | 0 | 0 | 3 | 0 | 25 |
| adapter-overhead | 0 | 0 | 0 | 0 | 30 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 191801 | +32.7% | 7225.050 bytes | beta11-8f97f14-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 125295 | +25.2% | 5002.900 bytes | beta11-8f97f14-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 184422 | +34.0% | 6881.950 bytes | beta11-8f97f14-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 17.600 | +1.1% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 15.900 | +21.4% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.438 | -13.9% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.489 | -4.9% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 6.499 | +1.6% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 6.441 | +5.7% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 1.157 | +12.7% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 1.169 | +20.5% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.062 | +120.6% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.060 | +112.8% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 28.600 | -75.2% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 21.500 | -39.1% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 21.977 | -74.3% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 7.775 | -66.8% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 24.831 | -72.6% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.746 | -76.4% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 20.522 | -74.8% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 4.059 | -74.5% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 19.521 | -75.4% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 3.802 | -79.3% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 243752 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 305065 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 499981 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

