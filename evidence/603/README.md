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
[`docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md`](../../docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md)
and [`docs/decisions/2026-09-23-run-the-performance-evaluation-for-real.md`](../../docs/decisions/2026-09-23-run-the-performance-evaluation-for-real.md)
(the #150 follow-up) and `docs/specs/performance-acceptance.md`. This file
exists so a permalink to it, plus the one-line result above, is everything
the core repository's own evidence archive needs to keep — per
[`evidence/README.md`](../README.md).

## Later runs at a newer pin

The registry pin moved again to product `main` `065ec76` (Mailgun, the Datadog
application-key split, Okta). The same workflow at that commit evaluated
**REJECTED** twice against the criteria this file's run produced; those runs
and the numbers are recorded in [`evidence/683/README.md`](../683/README.md)
(redact-secret#683). The criteria were deliberately **not** re-derived from
them, so `baseline.sourceCommit` here stays `41fc366` while the pin is
`065ec76`, and `npm run pins:check` reports that mismatch until the product
decides.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (measured) | `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1` (product `main`, unreleased; the registry pin after the post-beta.6 refresh) — the commit `benchmarks/pin-manifest.json`'s `pins.redactSecretRevision` names at measurement time. The published npm package this repository scores accuracy against stays 0.1.0-beta.6 (`079095e`). |
| `redact-secret-benchmarks` | `0c0825a9d70f64b3bccaac89472798ea3abd6271` (branch `milocosmopolitan/new-detectors-fixture`, the registry-refresh commit) at measurement time — the workflow ref this run was dispatched against and the criteria file it evaluated `summary.json` with. |

## Pinned scanner versions

Not a scanner-comparison run. `summary.json` is core's own cross-language
`CompleteAssessment` output: five real, release-build artifacts (Rust core,
Python, Node, browser WebAssembly, CLI) measured against core's shared
accuracy corpus (version `3`, hash
`438df062ddde47dcb32ae0aefc4297ed8b8c9e2c3270778c2b1f8809e40bd0dd`) and
workload profiles (version `1`, hash
`b4db2cd22b4c008c9d63789df8ca2e21e697a21a84699466ea5f96c89d8e2806`) — no
Gitleaks or TruffleHog comparison. Every result in `summary.json` carries its
own `provenance.artifactIdentity`, `provenance.runtime`, and (for `rust-core`)
`provenance.buildProfile: "release"`.

## Command

The raw evidence (`summary.json`, `acceptance.json`, `acceptance.md`,
alongside this README) is this repository's own `ubuntu-latest` CI run:
[`performance-evaluation` run 35868842776](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35868842776),
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
[evidence decision](../../docs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md):

> Performance-evaluation ownership intake: PASS. A real CI execution of the
> pinned core revision evaluated ACCEPTED (46/46 checks) against criteria
> fixed before that run. Full evidence:
> `https://github.com/redact-secret/redact-secret-benchmarks/blob/<40-hex main commit>/evidence/603/README.md`.
