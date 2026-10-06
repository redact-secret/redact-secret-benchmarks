# Batch 2 (#739): measurement of all 58 families, disposition ledger

## Round 3 (`round3/`, `ledger.json`): replay of the exact candidate 4e004108

**Candidate.** redact-secret `4e0041081aad22d0101bd52db52017b67b5bd3db` (core main after PR #1235, clean detached worktree, declared 0.1.0-beta.13, unreleased). It contains the fixes for core #1232 (empty form value took the next parameter), #1233 (HubSpot `personalAccessKey` / `HUBSPOT_PERSONAL_ACCESS_KEY`) and #1234 (`YOUR_PASSWORD` placeholder), plus #1227 and #1231 since `a148dadf`. Built here on darwin-arm64, Node v22.16.0, rustc/cargo 1.98.1, maturin 1.15.0, one `CARGO_TARGET_DIR`: `npm ci --ignore-scripts` (root and `bindings/node`), `npm run js:build`, `npm run build` in `bindings/node`, `npm run wasm:build` and `wasm:build:common` (`--out-dir`), `npm pack` of core, the staged darwin-arm64 addon and the staged wasm package (the same steps as `buildCandidate()` in the core's `scripts/benchmark-candidate.mjs`, without its benchmark-repo evaluation), `maturin develop --release` (Python 0.1.0b13) and `cargo build --release --locked -p redact-secret-cli`. Tarball SHA-256, this host against core's: core `3cf936c45937b99799d89f922738f2f1ba78d377e21dd4fa92c3cde125a3798c` (equal), wasm `f205071e59351b210cf24ab4a1f336e950c2640d1f67901c979444db8e796f8b` (equal), node-darwin-arm64 `078540b10ac933483c750648fe5ec99ee79abff7f7803d0b6f2bb9a95fbaaed1` here versus `8c4198ed675027d1da8a0fd57fc4761dfeb5b6d4b999bf40e2086a05bd0e31bb` (the addon is host-bound and not reproducible; the behaviour is what is compared).

**Replay.** The unchanged frozen corpora (round 2 `a312308a...`, 1935 cases; round 1 `74fed382...`, 486 cases; Batch 1, 82 cases) on Node, WASM, Python and CLI, whole and streamed at 7-byte and 1-byte chunks. Baseline stays published beta.13 as measured in round 2 (same identity, observations reused). Peers not run: the harness is product-only (a real trufflehog 3.97.4 binary was available but no peer step belongs to this replay).

**Result.** Round 2 corpus: 1010 of 1010 positives pass and 555 of 555 controls are clean at both chunk sizes (a148dadf: 1002 and 539; published: 980 and 539); whole equals stream and the four surfaces are identical on every case. Round 1 corpus: 200 of 200 and 203 of 203, identical to the round-1 observations of a148dadf (0 differences). Batch 1: 656 entries, 0 differences against the accepted af1e71e0 observations. Against a148dadf exactly 25 cases differ (200 observations = 25 x 4 surfaces x whole/stream): 15 empty-value controls (now clean), 8 HubSpot positives (now pass), 1 Atlas `YOUR_PASSWORD` control (now clean) and 1 unscored `legacy-portals` observation. Regressions: none. All 17 rows with a reproduced gap are `fixed by candidate 4e004108, replay verified on Node, WASM, Python and CLI (whole, 7-byte and 1-byte streams)`. The `&name=`-initial password trade-off of #1232 is not exercised by any frozen case. Recorded contract-evidence conflicts are unchanged and not resolved (`oauth_token`, Atlas percent-escaped URI password, Atlas programmatic API private key; the Atlas private key source stays unresolved). See `round3/report.md`.

Reproduce: build as above, install the three tarballs in a scratch directory, then `node scripts/measure-batch1.mjs --corpus ../benchmarks/batch2/corpus-r2.mjs --chunk 7|1 --label candidate --out f --node-root D --wasm-dir D/node_modules/@redact-secret/wasm --python <venv python> --cli <target/release/redact-secret> --source-commit 4e0041081aad22d0101bd52db52017b67b5bd3db` (also `corpus.mjs` for round 1 and no `--corpus` for Batch 1), then `node scripts/report-batch2-r3.mjs --candidate-r2-c7 ...` (flags in the script header).

---

## Round 2 (this directory's `round2/`, `ledger.json`)

**Readiness.** credential-evidence finished Groups C, D, E (PR #253, main `65602481`, snapshot-2026.10.06). All 28 previously carrier-unresolved rows are now `ready`, so 58 of 58 are ready (G1 23, G2 13, G3 12, G4 4, G5 3, G6 3). The 30 round-1 rows kept their contract digests and claim IDs (no re-derivation needed); the 28 newly ready rows have changed contract digests because carrier claims were added (`readiness.md`). Their carriers come from `docs/handoffs/batch-2-research-r1..r3.md`.

**Measured.** An adversarial corpus (`benchmarks/batch2/corpus-r2.mjs`, 1935 cases, sha256 `a312308a...`, frozen in `FROZEN-r2.json`; first freeze `8e447629` before any scan, three documented errata E1 to E3 before the re-measurement) in two parts: 28 new rows (1048 cases) and the 30 round-1 rows re-tested with the same axes (887 cases). 21 axes (delimiter, neighbouring/same-shape public fields, neighbouring secret, repeated secret, UTF-8 before and after, end of input, line endings, nesting, big preceding text, glued names, near-miss values and names, alphabet, low entropy, JWT overlap, unsupported representations, 1-byte stream cuts) are explained in `round2/report.md`. Same baseline (published beta.13) and candidate (`a148dadf4a43b5441ed88386d055428b2e278f25`; core main has not moved and no candidate package was published) as round 1. Node, WASM, Python, CLI, whole and streamed at 7-byte and 1-byte chunks. Peers not run.

**Results (candidate).** New rows: 536 of 544 positives pass, 295 of 307 controls clean. Round-1 rows with the harder axes: 466 of 466 positives pass, 244 of 248 controls clean (round 1 held on positives and was too easy on controls: 4 control cases flagged). On the baseline, 11 positives fail on `elastic:ece-api-key` and 11 on `elastic:cloud-api-key` plus none elsewhere (the Batch 1 ApiKey fix, core #1212). Stream equals whole and the four surfaces agree on every case, at both chunk sizes.

Reproduced gaps (core issues filed, no core code changed):
- redact-secret#1232 (package #1223, also #1225): an empty form value (`refresh_token=&other=1`) is reported as the next parameter (warn span over `&other=1`); 15 families.
- redact-secret#1233 (package #1225): HubSpot `personalAccessKey` and `HUBSPOT_PERSONAL_ACCESS_KEY` are not read; 8 of 8 positives miss.
- redact-secret#1234 (package #1226): `"password":"YOUR_PASSWORD"` placeholder flagged (warn).

Unchanged recorded conflicts: `oauth_token` (x:oauth1-access-token-secret), Atlas percent-escaped URI password, Atlas programmatic API private key readiness (controls only). Adversarial `unsupported` variants (prefixed names, upper-case names, single quotes, lower-case schemes, percent values, legacy layouts) are observed and never scored.

Files: `readiness.*`, `round2/report.{md,json}`, `round2/observations-*.json.gz` (per-case findings, no matched text), `ledger.json` (58 rows), `ledger-round1.json` (the round-1 ledger), corpora `benchmarks/batch2/corpus.mjs` (round 1) and `corpus-r2.mjs`, scorers `score.mjs` and `score-r2.mjs`, reports `scripts/report-batch2.mjs` and `scripts/report-batch2-r2.mjs`.

Reproduce round 2: build the same baseline and candidate as below, then run `node scripts/measure-batch1.mjs --corpus ../benchmarks/batch2/corpus-r2.mjs --chunk 7|1 ...` (same flags as round 1) and `node scripts/report-batch2-r2.mjs --published-c7 ... --candidate-c7 ... --published-c1 ... --candidate-c1 ... --gaps benchmarks/batch2/gaps-r2.json`.

---

# Round 1

**Result.** Of 58 families, credential-evidence's handoff marks 30 ready and 28 carrier-unresolved. The 30 ready rows were measured (frozen corpus, 486 cases) on the published baseline and on an exact unpublished candidate, across Node, WASM, Python and the CLI, whole and streamed. On the candidate all 200 positives pass (exact span, contract type, contract action) on every surface and stream, and all 203 controls are clean. On the published baseline 194 of 200 pass; the six misses are the `elastic:cloud-api-key` ApiKey header cases, already fixed by Batch 1 (core #1212, PR #1215). No new product gap was reproduced, so no core issue was filed. The 28 unresolved rows are not measured: not false negatives, true negatives or passing coverage.

| group | families | measured | not measured | already-covered / no-code | fixed by an existing core fix | contract-evidence conflict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| G1 (#740) | 23 | 15 | 8 | 15 | 0 | 0 |
| G2 (#741) | 13 | 5 | 8 | 5 | 0 | 0 |
| G3 (#742) | 12 | 4 | 8 | 4 | 0 | 0 |
| G4 (#743) | 4 | 2 | 2 | 1 | 1 (`elastic:cloud-api-key`) | 0 |
| G5 (#744) | 3 | 1 | 2 | 1 | 0 | 0 |
| G6 (#745) | 3 | 3 | 0 | 2 | 0 | 1 |

## Identity

- Baseline: `@redact-secret/core`, `@redact-secret/wasm` and the darwin-arm64 addon 0.1.0-beta.13 from npm (core integrity `sha512-qZkqRN7CIJ+pc0IteRCXSucr1l9KtTc/nJaM5wPL0NvCiZ4AGWLCyrLy8KD95a2MBgxo8vuUJ/UaKhrny7gMJQ==`), PyPI `redact-secret` 0.1.0b13, `redact-secret-cli` 0.1.0-beta.13 built from crates.io with `cargo install --locked`.
- Candidate: unpublished `redact-secret` commit `a148dadf4a43b5441ed88386d055428b2e278f25` (core main after PR #1231; no code change since `3b1a5aa9`; contains the Batch 1 fixes `af1e71e0`, #1202/#1204/#1206 and the #1227 second-wave detectors). Declared version 0.1.0-beta.13, not released. No candidate recipe was published by the core session, so the commit was pinned here. Built as in `evidence/717/README.md`: `npm ci`, `npm run js:build`, napi addon (`npm run build` in `bindings/node`), `npm run wasm:build`, `npm pack` of core, addon and wasm, `maturin develop --release`, `cargo build --release --locked -p redact-secret-cli`. Candidate tarball SHA-256: core `3cf936c45937b99799d89f922738f2f1ba78d377e21dd4fa92c3cde125a3798c` (same as the Batch 1 candidate: the TypeScript façade did not change), node addon `fa395bacca98afa52763f11f1ac20927938782547d26b9b5ab10170d8f04fdd1` and wasm `8ba5adfc56065fb5ef662777092f140b108997c1a44b78838586c9226659d9df` (host-bound).
- darwin-arm64, Node v22.16.0, streams in 7-byte chunks. No separate Rust-library harness exists; the CLI is the Rust surface.
- Peers: not run. `trufflehog` on PATH printed 3.97.6; this was a product-only diagnostic and no peer numbers are reported.
- Batch 1 replay on the candidate: identical to the accepted `af1e71e0` observations on 656 surface x case x mode entries (0 differences).

## Expectations

Authored from the evidence handoff slots and the adopted product contract (redact-secret #1231, merge `a148dadf`: field value `contextual_secret`, explicit Bearer `bearer_token`, Basic and ApiKey `authorization_credential` over the whole encoded value, default `redact`, `warn` for a low-entropy literal), frozen and committed (`53cabc74`, `benchmarks/batch2/FROZEN.json`, corpus `sha256:74fed38245503b63d55247f0da2da8e27a271de5467b3b06146ebef0c4f7a4f1`) before any scanner ran. Provider attribution is never an expectation. Values are built at runtime from filler; none is a provider key.

## Contract-evidence conflicts (recorded, not resolved)

- `x:oauth1-access-token-secret`: the evidence handoff lists `oauth_token` as a public lookalike; the adopted contract (#1225) keeps the default that reads it as `contextual_secret` and asserts nothing for it. The secret-half expectation passes; the `oauth_token` case is observed, not scored (flagged `contextual_secret` redact, as the contract's default predicts).
- `mongodb-atlas:programmatic-api-private-key`: the evidence marks it ready (Digest input, no wire carrier); the contract (#1226) names no layout and starts it at P2. Only the controls both sides agree on (Digest header, public key, redacted read) were observed, all clean; the row has no positive.
- `mongodb-atlas:database-user-password`: percent escapes in a connection-string password: the contract keeps them inside the span, the evidence records the encoding as unresolved. Observed, not scored; the password field and plain URI userinfo positives pass.

## Unsupported-policy boundaries observed

`x:app-only-bearer-token` percent-containing and escaped Bearer values: only the prefix before the first `%`/escape is redacted (`bearer_token`), the residual bytes stay in the output; never reported as full coverage and never scored. Prefixed header or member names, newline-separated values, values below the documented floors and the Atlas Digest curl form are observed and unscored (see `ledger.json`).

## Files

`readiness.json` / `readiness.md` (inventory), `report.json` / `report.md` (per-row results), `ledger.json` (58-row ledger), `observations-published.json`, `observations-candidate.json` (per case findings, no matched text); corpus `benchmarks/batch2/corpus.mjs`, scoring `benchmarks/batch2/score.mjs`.

## Reproduce

```bash
node scripts/measure-batch1.mjs --corpus ../benchmarks/batch2/corpus.mjs --label published --out published.json --node-root <npm install of beta.13> --wasm-dir <.../node_modules/@redact-secret/wasm> --python <venv redact-secret==0.1.0b13>/bin/python --cli <cargo install redact-secret-cli@0.1.0-beta.13>/bin/redact-secret --source-commit npm:@redact-secret/core@0.1.0-beta.13
node scripts/measure-batch1.mjs --corpus ../benchmarks/batch2/corpus.mjs --label candidate --out candidate.json --node-root <npm install of the three built tarballs> --wasm-dir <.../node_modules/@redact-secret/wasm> --python <venv, maturin develop --release> --cli <target/release/redact-secret> --source-commit a148dadf4a43b5441ed88386d055428b2e278f25
node scripts/measure-batch1.mjs --label candidate-batch1 --out b1.json ...same candidate flags...
node scripts/report-batch2.mjs --published published.json --candidate candidate.json --batch1-candidate b1.json
```

Nothing here repins, changes an official run, promotes support, releases, or touches owner acceptance or authority. Detector support status changes only through the credential-eval qualification after a release.
