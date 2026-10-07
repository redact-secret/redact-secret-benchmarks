---
decision_id: decision-record-the-measurement-host-at-execution
status: accepted
scope: benchmarks
title: Record the measurement host at execution, keep it out of every run identity, and show it apart from the publication host
decided_at: 2026-10-07
---

# Record the measurement host at execution, keep it out of every run identity, and show it apart from the publication host

## Context

#620 and #621 (part of #543) asked for the OS release, CPU, Node and CI runner image behind the numbers on `/evaluation/scanner/`. Both were
written for the legacy pipeline (peer snapshots, `public/results/run.json`). Since #658 the credential authority is `new`: the scanner page reads
the official run of the report population through `loadCredentialSource` (PR #747), so the facts have to come from the official run, and a site
build is not the measurement (the CI runner that builds the site reuses runs measured earlier, elsewhere).

Inventory of what the official path already retains, at `develop` 5982d971 (engine credential-eval alpha.16, RunArtifact v1):

| Fact | Where it is retained | Verified how |
| --- | --- | --- |
| Platform (`linux-x64`) | `benchmarks/official-runs.json` `runs[].platform` | identity: it selects the pinned executables, so it is in `configHash` |
| OS and architecture (`linux-x86_64`) | the artifact's `non_semantic.host` | the archived artifact's bytes against `runs[].artifact.byteDigest` |
| Start and finish time | the artifact's `non_semantic.started_at`, `finished_at` | the same byte digest |
| Recorded date, benchmark revision | `runs[].recordedOn`, `runs[].benchmarkRevision` | the registry, `official-runs:check` |
| Job bound, process counts | `non_semantic.execution` | the same byte digest; not shown (scheduling, not host) |
| OS release, CPU model and cores, Node, CI image | nowhere | none |

The engine's contract carries only an OS/architecture string about the host; `non_semantic` is closed (`additionalProperties: false`), so the
benchmark cannot add to it. The view (`qualification-v1.json`) carried none of it.

## Decision

1. **Two sources, kept apart.** (a) The engine's own stamp, read from the verified artifact by the adapter
   (`benchmarks/qualification/measurement-host.ts` `engineTelemetry`) into the view as `populations[].measurement` and `methodsMeasurement`
   (`host`, `startedAt`, `finishedAt`; additive in view v1, like `origins`). (b) The facts the engine does not carry, captured by the benchmark's run
   driver (`scripts/run-official-credential-eval.ts`) on the measuring machine the moment it starts the engine (`captureMeasurementHost`: `os.release()`,
   the `/etc/os-release` name, the CPU model and logical core count, `process.version`, and, on GitHub Actions, `ImageOS`, `ImageVersion` and
   `RUNNER_ENVIRONMENT`), written into `run-record.json` as `measurementHost` and copied verbatim by `official-runs:record` into `runs[].measurementHost`.
2. **Provenance at measurement execution only.** A stage reused from an earlier run's receipt (#707, #762) carries that run's `measurementHost`, or
   none; never the reusing job's. Neither the recorder, the view build nor the site build fills it from the machine they run on.
3. **Not identity.** Host facts and times enter no run id, `configHash`, semantic digest, receipt match, determinism check, count, status or
   denominator. Two runs of the same inputs on different runner images are the same measurement; the platform (already identity) is what separates
   a darwin verification from the linux canonical run. The adapter test holds the view equal when only `non_semantic` differs, apart from the
   provenance fields; `receiptProblems` is unchanged.
4. **Immutable records; old ones stay unavailable.** The four runs recorded before this change have no `measurementHost` and keep none; a record is
   never amended to add one (a later read of a different machine would be invented provenance). `official-runs:check` accepts a run without it, and
   for one with it checks the bounded shape, that it matches the run's platform, that it was captured no later than `recordedOn`, and that a canonical
   (CI) run names its runner. The page says "Unavailable" with the reason. Historical receipts are checked the same way.
5. **Bounded values.** Every host value is a token or short text from a fixed character set with no slash: no path, username, hostname or free text
   reaches a page. A value outside it is dropped (the run is unaffected), never recorded in another shape.
6. **The page.** `/evaluation/scanner/` shows, in each scanner's "Where it ran": the engine's start time and host from the artifact, then the OS
   release, CPU, Node and CI runner image from the run record, or one "Unavailable" line. The page header's "Page built" line is the publication host
   (`web/services/build-host.ts`, read at build time), labelled apart, and is never offered as the measurement host. `check-export-comparison.mjs`
   rereads the view and the registry and checks the page states them.
7. **Legacy.** The legacy pipeline (rollback and oracle) is unchanged: its fresh run keeps `run.json`'s Node/platform/arch line and its peer snapshots
   keep "Not recorded". The snapshots are not refreshed and `run.json`'s shape is not changed (it is the parity oracle); `PEER_SNAPSHOT_SCHEMA` is
   untouched, so no snapshot or ledger value is re-keyed.

## Upstream gap

The OS release, CPU and Node of the run are recorded by the benchmark's driver, beside the artifact, not inside the verified artifact bytes: they are
as trustworthy as the run record (a CI job of `official-runs.yml`, committed by the owner's recording step). Carrying them in the engine's
`non_semantic` (for example a structured `host` object) would put them under the artifact's byte digest; that is a credential-eval contract change and
is left to its maintainers. Until then the page names the engine's stamp and the driver's record separately.

## Consequences

- The next official run records the host; until then the page says "Unavailable" for it. No official run is re-dispatched for this.
- The view gains two optional provenance fields; a view built before them is still read (the page says the stamp is unavailable).
- `measurementHost` is optional in the run record, so a receipt from an earlier workflow still verifies.
