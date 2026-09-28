# Evidence: redact-secret#911: fixed-candidate rerun of its untargeted benign fixtures

**Result:** PASS for #911's scope. On the fixed candidate `1db8ff3`, none of this gap's 7 `real-world-shapes` files is
gated (observed: 7 gated). 6 are clean. `pytest-fake-fixtures` keeps one medium `warn` on a short quoted literal under a
high-signal name, which is outside #911 and warns by documented policy (below).

Gap: [redact-secret#911](https://github.com/redact-secret/redact-secret/issues/911), generic-token redacts secret-reference names and identifiers in ordinary config/source (untargeted real-world-shapes). Known-gap record
`product-911`, fixed by [`12a984e`](https://github.com/redact-secret/redact-secret/commit/12a984ebf62dd1f8640058b8290421f6cc72baf7)
(PR [#938](https://github.com/redact-secret/redact-secret/pull/938), merge `ea5c7bd`). This is the benchmark-side rerun that
[`decision-govern-benchmark-promotion`](../../docs/decisions/2026-09-18-govern-benchmark-promotion.md)
requires before `verified`. It keeps no fixture content and no matched value.

## Fixture outcomes

All seven are `must-not-flag`, T3.

| Fixture | Observed (published 0.1.0-beta.9 / candidate `9ab0fa0`) | Candidate `1db8ff3` |
| --- | --- | --- |
| `real-world-shapes--helm-values-search-api` | 1 redact | clean |
| `real-world-shapes--k8s-billing-externalsecret` | 2 redact, 1 warn | clean |
| `real-world-shapes--ansible-group-vars-gameservers` | 1 redact | clean |
| `real-world-shapes--swift-keychain-wrapper` | 3 redact | clean |
| `real-world-shapes--pytest-fake-fixtures` | 1 redact, 2 warn | 1 warn (406–416, medium, `contextual_secret`) |
| `real-world-shapes--lua-openresty-hmac` | 1 redact | clean |
| `real-world-shapes--agent-summary-korean-rotation` | 1 redact | clean |

The remaining `pytest-fake-fixtures` finding is the first of the two medium warns observed there: a `FAKE_TOKEN = "<10-byte literal>"`
assignment. The observed high `redact` (a placeholder constant passed as `signing_secret=`) and the second warn (an
all-caps constant passed as `api_token=`) are gone. #911's issue body excludes this span ("a `"test-token"` literal ... accepted
by design"): a quoted literal under a high-signal name warns unconditionally under
[`decision-warn-unconditionally-on-high-signal-contextual-names`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-20-warn-unconditionally-on-high-signal-contextual-names.md).
The fixture's `must-not-flag` expectation is unchanged, so the benchmark still counts this file as flagged (`flagged:1`). The
warn-only reading matches the Beta.11 final report: global untargeted T3 at the candidate is 0 gated and 2 warn-only
of 216. The other warn-only file, `real-world-shapes--terraform-apply-sensitive`, is not part of this record.

The candidate run records outcomes, not actions. The span, confidence and action above come from `scan()` on the same
candidate tarballs (the command is below). Raw outcome rows: [`candidate-rerun.json`](candidate-rerun.json).

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `1db8ff38b16e50c51229eb27025452952bf621e1`, clean, product `main` (the frozen Beta.11 candidate; descends from the fixing commit) |
| `redact-secret-benchmarks` | `3cd8d6525d8d0b80195f896849b3efbd48ca2764`, clean, `develop`; lockfile SHA-256 `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Corpus | measurement-v4, hash `a89a8d117ef2e3b80fb2a7e6b612fc5c464030bfc4d9cd05c52204aba8706d75`; `real-world-shapes` hash `7adc76864a1a1f017f1ac3a88de933301819ffe28af154ab9b9ff7e155355de3` (unchanged since the observation) |
| Candidate run | `009a85fa-e810-4ab8-85a5-a264dba30536`, 2026-09-28T21:41:22.018Z to 2026-09-28T21:41:24.715Z, status `complete`, scope `full-suite`, 4,768 of 4,768 fixtures, `eval:validate` passed |

This is the same run as [`../931/README.md`](../931/README.md). Detection is unchanged after the candidate: product `main`
after `1db8ff3` changes only CI workflow and check scripts, documentation, pins and the conformance manifest, with no source under `crates/` or `packages/`.

## Scanner and artifacts

Candidate-only rerun (`redact-secret-candidate`, adapter version 2, default detectors, configuration hash
`c1af1eee…`, Node v22.16.0 on darwin-arm64). No peer scanner is involved, so this is
candidate mode with no peer comparison. Tarballs built by `npm run benchmark:candidate` at the candidate commit:

- core facade `0.1.0-beta.10` SHA-256: `4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1`
- node darwin-arm64 SHA-256: `fec9c4332aa68426f0cbcd8fc7ee1f6d34d53b2db32530ea17af6fd99fd32d22`
- wasm SHA-256: `af0633663d713456a82d297f23023280cff05ad5f56489e9e72854601af2b1a1`

## Product conformance

The 11 canonical fixtures of product manifest record `benchmark-gap-911` (6 benign shapes, 5 literal twins) pass in
[Artifact qualification run 36480272622](https://github.com/redact-secret/redact-secret/actions/runs/36480272622) at
`1db8ff3`: Rust native host (ubuntu, macOS, Windows), browser WebAssembly (Chromium, Firefox, WebKit), the CLI, the
N-API addon, and the Python wheel. The record is added by [redact-secret#967](https://github.com/redact-secret/redact-secret/pull/967).

## Command

From a clean `redact-secret` checkout at `1db8ff38b16e50c51229eb27025452952bf621e1`:

```sh
npm run benchmark:candidate -- --benchmark-ref 3cd8d6525d8d0b80195f896849b3efbd48ca2764 \
  --benchmark-repo <redact-secret-benchmarks> --output-dir <out>
```

Finding metadata for the residual warn: install the three tarballs from `<out>/artifacts` into an empty directory. Then call
`initialize()` and `scan(content)` from `@redact-secret/core` on the `pytest-fake-fixtures` entry of
`fixtures/real-world-shapes/corpus.json` at `3cd8d65`, and print only `start`, `end`, `type`, `confidence` and `action`.
