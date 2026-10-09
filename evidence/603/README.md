# Evidence: redact-secret#603 — DS11, own performance evaluation and recalibrate Linux x86_64 thresholds

**Result:** PASS. A real `.github/workflows/performance-evaluation.yml`
execution against the exact commit `benchmarks/pin-manifest.json` pins
(`41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`, product `main` after the
post-beta.6 detector families landed) evaluated **ACCEPTED**, all 46 timing,
throughput, and observable-memory checks passing, against
`benchmarks/performance-criteria.json` as it stood at measurement time —
thresholds derived from the previous pin's own release-build run
(`079095e766e4a71e2b7e29413ed17be37bb3315d`, beta.6; run 35861463332, which
had itself evaluated ACCEPTED against the beta.4-derived thresholds before
it). This is a genuine, non-circular verdict: the thresholds it was checked
against were fixed before, and independently of, this run.

The pin moved because `benchmarks/detectors.json` was refreshed to the first
product commit carrying every family from redact-secret#308–#313; #150's
rule that the evaluated core revision must match the pin manifest
(`npm run pins:check`) is what required this re-run.

This same run's `summary.json` (committed here, replacing the beta.4 one) was
then used to recalibrate `benchmarks/performance-criteria.json` for future
evaluations, so its `baseline.sourceCommit` now matches the current pin. That
recalibration is not itself re-claimed as a verification: any mechanically
derived-with-margin threshold necessarily accepts the run it was computed
from, so this README does not report "the new criteria pass" as a finding —
see [redact-secret-benchmarks#150](https://github.com/redact-secret/redact-secret-benchmarks/issues/150),
which retired that framing.

Full derivation rule and rationale are in
[`docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md)
and [`docs/decisions/2026-09-23-run-the-performance-evaluation-for-real.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-23-run-the-performance-evaluation-for-real.md)
(the #150 follow-up) and `docs/specs/performance-acceptance.md`. This file
exists so a permalink to it, plus the one-line result above, is everything
the core repository's own evidence archive needs to keep — per
[`evidence/README.md`](../README.md).

## Later runs at newer pins

Product `main` `065ec76` (Mailgun, the Datadog application-key split, Okta)
evaluated **REJECTED** twice against the criteria the `41fc366` run produced
([`evidence/683/README.md`](../683/README.md), redact-secret#683); the
criteria were deliberately not re-derived from those runs. Product
[#684](https://github.com/redact-secret/redact-secret/pull/684) fixed the
regression, and product `main` `15fce66e7c2d45003d7c6e31a341e5bc875a7326`
then evaluated **ACCEPTED**, 46/46, against those same unchanged `41fc366`
criteria (run 35878900954). After the #709 detector changes, product `main`
`fdca511d5a161202deebfd5906b17d7218ef9b2c` evaluated **ACCEPTED** against the
`15fce66` criteria ([run 35934055036](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35934055036)).
Published `0.1.0-beta.7` core `2b98027bbf38d63f07b75129fe2864ef32ed4732` then
evaluated **ACCEPTED** against the `fdca511` criteria
([run 35994341768](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35994341768)).
That run's `summary.json`, `acceptance.json` and `acceptance.md` are what this
directory now holds, and `benchmarks/performance-criteria.json` was
recalibrated from it, so `baseline.sourceCommit` matches the pin. The earlier
`fdca511` run
([35934055036](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35934055036))
and the `41fc366` run (35868842776) are superseded here; its verdict is still recorded
above and in the decision records.


### Verified at `0c62fd3`, not re-derived (published 0.1.0-beta.14)

Product `main` `0c62fd38bca75c5b28b042dc79789b708ebf1d17` is the release source
of `0.1.0-beta.14` (tag `v0.1.0-beta.14`) and the commit measured as the Beta.14
candidate (run 37552333458, size rows accepted in #803). The 118-detector
registry is the one pinned at `3b1a5aa`, so `detectors.json` moves its
`sourceRevision` only.
[Run 37611533005](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37611533005)
(`performance-evaluation.yml` on `feat/808-published-beta14-repin`, candidate
`0c62fd3`, 14 interleaved rounds) reads **ACCEPTED** on both verdicts: RC
acceptance against the unchanged criteria, and the regression budgets read
latency 10/10, initialization 9/10, memory 16/16 within budget, with four
accepted tradeoffs (three size rows and one initialization ratio, 1.2857 against
the 1.25 limit), no regression and no invalid measurement. Runner: AMD EPYC 7763,
4 logical CPUs, image `ubuntu24 20260927.320.1`.

The four rows are the `beta14-0c62fd3-*` entries accepted in #803 for this same
commit; no entry was added or changed:

| Trigger | Baseline (0.1.0-beta.8) | Measured at 0c62fd3 | Change | Entry |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 235,713 | +71.3% | `beta14-0c62fd3-wasm-full-gzip` |
| `size/wasm/common/gzip` | 100,058 | 168,891 | +68.8% | `beta14-0c62fd3-wasm-common-gzip` |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 244,931 | +69.5% | `beta14-0c62fd3-quickstart-bundle-gzip` |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` | 1 | 1.2857 | +28.6% | `beta14-0c62fd3-browser-wasm-scale-logs-small-whole-init-ratio` |

The thresholds are not re-derived. The run is frozen in
[`verified-0c62fd3/`](verified-0c62fd3/) and advances only
`baseline.verifiedCommit`.

Reproduce: dispatch `performance-evaluation.yml` with
`candidate_revision=0c62fd38bca75c5b28b042dc79789b708ebf1d17` and `rounds=14`; the
artifact is `performance-evaluation-0c62fd38bca75c5b28b042dc79789b708ebf1d17`.

### Verified at `66b492b`, not re-derived (published 0.1.0-beta.13)

Product `main` `66b492bdff5e6751fc6b5409266916346ed7c723` is the release source
of `0.1.0-beta.13` (tag `v0.1.0-beta.13`). Against the measured candidate
`401158d` it changes only files under `docs/`, and `detectors/mod.rs` has not
changed since `4227160`, so `detectors.json` moves its `sourceRevision` only.
[Run 37118767833](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37118767833)
(`performance-evaluation.yml` on `workbench/repin-beta13-published`, candidate
`66b492b`, 14 interleaved rounds) reads **ACCEPTED** on both verdicts: RC
acceptance against the unchanged criteria, and the regression budgets read
latency 10/10, initialization 10/10, memory 16/16 within budget, with three
accepted tradeoffs, no regression and no invalid measurement. Runner: AMD EPYC
9V74, 4 logical CPUs, image `ubuntu24 20260927.320.1`. An earlier 6-round run on
`develop` (37118371501) read the same sizes as `regression` only because the
entries below were not yet on that ref; it is not frozen.

The three size rows are the Beta.13 growth accepted at candidate `401158d`,
re-keyed to this commit through the `beta13-66b492b-*` entries in
`benchmarks/accepted-regressions.json` (byte-identical measured values):

| Trigger | Baseline (0.1.0-beta.8) | Measured at 66b492b | Change | Entry |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 206,697 | +50.2% | `beta13-66b492b-wasm-full-gzip` |
| `size/wasm/common/gzip` | 100,058 | 142,866 | +42.8% | `beta13-66b492b-wasm-common-gzip` |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 214,214 | +48.2% | `beta13-66b492b-quickstart-bundle-gzip` |

The thresholds are not re-derived. The run is frozen in
[`verified-66b492b/`](verified-66b492b/) and advances only
`baseline.verifiedCommit`.

Reproduce: dispatch `performance-evaluation.yml` with
`candidate_revision=66b492bdff5e6751fc6b5409266916346ed7c723` and `rounds=14`; the
artifact is `performance-evaluation-66b492bdff5e6751fc6b5409266916346ed7c723`.

### Verified at `4227160`, not re-derived (published 0.1.0-beta.12)

Product `main` `4227160c4dac402d7add53d3f8fe990f693912c1` is the release source
of `0.1.0-beta.12` (tag `v0.1.0-beta.12`). Against `bfc608c` it changes no file
under `crates/`: the diff is the version strings, the changelog and readiness
docs, the contract review and the refreshed support matrix. The registry list is
unchanged, so `detectors.json` moves its `sourceRevision` only.
[Run 36817086580](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36817086580)
(`performance-evaluation.yml`, candidate `4227160`, 14 interleaved rounds) reads
**ACCEPTED** on both verdicts: RC acceptance passed all 46 checks against the
unchanged criteria, and the regression budgets read latency 10/10,
initialization 10/10, memory 16/16 within budget, with three accepted
tradeoffs, no regression and no invalid measurement. Runner: AMD EPYC 9V74, 4
logical CPUs, image `ubuntu24 20260927.320.1`.

The three size rows are the same Beta.12 growth accepted at `bfc608c`
(maintainer's 2026-09-30 option A decision, redact-secret-benchmarks#587),
re-keyed to this commit through the `beta12-4227160-*` entries in
`benchmarks/accepted-regressions.json`:

| Trigger | Baseline (0.1.0-beta.8) | Measured at 4227160 | Change | Entry |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 205,059 | +49.0% | `beta12-4227160-wasm-full-gzip` |
| `size/wasm/common/gzip` | 100,058 | 142,515 | +42.4% | `beta12-4227160-wasm-common-gzip` |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 212,502 | +47.1% | `beta12-4227160-quickstart-bundle-gzip` |

The thresholds are not re-derived. The run is frozen in
[`verified-4227160/`](verified-4227160/) and advances only
`baseline.verifiedCommit`. Its `acceptance.json`/`.md` name the workflow's
fixed summary label; the summary it evaluated is
`verified-4227160/summary.json`.

Reproduce: dispatch `performance-evaluation.yml` on `develop` with
`candidate_revision=4227160c4dac402d7add53d3f8fe990f693912c1`; the artifact is
`performance-evaluation-4227160c4dac402d7add53d3f8fe990f693912c1`.

### Verified at `bfc608c`, not re-derived (Beta.12 performance work)

Product `main` `bfc608cce75f79f6a5cab037d7e558ba629777f6` follows `da69ebf`
with the Beta.12 performance work (the `*_in` lookback retention hints,
redact-secret#1060 and #1074). Its `detectors/mod.rs` changed only re-exports
and lookback helpers; the registry list is unchanged, so `detectors.json` is
not regenerated.
[Run 36788351912](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36788351912)
(`performance-evaluation.yml` dispatched on `docs/dossiers-1012-1013-1014`,
candidate `bfc608c`) reads **ACCEPTED** on both verdicts: RC acceptance
ACCEPTED against the unchanged criteria, and the regression budgets read
latency 10/10, initialization 10/10, memory 16/16 within budget, with three
accepted tradeoffs, no regression and no invalid measurement.

The three size rows are accepted under the maintainer's 2026-09-30 option A
decision, extended to the Beta.12 performance work, through the
`beta12-bfc608c-*` entries in `benchmarks/accepted-regressions.json`
(commit `c2871006`, bound to `bfc608c` only):

| Trigger | Baseline (0.1.0-beta.8) | Measured at bfc608c | Change | Entry |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 205,068 | +49.0% | `beta12-bfc608c-wasm-full-gzip` |
| `size/wasm/common/gzip` | 100,058 | 142,525 | +42.4% | `beta12-bfc608c-wasm-common-gzip` |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 212,515 | +47.1% | `beta12-bfc608c-quickstart-bundle-gzip` |

The thresholds are not re-derived. The run is frozen in
[`verified-bfc608c/`](verified-bfc608c/) and advances only
`baseline.verifiedCommit`. Its `acceptance.json`/`.md` name the workflow's
fixed summary label; the summary it evaluated is
`verified-bfc608c/summary.json`.

### Verified at `0af4cb8`, not re-derived (redact-secret#846)

Product `main` `0af4cb83b571baa86d27a678a351ece2ebc1f3cb` carries
redact-secret#846 (`2fe3275`), the only change to `detectors/` after
`192c964` (`generic_token.rs` only; `detectors/mod.rs` unchanged, so the
registry list is unchanged). Redact-secret-benchmarks#324 tracked the pin.
[Run 36214273900](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36214273900)
(`performance-evaluation.yml` at benchmarks `75c1a2b47b37e17feb544b6053a36d242083f20f`,
candidate `0af4cb8`, baseline `3144bb3` restored from the build cache) reads
**ACCEPTED** on both verdicts: RC acceptance passed all 46 checks against the
unchanged `3144bb3` criteria (accuracy TP 21, FP 1, FN 5, policy mismatches 0
on both sides), and the regression budgets read latency 10/10,
initialization 10/10, memory 16/16 within budget, with no regression,
tradeoff or invalid measurement. Runner: AMD EPYC 9V74, 4 logical CPUs, image
`ubuntu24 20260920.314.1`; 6 interleaved rounds, 12 samples per side.

The thresholds are not re-derived. The run is frozen in
[`verified-0af4cb8/`](verified-0af4cb8/) and advances only
`baseline.verifiedCommit`. As before, its `acceptance.json`/`.md` name the
workflow's fixed summary label; the summary it evaluated is
`verified-0af4cb8/summary.json`.

Reproduce: dispatch `performance-evaluation.yml` on `develop` with
`candidate_revision=0af4cb83b571baa86d27a678a351ece2ebc1f3cb`; the artifact is
`performance-evaluation-0af4cb83b571baa86d27a678a351ece2ebc1f3cb`.

### Verified at `192c964`, not re-derived (detector fixes #831–#838)

Product `main` `192c9649deb88e342abc8071fb78e7b1d84ec475` changed
`detectors/bearer_token.rs`, `connection_string.rs` and `generic_token.rs`
(the beta.9 adversarial-pack fixes, redact-secret#831–#838) with no registry
change in `detectors/mod.rs`, so the pin moved.
[Run 36197119563](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36197119563)
(`performance-evaluation.yml` at benchmarks `3fd1e545dc92747f118a8a024cd9364c06f36c40`,
candidate `192c964`, baseline `3144bb3` built in the same job) reads
**ACCEPTED** on both verdicts: RC acceptance passed all 46 timing, throughput,
memory and accuracy-count checks against the unchanged `3144bb3` criteria
(accuracy corpus version `3`, hash `ca96dddd…`; TP 21, FP 1, FN 5, policy
mismatches 0 on both sides), and the regression budgets read latency 10/10,
initialization 10/10, memory 16/16 within budget, with no regression, tradeoff
or invalid measurement. Runner: AMD EPYC 7763, 4 logical CPUs, image
`ubuntu24 20260920.314.1`; 6 interleaved rounds, 12 samples per side.

Per
[`decision-decouple-pin-freshness-from-pin-consistency`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-23-decouple-pin-freshness-from-pin-consistency.md),
this ACCEPTED run does not re-derive thresholds. `summary.json` here still
holds the `3144bb3` run the thresholds came from; the `192c964` run is frozen
in [`verified-192c964/`](verified-192c964/) and advances only
`benchmarks/performance-criteria.json` `baseline.verifiedCommit`.
Its `acceptance.json`/`.md` name `evidence/603/summary.json` as the summary
path because that is the workflow's fixed label; the summary it evaluated is
`verified-192c964/summary.json`.

Reproduce: dispatch `performance-evaluation.yml` on `develop` with
`candidate_revision=192c9649deb88e342abc8071fb78e7b1d84ec475` (baseline
defaults to the regression budgets' `3144bb3`); the artifact is
`performance-evaluation-192c9649deb88e342abc8071fb78e7b1d84ec475`.

### Re-derived at `3144bb3` (#259 registry re-pin)

The registry pin moved to product `main`
`3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c` (redact-secret#773: the
`travisci-api-token`, `neon-api-key` and `postman-collection-access-key`
detectors and the Mailgun key triplet), so #150 required a new run.
[Run 36078460497](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36078460497)
reads **ACCEPTED**: it passed all 46 timing, throughput, memory and
accuracy-count checks against the `f2082ab` criteria, with the accuracy corpus
unchanged (version `3`, hash `ca96dddd…`). Its `summary.json`,
`acceptance.json` and `acceptance.md` replace the `f2082ab` ones here, and
`benchmarks/performance-criteria.json` was re-derived from it
(`baseline.sourceCommit` `3144bb3`).

### Re-derived at `f2082ab` (#762 accuracy-corpus change)

The registry pin moved to product `main`
`f2082ab6fe1d0fc8cc703e371e9203bc4ff68f6b` (the #727–#730 Beta.8 detector
families, PRs #759, #760, #761, #763), so #150 required a new run.
[Run 36052694026](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36052694026)
passed all 46 timing, throughput, memory and accuracy-count checks against the
`2b98027` criteria. It read **REJECTED** only on
`suite:accuracy-corpus-identity-mismatch`. Product #762 (`be7b870`)
intentionally re-pinned the shared accuracy corpus's Supabase value to the
documented layout. It is the only commit touching
`assessment/fixtures/accuracy-corpus.json` since `2b98027`, and it moved the
corpus hash from `438df062…` to `ca96dddd…` (version still `3`). Accuracy
counts are unchanged on every surface: TP 21, FP 1, FN 5, policy mismatches 0.
Because that failure is the intended corpus change and nothing else failed,
this run's `summary.json`, `acceptance.json` and `acceptance.md` replace the
`2b98027` ones here, and `benchmarks/performance-criteria.json` was re-derived
from it (`baseline.sourceCommit` `f2082ab`, corpus hash `ca96dddd…`).

A run at the intermediate pin `bc96046`
([36044771153](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36044771153))
was rejected on the same identity check plus one browser-wasm
`scale-logs-medium-fixed4096` initialization p95 (74 ms against a 35 ms limit).
No criteria were derived from it, and the `f2082ab` run passed that check.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (measured) | `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c` (product `main`; the registry pin), evaluated against the `f2082ab` criteria (run 36078460497). Before it, `f2082ab6fe1d0fc8cc703e371e9203bc4ff68f6b` (product `main`) was evaluated against the `2b98027` criteria (run 36052694026). Before it, `2b98027bbf38d63f07b75129fe2864ef32ed4732` (published `0.1.0-beta.7`) was evaluated against the `fdca511` criteria (run 35994341768). Before it, `fdca511d5a161202deebfd5906b17d7218ef9b2c` (product `main` after #709) supplied the criteria, and before that `15fce66e7c2d45003d7c6e31a341e5bc875a7326` (after #684) supplied the criteria before that. The earlier `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1` run supplied the criteria this one was checked against — the commit `benchmarks/pin-manifest.json`'s `pins.redactSecretRevision` names at measurement time. The published npm package this repository scores accuracy against stays 0.1.0-beta.6 (`079095e`). |
| `redact-secret-benchmarks` | `beta8/core-closeout-arrival-families` at `282bb37`, the registry re-pin commit at measurement time — the workflow ref this run was dispatched against and the criteria file it evaluated `summary.json` with. |

## Pinned scanner versions

Not a scanner-comparison run. `summary.json` is core's own cross-language
`CompleteAssessment` output: five real, release-build artifacts (Rust core,
Python, Node, browser WebAssembly, CLI) measured against core's shared
accuracy corpus (version `3`, hash
`ca96dddd9cb189e83db6cde203060e559f116670f823dd9631c3850aed4892d0`) and
workload profiles (version `1`, hash
`b4db2cd22b4c008c9d63789df8ca2e21e697a21a84699466ea5f96c89d8e2806`) — no
Gitleaks or TruffleHog comparison. Every result in `summary.json` carries its
own `provenance.artifactIdentity`, `provenance.runtime`, and (for `rust-core`)
`provenance.buildProfile: "release"`.

## Command

The raw evidence (`summary.json`, `acceptance.json`, `acceptance.md`,
alongside this README) is this repository's own `ubuntu-latest` CI run:
[`performance-evaluation` run 36078460497](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36078460497),
dispatched against the branch carrying the refreshed pin and reproducible by
anyone with:

```sh
gh workflow run performance-evaluation.yml --ref <branch or main carrying the pin>
```

The previous baseline at beta.6 (run 35861463332, the #150 intake) is
superseded by this file; its verdict remains recorded in
`docs/decisions/2026-09-23-run-the-performance-evaluation-for-real.md`.

which checks out core at `benchmarks/pin-manifest.json`'s
`pins.redactSecretRevision`, builds every surface's release artifact, and
runs:

```sh
npm run assessment:all -- --python .venv/bin/python --runs 5 --output-dir ../performance-output
```

then checks the result for core-schema drift, evaluates it against the
criteria committed on the dispatched ref, and uploads `summary.json`,
`acceptance.json`, and `acceptance.md` as a workflow artifact (see
`acceptance.md`, committed here, for every threshold check).

Recalibrating this repository's own criteria from this same `summary.json`,
for future runs:

```sh
npm run performance:criteria -- --summary evidence/603/summary.json
npm run performance:schema:check
npm run pins:check:local
```

Evaluating a fresh candidate run against the (now recalibrated) criteria
locally, the same way the workflow does in CI:

```sh
npm run performance:evaluate -- \
  --summary <path>/summary.json \
  --criteria benchmarks/performance-criteria.json \
  --json-out performance-output/acceptance.json \
  --markdown-out performance-output/acceptance.md
```

## Core-side stub (for reference — authored in `redact-secret`, not here)

What `redact-secret/redact-secret`'s own `docs/audits/evidence/603/` keeps,
per this repository's
[evidence decision](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md):

> Performance-evaluation ownership intake: PASS. A real CI execution of the
> pinned core revision evaluated ACCEPTED (46/46 checks) against criteria
> fixed before that run. Full evidence:
> `https://github.com/redact-secret/redact-secret-benchmarks/blob/<40-hex main commit>/evidence/603/README.md`.
