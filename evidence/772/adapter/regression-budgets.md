# Regression budgets: REGRESSION

Budgets `regression-budgets-v1` against baseline `0.1.0-beta.8`; candidate `6d61c271bd20213afa9a0158bf332edbd2d103f2`.
Each dimension is judged on its own; no score combines them.

| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |
| --- | ---: | ---: | ---: | ---: | ---: |
| latency | 0 | 0 | 0 | 0 | 10 |
| initialization | 0 | 0 | 0 | 0 | 10 |
| memory | 0 | 0 | 0 | 0 | 16 |
| size | 0 | 0 | 0 | 0 | 28 |
| adapter-overhead | 28 | 2 | 0 | 0 | 0 |

## Triggers that need attention

| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `adapter/pino-streamwrite/log-flat/traversal` | regression | 3.7 | 4.702 | +27.1% | 0.555 microseconds-per-event | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |
| `adapter/python-logging/log-nested/traversal` | regression | 11.718 | 14.247 | +21.6% | 1.758 microseconds-per-event | breach without an accepted tradeoff in benchmarks/accepted-regressions.json |

## Detection (reported, not budgeted)

Baseline {"truePositives":21,"falsePositives":1,"falseNegatives":5,"policyMismatches":0}; candidate null.

