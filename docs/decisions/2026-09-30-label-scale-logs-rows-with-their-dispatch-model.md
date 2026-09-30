---
decision_id: decision-label-scale-logs-rows-with-their-dispatch-model
status: accepted
scope: benchmarks
title: Label each scale-logs row with its dispatch model and compare rows only within one model
decided_at: 2026-09-30
---

# Label each scale-logs row with its dispatch model and compare rows only within one model

## Context

[#405](https://github.com/redact-secret/redact-secret-benchmarks/issues/405) publishes the accepted run's measured
throughput per surface and profile. Reading those numbers side by side shows the problem
[#450](https://github.com/redact-secret/redact-secret-benchmarks/issues/450) reported from redact-secret#883: at the
accepted commit `da69ebf`, `scale-logs-small-whole` reads 31.7 MB/s on `rust-core` and 13.3 MB/s on the CLI. The CLI
dispatches each line separately (about 983 `detect()` calls per 64 KiB) and `rust-core` makes one call, so the ratio
mixes dispatch cost with detector cost. The summary's own `path` field (`whole-input`, `incremental`,
`standard-input`) does not carry this: the CLI's `whole-input` row is not a one-shot scan.

## Decision

1. **Label, do not split.** Every measured row carries a dispatch model, `one-shot`, `chunked-incremental` or
   `per-line-incremental`, derived by `dispatchModel` in `benchmarks/lib/measured-performance.ts` and shown as its own
   column on the performance page. The library surfaces are classified by the summary's `path`; the CLI is classified
   by surface, because `path` cannot express per-line dispatch. Splitting into like-for-like pairs needs runs this
   repository does not own: the runners live in the product repo, and the CLI has no one-shot mode to pair with. A
   label states the difference today and stays valid if the product later adds one.
2. **Cross-model ratios are not published.** `comparableRows` is the rule: two rows are comparable only when their
   dispatch models match. The page says so beside the table, and the workload guidance is derived from the one-shot
   rows only.
3. **Budgets already compare within one model, and a test now pins that.** Every latency and initialization trigger in
   `benchmarks/regression-budgets.json` is a candidate/baseline ratio of one surface and profile, measured in one
   paired job, so both sides share a dispatch model. `tests/measured-performance.test.mjs` fails if a trigger id stops
   naming a single surface. No threshold and no budget changes.

## Consequences

- If the product changes how a surface dispatches (for example a CLI one-shot mode), `dispatchModel` and its tests
  change with it, and the budgets baseline is re-derived as for any other pin move.
- A per-line row is not a measure of detector cost. Anyone who wants detector cost per line reads a one-shot row.
- Not done here: the product-side runner change that would record the dispatch model in the result's provenance, so the
  classification could be read instead of derived. It is the paired follow-up on redact-secret.
