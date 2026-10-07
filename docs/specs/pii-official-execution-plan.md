# The official public/synthetic PII measurement: frozen plan and provenance (#796)

Status: benchmark-side record; measures and records, asserts no product output. Plan file (derived, never typed): [`benchmarks/pii-eval-official-execution-plan.json`](../../benchmarks/pii-eval-official-execution-plan.json),
`node scripts/pii-official-plan.mjs --check` (`npm run pii:official-plan:check`). Public synthetic only: no EC2, custodian, private ledger, protected corpus or production key is needed or used.

## What the plan freezes

The exact pii-eval engine (commit `b1c097e4…`, Linux CI artifact and binary digest), protocol `pii-v1` revision 2 and artifact schema 1.4, the candidate (`0.1.0-beta.13`, source commit, artifact-set commitment), scanner adapter, configuration and activation digests,
each of the four complete populations (snapshot, manifest and roster digests; 146, 266, 477 and 299 memberships, 156 of them range-less), the benchmark policy (`qualification/pii-v1.json` digest, the scorer-basis decision and its status).

## Execution versus replay

| Evidence | What it is | Launched a scanner | Mode |
| --- | --- | --- | --- |
| The four committed artifacts (`benchmarks/pii-eval-population-dual-run/`) | `pii-eval replay` of the frozen Beta.13 observation, built by a local darwin build of the engine | no | exploratory |
| The linux replay receipt (`linux-replay.json`, `pii-population-replay.yml`) | the pinned linux CI engine replays the same observation to the same bytes | no | exploratory, canonical platform |
| A fresh official execution | `pii-eval run --config` with `mode: official` against the pinned scanner package on Linux | yes | official |

Only the last would be an official measurement, and it does not exist. A replay proves deterministic reproduction; it is never relabelled as an execution, an official run or an acceptance.

## What stops the dispatch (state `pending-not-dispatched`)

1. The scorer-basis decision (#795) is proposed and the owner decision is pending, so "validates under the accepted scorer semantics" cannot be asserted.
2. An official run pins the scanner package tree digest and extra artifacts (the native addon); the recorded candidate identity is the artifact-set commitment of the frozen observation, and their equality is not established. The package for a fresh run comes from the product repository's build.
3. No workflow runs `pii-eval run --config` against a scanner package in CI; it must be added and reviewed (dispatch only, read-only App token for the pinned engine artifact, no token in the scanner step).
4. CI cost: the owner decides whether to dispatch a long Linux run; none was started. The intended command is recorded in the plan (`dispatch.intendedCommand`) and names a workflow that does not exist yet.

Once an official artifact exists it feeds the existing consumer (schema 1.4, `popPins.projection.mode: official`), the durable public copy is committed beside the Actions artifact (coordinated with #785; no new storage is invented), and the #666 rehearsal is regenerated against the same pins
(`npm run pii:authority:rehearse -- --write`). Local darwin runs are verification only and are never compared with a linux run.
