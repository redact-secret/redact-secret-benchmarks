# Batch 2 (#739): measurement of the 30 ready families, 58-family disposition ledger

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
