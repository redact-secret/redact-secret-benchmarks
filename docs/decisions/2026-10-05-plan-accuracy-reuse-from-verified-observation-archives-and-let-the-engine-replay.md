---
decision_id: decision-plan-accuracy-reuse-from-verified-observation-archives-and-let-the-engine-replay
status: accepted
scope: benchmarks
title: Plan accuracy reuse from verified observation archives and let the engine replay
decided_at: 2026-10-05
---

# Plan accuracy reuse from verified observation archives and let the engine replay

## Context

#706, under #704. credential-eval ADR 0008 (issue #40, PR #44, merged after `v0.1.0-alpha.5`, no tag yet) defines whole-population accuracy observation reuse: `run --reuse-observations <set> [--fresh <id>]` keeps a scanner's recorded observation when its identity is unchanged, refuses changed fixture inputs and re-scores expectation-only changes. A candidate replay still re-scans every unchanged peer because this repository has no way to choose an earlier observation set, check it and say what will be scanned.

## Decision

1. **Benchmarks plans, the engine replays.** `benchmarks/qualification/accuracy-reuse.ts` selects an immutable archive, verifies its byte digest and receipts, compares measured input identity and scanner identity, and states per scanner whether the observation is `reused` or `fresh` and why. The engine re-verifies everything and produces the artifact. This repository never splices, caches or recomputes a score, assertion, comparison or qualification input; only observations are reused, so a changed product or reference regenerates every dependent result in the engine.
2. **Compatibility is measured input and scanner identity, never the release tag.** The plan compares `input_digest` (path and exact bytes, covering generated variant bytes), the protocol, any family restriction and each scanner's recorded identity. The evidence release tag of the archive is recorded as provenance only, so a new tag with identical inputs forces no scan.
3. **Fixture changes fall back, openly.** A changed `input_digest` plans a fresh accuracy run of the changed population (the documented initial fallback; no case-level caching), shown in the plan before execution. The new run's artifact is bound to the new corpus; archives are immutable and never edited. Expectation-only changes plan a re-score without a scan.
4. **Corrupt is refused, absent is a fallback.** An archive whose bytes differ from the recorded digest, whose schema is wrong, or whose observation of an unchanged scanner is not complete, agreed and replayed at least twice, is a refusal (exit 4, nothing runs). A missing, unbound, other-protocol or wrongly restricted archive, a changed scanner or a new scanner runs fresh with the reason named. `--force-fresh` forces scanners or the population.
5. **Reuse is exploratory.** A plan with any reused scanner is for a diagnostic (exploratory, internal) run: the engine refuses reuse for an official run, so official completeness and two-run agreement for new measurements are unchanged. The driver accepts `--reuse-observations`, `--fresh` and `--observations-out` in diagnostic mode only, refuses an engine whose `run --help` lacks the contract, and records the reuse in `diagnostic-record.json`. Admitting reuse into an official run needs its own decision.
6. **Accuracy only.** A plan always reports zero performance measurements; a fixture-only change launches none (#709). Savings are scans not launched and runner-minutes from the reused observations' own recorded durations, not elapsed time.

## Consequences

The first reuse run needs an engine tag with ADR 0008 (not in the pinned `v0.1.0-alpha.4`); until a repin, the planner and its tests work on synthetic sets and the driver refuses reuse on the pinned engine. Mixed-origin results stay exploratory/internal and never reach the ledger. Spec: `docs/specs/accuracy-reuse.md`.
