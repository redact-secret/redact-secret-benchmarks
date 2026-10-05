---
decision_id: decision-plan-accuracy-and-performance-execution-separately-by-identity
status: accepted
scope: benchmarks
title: Plan accuracy and performance execution separately, by identity
decided_at: 2026-10-05
---

# Plan accuracy and performance execution separately, by identity

## Context

#709, under #704. Accuracy and performance are different axes with different invalidation. Until now nothing in this repository said, before a run, what would be measured and why: `official-runs.yml` is the accuracy lane, the performance measurements (`peer-pii-runtime-throughput-v1`, `runtime-comparison-v2`, `pii-profile-cost`) are separate dispatch workflows, and a recorded performance artifact had no identity a later change could be compared with. credential-eval #42 (PR #47, ADR 0010) defines the engine's performance reuse identity and `perf plan`; it is merged but not tagged, so the pinned engine has neither.

## Decision

1. **A dry-run plan, not a scheduler.** `scripts/plan-execution.ts plan` (module `benchmarks/qualification/execution-plan.ts`) states per axis and per scanner whether work is `fresh`, `reuse` or `rescore`, why, the expected jobs and engine invocations, and runner-minutes where telemetry exists (unknown stays unknown). It starts nothing. The axis is a required input; `both` is an explicit choice.
2. **Accuracy follows the change, performance follows identity.** `benchmarks/execution-axes.json` classifies a change (fixtures, expectations, scanner pin, performance workload, measurement code, evidence record, view/docs); an unclassified file is a decision, never a guess. The performance axis decides per cell by comparing the recorded identity (subject id, version, package, kind, commit, activation; the workload definition digest; the protocol digest) with what the repository pins now, and is only consulted by a change that touches a performance input, a force-fresh, a controlled comparison, or `--axis performance` by name. A fixture, label, policy, view or docs change therefore schedules no performance job.
3. **Immutable, independently pinned references.** `benchmarks/performance-cells.json` registers each cell of a recorded performance artifact with its identity, the artifact's byte digest, `measuredAt` and host, and is refused unless the artifact's plan commitment is the plan's. A missing or altered artifact is never reused. Reuse is only of an independent historical measurement: it is shown with its date and host, never as same-run, and no ranking or latency direction is derived from it.
4. **No silent fan-out.** The repository's harness measures every subject of a job in one interleaved process. A changed core cell would therefore also run the peers, so the plan reports that as a decision and schedules nothing until a controlled comparison or force-fresh is requested; a cache miss appears in the plan. Per-subject execution needs harness support or engine #42's `perf plan`, which is integrated when a tag carries it.
5. **The official accuracy lane stays fresh.** The engine refuses observation reuse in an official run (ADR 0008), so an accuracy change plans every scanner of the changed population fresh there; the diagnostic lane repeats what the #706 reuse plans say, and a population without a plan is shown as a cache miss.
6. **Cost is reported apart.** Executed and skipped measurement counts and runner-minutes are separate from wall-clock latency. `benchmarks/execution-telemetry.json` holds only operational minutes of past jobs.

## Consequences

Seeded cells: the two PII runtime measurements. The first plan against them reports the product cell of `peer-pii-runtime-throughput-v1` as stale (a beta.11 local build against beta.13 now) and the 60 others reusable. Spec: `docs/specs/execution-plan.md`. The dry-run workflow `execution-plan.yml` publishes the plan; the dispatch workflows are unchanged and run what the plan names.
