# Evidence: redact-secret#911: fixed-candidate rerun of its untargeted benign fixtures

## Rerun at the re-bound Beta.11 candidate 8b6a5fd (current)

**Result:** PASS, unchanged. The Beta.11 candidate moved from `ec9224d` to product main `8b6a5fd` (PR #996, the #902
Wasm follow-up; PII-only code, output byte-identical). Every fixture of this record has the same outcome and finding
count there. The record stays `verified`.

| Fixture | Kind | Candidate `ec9224d` | Candidate `8b6a5fd` |
| --- | --- | --- | --- |
| `real-world-shapes--helm-values-search-api` | must-not-flag | clean | clean |
| `real-world-shapes--k8s-billing-externalsecret` | must-not-flag | clean | clean |
| `real-world-shapes--ansible-group-vars-gameservers` | must-not-flag | clean | clean |
| `real-world-shapes--swift-keychain-wrapper` | must-not-flag | clean | clean |
| `real-world-shapes--pytest-fake-fixtures` | must-not-flag | flagged:1 | flagged:1 |
| `real-world-shapes--lua-openresty-hmac` | must-not-flag | clean | clean |
| `real-world-shapes--agent-summary-korean-rotation` | must-not-flag | clean | clean |

The residual `pytest-fake-fixtures` warn is unchanged (406–416, medium, `contextual_secret`, `warn`), from `scan()` on the
8b6a5fd tarballs.

- Candidate run `e795030e-478e-4d21-9775-57456d832143` (complete, full suite, 4,777 of 4,777 fixtures, `eval:validate`
  passed), benchmarks `405892a5ba40b6eeef919d2fb818470ee495092c` (clean, the re-pin), corpus `d88c19f7…3e2f` (unchanged).
- Artifacts: core `467111e2…f74c`, node `19f41652…05ea`, wasm `61d135ba…6f2d`.
- Product conformance at `8b6a5fd`: [Artifact qualification run 36581019627](https://github.com/redact-secret/redact-secret/actions/runs/36581019627) (success).
- Raw rows: [`candidate-rerun-8b6a5fd.json`](candidate-rerun-8b6a5fd.json). Family-level summary:
  [`../860/8b6a5fd/README.md`](../860/8b6a5fd/README.md).

The `ec9224d` rerun below is superseded by this one and kept as history.

## Rerun at the re-bound Beta.11 candidate ec9224d (superseded)

**Result:** PASS, unchanged. The Beta.11 candidate was re-bound from `8f97f14` to product main `ec9224d` (PR #994: the
#948 provider-named generic-token fallback, the #993 non-secret value exclusions and the #902 linear PII context
association). Every fixture of this record has the same outcome and finding count there. None of them is among the 177
fixtures #948 changes or the one #993 changes. The record stays `verified`.

| Fixture | Kind | Candidate `8f97f14` | Candidate `ec9224d` |
| --- | --- | --- | --- |
| `real-world-shapes--helm-values-search-api` | must-not-flag | clean | clean |
| `real-world-shapes--k8s-billing-externalsecret` | must-not-flag | clean | clean |
| `real-world-shapes--ansible-group-vars-gameservers` | must-not-flag | clean | clean |
| `real-world-shapes--swift-keychain-wrapper` | must-not-flag | clean | clean |
| `real-world-shapes--pytest-fake-fixtures` | must-not-flag | flagged:1 | flagged:1 |
| `real-world-shapes--lua-openresty-hmac` | must-not-flag | clean | clean |
| `real-world-shapes--agent-summary-korean-rotation` | must-not-flag | clean | clean |

The residual `pytest-fake-fixtures` warn is unchanged (406–416, medium, `contextual_secret`, `warn`), from `scan()` on the
ec9224d tarballs.

- Candidate run `589527ab-8df1-4ae7-a517-26f7567ffb3b` (complete, full suite, 4,777 of 4,777 fixtures, `eval:validate`
  passed), benchmarks `5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f` (clean), corpus `d88c19f7…3e2f` (the #948 relabel and
  the nine `beta8-948` controls; this record's fixtures are unchanged).
- Artifacts: core `467111e2…f74c`, node `9ceabe01…83d6`, wasm `c3f54788…7d78`.
- Product conformance at `ec9224d`: [Artifact qualification run 36570726765](https://github.com/redact-secret/redact-secret/actions/runs/36570726765) (success).
- Raw rows: [`candidate-rerun-ec9224d.json`](candidate-rerun-ec9224d.json). Family-level summary:
  [`../860/ec9224d/README.md`](../860/ec9224d/README.md).

The `8f97f14` rerun below is superseded by this one and kept as history.

## Rerun at the re-bound Beta.11 candidate 8f97f14 (superseded)

**Result:** PASS, unchanged. The Beta.11 candidate was re-bound from `1db8ff3` to product main `8f97f14` (PR #991, the
#980 performance backlog, and PR #992, the #990 streaming fixes). Every fixture of this record has the same outcome
and finding count there. The record stays `verified`.

| Fixture | Kind | Candidate `1db8ff3` | Candidate `8f97f14` |
| --- | --- | --- | --- |
| `real-world-shapes--helm-values-search-api` | must-not-flag | clean | clean |
| `real-world-shapes--k8s-billing-externalsecret` | must-not-flag | clean | clean |
| `real-world-shapes--ansible-group-vars-gameservers` | must-not-flag | clean | clean |
| `real-world-shapes--swift-keychain-wrapper` | must-not-flag | clean | clean |
| `real-world-shapes--pytest-fake-fixtures` | must-not-flag | flagged:1 | flagged:1 |
| `real-world-shapes--lua-openresty-hmac` | must-not-flag | clean | clean |
| `real-world-shapes--agent-summary-korean-rotation` | must-not-flag | clean | clean |

The residual `pytest-fake-fixtures` warn is unchanged (406–416, medium, `contextual_secret`, `warn`), from `scan()` on the
8f97f14 tarballs.

- Candidate run `74888ff3-48ed-4459-b2fe-32906a5a95cb` (complete, full suite, 4,768 of 4,768 fixtures, `eval:validate`
  passed), benchmarks `005b19b85368d24910da437f31db701d670a2b8d` (clean), corpus `a89a8d11…6d75` (unchanged).
- Artifacts: core `467111e2…f74c`, node `b32d462b…29f8`, wasm `b6819bfd…e966`.
- Product conformance at `8f97f14`: [Artifact qualification run 36553444981](https://github.com/redact-secret/redact-secret/actions/runs/36553444981) (success).
- Raw rows: [`candidate-rerun-8f97f14.json`](candidate-rerun-8f97f14.json). Family-level summary:
  [`../860/8f97f14/README.md`](../860/8f97f14/README.md).

The `1db8ff3` rerun below is superseded by this one and kept as history.

## Rerun at 1db8ff3 (superseded)

**Result:** PASS for #911's scope. On the fixed candidate `1db8ff3`, none of this gap's 7 `real-world-shapes` files is
gated (observed: 7 gated). 6 are clean. `pytest-fake-fixtures` keeps one medium `warn` on a short quoted literal under a
high-signal name, which is outside #911 and warns by documented policy (below).

Gap: [redact-secret#911](https://github.com/redact-secret/redact-secret/issues/911), generic-token redacts secret-reference names and identifiers in ordinary config/source (untargeted real-world-shapes). Known-gap record
`product-911`, fixed by [`12a984e`](https://github.com/redact-secret/redact-secret/commit/12a984ebf62dd1f8640058b8290421f6cc72baf7)
(PR [#938](https://github.com/redact-secret/redact-secret/pull/938), merge `ea5c7bd`). This is the benchmark-side rerun that
[`decision-govern-benchmark-promotion`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-18-govern-benchmark-promotion.md)
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
