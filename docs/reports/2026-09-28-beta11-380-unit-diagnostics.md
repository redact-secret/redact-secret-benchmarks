# Beta.11 #380: unit-safe diagnostics (published and candidate)

**Result:** the unit-diagnostics runs over the pinned credential corpus
(identity `f06ddd6c…bd6d`, 31 categories, including #378's expanded untargeted
benign corpus) reproduce every v4 count and show one thing v4 cannot: **a `warn`
finding is full v4 detection but leaves the secret in the output.** Published
`@redact-secret/core@0.1.0-beta.10` and candidate `7720ae2a` (product `main`)
produce identical diagnostics. Both detect all 1,013 `must-redact` T1/T2 spans
(0 v4 leaks), yet 12 of them (7 T1, 5 T2; 468 bytes) remain readable in the
actual `scanAndRedact` output, every one `warn`-only. No run hit a failure state
(0 scan errors, 0 unstable, 0 unverified outputs).

These are diagnostics. The v4 headline (leaked-span rate, leaked-byte rate,
collateral ratio, false-alarm rate) is unchanged and authoritative. See
[`docs/specs/unit-diagnostics.md`](../specs/unit-diagnostics.md).

## Runs

| | Published | Candidate |
| --- | --- | --- |
| Product | `@redact-secret/core@0.1.0-beta.10` (package-lock pin, lock SHA-256 `14dbaa9e…3939`) | `redact-secret` `7720ae2a8d383c855a3051b53103657d22154411` (`0.1.0-beta.10`), built by product `npm run benchmark:candidate` |
| Artifacts | npm registry | core `4c1a81b0a96e9d3343a696a7d2e60e9080ed95ccff20ec9acbe140619324aebf`, node-darwin-arm64 `1aa6c90c96a9a281b5d3debddfaa59d1f42192e21b25ee185057d596abd889a6`, wasm `2ec369915fb414b1ef9c66420413b3448d2aa77637702dd2189df7f6791a326e` |
| Corpus | `f06ddd6cedf4f71477b2efb3dc5c13ca5f062ce1d33f9adc1b3e5472f96dbd6d`, pinned by `benchmarks/pin-manifest.json` @ `71d0d8c1` | same |
| Benchmark revision | `8576326c3aa201bd5b0d6d3a55a77ea326c89ddc` (clean) | same |
| Report digest | `69fdc148d022b97073e40e293edbbceea3153233822b5fc6097bb000119c6046` | `b79f280b9826d2ebece9307604a096e000890576ea4a024c5c092c8f0d2fdd2d` |
| Machine report | [`…-published.json`](2026-09-28-beta11-380-unit-diagnostics-published.json) | [`…-candidate.json`](2026-09-28-beta11-380-unit-diagnostics-candidate.json) |
| Human report | [`…-published.md`](2026-09-28-beta11-380-unit-diagnostics-published.md) | [`…-candidate.md`](2026-09-28-beta11-380-unit-diagnostics-candidate.md) |

Peers are not part of this report (sanitized output is a product property).
The published digest reproduced with `--check`. The candidate artifacts' own
`benchmark:candidate` evaluation ran at benchmark
`8576326c3aa201bd5b0d6d3a55a77ea326c89ddc` with trufflehog 3.97.4 (run
`fa99f029-1f1b-4554-90a3-ffb6d5f07224`, status `complete`, evidence validated);
its `candidate-evidence-v1.json` is not committed here.

**Regenerated on the Beta.11 batch-1 tree.** The first run of this report
measured published `0.1.0-beta.9` and candidate `9ab0fa02` over corpus
`fe9697fe…0510` (111 global untargeted T3 files). Develop has since pinned the
published `0.1.0-beta.10`, and #378 grew the untargeted corpus, so both reports
were regenerated rather than edited. The beta.10 pin removed every published
`none`-action leak in `must-redact` (published T1 MISS 40 to 0, T2 16 to 0;
policy/T3 MISS 20 to 4), which is why the published and candidate columns now
agree. The only change the corpus made is the new
`must-not-flag/T3|global-untargeted` row below (111 to 216 files).

## Secret-span units (`must-redact`, `policy`)

| Segment | Mode | Spans | MISS (v4 leak) | Output: removed | Output: leaked | of which `warn`-only | Output leaked bytes (v4 leaked bytes) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| must-redact/T1, family | both | 563 | 0 | 556 | 7 | 7 | 280 (0) |
| must-redact/T2, family | both | 450 | 0 | 445 | 5 | 5 | 188 (0) |
| policy/T3, family | both | 380 | 4 | 335 | 45 | 41 | 1,724 (152) |
| policy/T3, uncontracted | both | 44 | 0 | 40 | 4 | 4 | 48 (0) |

No span was partially leaked, and no out-of-envelope finding or output
collateral occurred in any positive file in either run. The `warn`-only
leaks in `must-redact`: `new-relic-license-key` (7, T1), `mailchimp-api-key`
(2), `mailgun-api-key` (2), `okta-api-token` (1). These are product policy
actions, not detector misses; whether a documented credential should be `warn`
is a product question this report only makes visible.

## File units (`must-not-flag`)

| Segment | Mode | Files | Clean | Flagged `warn` only | Flagged `redact`/`block` | v4 flagged (twin-scoped) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| T1, family | both | 9 | 9 | 0 | 0 | 0 |
| T2, family | both | 1,197 | 1,042 | 6 | 149 | 1 |
| T2, global untargeted | both | 14 | 14 | 0 | 0 | 0 |
| T3, family | both | 723 | 695 | 1 | 27 | 2 |
| T3, global untargeted | both | 216 | 208 | 1 | 7 | 8 |

Every flagged family control in both runs was flagged only by *another* known
family (`other-family-only`), never by its own contract's family. v4 reads a
twin flagged that way as co-detection, which is why its false-alarm count is
far lower than the any-flag file count; both readings are in the report. The
8 flagged global untargeted files are #378's `real-world-shapes` false alarms
(7 gating, 1 warn-only), recorded as known gap `product-911`.

## Reproduce

Write each run outside the working tree (the report records the benchmark
revision as dirty if the other report has already been rewritten in place),
then copy `<out>.json` and `<out>.md` into `docs/reports/`; `<out>.rows.json`
stays with the run.

```sh
export PATH=<dir with trufflehog 3.97.4>:$PATH   # only needed for benchmark:candidate
npm run eval:diagnostics -- --out=<scratch>/2026-09-28-beta11-380-unit-diagnostics-published
npm run eval:diagnostics -- --out=<scratch>/2026-09-28-beta11-380-unit-diagnostics-candidate \
  --candidate-package=<dir>/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=7720ae2a8d383c855a3051b53103657d22154411
npm run eval:diagnostics:validate -- <scratch>/2026-09-28-beta11-380-unit-diagnostics-{published,candidate}.json
npm run eval:diagnostics -- --check=docs/reports/2026-09-28-beta11-380-unit-diagnostics-published.json
```

The candidate tarballs come from product `npm run benchmark:candidate --
--benchmark-ref 8576326c3aa201bd5b0d6d3a55a77ea326c89ddc --output-dir <dir>` at
product `7720ae2a` (`<dir>/artifacts/`); their SHA-256s above identify them.

When #379's fixtures land, the corpus identity changes and `--check` reports
these files as stale; regenerate both rather than editing them.
