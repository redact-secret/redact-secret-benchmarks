---
decision_id: decision-record-show-the-performance-pair-as-same-run-times-with-a-noise-rule
status: accepted
scope: benchmarks
title: Show the performance pair as same-run times on one log axis, with a recorded noise rule
decided_at: 2026-09-30
---

# Show the performance pair as same-run times on one log axis, with a recorded noise rule

## Context

#569 (part of #543). The mockup of `/comparison/performance` shows redact-secret and one library on 17 texts in five
groups. The ledger records six texts (`qualification/runtime-comparison-v2.json`, `evidence/562`, three settings, 12 timed
calls per cell). Timings are noisy and different runs or CPUs are not comparable
(`2026-09-30-record-runtime-outcomes-and-time-redact-secret-settings.md`).

## Decision

1. **Route `/comparison/performance/`** (the mockup's), under the Comparison section, linked from `/comparison/runtime`.
2. **The pair and the setting live in the URL**: `?with=flare-redact|openredaction`, `?setting=default|pii-global|pii-global-us`.
   All six combinations are pre-rendered panels picked by `data-peer` and `data-setting` on the root, as `/comparison/runtime`
   does. No client fetch; no row data is loaded at runtime.
3. **Same-run rule.** A panel takes both sides from the report of the chosen setting. The peer is timed again in every run, so
   its numbers move a little between settings; the page says so. A time from one run is never set beside a time from another.
4. **Default setting PII + US** (the mockup's): the libraries run their defaults, which include personal data, so it is the closest
   like-for-like job. `/comparison/runtime` keeps `pii-global` for its external PII view (the ADR above); the two pages differ on
   purpose and each states its setting.
5. **Noise rule, computed from the ledger only.** The spread of a cell is the shortest and longest of its timed calls (read from the
   validated samples). The run-to-run movement is, per text, how far the same peer's median moved between the committed runs. A row
   is marked "not read as different" when the two ranges overlap or the two medians are closer than that movement. The page states
   the largest movement per peer. With one run only, it says the movement is not measured.
6. **Absolute times only.** No ratio, no ordering by time, no headline figure, sides drawn alike (filled and hollow squares:
   shape, not colour). Every time carries what the call did ("Hid N of M values"; a value the setting does not switch on says so).
7. **One log axis** whose decades are the smallest that hold every recorded time, the same for all panels.
8. **redact-secret's own throughput** (the accepted run `benchmarks/performance-criteria.json` names, read with the existing
   `completeAssessmentProblem` and `measuredRows`) is a separate table, Node surface only, stated as another run and protocol, never
   drawn on the pair axis; the other side reads "Not measured".
9. **Gaps are shown, not filled.** The mockup's five groups (size, shape, slow-down patterns, secret density, pieces) have no
   committed timing for the peers. Each is a dashed "Not measured" pointing at #571; the unreleased local build of redact-secret
   is labelled on every panel and tracked in #572.

## Consequences

- `check:routes` (`web/scripts/check-export-performance.mjs`) recomputes every shown time, spread, speed, hidden count, mark
  position and noise figure from the committed reports and fails on a verdict word.
- When #571 lands, its groups replace the "Not measured" list; the same-run and noise rules carry over unchanged.
