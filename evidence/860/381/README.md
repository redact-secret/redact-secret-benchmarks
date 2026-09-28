# Evidence: credential mixed-document, streaming and binding parity at product main 1127bf9 (#381)

**Result:** on 10 mixed documents carrying 83 credential targets from 39 families (15 #377 ledger families, 24 #860
families), candidate `1127bf9` gives the same UTF-8 spans and the same sanitized bytes on all six surfaces (Node addon,
Node Wasm, browser Wasm, Python, Rust, CLI) in LF and CRLF, and every incremental partition and every Node/Web byte
stream agrees with the whole-input result, except where a declared incremental limit fails closed. 69 of 71 must-redact
targets and 9 of 12 policy targets are redacted exactly; 2 must-redact and 2 policy targets are found but only warned
(their value stays in the output), and 1 policy target is not reported. No replacing collateral lands on a control or on
filler. The same checks show the #860 detectors (PR #938) cost 5.6–14.9% processing time and 13.6 KB of gzip in the full
WASM build. Nothing here is a support-status claim.

Benchmark side of [redact-secret-benchmarks#381](https://github.com/redact-secret/redact-secret-benchmarks/issues/381)
(Beta.11 E, parent [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376); product research
[redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860)). Method:
[`docs/specs/credential-mixed-parity.md`](../../../docs/specs/credential-mixed-parity.md). No input or output text is
retained: the observation carries ranges, finding metadata and SHA-256 digests only.

## Source revisions

| Item | Identity |
| --- | --- |
| Product | `redact-secret` main `1127bf91323797be89b4413c8051f9a9a85da43b` (PR #938 then #947), clean; `crates/secret-scan-core` tree `4ae1ec0910b897d0686c0b9dbd7dde822fe6ea8d`; declared version 0.1.0-beta.10 |
| Artifacts (built by the harness with the product's candidate recipe, darwin-arm64) | core `4681ad429ebe…29a1`, node `57969928…1714`, wasm `e62e3f26…201f`, wheel `59874ead…3e41`, CLI `a4cd529a…3c66` (full hashes in the report) |
| Benchmarks | `303bb8cc93116ee9056988bce16a16ec51d5e447` (plan frozen there, harness clean) |
| Plan | `benchmarks/evaluation/domains/credential/mixed-parity/credential-mixed-parity-v1.json`, commitment `021fb995deb3b872d34b7b97ca1b4d27bdc47c7cd22713bb4f1ee5a02612ec00`; family ledger `docs/reports/2026-09-28/beta-11-family-axis-ledger.json` |
| Runtimes | Node v22.16.0, Google Chrome 154.0.8037.57 (headless), Python 3.14.7, rustc 1.98.1 |
| Incremental limits | input 1 MiB, buffered 64 KiB, token 8 KiB, multiline 16 KiB (the #427 limits) |

Files: [`1127bf913237/credential-mixed-parity-observation-v1.json`](1127bf913237/credential-mixed-parity-observation-v1.json),
[`1127bf913237/credential-mixed-parity-report-v1.json`](1127bf913237/credential-mixed-parity-report-v1.json).

## Units

Documents (10) and targets (83: 71 must-redact, 12 policy) are the independent samples. Eight documents mix five
families each (two positives, a twin and a control per family) among log, Markdown, chat or YAML filler; one ~75 KiB log
carries positives at its start, middle and end; one document puts two positives after a single minified run longer than
the 8 KiB token limit. Variants, partitions (3,426 over both variants), byte streams, operations and surfaces are checks
on these documents, not samples.

## Parity per surface

| Surface | Range unit | Checks | Cross-surface divergences | Partition divergences | Stream divergences | Declared limit, failed closed | Limit issues | Target values emitted before a limit failure |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| Node addon (reference) | UTF-16 | 10,478 | 0 | 0 | 0 | 91 partitions, 182 streams (`TOKEN_LIMIT_EXCEEDED`) | 0 | 0 |
| Node Wasm fallback | UTF-16 | 10,518 | 0 | 0 | 0 | 91 partitions, 182 streams | 0 | 0 |
| Browser Wasm | UTF-16 | 3,646 | 0 | 0 | — (not driven in the page) | 91 partitions | 0 | 0 |
| Python | code points | 3,646 | 0 | 0 | — (no stream adapter) | 91 partitions | 0 | 0 |
| Rust crate | UTF-8 | 3,646 | 0 | 0 | — (no stream adapter) | 91 partitions | 0 | 0 |
| CLI | UTF-8 | 80 | 0 | 0 | — (one stdin write, one paced write) | none | — (fixed limits) | — |

Every operation's output equals the input with exactly its replacing findings replaced, and `redact(scan)` equals
`scanAndRedact` on every surface. Whole-input limits behave as declared: at exactly the input size the result equals the
unlimited one, one byte under it fails closed. An incremental session one unit under the input size fails closed and
emits no target value the whole-input result redacts.

**Known unsupported context (declared, not a gap):** on the long-minified-line document every incremental session and
byte stream fails with `TOKEN_LIMIT_EXCEEDED` (the minified run exceeds the 8 KiB token limit) while whole-input
`scan`/`scanAndRedact` redacts both positives exactly. The failure is closed and emits nothing the whole-input result
redacts. The CLI's read loop redacts the same document like whole input.

## Outcomes on the reference surface (identical on all six)

| Target | Fixture | Kind | Outcome |
| --- | --- | --- | --- |
| `mixed-01-log/L4/new-relic-license-key` | `beta8-379--new-relic-license-key-python-newrelic-ini` | must-redact | warn-only: value stays (the open policy question redact-secret#936, known gap `product-936`) |
| `mixed-01-log/L6/mailchimp-api-key` | `beta8-379--mailchimp-api-key-python-requests-auth` | must-redact | warn-only: found since #931, but warned, so the value stays |
| `mixed-01-log/L11/deepgram-api-key` | `beta8-379--deepgram-api-key-httpie-token` | policy | warn-only (found since #932) |
| `mixed-01-log/L16/heroku-api-key-legacy` | `beta8-379--heroku-api-key-legacy-authorizations-info` | policy | warn-only (found since #933) |
| `mixed-02-markdown/L11/cohere-api-key` | `beta8-379--cohere-api-key-litellm-proxy-debug` | policy | not reported (recorded as product policy on #932) |
| the other 78 | | | exact, redacted |

Each of the five behaves the same when the fixture is scanned alone, so none is a mixed-document effect; they are the
action-policy question of redact-secret#936 (commented there). All 24 #860 families are redacted exactly in every wrap
(Unicode neighbours, JSON escaping, adjacent `「…」`, CRLF, the oversized log) and at every prefix, delimiter and body
cut, apart from the declared token limit above.

Collateral: no replacing finding on a control or filler line. Replacing findings on 50 twin-line occurrences (25 twins in
both variants) are `generic-token` co-detection in credential-named contexts, never the twin's own family. Warn-only
findings: the Resend digits placeholder control (redact-secret#949, known gap `product-949`) and the Inngest 63-hex body
twin (`generic-token`, medium, under an `INNGEST_SIGNING_KEY` name; a warn leaves the text unchanged).

## Runtime and WASM size of the #860 detectors

Measured by `performance-evaluation.yml` on one runner model (AMD EPYC 7763, 4 vCPU), interleaved same-job pairs
(6 rounds × 2 samples per side):

- **Paired `b0be64b` → `ea5c7bd`** (PR #938 alone, run
  [36459040787](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36459040787),
  [`performance/paired-b0be64b-vs-ea5c7bd.json`](performance/paired-b0be64b-vs-ea5c7bd.json)): median processing time
  rises on every surface; detection on the assessment corpus is unchanged (21 true positives, 1 false positive, 5 false
  negatives on both sides). An A/A run of `b0be64b` against itself on the same runner model (run
  [36460951864](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36460951864),
  [`performance/paired-aa-b0be64b.json`](performance/paired-aa-b0be64b.json)) moves by at most 1.1%.

| Surface / workload | b0be64b median ms | ea5c7bd median ms | Change | A/A change |
| --- | ---: | ---: | ---: | ---: |
| rust-core small-whole | 17.10 | 18.12 | +5.9% | +0.1% |
| rust-core medium-fixed4096 | 85.26 | 93.37 | +9.5% | +0.3% |
| python small-whole | 17.08 | 18.05 | +5.6% | +0.4% |
| python medium-fixed4096 | 87.85 | 95.13 | +8.3% | −0.7% |
| node small-whole | 16.90 | 17.84 | +5.6% | 0.0% |
| node medium-fixed4096 | 93.66 | 100.93 | +7.8% | 0.0% |
| browser-wasm small-whole | 31.10 | 34.25 | +10.1% | +0.8% |
| browser-wasm medium-fixed4096 | 115.90 | 133.20 | +14.9% | −0.4% |
| cli small-whole | 24.64 | 27.08 | +9.9% | +1.1% |
| cli medium-fixed4096 | 90.87 | 99.85 | +9.9% | +0.5% |

Initialization is unchanged within noise.

- **WASM sizes** (`scripts/measure-wasm-sizes.mjs` in each run, [`performance/`](performance/)):

| Build | full raw | full gzip | full brotli | common raw | common gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| `b0be64b` | 742,630 | 275,644 | 217,770 | 742,742 | 275,658 |
| `ea5c7bd` (PR #938) | 782,817 | 289,216 | 228,050 | 614,029 | 236,692 |
| `1127bf9` (PR #947, PII split out, #937) | 515,537 | 176,383 | 138,524 | 336,984 | 120,676 |

The full build is the one that carries the new provider detectors: PR #938 adds 40,187 raw, 13,572 gzip and 10,280
brotli bytes (+4.9% gzip). The common build shrinks at `ea5c7bd` because the same PR stops linking provider detectors
into it (#929), so its change is not a detector cost. At `1127bf9` both builds drop again because the PII runtime moved to
separate artifacts (#937). Against the reviewed 0.1.0-beta.8 budgets, `1127bf9` still breaches `size/wasm/*/gzip`
(common 120,676 vs 100,058; full 176,383 vs 137,639) and every processing-ratio budget (run
[36463844435](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36463844435), REJECTED); recording
an accepted tradeoff or fixing it is a maintainer decision.

## Commands

```sh
npm run credential-parity:plan            # regenerate the plan (the harness refuses a drifted or uncommitted plan)
npm run credential-parity:measure -- --core-commit=1127bf91323797be89b4413c8051f9a9a85da43b \
  --core-repo=<absolute path to a redact-secret clone>
gh workflow run performance-evaluation.yml -f candidate_revision=<core> -f baseline_revision=<core>   # paired or A/A
```
