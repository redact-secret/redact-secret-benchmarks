# Regression budgets: ACCEPTED

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `94fc18a974f659ea882c89120dbf1adb3acf2f28`.
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
| `size/browser-bundle/quickstart/gzip` (default) | accepted-tradeoff | 144501 | 194615 | +34.7% | 7225.050 bytes | beta11-94fc18a-quickstart-bundle-gzip |
| `size/wasm/common/gzip` (optional) | accepted-tradeoff | 100058 | 127653 | +27.6% | 5002.900 bytes | beta11-94fc18a-wasm-common-gzip |
| `size/wasm/full/gzip` (default) | accepted-tradeoff | 137639 | 187236 | +36.0% | 6881.950 bytes | beta11-94fc18a-wasm-full-gzip |

## Absolute timing across jobs (informational, not judged)

These compare with the frozen snapshot measured in another job, possibly on another runner machine class; timing verdicts come from the same-job paired ratios above.

| Metric | Snapshot | This run | Change |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-medium-fixed4096/initialization-p95` | 17.400 | 31.300 | +79.9% |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-p95` | 13.100 | 12.300 | -6.1% |
| `initialization/cli/scale-logs-medium-fixed4096/initialization-p95` | 2.832 | 2.363 | -16.6% |
| `initialization/cli/scale-logs-small-whole/initialization-p95` | 2.616 | 2.138 | -18.3% |
| `initialization/node/scale-logs-medium-fixed4096/initialization-p95` | 6.396 | 5.410 | -15.4% |
| `initialization/node/scale-logs-small-whole/initialization-p95` | 6.092 | 4.696 | -22.9% |
| `initialization/python/scale-logs-medium-fixed4096/initialization-p95` | 1.026 | 0.997 | -2.8% |
| `initialization/python/scale-logs-small-whole/initialization-p95` | 0.970 | 0.908 | -6.5% |
| `initialization/rust-core/scale-logs-medium-fixed4096/initialization-p95` | 0.028 | 0.050 | +80.6% |
| `initialization/rust-core/scale-logs-small-whole/initialization-p95` | 0.028 | 0.051 | +81.8% |
| `latency/browser-wasm/scale-logs-medium-fixed4096/processing-p95` | 115.500 | 23.500 | -79.7% |
| `latency/browser-wasm/scale-logs-small-whole/processing-p95` | 35.300 | 18.100 | -48.7% |
| `latency/cli/scale-logs-medium-fixed4096/processing-p95` | 85.563 | 17.909 | -79.1% |
| `latency/cli/scale-logs-small-whole/processing-p95` | 23.400 | 6.270 | -73.2% |
| `latency/node/scale-logs-medium-fixed4096/processing-p95` | 90.489 | 20.336 | -77.5% |
| `latency/node/scale-logs-small-whole/processing-p95` | 15.848 | 3.003 | -81.1% |
| `latency/python/scale-logs-medium-fixed4096/processing-p95` | 81.351 | 15.206 | -81.3% |
| `latency/python/scale-logs-small-whole/processing-p95` | 15.893 | 2.971 | -81.3% |
| `latency/rust-core/scale-logs-medium-fixed4096/processing-p95` | 79.304 | 14.808 | -81.3% |
| `latency/rust-core/scale-logs-small-whole/processing-p95` | 18.381 | 2.968 | -83.9% |

## Measured rows with no baseline yet (baseline-pending, not judged)

| Row | Candidate | Note |
| --- | ---: | --- |
| `size/wasm/common-pii/gzip` (optional) | 248432 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |
| `size/wasm/full-pii/gzip` (optional) | 310041 bytes | baseline-pending: baseline 0.1.0-beta.8 did not measure this row, so it has no trigger; it gets one (rules.size) only when a baseline snapshot that carries it is promoted |

## Diagnostics (measured, never budgeted)

| Row | Value | Note |
| --- | ---: | --- |
| `size/browser-bundle/quickstart/emitted-gzip` | 507770 bytes | every asset the bundler emitted, 2 not fetched by a default quickstart included; diagnostic, not budgeted |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}.

