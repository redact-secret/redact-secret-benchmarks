# Batch 1 (#717): independent baseline and candidate replay for five bounded credential candidates

**Result:** the exact candidate `af1e71e0a0d5a7d8162c3b06a684d2736d2558e1` (redact-secret#1215) passes all five families on Node, WASM, Python and CLI, whole and streamed (Figma 5/5, Asana 6/6, Airtable 7/7, Elastic ApiKey 8/8, Canva 8/8 exact, 0/42 controls flagged); against the published beta.13 baseline it fixes 15 misses and 1 false positive and regresses nothing.

## Source revisions

| | published (baseline) | current core (baseline) | candidate (replay) |
| --- | --- | --- | --- |
| product | `@redact-secret/core`, `@redact-secret/wasm` 0.1.0-beta.13 (npm), PyPI `redact-secret` 0.1.0b13, crates.io `redact-secret-cli` 0.1.0-beta.13 | commit `d4e86769f6f695598255d0629d942e24e7551417` | commit `af1e71e0a0d5a7d8162c3b06a684d2736d2558e1` (declared 0.1.0-beta.13, unreleased) |
| build | released artifacts | built locally | built locally: `tsc`, napi addon, `build-browser-artifact.mjs`, `maturin develop --release`, `cargo build --release -p redact-secret-cli` |
| platform | darwin-arm64, Node v22.16.0 | the same | the same |

The candidate differs from `d4e86769` by #1206, #1207, #1208, #1214 (four unrelated detectors) and #1215. Benchmarks: baseline run on `develop` `c9d7e850`, replay on `develop` `d2ca5de9`; the corpus did not change between them.

Candidate tarball SHA-256 (this build host): core `3cf936c4…3798c` (equals the product's own digest, reproducible), node addon `15f413db…894f` and wasm `621b810f…ea55` (host-bound; the product's own build differs, as the product comment says).

Corpus: `benchmarks/batch1/corpus.mjs` v1, 82 cases, `sha256:ddd709174816443e2234594f040d0dae27e3b78b5dce68f2396296bffde8708c`, unchanged expectations across both runs. Streamed runs: 7-byte chunks, session limits 1 MB input / 32,896 buffered / 8,192 token / 32,768 multiline.

## Pinned scanners

Product only. No peer scanner produced a finding here, so no peer classification ran and no peer disagreement exists. `trufflehog` on `PATH` printed 3.97.6 in the measuring shell; the 3.97.4 pin is the Homebrew keg and must be first on `PATH` before any `eval:classify`, `eval:matrix` or `benchmark:candidate`.

## Measured (Node, identical on WASM, Python and CLI)

| family | core issue | published = current core `d4e86769` | candidate `af1e71e0` | disposition |
| --- | --- | --- | --- | --- |
| `figma:personal-access-token` | #1209 | 5/5 exact; 1/9 controls flagged (`YOUR_FIGMA_TOKEN` placeholder in a curl header) | 5/5 exact, 0/9 flagged | fixed false positive; detection was already covered (validation) |
| `asana:webhook-secret` | #1210 | 6/6 exact, 0/8 flagged | unchanged | no-code coverage validation |
| `airtable:webhook-mac-secret` | #1211 | 0/7 detected | 7/7 exact, `redact`, `contextual_secret`, 0/8 flagged | measured gap fixed |
| `elastic:elasticsearch-api-key` | #1212 | 0/8 detected | 8/8 exact, `redact`, `authorization_credential`, 0/8 flagged | measured gap fixed |
| `canva:client-secret` | #1213 | 8/8 exact, 0/9 flagged | unchanged | no-code coverage validation |

Effect, published to candidate: 16 case changes (15 positives miss to exact, 1 control flagged to clean), regressions 0. `d4e86769` to published: no change. Agreement: stream equals whole and the four surfaces agree on every case, for all three engines. The HMAC outputs (`X-Hook-Signature`, `X-Airtable-Content-MAC`), ids, other `*Base64` fields, lookalike names, placeholders, references and masks stay clean. Attribution stays generic (no provider type), as the issue allows.

Unsupported variants are observed and never scored; none changed: prefixed `X-Old-Figma-Token` and `X-Old-Hook-Secret` (flagged generically), newline-separated Figma value, bare `figd_` prose, an Elastic key id alone, a bare `cnvca` value (the last four unflagged). The one class change in this work (prefixed header names from control to unsupported) was made after the first baseline, because such a header can carry the same credential.

## Gate status

| gate | state |
| --- | --- |
| bounded contracts, independent positives and controls | met |
| public ids and HMAC outputs distinct from secrets | met |
| corpus hash, versions, mode, source commit recorded | met |
| exact span/action/finding on Node, WASM, Python, CLI; incremental equals whole | met for the candidate; the baseline gaps are the miss rows above |
| TruffleHog 3.97.4 pin before peer classification | not applicable: no peer ran |
| baseline misses improve, no new regression | met on the focused batch (15 fixed, 1 false positive fixed, 0 regressions). The existing credential and authorization regression corpus is the product's full-suite candidate evidence (core issue comment: run `30f83edc-231a-48ba-9f33-4795c05cbf1a`, fixed corpus negative flags 4 to 4, expanded 16 to 14, required-positive misses 0 to 0); it is not re-run here and the official qualification run is not replaced |
| slow peer and performance runs separate | met |
| artifacts stored; support-matrix change only through normal qualification | met: no pin, ledger row, support status or authority changed |

## Adoption disposition

Accepted as an exploratory replay for the exact candidate. It is not an official run and not a support promotion: detector support status changes only through the credential-eval qualification (`official-runs.yml`) after a release carries the fix. Nothing was released or tagged.

## Reproduce

```bash
node scripts/measure-batch1.mjs --label published --out published.json --node-root . --wasm-dir node_modules/@redact-secret/wasm --python <venv redact-secret==0.1.0b13>/bin/python --cli <cargo install redact-secret-cli@0.1.0-beta.13>/bin/redact-secret --source-commit npm:@redact-secret/core@0.1.0-beta.13
node scripts/measure-batch1.mjs --label candidate --out candidate.json --node-root <npm install of the built core, addon and wasm tarballs> --wasm-dir <build-browser-artifact.mjs out> --python <venv, maturin develop --release> --cli <target/release/redact-secret> --source-commit af1e71e0a0d5a7d8162c3b06a684d2736d2558e1
node scripts/report-batch1.mjs --published published.json --candidate candidate.json --out-dir evidence/717
```

Files: `report.md` / `report.json` (published against the candidate), `observations-published.json`, `observations-core-d4e86769.json` (the earlier current-core baseline), `observations-candidate.json`. `tests/batch1.test.mjs` refuses observations from a different corpus.
