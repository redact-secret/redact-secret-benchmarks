---
decision_id: decision-integrate-the-engine-perf-plan-for-engine-kinds-and-keep-harness-cells-repository-side
status: accepted
scope: benchmarks
title: Integrate the engine perf plan for engine-run kinds and keep harness cells on the repository-side comparison
decided_at: 2026-10-06
---

# Integrate the engine perf plan for engine-run kinds and keep harness cells on the repository-side comparison

## Context

#722, follow-up of #709. credential-eval #42 (ADR 0010) defines the engine's performance reuse identity and `credential-eval perf plan`. The tag now exists: the pinned engine is `v0.1.0-alpha.15` (`benchmarks/official-runs.json`), and `perf plan` was released with alpha.9, so the "once a tag carries it" condition is met.

The issue asked to replace the cell comparison in `scripts/plan-execution.ts` with `perf plan`. Reading ADR 0010 against the register shows the two do not describe the same artifacts:

- `perf plan --kind latency|instructions --config <performance-config-v1> --store <artifact>...` plans measurements the engine itself runs, and reads only engine `PerformanceArtifact` v1 files (ADR 0010 §5, §7).
- A stored cell is reusable only with an `invocation_digest`, an executable digest and a CPU model (§2). Artifacts written before that revision are "not reusable as independent cells".
- All 60 cells in `benchmarks/performance-cells.json` come from this repository's own harness (`peer-pii-runtime-throughput-v1`, `runtime-comparison-v2`): published npm packages measured in one interleaved Node process, recorded as `evidence/429/peer-pii-runtime-throughput.json`. None is an engine `PerformanceArtifact`, none carries an invocation digest, and no workflow here calls `credential-eval perf`.

Replacing the comparison would therefore turn every reusable cell into `no stored result` and schedule 60 fresh measurements for no change in any input. That is the opposite of what #709 and #722 set out to do.

## Decision

1. **Two planners, one per artifact family, selected by the measurement's declared kind.** A measurement in `benchmarks/performance-cells.json` is planned by the repository-side identity comparison (harness cells, today's two measurements) or, when it is an engine-run kind (`latency`, `instructions`), by `credential-eval perf plan` against the engine pinned in `official-runs.json`. The plan reports which planner decided each job. A measurement is never planned by both and the engine's dry-run result is carried verbatim (its decision, reason and `invalidated_by`), not recomputed here.
2. **The pin is the existing engine pin.** No second engine pin is added; `perf plan` runs from the engine artifact the official-runs transport already verifies by digest.
3. **No migration of recorded harness cells.** Their artifacts are frozen and content-addressed; rewriting them as engine artifacts would assert measurements nobody took. A harness measurement moves to the engine planner only when it is re-measured by an engine kind, which is its own measurement entry and its own PR, and its first run is `measure-fresh`.
4. **The whole-job granularity decision stays explicit.** The harness measures every subject of a job in one process, so a stale cell still reports the peers it would also run and waits for `--controlled-comparison` or `--force-fresh`. Engine-run kinds plan per cell (`--fresh <subject>`), and a pairwise direction is reused only under the engine's `reuse-comparison` rule (ADR 0010 §4); a stored measurement of one unchanged subject is shown as dated history, never as a claim against a new build.
5. **The register keeps its artifact references** (path, byte digest, commitment, `measuredAt`, host) for both planners.

## Consequences

- The condition in #709's follow-up is closed by this decision; the integration itself is gated on the first engine-run measurement existing, because there is no real artifact to plan against and no engine call in the tree is worth shipping untested against real data.
- The execution plan spec no longer says the engine feature is untagged.
- Nothing is scheduled and no run is dispatched by this change.
