# Evidence: redact-secret#642 — first existing-family stabilization batch

**Result:** TARGET PASS, GLOBAL GATE BLOCKED — all eight requested taxonomy
families are `stable`, the 33-family baseline has zero regressions, and the
current matrix reports 42 `stable`; the full candidate still has 3 leaked T2
spans, all in the separately scoped Microsoft Entra leading-dash fixtures.

This file records the benchmark side of
[redact-secret/redact-secret#642](https://github.com/redact-secret/redact-secret/issues/642),
per [`evidence/README.md`](../README.md). No matched plaintext or full example
credential is retained here.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `63d33678124e919c83d03965df9cca4a8b3069ba`, clean, branch `workbench/642-retier-provider-families` |
| `redact-secret-benchmarks` corpus, contracts, and ledger | `eceaf0a055a3552ee3d470c8e4a302a9c2787288`, clean, branch `workbench/112-retier-provider-families` |
| 33-stable comparison baseline | `30967da825665f678f15e4f1fdaafbb3e214d6e5`, clean, published `@redact-secret/core` 0.1.0-beta.6 |

## Pinned scanners and artifacts

The support run used `redact-secret` candidate 0.1.0-beta.7, gitleaks 8.30.1,
and trufflehog 3.97.4. Candidate artifacts were installed from isolated npm
tarballs:

- core facade SHA-256: `8b6e759b98201ebfed797a5389eca57a3aa52fef1bc96783d522c60418662520`
- node darwin-arm64 SHA-256: `0295ca8209dfc9cbd1bca166e5ab9b9f3b90ae76a0ffe3b1a0d0fac0e03c5639`
- wasm SHA-256: `47b731c88845a7bcd365fb03164edf3a04f9650cf997bf415c29a835c47cd40b`

The candidate-only full-corpus run is `53b7a5e8-99a9-45d1-a1e6-6a7635a42708`:
status `complete`, 1,442/1,442 fixtures scanned and written, corpus hash
`2b9fa53a03d42462d57a7fecb7e86d1eb63191fc36130e40f3d52fad5bd40b74`,
and no execution failures. The sanitized raw record is
[`candidate-evidence-v1.json`](candidate-evidence-v1.json).

The pinned support-classification run is
`070a23b2-4952-4860-acb1-6ef6c46c3016`: 4,391 cases / 11,805 variants, all
three scanners complete, benchmark working tree clean. Its aggregate records
are [`support-status.json`](support-status.json) and
[`support-matrix.json`](support-matrix.json).

## Target result

| Detector / taxonomy family | Tier | Twin pairs | Benign cases / axes | Unresolved or failing gates | Status |
| --- | --- | ---: | ---: | ---: | --- |
| `anthropic-token` / `anthropic:secret-api-key` | T1 | 6 | 5 / 3 | 0 | stable |
| `linear-token` / `linear:personal-api-key` | T1 | 5 | 10 / 3 | 0 | stable |
| `notion-token` / `notion:legacy-integration-token` | T1 | 6 | 5 / 3 | 0 | stable |
| `new-relic-user-api-key` / `new-relic:user-api-key` | T1 | 11 | 5 / 3 | 0 | stable |
| `grafana-cloud-access-policy-token` / `grafana:cloud-access-policy-token` | T1 | 11 | 5 / 3 | 0 | stable |
| `grafana-service-account-token` / `grafana:service-account-token` | T1 | 11 | 5 / 3 | 0 | stable |
| `azure-devops-personal-access-token` / `azure-devops:personal-access-token` | T1 | 6 | 5 / 3 | 0 | stable |
| `google-api-key` / `google:generic-api-key` | T1 | 6 | 5 / 3 | 0 | stable |

The old baseline contains 33 stable taxonomy families. All 33 remain stable.
The eight rows above are the expected improvements. The current 93-family
taxonomy totals 42 stable rather than 41 because
`heroku:oauth-access-token` is a new stable family not present in the old
79-family baseline.

## Remaining global blocker

The full candidate evidence has 392 expected T1/T2 spans and 3 misses, so the
global leaked-span count is not zero. All three are the bare, quoted, and
Unicode/CRLF contexts of
`detector-coverage--microsoft-entra-client-secret-leading-dash-*`. They are
outside this eight-family batch and are already named as a grammar mismatch in
[redact-secret#655](https://github.com/redact-secret/redact-secret/issues/655).
The benchmark expectation stays intact; this must go through the product
promotion lifecycle rather than being hidden by changing the corpus.

## Commands

From the clean product worktree:

```sh
npm run benchmark:candidate -- \
  --benchmark-ref eceaf0a055a3552ee3d470c8e4a302a9c2787288 \
  --benchmark-repo <clean redact-secret-benchmarks checkout> \
  --output-dir <candidate-output>
```

From the clean benchmark worktree, with trufflehog 3.97.4 first on `PATH`:

```sh
npm run eval:classify -- \
  --output=<support-status.json> \
  --candidate-package=<candidate-output>/artifacts/redact-secret-core-0.1.0-beta.7.tgz \
  --candidate-node-package=<candidate-output>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.7.tgz \
  --candidate-wasm-package=<candidate-output>/artifacts/redact-secret-wasm-0.1.0-beta.7.tgz \
  --candidate-source-commit=63d33678124e919c83d03965df9cca4a8b3069ba
npm run eval:matrix -- --input=<support-status.json> --output=<support-matrix.json>
```
