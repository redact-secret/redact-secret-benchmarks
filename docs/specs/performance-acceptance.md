# Performance acceptance: `performance-criteria.json`

Issue: [#136](https://github.com/redact-secret/redact-secret-benchmarks/issues/136),
part of [#132](https://github.com/redact-secret/redact-secret-benchmarks/issues/132).
Paired with [redact-secret#603 (DS11)](https://github.com/redact-secret/redact-secret/issues/603).
Decisions: [`2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md`](../decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md),
[`2026-09-23-run-the-performance-evaluation-for-real.md`](../decisions/2026-09-23-run-the-performance-evaluation-for-real.md)
(the [#150](https://github.com/redact-secret/redact-secret-benchmarks/issues/150) follow-up
that actually ran the workflow and retired the "by construction" framing below).
Data: `benchmarks/performance-criteria.json`, schema
`schemas/performance-criteria-v1.json`. Pinned core result contract:
`benchmarks/lib/performance-schema.ts`, schema
`schemas/performance-assessment-v1.json`. Live drift check against core's
own source at the pinned commit: `benchmarks/lib/performance-schema-drift.ts`
(`npm run performance:schema:drift-check`). Derivation:
`benchmarks/lib/performance-derivation.ts` (`npm run performance:criteria`).
Evaluation: `benchmarks/lib/performance-acceptance.ts`,
`benchmarks/evaluate-performance.ts` (`npm run performance:evaluate`). CI:
`.github/workflows/performance-evaluation.yml`. Pin consistency:
`benchmarks/lib/pin-drift.ts` (`npm run pins:check`).

## Why this exists

Per this repository's boundary rule, nothing here asserts product output —
this owns *measuring against thresholds this repository holds*, not the
product's release decision. Core (`redact-secret/redact-secret`) keeps the
per-surface runners, the result schema, the workload generator and
profiles, and the accuracy corpus; core's own `assessment/` directory states
plainly that producing or reporting a result there "is not a release gate."
This repository's acceptance verdict is not one either.

## What it does

`assessment:all` (core) produces a `CompleteAssessment` summary: one
`AssessmentResult` per surface (`rust-core`, `python`, `node`,
`browser-wasm`, `cli`) x workload profile (`scale-logs-small-whole`,
`scale-logs-medium-fixed4096`), each carrying `provenance` (exact commit,
artifact identity, host OS/CPU, language runtime, build profile) plus either
`accuracy` or `performance` metrics.

`completeAssessmentProblem` (`benchmarks/lib/performance-schema.ts`) checks
that summary against a pinned copy of core's contract before anything else
touches it — the pin-and-drift-check pattern `benchmarks/support/taxonomy.ts`
already uses for core's provider/family taxonomy, and
`schemas/performance-assessment-v1.json` is the JSON Schema counterpart
`npm run performance:schema:check` validates a live summary against in CI.
Before any of that, `checkCoreSchemaDrift`
(`benchmarks/lib/performance-schema-drift.ts`, `npm run performance:schema:drift-check`)
reads core's actual `assessment/complete.ts` and `assessment/schema.ts`
source at the pinned commit (already checked out by CI into `core-repo/`,
before any of the five language toolchains are built) and fails if the
schema-version constant, required surfaces, or result-contract field names
have moved against the pinned copy — catching drift before a live summary
even exists to validate, not only after (#150).

`evaluateAcceptance` (`benchmarks/lib/performance-acceptance.ts`) then checks
the summary's completeness, repetition count, corpus/profile identity, host
environment, accuracy parity, and every named performance profile's
initialization/processing p95, minimum throughput, and observable memory
maxima against `benchmarks/performance-criteria.json` — a direct port of
core's own `assessment/acceptance.ts`, since #603 (DS11) moves "acceptance
evaluation" ownership here, not just the criteria file.

## Deriving the criteria

`deriveCriteria` (`benchmarks/lib/performance-derivation.ts`) computes
`benchmarks/performance-criteria.json` mechanically from one complete,
five-repetition, release-build `CompleteAssessment` summary — never
hand-picked. The rule, reproduced from redact-secret's own
`assessment/README.md` (and recorded machine-readably in the criteria
file's own `derivation` field):

- **Repetitions**: minimum 5 — "so a two-sample exploratory baseline cannot
  be mistaken for formal acceptance evidence."
- **Percentile**: p95, for both initialization and processing timing.
- **Timing ceilings**: 2x the observed p95, rounded up — whole millisecond
  below 10ms, nearest 5ms below 100ms, nearest 50ms below 1000ms, else
  nearest 100ms.
- **Throughput floors**: half the observed minimum, rounded down — nearest
  10,000 bytes/s below 1,000,000, else nearest 100,000.
- **Memory caps**: 2.5x the observed maximum, rounded up to the nearest
  mebibyte, one cap per memory category the surface can actually observe
  (Rust/CLI process RSS, Python allocator plus process RSS, Node
  heap/RSS/external, Chromium's coarsened JS heap). Categories overlap and
  are never summed; an unobservable category (WebAssembly linear memory,
  streaming buffers) stays explicitly unavailable rather than defaulting to
  a zero or an invented cap.
- A `rust-core` performance result whose `provenance.buildProfile` is not
  `"release"` is refused outright — a debug-build timing cannot license a
  threshold anyone else is held to.
- Every surface must report identical accuracy counts (true/false
  positives, false negatives, policy mismatches); derivation refuses to
  proceed on disagreement, since the accuracy counts are a no-drift check
  across artifacts, not a fresh measurement.

The current criteria were derived from
[`evidence/603/summary.json`](../../evidence/603/summary.json), this
repository's own real
[`performance-evaluation.yml` run](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35861463332)
against the commit `benchmarks/pin-manifest.json` pinned at measurement time
(`079095e766e4a71e2b7e29413ed17be37bb3315d`) — release builds, five
repetitions, matching the current pin (`npm run pins:check` fails otherwise;
see #150). This run's own evaluation, recorded in
[`evidence/603/acceptance.md`](../../evidence/603/acceptance.md), reports
`ACCEPTED` with all 46 checks passing against the criteria that were
committed *before* this run — an earlier, unrelated beta.4 baseline — which
makes that verdict genuine, not self-referential. The recalibration this run
then produced is not itself re-checked against the same run for a second
"ACCEPTED": any threshold derived with a margin necessarily accepts the run
it came from, so that would demonstrate nothing.

## Environment profile

Linux x86_64 only (`linux-x64-node22-chromium`: Linux, x86\_64/x64, Node 22,
Chromium, CPython 3, the host Rust toolchain). The macOS profile is not
carried forward — its Rust portion came from debug builds, per core's own
`assessment/README.md:620-630` correction — and is not adopted here.

## Recalibrating

```sh
npm run performance:criteria -- --summary <path-to-a-fresh-complete-assessment-summary.json>
npm run performance:schema:check
npm test  # benchmarks/lib/performance-derivation.ts and performance-acceptance.ts are unit-tested
```

`npm run performance:criteria:check` (wired into `validate.yml`) fails CI if
`benchmarks/performance-criteria.json` no longer matches what
`deriveCriteria` would produce from `evidence/603/summary.json` — the same
generate-then-check pattern `pins:manifest` / `pins:manifest:check` uses.
`npm run pins:check` (also wired into `validate.yml`) separately fails if
`benchmarks/performance-criteria.json`'s `baseline.sourceCommit` no longer
matches the commit `benchmarks/pin-manifest.json` pins — recalibrating from
one commit while the pin has already moved to another is exactly the drift
#150 found (evaluated revision matching evidence, but not the current pin).

## Running an evaluation

`.github/workflows/performance-evaluation.yml` (manual `workflow_dispatch`)
checks out core at the exact commit `benchmarks/pin-manifest.json`'s
`pins.redactSecretRevision` names, checks that checkout's live
`assessment/complete.ts`/`assessment/schema.ts` for drift against the pinned
contract (`npm run performance:schema:drift-check`) before building
anything, builds every surface's release artifact the same way core's own
"Complete assessment" workflow does, runs `npm run assessment:all -- --runs 5`,
checks the result for schema drift against the pinned contract, and
evaluates it with `npm run performance:evaluate`. This produces a
schema-valid result and an acceptance verdict in this repository's own CI —
first actually exercised, end to end, by
[run 35861463332](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35861463332)
(#150; see `evidence/603/README.md`).
