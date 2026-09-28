# Peer runtime PII-redaction throughput: `peer-pii-runtime-throughput-v1`

Issue: [#429](https://github.com/redact-secret/redact-secret-benchmarks/issues/429).
Decision: [`2026-09-28-add-peer-runtime-pii-redaction-throughput.md`](../decisions/2026-09-28-add-peer-runtime-pii-redaction-throughput.md).
Plan: `qualification/peer-pii-runtime-throughput-v1.json`, schema/validator
`benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts`. Adapters:
`scripts/peer-pii-runtime-throughput/adapters.mjs`. Measurement:
`scripts/measure-peer-pii-runtime-throughput.mjs`
(`npm run peer-pii-runtime-throughput`). Published output: the frozen
snapshot `evidence/429/peer-pii-runtime-throughput.json`, shown on `/report`
under "Runtime redaction libraries on the same PII inputs"
([#444](https://github.com/redact-secret/redact-secret-benchmarks/issues/444)).

## Why this exists

[#286](https://github.com/redact-secret/redact-secret-benchmarks/issues/286)'s
`pii-profile-cost-v1` plan found that activating PII detection measurably
regresses redact-secret's own latency. That measurement is entirely
self-referential (redact-secret `off` vs `enabled`) and cannot answer
whether the resulting speed is competitive with other runtime PII-redaction
libraries. Gitleaks and TruffleHog are not useful references for that
question — both are repository/file secret scanners, not runtime redaction
libraries. This plan measures redact-secret alongside two runtime
PII-redaction peers, flare-redact and OpenRedaction, on the same synthetic
workloads.

Per this repository's Boundary rule (`AGENTS.md`), this plan **never**
produces a pass/fail verdict or a ranking assertion. Its `thresholdPolicy`
is the single field `{ "verdict": "informational" }`, and the report schema
has no field a verdict could occupy. It exists to publish comparable
numbers, not a conclusion.

## What it measures

For each of the two workloads in
`qualification/pii-profile-cost-workloads-v1.json` (`validator-heavy`,
`multilingual-context`, reused unchanged — see "Workload reuse" below),
`scripts/measure-peer-pii-runtime-throughput.mjs` calls each tool's actual
redact operation `sampleProtocol.samplesPerCell` times (after
`warmupSamples` discarded warmup calls), interleaved round-robin across the
three tools per workload round to spread out any environment drift evenly,
and times each call with `performance.now()` around the call itself
(`await`ed where the tool's call is asynchronous). It records `redactMs`
and `bytesPerSecond` per sample, then the median and p95 across samples.

**Each tool's own redact-shaped call**, not a position-only scan — every
tool in this corpus names a detect-only function `scan`, which would
silently make three unequal comparisons if used here:

| Tool | Package | Call | Async | Returns |
| --- | --- | --- | --- | --- |
| redact-secret | `@redact-secret/core` (local build) | `scanAndRedact(input)` | no | `{ text, findings }` |
| flare-redact | `flare-redact` (npm, `1.6.1` pinned) | `redact(input, opts)` | no | redacted string |
| OpenRedaction | `@openredaction/core` (npm, `1.1.5` pinned) | `new OpenRedaction().detect(input)` | **yes** | `{ redacted, detections, ... }` |

## The async/sync caveat

OpenRedaction's `detect()` returns a `Promise`; flare-redact's `redact()`
and redact-secret's `scanAndRedact()` are synchronous. The harness `await`s
the call and times the whole thing, so OpenRedaction's recorded latency
necessarily includes at least one Node event-loop microtask tick that
neither other tool's figure does. `validatePeerRuntimeThroughputReport`
requires every published report to carry a `methodologyNotes` entry stating
this explicitly (matched by `/async|asynchronous|promise/i`), so it can
never be silently dropped from a future regeneration.

## redact-secret is measured from a local source build, not the published package

`pii:global` PII selection is source-only on redact-secret's `main` branch
as of this plan (`packages/javascript/src/runtime.ts`); it is not in any
published `@redact-secret/core` npm release, including the `0.1.0-beta.9`
this repository otherwise pins for the accuracy comparison
(`scanners/index.mjs`). `scripts/peer-pii-runtime-throughput/adapters.mjs`
therefore `require()`s a native addon built directly from
`redact-secret/bindings/node` (`napi build --platform --release`) —
supplied via `--redact-secret-addon=<path>` or
`REDACT_SECRET_NODE_ADDON_PATH`, never guessed or defaulted silently to a
stale artifact — and calls its raw exports (`initializePii(['pii:global'])`,
`scanAndRedact(text)`) directly, bypassing the published package's
`optionalDependencies`-resolved platform-package loading. flare-redact and
OpenRedaction are measured from their ordinary published npm packages at
their package defaults (no options disabled, matching how a consumer would
install and call them out of the box). `validatePeerRuntimeThroughputReport`
requires a second fixed `methodologyNotes` entry stating this asymmetry.

This is a deliberate, narrower scope than `pii-profile-cost-v1`'s own
multi-surface candidate-build pipeline (six surfaces, pinned product commit,
CI-hosted release builds across languages): this plan builds one artifact
(the Node addon) from whatever `redact-secret` checkout the caller points
it at, and states the exact version (`addon.version()`) and PII activation
identity (`addon.piiActivation()`) in the published report's `tools[]`
entry rather than pinning a specific commit up front. A future revision
could pin `redact-secret`'s commit and rebuild it in CI the way
`pii-profile-cost.yml` does, if this comparison earns a recurring,
CI-scheduled slot; nothing about this plan requires that now, and its
`thresholdPolicy` would stay informational-only either way.

## Workload reuse

`plan.workloadsRef` binds this plan to
`qualification/pii-profile-cost-workloads-v1.json`'s exact
`contentCommitment`; `validatePeerRuntimeThroughputPlan` fails closed if
that file changes underneath this plan. `renderWorkloadText` in
`benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts` duplicates
(rather than imports) the small text-generation snippet
`benchmarks/evaluation/domains/pii/profile-cost.ts` uses for its own
candidate report's `workloadCommitment`, so this plan never depends on
editing that frozen, `pii-profile-cost-v1`-owned file — the two stay
byte-identical as long as the underlying workload JSON is unchanged, which
this plan requires anyway.

## Running a measurement

```sh
npm run peer-pii-runtime-throughput -- --redact-secret-addon=<path-to-built-.node-file>
```

Builds the addon first if needed:

```sh
cd <redact-secret checkout>/bindings/node && npm install && npm run build
```

The report is validated against
`validatePeerRuntimeThroughputReport` before it is written — an invalid or
incomplete observation matrix fails the run rather than publishing a
partial report — and written to
`public/results/peer-pii-runtime-throughput.json`.

## Publishing a snapshot

The script's default output, `public/results/peer-pii-runtime-throughput.json`,
is gitignored and the publish workflow never runs this measurement (it needs
the hand-built addon above). The site therefore reads a committed snapshot
instead: rerun with `--out=evidence/429/peer-pii-runtime-throughput.json` and
update `evidence/429/README.md` with the new source identities.
`src/pages/peer-runtime-throughput.ts` imports that file at build time, and
`tests/peer-runtime-section.test.mjs` fails CI if it no longer passes
`validatePeerRuntimeThroughputReport`. Without the file, the section reads
Not measured.

The `/report` section is bound by the same rule as this plan: rows in plan
order, no marked, sorted or relative value, every `methodologyNotes` entry
verbatim, and a roster that comes only from `TOOL_IDS`, never from the
accuracy run's `summary.scanners`.

## What this plan does not do

- No CI workflow. Building `redact-secret`'s native addon from source is a
  manual step today (see above); wiring a scheduled or PR-triggered CI run
  is future work, not part of this plan.
- No memory measurement — only latency and throughput. `pii-profile-cost-v1`
  already owns redact-secret's own memory-regression budgets; duplicating
  that machinery for a three-tool informational comparison is out of scope.
- No accuracy scoring. Each tool's own default PII detectors run on the
  workloads, but nothing here checks whether they agree, only how long each
  took; a finding-family mismatch is not an error condition this plan
  detects.
- No verdict, ever, per `thresholdPolicy.verdict: "informational"` and the
  ADR's decision 6.
