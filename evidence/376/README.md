# Evidence: redact-secret#376 — beta.5 candidate precision gate

**Result:** PASS. Fixed-corpus twin false alarms 24 → 0 (56/56 discrimination
target met); 0 required-positive misses (T1/T2) in either corpus, before or
after.

Full narrative, per-issue fixture mapping, policy-change table, anomalies,
and the closing published-package re-measurement are in
[`docs/reports/beta-5/results.md`](../../docs/reports/beta-5/results.md).
This file exists so a permalink to it, plus the one-line result above, is
everything the core repository's own evidence archive needs to keep — per
[`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (candidate under test) | `a637ac1c156a05630243185a6adccadc28f5a1ab`, clean at measurement time |
| `redact-secret-benchmarks` | `c1f777ae20bb38c105a615ffa28005f64d4d6596`, clean, `main` HEAD at measurement time |

## Pinned scanner versions

Candidate-only run — no peer-scanner comparison. `eval:candidate` measures a
single locally built `redact-secret` artifact against this repository's
frozen expectations; it does not invoke Gitleaks or TruffleHog.

- `redact-secret-candidate` — package artifact SHA-256
  `1245d813d665994bc352e87e5a1a730369104dde3c42896c89dec69df8d62677`, node
  artifact SHA-256 `87c32b382e10fbac9e5f309393ddd0b1d17b3bb16395996acbde0efb95fdaf37`,
  wasm artifact SHA-256 `891fde4fbaf20eea52ca8c86e9358dc4dd0f40a0713083c14bd4bff0491d4e75`,
  default detectors, isolated npm-tarball install with overrides.
- Corpus hash `c896dc80d571ae8dbb2dbe567468b825cf0152711c4bb59f7645644de6520e1f`.
- Run ID `808cd7dd-b356-4bdf-9521-9045b4893900`, status `complete`, 612/612
  fixtures scanned, 0 failures.

## Command

```sh
npm run benchmark:candidate -- \
  --benchmark-ref c1f777ae20bb38c105a615ffa28005f64d4d6596 \
  --benchmark-repo /absolute/path/to/redact-secret-benchmarks
```

## Core-side stub (for reference — authored in `redact-secret`, not here)

What `redact-secret/redact-secret`'s own `docs/audits/evidence/376/` keeps,
per this repository's [evidence decision](../../docs/specs/decisions/2026-09-22-store-benchmark-evidence-per-core-issue.md):

> Benchmark gate: PASS. Fixed-corpus twin false alarms 24 → 0 (56/56
> discrimination); 0 required-positive misses. Full evidence:
> `https://github.com/redact-secret/redact-secret-benchmarks/blob/<40-hex main commit>/evidence/376/README.md`.
