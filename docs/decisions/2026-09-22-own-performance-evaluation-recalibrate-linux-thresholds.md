---
decision_id: decision-own-performance-evaluation-recalibrate-linux-thresholds
status: accepted
scope: benchmarks
title: Own performance evaluation and recalibrate Linux x86_64 thresholds
decided_at: 2026-09-22
---

# Own performance evaluation and recalibrate Linux x86_64 thresholds

## Context

[redact-secret-benchmarks#136](https://github.com/redact-secret/redact-secret-benchmarks/issues/136),
part of [#132](https://github.com/redact-secret/redact-secret-benchmarks/issues/132).
Paired with
[redact-secret#603 (DS11)](https://github.com/redact-secret/redact-secret/issues/603),
"Move performance results, criteria, and judgement to
redact-secret-benchmarks," which this repository's decision mirrors.

Today this repository does not evaluate performance: `performance.now()`
only times scanner runs (`benchmarks/engine/execution.ts:83`,
`benchmarks/run.ts:92`). It consumes core only as the published npm package
(`package.json:67`). Core's thresholds were derived once from first runs;
the macOS Rust portion came from debug builds
(`assessment/README.md:620-630` in core).

At the time this decision was recorded, redact-secret#603 was still open and
its closing PR ([redact-secret#622](https://github.com/redact-secret/redact-secret/pull/622),
which deletes core's `assessment/results/*` and `acceptance-criteria*.json`)
had not merged. #603's own acceptance criteria state: "The benchmarks-side
intake is merged, or its revision is pinned, before core deletes the
criteria" -- core's deletion is ordered to happen *after* this repository's
intake, not before. This record is that intake. Core's own DS11 ADR is
recorded separately, in core, once #622 lands.

Core's `assessment/results/complete-linux-x64-v4/summary.json` (release
builds, five repetitions, commit `944341903d5b85686a056d3218f4c33110d7d57b`)
was still committed on core's `main` at decision time and is copied into
[`evidence/603/summary.json`](../../evidence/603/summary.json) as this
decision's raw evidence. Core's own `acceptance-criteria-linux-x64.json`
threshold *numbers*, by contrast, trace to an earlier, since-pruned run
(`assessment/README.md`'s "Linux x86_64" section names commit
`9ff702001342ff84acdde8ad9acdec396572a15e`, pruned by core's #594); only the
*identity* pointer was re-pinned forward to `complete-linux-x64-v4`, not the
threshold values themselves. Recalibrating from a run whose raw numbers no
longer exist anywhere is not reproducible, so this decision re-derives fresh
thresholds directly from `complete-linux-x64-v4`'s own committed
observations instead of copying core's frozen numbers.

## Decision

- **Core keeps measurement tooling**: per-surface runners, the result
  schema, the workload generator and profiles, and the accuracy corpus.
- **This repository owns performance results, criteria, acceptance
  evaluation, recalibration, and publication.**
- **Linux x86_64 is the only official profile.** The macOS profile (whose
  Rust portion came from debug builds) is not adopted here.
- A pinned copy of core's result contract lives in
  [`benchmarks/lib/performance-schema.ts`](../../benchmarks/lib/performance-schema.ts)
  and [`schemas/performance-assessment-v1.json`](../../schemas/performance-assessment-v1.json),
  checked for drift the same way `benchmarks/support/taxonomy.ts` and
  `schemas/support-matrix-v1.json` pin a copy of core's provider/family
  taxonomy: `npm run performance:schema:check` validates a live
  `CompleteAssessment` summary against the pinned contract, and
  `.github/workflows/performance-evaluation.yml` runs it right after core's
  `assessment:all` produces one.
- [`.github/workflows/performance-evaluation.yml`](../../.github/workflows/performance-evaluation.yml)
  (manual `workflow_dispatch`, matching core's own manual "Complete
  assessment" workflow) checks out core at the exact commit
  `benchmarks/pin-manifest.json`'s `pins.redactSecretRevision` names, builds
  release artifacts for every surface, runs `npm run assessment:all`, and
  evaluates the result against
  [`benchmarks/performance-criteria.json`](../../benchmarks/performance-criteria.json)
  via [`benchmarks/evaluate-performance.ts`](../../benchmarks/evaluate-performance.ts) --
  no cross-repo token or artifact handoff; it only reads core's public
  source at a pinned commit and runs core's own public npm scripts.
- `benchmarks/performance-criteria.json` is derived mechanically, not
  hand-picked, by
  [`benchmarks/lib/performance-derivation.ts`](../../benchmarks/lib/performance-derivation.ts)
  (`npm run performance:criteria`) from
  [`evidence/603/summary.json`](../../evidence/603/summary.json):
  - **Repetitions**: 5 (the same minimum core's own criteria required).
  - **Percentile**: p95, for both initialization and processing timing
    ceilings.
  - **Margin**: timing ceilings are 2x the observed p95, rounded up (whole
    millisecond below 10ms, nearest 5ms below 100ms, nearest 50ms below
    1000ms, else nearest 100ms); throughput floors are half the observed
    minimum, rounded down (nearest 10,000 bytes/s below 1,000,000, else
    nearest 100,000); memory caps are 2.5x the observed maximum, rounded up
    to the nearest mebibyte. This reproduces the rounding rule
    `assessment/README.md` documented for core's own Linux x86_64 profile,
    verified in `benchmarks/lib/performance-derivation.ts`'s module comment
    against every number in core's (now superseded)
    `acceptance-criteria-linux-x64.json` before this repository re-derived
    its own.
  - The derivation is recorded machine-readably in the criteria file's own
    `derivation` field, not only in this prose.
- Evaluating `evidence/603/summary.json` against the freshly derived
  criteria reports `accepted` with all 46 checks passing, by construction --
  the same self-consistency core's own README documents for its first
  Linux run.

## Provenance preserved for core

Core DS11 can delete `assessment/acceptance-criteria*.json` and
`assessment/results/*` without losing any threshold's provenance:
`benchmarks/performance-criteria.json`'s `baseline` block carries the exact
source commit, accuracy-corpus identity, and workload-profile identity the
thresholds were derived from, and `evidence/603/summary.json` is the
complete raw observation set those thresholds were computed from --
committed here, reproducible by anyone, independent of whether core keeps
its own copy.

## Consequences

- `evidence/603/README.md` records the one-line result, source revisions,
  scanner/artifact identities, and reproduction command per
  `evidence/README.md`'s contract, so core's own `docs/audits/evidence/603/`
  stub needs only a permalink and that one line.
- `npm run performance:criteria:check` and `npm run performance:schema:check`
  run in `validate.yml`'s standard job, so the committed criteria file and
  the pinned schema copy cannot silently drift from what
  `performance-derivation.ts` and `performance-schema.ts` would produce
  today.
- `.github/workflows/performance-evaluation.yml` stays manual: it builds
  five language toolchains from source and is not cheap enough to run on
  every push, the same trade-off core made for its own "Complete assessment"
  workflow.
- When core's #622 merges and its own DS11 ADR is recorded there, this
  record does not need to change: it already treats core's criteria files
  as the thing being retired, not a dependency this repository's own
  criteria continue to read from.
- This does not change scoring, gates, or ledger semantics (per #132's
  epic non-goals), and producing a performance acceptance verdict here is
  not a release gate, matching core's own "never itself a release gate"
  framing for `assessment/`.
