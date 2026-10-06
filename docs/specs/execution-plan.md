# Execution plan: accuracy and performance planned separately

Issue [#709](https://github.com/redact-secret/redact-secret-benchmarks/issues/709), under [#704](https://github.com/redact-secret/redact-secret-benchmarks/issues/704).
Decision: [plan accuracy and performance execution separately, by identity](../decisions/2026-10-05-plan-accuracy-and-performance-execution-separately-by-identity.md).
Accuracy observation reuse is [accuracy-reuse.md](accuracy-reuse.md) (#706). This repository measures and records; the plan never reads a score and starts nothing.

## Inventory of what runs where

| Caller | Axis | Notes |
| --- | --- | --- |
| `official-runs.yml` (credential-eval `run`) | accuracy | One job per population; elapsed time is cost telemetry, not a PerformanceArtifact. Calls no `credential-eval perf`. |
| `peer-pii-runtime-throughput.yml` | performance | `peer-pii-runtime-throughput-v1` and `runtime-comparison-v2`: one harness process measures all tools, interleaved. |
| `pii-profile-cost.yml`, `pii-profile-cost-v2.yml` | performance | A/A, freeze, candidate phases. |
| `performance-evaluation.yml` | performance | core's assessment, paired baseline/candidate on one runner. |

No workflow here calls the engine's `perf` command yet. credential-eval #42 (ADR 0010, `perf plan`) is released (alpha.9) and the pinned engine, `v0.1.0-alpha.15`, carries it; see [Which planner](#which-planner).

## Running it

```
node --import tsx scripts/plan-execution.ts plan --axis <accuracy|performance|both> [--base origin/develop | --files a,b]
  [--lane official|diagnostic] [--accuracy-plan <reuse-plan.json>]... [--force-fresh <id,id|all>] [--controlled-comparison] [--out <dir>] [--strict]
```

`--axis` has no default. `.github/workflows/execution-plan.yml` runs it on dispatch and writes the plan to the job summary. `--strict` exits 3 when the plan needs a decision.

| Change | Accuracy (official lane) | Performance |
| --- | --- | --- |
| Fixture bytes, paths, variants | every scanner of the populations fresh; new bound artifact | reuse: no job |
| Labels, expected spans, accounting | fresh in the official lane (the engine refuses reuse there); the diagnostic lane re-scores per the #706 plan | reuse: no job |
| Core candidate or peer pin | product fresh; peers fresh in the official lane, reused in the diagnostic lane from a #706 plan | cells whose identity differs are fresh; reuse otherwise |
| Performance workload or protocol | reuse | the affected cells are fresh |
| View, docs, evidence record | reuse recorded runs | reuse |
| A file no rule classifies | decision | decision |

## Dispatch modes

The axes are dispatched by separate workflows, never one from the other: accuracy by `official-runs.yml` (`mode` full or diagnostic), performance by the measurement's own workflow (`peer-pii-runtime-throughput.yml`, input `measurement`, recorded per measurement in the cell register). `plan` ends with the exact `gh workflow run` commands for what it scheduled, one per axis job, and none while a decision is open. A fixture-only plan therefore names no performance workflow. `execution-plan.yml` has no dispatch rights by design (`contents: read`), so it names the commands and a maintainer runs them.

## Views

The runtime and performance pages already show each measurement's date and host (`resolvers/performance.ts`, `resolvers/scanners.ts`: `Run of <date>: <platform> <arch> · Node · <cpu>`), and each report is a frozen, content-addressed artifact, so a view always shows an independent historical measurement with its source. The cell register carries the same fields plus the artifact digest for the plan.

## Performance cells

`benchmarks/performance-cells.json` is registered with `plan-execution.ts register --measurement <id> --plan <plan> --artifact <path>[:<setting>]` (`--check` verifies). A cell is a subject x workload (x setting) of one recorded artifact: identity `{subject: {id, version, package, kind, commit, activation}, workloadDigest, protocolDigest}`, the artifact's path, byte digest, commitment, `measuredAt` and host. Current identity is read from the plan (workload definitions, protocol, settings), `package.json` (versions) and `benchmarks/pin-manifest.json` (the product commit).

The harness measures a whole job (a measurement, or a measurement and setting) in one process. When only some cells are stale the plan names the cells the harness would also run and waits for `--controlled-comparison` (all subjects fresh in one run) or `--force-fresh`; it never schedules a peer on its own. Reused cells are independent historical measurements, shown with date and host, never same-run.

## Counts and cost

The plan reports executed, reused and re-scored counts, jobs, engine runs or invocations and peer processes, and runner-minutes from `benchmarks/execution-telemetry.json` (a job kind without an entry is unknown and is counted as such), separately from wall-clock latency.

## Which planner

[Decision](../decisions/2026-10-06-integrate-the-engine-perf-plan-for-engine-kinds-and-keep-harness-cells-repository-side.md) (#722). `perf plan` reads only engine `PerformanceArtifact` v1 files and reuses a cell only with an invocation digest, an executable digest and a CPU model (ADR 0010 §2, §5). The 60 registered cells come from this repository's harness, are not engine artifacts and carry no invocation digest, so they stay on the repository-side identity comparison above; replacing it would mark every one `no stored result`. A measurement declared as an engine-run kind (`latency`, `instructions`) is planned by `credential-eval perf plan` from the pinned engine, and its dry-run decision, reason and `invalidated_by` are reported as the engine states them. Each job names its planner. The harness whole-job granularity decision above is unchanged. No engine-run measurement is registered yet, so the engine path is not wired until one exists.

## Not covered

Case-level accuracy reuse (#706).
