# Beta.11 #380: unit-safe diagnostics, first run (published and candidate)

**Result:** the first unit-diagnostics runs over the pinned credential corpus
(identity `fe9697fe…0510`, 31 categories) reproduce every v4 count and show one
thing v4 cannot: **a `warn` finding is full v4 detection but leaves the secret in
the output.** Candidate `9ab0fa02` (product `main`) detects all 1,013
`must-redact` T1/T2 spans (0 v4 leaks), yet 12 of them (7 T1, 5 T2; 468 bytes)
remain readable in its actual `scanAndRedact` output, every one `warn`-only.
No run hit a failure state (0 scan errors, 0 unstable, 0 unverified outputs).

These are diagnostics. The v4 headline (leaked-span rate, leaked-byte rate,
collateral ratio, false-alarm rate) is unchanged and authoritative. See
[`docs/specs/unit-diagnostics.md`](../specs/unit-diagnostics.md).

## Runs

| | Published | Candidate |
| --- | --- | --- |
| Product | `@redact-secret/core@0.1.0-beta.9` (package-lock pin, lock SHA-256 `97692c4c…5aec`) | `redact-secret` `9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7` (`0.1.0-beta.10`), built by product `npm run benchmark:candidate` |
| Artifacts | npm registry | core `4c1a81b0a96e9d3343a696a7d2e60e9080ed95ccff20ec9acbe140619324aebf`, node-darwin-arm64 `42dbcd321ac3171eaa2b6b9710d4e1593da340da95ffcc4ca27c15c82df2e5aa`, wasm `5508eec4473b30aba98c967b8fd31c677280db9dd506e680e206bdef085fea0c` |
| Corpus | `fe9697fe197d9ac36d0743d0fe5360b69164fc3017dafbc471336939fd1b0510`, pinned by `benchmarks/pin-manifest.json` @ `99a76816` | same |
| Benchmark revision | `39f21327fbeb524de91ed458541c2c3e6d3e2e7b` (clean) | same |
| Report digest | `09c8f6efcf92d7f13d1fbd90602786d193c2fc0b910705fd68b2e0c7acdc7fa3` | `5adcbfc48ff20028591827f2522a184249f7e3be72acec0a6b52073d37e1613a` |
| Machine report | [`…-published.json`](2026-09-28-beta11-380-unit-diagnostics-published.json) | [`…-candidate.json`](2026-09-28-beta11-380-unit-diagnostics-candidate.json) |
| Human report | [`…-published.md`](2026-09-28-beta11-380-unit-diagnostics-published.md) | [`…-candidate.md`](2026-09-28-beta11-380-unit-diagnostics-candidate.md) |

Peers are not part of this report (sanitized output is a product property).
Both digests reproduced on a second run, and the published digest is the same
from two different benchmark commits. The candidate artifacts' own
`benchmark:candidate` evaluation ran at benchmark `develop`
`0a73b7db198c628dde74fb815d3029eb6c0acf42` with trufflehog 3.97.4 (status
`complete`); its `candidate-evidence-v1.json` is not committed here.

## Secret-span units (`must-redact`, `policy`)

| Segment | Mode | Spans | MISS (v4 leak) | Output: removed | Output: leaked | of which `warn`-only | Output leaked bytes (v4 leaked bytes) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| must-redact/T1, family | published | 563 | 40 | 516 | 47 | 7 | 15,319 (15,039) |
| must-redact/T1, family | candidate | 563 | 0 | 556 | 7 | 7 | 280 (0) |
| must-redact/T2, family | published | 450 | 16 | 429 | 21 | 5 | 917 (729) |
| must-redact/T2, family | candidate | 450 | 0 | 445 | 5 | 5 | 188 (0) |
| policy/T3, family | published | 380 | 20 | 324 | 56 | 36 | 2,124 (744) |
| policy/T3, family | candidate | 380 | 4 | 335 | 45 | 41 | 1,724 (152) |
| policy/T3, uncontracted | published | 44 | 0 | 40 | 4 | 4 | 48 (0) |
| policy/T3, uncontracted | candidate | 44 | 0 | 40 | 4 | 4 | 48 (0) |

No span was partially leaked, and no out-of-envelope finding or output
collateral occurred in any positive file in either run. Candidate `warn`-only
leaks in `must-redact`: `new-relic-license-key` (7, T1), `mailchimp-api-key`
(2), `mailgun-api-key` (2), `okta-api-token` (1). These are product policy
actions, not detector misses; whether a documented credential should be `warn`
is a product question this report only makes visible.

## File units (`must-not-flag`)

| Segment | Mode | Files | Clean | Flagged `warn` only | Flagged `redact`/`block` | v4 flagged (twin-scoped) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| T1, family | both | 9 | 9 | 0 | 0 | 0 |
| T2, family | published | 1,197 | 1,064 | 6 | 127 | 1 |
| T2, family | candidate | 1,197 | 1,042 | 6 | 149 | 1 |
| T2, global untargeted | both | 14 | 14 | 0 | 0 | 0 |
| T3, family | published | 723 | 692 | 1 | 30 | 10 |
| T3, family | candidate | 723 | 695 | 1 | 27 | 2 |
| T3, global untargeted | both | 111 | 111 | 0 | 0 | 0 |

Every flagged family control in both runs was flagged only by *another* known
family (`other-family-only`), never by its own contract's family. v4 reads a
twin flagged that way as co-detection, which is why its false-alarm count is
far lower than the any-flag file count; both readings are in the report.

## Reproduce

```sh
export PATH=<dir with trufflehog 3.97.4>:$PATH   # only needed for benchmark:candidate
npm run eval:diagnostics -- --out=docs/reports/2026-09-28-beta11-380-unit-diagnostics-published
npm run eval:diagnostics -- --out=docs/reports/2026-09-28-beta11-380-unit-diagnostics-candidate \
  --candidate-package=<dir>/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=9ab0fa02f2aeeda16a2c99e04862ebb0f0e9b5e7
npm run eval:diagnostics:validate -- docs/reports/2026-09-28-beta11-380-unit-diagnostics-*.json
npm run eval:diagnostics -- --check=docs/reports/2026-09-28-beta11-380-unit-diagnostics-published.json
```

The candidate tarballs come from product `npm run benchmark:candidate --
--benchmark-ref <40-hex> --output-dir <dir>` at product `9ab0fa02`
(`<dir>/artifacts/`); their SHA-256s above identify them.

When #379's fixtures land, the corpus identity changes and `--check` reports
these files as stale; regenerate both rather than editing them.
