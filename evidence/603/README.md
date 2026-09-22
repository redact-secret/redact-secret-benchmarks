# Evidence: redact-secret#603 — DS11, own performance evaluation and recalibrate Linux x86_64 thresholds

**Result:** PASS. `benchmarks/performance-criteria.json`, derived mechanically
from this run, evaluates this same run as **ACCEPTED** with all 46 timing,
throughput, and observable-memory checks passing (by construction: the
thresholds are 2x/0.5x/2.5x this run's own p95, minimum, and maximum
observations).

Full derivation rule and rationale are in
[`docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md`](../../docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md)
and `docs/specs/performance-acceptance.md`. This file exists so a permalink
to it, plus the one-line result above, is everything the core repository's
own evidence archive needs to keep — per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (measured) | `944341903d5b85686a056d3218f4c33110d7d57b` — the commit core's own (now superseded) `assessment/acceptance-criteria-linux-x64.json` last re-pinned its `baseline` identity to, committed under core's `assessment/results/complete-linux-x64-v4/`. |
| `redact-secret-benchmarks` | `main` HEAD at the time `benchmarks/performance-criteria.json` was derived (see that file's own `baseline` block for the exact identity fields checked against a fresh run). |

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

The raw evidence (`summary.json`, alongside this README) was core's own
`ubuntu-latest` CI run of:

```sh
npm run assessment:all -- --python .venv/bin/python --runs 5 --output-dir assessment-output
```

Recalibrating this repository's own criteria from it:

```sh
npm run performance:criteria -- --summary evidence/603/summary.json
npm run performance:schema:check
```

Evaluating a fresh candidate run against the recalibrated criteria (as
`.github/workflows/performance-evaluation.yml` does in CI, after checking out
core at `benchmarks/pin-manifest.json`'s `pins.redactSecretRevision` and
running the same `assessment:all` command against that pinned commit):

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

> Performance-evaluation ownership intake: PASS. Recalibrated Linux x86_64
> criteria evaluate their own release-build baseline as ACCEPTED (46/46
> checks). Full evidence:
> `https://github.com/redact-secret/redact-secret-benchmarks/blob/<40-hex main commit>/evidence/603/README.md`.
