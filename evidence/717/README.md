# Batch 1 (#717): independent baseline and candidate replay for five bounded credential candidates

**Result:** Airtable `macSecretBase64` (0/7) and Elastic `Authorization: ApiKey` (0/8) are measured gaps on every surface of the published `@redact-secret/core` 0.1.0-beta.13 and of current core `d4e86769`; Figma (5/5, one placeholder control flagged), Asana (6/6) and Canva (8/8) are already covered generically, so Asana and Canva are no-code coverage validation. The replay on current core changes no case and regresses none; the replay of an implemented fix is open until redact-secret#1211 and #1212 land.

## Source revisions

| | published | candidate (current core) |
| --- | --- | --- |
| product | `@redact-secret/core` 0.1.0-beta.13 (npm), `@redact-secret/wasm` 0.1.0-beta.13, PyPI `redact-secret` 0.1.0b13, crates.io `redact-secret-cli` 0.1.0-beta.13 | commit `d4e86769f6f695598255d0629d942e24e7551417` built locally: core `tsc`, napi addon (darwin-arm64), `build-browser-artifact.mjs`, `maturin develop --release`, `cargo build --release -p redact-secret-cli` |
| platform | darwin-arm64, Node v22.16.0 | the same |
| benchmarks | branch cut from `develop` at `c9d7e850` | the same |

Corpus: `benchmarks/batch1/corpus.mjs` v1, 82 cases, `sha256:ddd709174816443e2234594f040d0dae27e3b78b5dce68f2396296bffde8708c`. Chunk size for streamed runs: 7 UTF-8 bytes (Node and WASM sessions by UTF-16 chunk, CLI by stdin writes, Python by code-point chunk), session limits 1 MB input / 32,896 buffered / 8,192 token / 32,768 multiline.

## Pinned scanners

Product only. No peer scanner produced a finding in this evidence, so no peer classification ran and no peer disagreement exists to report. For the record, `trufflehog` on `PATH` printed 3.97.6 in the measuring shell; the 3.97.4 pin is the Homebrew keg and must be first on `PATH` before any later `eval:classify`, `eval:matrix` or `benchmark:candidate`.

## What was measured

Every surface scans every case whole and streamed. Offsets are normalized to UTF-8 bytes (the bindings report UTF-16 code units, code points or bytes). Observations hold spans, finding type, detector and action, never matched text.

| family | core issue | published and candidate | disposition |
| --- | --- | --- | --- |
| `figma:personal-access-token` | #1209 | 5/5 exact, `redact`, generic `contextual_secret`; 1/9 controls flagged (`figma-placeholder-example-control`: the value `YOUR_FIGMA_TOKEN` after `X-Figma-Token:` in a curl header) | detection is covered (validation only); the placeholder control is a measured false positive to route to core |
| `asana:webhook-secret` | #1210 | 6/6 exact, `redact`, generic `contextual_secret`; 0/8 controls flagged (HMAC `X-Hook-Signature`, `X-Hook-Secret-Id`, `X-Hook-Secrets`, placeholders, references, masks, bare string stay clean) | no-code coverage validation |
| `airtable:webhook-mac-secret` | #1211 | 0/7: no finding in JSON, pretty JSON, YAML, quoted YAML, spaced and env assignment, non-ASCII prefix; 0/8 controls flagged | gap, route to core |
| `elastic:elasticsearch-api-key` | #1212 | 0/8: no finding for `Authorization` or `Proxy-Authorization: ApiKey` in raw HTTP, curl (single, double quotes) and JSON header maps; 0/8 controls flagged | gap, route to core |
| `canva:client-secret` | #1213 | 8/8 exact, `redact`: assignment, quoted, form body (span stops at `&`), JSON as `contextual_secret`; Basic raw and curl as `authorization_credential` over the encoded envelope; 0/9 controls flagged | no-code coverage validation |

Agreement: stream equals whole on every surface (0 disagreements) and the four surfaces (Node, WASM, Python, CLI) give the same outcome signature on every case (0 disagreements), for both engines. Published to candidate: no case changed, regressions 0.

Unsupported variants are observed, never scored: `X-Old-Figma-Token` and `X-Old-Hook-Secret` (prefixed names, each flagged generically; they may carry the same credential, so they were moved from controls to unsupported after the first baseline showed the flag), newline-separated Figma value, bare `figd_` prose, an Elastic key id alone and a bare `cnvca` value (all unflagged). The first baseline run is the only reason a case changed class; no expectation was moved to match a result otherwise.

## Gate status

| gate | state |
| --- | --- |
| bounded contracts and independent positives/controls for five families | met (`benchmarks/batch1/corpus.mjs`, `tests/batch1.test.mjs`) |
| public identifiers and HMAC outputs kept distinct from secrets | met: HMAC, ids and *Base64 lookalikes are controls |
| corpus hash, versions, mode and source commit recorded | met (`observations-*.json`, `report.json`) |
| exact span/action/finding checks on Node, WASM, Python, Rust CLI; incremental equals whole | measured and recorded for published and current core; the five-family pass bar is met for Figma, Asana, Canva detection and not met for Airtable and Elastic |
| TruffleHog 3.97.4 pin before peer classification | not applicable: no peer ran; see above |
| demonstrated baseline misses improve with no new regression | open: no implemented candidate exists (redact-secret#1211, #1212 open); the replay harness ran on current core and shows no change and no regression |
| slow peer/performance runs separate | met: nothing slow was run (#709) |
| artifacts stored and linked, support-matrix change only through normal qualification | met: no support status, ledger or pin changed |

## Reproduce

```bash
node scripts/measure-batch1.mjs --label published --out published.json --node-root . --wasm-dir node_modules/@redact-secret/wasm --python <venv with redact-secret==0.1.0b13>/bin/python --cli <cargo install redact-secret-cli@0.1.0-beta.13>/bin/redact-secret --source-commit npm:@redact-secret/core@0.1.0-beta.13
node scripts/measure-batch1.mjs --label candidate --out candidate.json --node-root <npm install of the built core, addon, wasm tarballs> --wasm-dir <build-browser-artifact.mjs out> --python <venv with maturin develop> --cli <target/release/redact-secret> --source-commit d4e86769f6f695598255d0629d942e24e7551417
node scripts/report-batch1.mjs --published published.json --candidate candidate.json --out-dir evidence/717
```

A fix is replayed by building it the same way and re-running the last two commands against the unchanged corpus; `tests/batch1.test.mjs` refuses observations taken on a different corpus.

Files: `report.md` (per family and per case), `report.json`, `observations-published.json`, `observations-candidate.json`.
