# Evidence: redact-secret#603 — DS11, own performance evaluation and recalibrate Linux x86_64 thresholds

**Result:** PASS. A real `.github/workflows/performance-evaluation.yml`
execution against the exact commit `benchmarks/pin-manifest.json` pins
(`079095e766e4a71e2b7e29413ed17be37bb3315d`, beta.6) evaluated **ACCEPTED**,
all 46 timing, throughput, and observable-memory checks passing, against
`benchmarks/performance-criteria.json` as it stood at measurement time —
thresholds derived from an earlier, unrelated run
(`944341903d5b85686a056d3218f4c33110d7d57b`, beta.4). This is a genuine,
non-circular verdict: the thresholds it was checked against were fixed
before, and independently of, this run.

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

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (measured) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6) — the commit `benchmarks/pin-manifest.json`'s `pins.redactSecretRevision` names at measurement time. |
| `redact-secret-benchmarks` | `main` HEAD (`4bd622d9a1b92f6c144ce8fb6a33df8fcd26337a`) at measurement time — the workflow ref this run was dispatched against and the criteria file it evaluated `summary.json` with. |

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
[`performance-evaluation` run 35861463332](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35861463332),
dispatched against `main` and reproducible by anyone with:

```sh
gh workflow run performance-evaluation.yml --ref main
```

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
