# Beta.10 PII profile/runtime/artifact-size cost evidence

Full official measurement per the frozen plan `qualification/pii-profile-cost-v1.json`
(`pii-profile-cost-v1`, issue #286). This measures operational cost, not
detection quality: whether enabling PII profiles is measurably slower and
larger, so beta.10 can decide default/full/common/opt-in surface placement
honestly. No support, qualification, or release-readiness claim is made or
implied.

## Source identities

- Benchmark base commit: `1111a8d1341a42707ce9c8a5ca827eb8440e1042`.
- Candidate product commit: `2e1bdcf0905f7a374c4c54b7caac41303cd7d88b`
  (product qualification run 36348390251).
- Distribution-baseline product commit: `f26dee26a9c2aa3cfff3543d784c02de5054de09`
  (product qualification run 36317349914).
- Plan `contentCommitment`: `6aac050bb449b019a9d55ca95c43cfdf9951fd9fb22e36f4cbd1bf8c5d2f33c9`.
- Benchmark commit that produced the reports in this directory:
  `a25309af7add303a063b152ccb9b4a6d733626bc`.

## Official execution

Three distinct full-matrix Linux x86_64 A/A runs (36417480021, 36417488341,
36417496140) → threshold freeze from those three only (36420155360,
`frozenAt` 2026-09-28T12:11:02.090Z) → full-matrix candidate measurement
against the frozen thresholds (36420243909) → distribution-size collection
(36422218812). `transientRetryLimit: 2` (added after this plan's first
dispatch attempts; see `docs/decisions/2026-09-28-retry-transient-pii-profile-cost-adapter-launches.md`)
consumed zero retries across all 80 candidate cells in the run that produced
this evidence.

Six prior official dispatch attempts across this plan's history failed
before producing a usable report — three at an unhandled `EPIPE` race in
`cli-sample.mjs`'s stdin write, later attempts at two further dormant bugs
in the never-before-exercised `candidate` and `size` phases (a missing `-R`
on a `gh run download` call, and a missing JSON import attribute). All three
are fixed and re-frozen on `develop`; none is a measurement-methodology
change, so nothing here reflects a tuned or adjusted threshold.

## Candidate measurement result (`pii-profile-cost-candidate-v1.json`)

80 cells (6 surfaces × credential profile × PII profile × workload,
typed-N/A where a surface has no `common` profile or no incremental API).
Overall verdict: **`regression`** (any cell regressing sets the whole
report's verdict; see the plan's guardrails — this never collapses to one
score, `evaluation[]` carries every cell's own verdict independently).

Per-surface breakdown of the 640 timing/memory metric evaluations:

| surface | regression | within-budget | not-applicable |
| --- | --- | --- | --- |
| rust-native | 38 | 42 | 16 |
| node-native | 32 | 96 | 32 |
| node-wasm | 39 | 89 | 32 |
| chromium-wasm | 28 | 52 | 32 |
| python | 16 | 48 | 0 |
| cli | 8 | 16 | 24 |

161 regression / 343 within-budget / 136 not-applicable / 0 invalid-measurement
overall. Enabling a PII profile measurably slows whole-input and incremental
scanning across every surface that has a comparable baseline; `rust-native`
shows the largest relative slowdowns (whole-input latency roughly 5.9-6.5x
baseline on the `global` profile against the `validator-heavy` and
`multilingual-context` workloads — see `evaluation[]` for exact per-cell
ratios). `python` and `cli` (`credentialProfiles: ["full"]` only, no
`common` comparison) show smaller but still real regressions.

## Distribution-size result (`pii-profile-cost-size-v1.json`)

65 tracked artifacts (native CLI binaries per target triple, node-addon and
node-wasm npm package files, WASM raw/gzip/brotli payloads, browser consumer
bundles for both `full` and `common` profiles) compared between the
distribution baseline and the candidate build. 40 of 65 exceed the `#143`
reviewed regression-budget threshold (5% relative, 16KB absolute floor);
25 are within budget. Native CLI binaries grow roughly 31-53% across every
target triple (`qualificationArtifacts[]`), driven by the beta.10 PII
detector and validator additions landing in every build regardless of
whether a PII profile is later activated at runtime — a fixed distribution
cost distinct from the activation-time cost the candidate report measures.

## Threshold artifact (`pii-profile-cost-thresholds-v1.json`)

640 cells, frozen from the three A/A runs above per the plan's `#143`
ABBA/interleaved noise-derivation procedure, before any candidate
measurement ran. No threshold in this file was adjusted after seeing
candidate output.

## Guardrails honored

- No credentials+PII combined cost figure anywhere in these reports; every
  rate/delta names its own surface, profile, and workload.
- `several-jurisdictions` remains `not-applicable:no-second-registered-jurisdiction`
  per the plan (`beta10-full` and `us-jurisdiction` carry an explicit
  `equivalentProfileOf` relation, not an invented independent comparison).
- Every unsupported metric (e.g. `common` profile on `python`/`cli`,
  incremental API on `chromium-wasm`'s comparable surfaces, browser
  retained-heap on some paths) is typed `not-applicable` with a reason code,
  never coerced to zero or omitted.
- `assertPiiProfileCostPublicEvidenceSafe` passed on both the candidate and
  size reports before they were written; no raw fixture content, only
  commitments and aggregate metrics.
