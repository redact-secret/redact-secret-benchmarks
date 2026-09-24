# Evidence: redact-secret#575 — second existing-family stabilization batch and Epic A qualification

**Result:** PASS. All seven selected taxonomy families are `stable`, so 15
existing families have now moved from `provisional` to `stable` against the
beta.6 baseline (8 in #642, 7 here). None of the 41 previously stable existing
families regressed. The full 93-family matrix reports 49 `stable`. The
candidate misses no T1/T2 expected span (0 leaked), and the three Microsoft
Entra leading-dash misses that blocked #642 are fixed.

This file records the benchmark side of
[redact-secret/redact-secret#575](https://github.com/redact-secret/redact-secret/issues/575)
and its two product fixes,
[#707](https://github.com/redact-secret/redact-secret/issues/707) and
[#708](https://github.com/redact-secret/redact-secret/issues/708), per
[`evidence/README.md`](../README.md). It retains no matched plaintext and no
full example credential.

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` candidate | `023367441dfa3314cd19890fed2ef68281ada5fd`, clean, branch `workbench/575-epic-a-final-batch` (contains the #707 and #708 fixes) |
| `redact-secret-benchmarks` corpus and contracts (candidate run) | `55c65e628a79a5085590d33fb757d122c426c9bc`, clean, branch `workbench/112-retier-provider-families` |
| `redact-secret-benchmarks` corpus, contracts and ledger (classification run) | `6e2567d6f2f84dc1061cf5b34f2660772a8bf372`, clean, same branch; differs from `55c65e6` only in `benchmarks/review-ledger.json` |
| #642 comparison matrix | [`evidence/642`](../642/README.md), benchmark `eceaf0a055a3552ee3d470c8e4a302a9c2787288`, 42 stable, including all 33 beta.6 baseline families |

## Pinned scanners and artifacts

The runs used a `redact-secret` candidate at 0.1.0-beta.7, gitleaks 8.30.1
and trufflehog 3.97.4. The candidate artifacts were installed from isolated
npm tarballs:

- core facade SHA-256: `8b6e759b98201ebfed797a5389eca57a3aa52fef1bc96783d522c60418662520`
- node darwin-arm64 SHA-256: `4b85d11e988eee1167269166973c67cca4bb19ea9cb5f101a5fae23fdcea2cd5`
- wasm SHA-256: `fb3bf38a9eee05d466f464440ae72564b4ad2333de227b30a8b274019264136a`

The facade hash is unchanged from #642 because the facade is JavaScript
only. The detector changes are in the node and wasm artifacts.

- **Candidate-only run** `20414439-a9a6-4977-87b6-cbb0bc27f8c2`: complete,
  1,466 of 1,466 fixtures scanned and written, corpus hash
  `29bde22bb7488be6ff18c8453d0090b6fe3403fac82de1de2540a0898068601c`. The raw
  record is [`candidate-evidence-v1.json`](candidate-evidence-v1.json).
- **Pinned support classification** `6e727b2f-dd5b-4aac-ae6d-1b1c7e887248`:
  4,444 cases / 11,917 variants, all three scanners complete, benchmark
  working tree clean. The aggregate records are
  [`support-status.json`](support-status.json) and
  [`support-matrix.json`](support-matrix.json).

## Target result

| Detector / taxonomy family | Tier | Twin pairs | Benign cases / axes | Unresolved or failing gates | Status |
| --- | --- | ---: | ---: | ---: | --- |
| `datadog-api-key` / `datadog:api-key` | T1 | 11 | 5 / 3 | 0 | stable |
| `datadog-application-key` / `datadog:application-key` | T1 | 6 | 5 / 4 | 0 | stable |
| `docker-token` / `docker:personal-access-token`, `docker:oauth-access-token` | T1 | 16 | 7 / 3 | 0 | stable |
| `huggingface-token` / `huggingface:api-token` | T1 | 7 | 7 / 3 | 0 | stable |
| `microsoft-entra-client-secret` / `microsoft-entra:application-client-secret` | T1 | 17 | 7 / 3 | 0 | stable |
| `new-relic-license-key` / `new-relic:license-key` | T1 | 9 | 5 / 3 | 0 | stable |

Each T1 `providerSource` and its `covers` text are in `benchmarks/lib/assessment.ts`,
taken from the product-side research records
`redact-secret/docs/audits/evidence/{644,645,647,648,654,655,656}`. The
`review` text of each contract keeps every contradiction those records found.
Two of the T1 sources are SDK-reference material on the provider's domain:
Entra's is an example and Hugging Face's is a type annotation. Accepting
them is the maintainer's ruling, on the same footing as the `google-api-key`
example source in #642.

Matrix against #642: the seven families above are the only status changes,
42 → 49 `stable`. There are no regressions.

## Product fixes verified in this candidate

| Product issue | Benchmark known gap | Fixtures | Candidate outcome |
| --- | --- | --- | --- |
| #707: the Entra lead rejected `-` | `product-707` | `detector-coverage--microsoft-entra-client-secret-leading-dash-{bare,quoted,unicode-crlf}` | EXACT (were MISS in #642) |
| #708: docker rejected the 27-byte `dckr_oat_` body | `product-708` | the new `oat-27` positives in detector-coverage | EXACT |

All twins and controls for both families are clean, including the 26- and
28-byte OAT twins and the leading-dash missing-marker and short-suffix
controls.

## Ledger work in this batch

`6e2567d` adds 80 rows. 65 are differential rows resolved as
`range-matches-corpus`: the candidate span matched the authored expectation,
and the peer's divergence is explained against the contract, for example
gitleaks' Entra rule excludes a leading `-` and trufflehog accepts only a
32-byte OAT body. The other 15 are docker `oat-27` mutation rows marked
`not-assertable`, because each mutant falls outside the widened contract.
`55c65e6` also carries 240 settled #642 rows forward to their re-keyed ids
unchanged, after the detector-coverage source hash changed.

## Global gates

- T1/T2 leaked spans: 0. The candidate run has no `MISS` on any
  `must-redact` fixture.
- One pre-existing `must-not-flag` outcome remains: `flagged:1` on
  `detector-coverage--heroku-api-key-legacy-public-id` (T2). It is identical
  in #642's run. The family is `provisional` and outside this epic.
- The #574 committed families show no regression. `heroku:oauth-access-token`
  stays `stable`. Netlify and Confluent read `provisional` in this
  candidate-mode classification only because their differential rows were
  settled for published mode (benchmarks #175/#176) and candidate-mode ledger
  ids hash differently. The published matrix counts them as `stable`.

## Update 2026-09-23: clean-main qualification

Both branches merged, as redact-secret PR #709 (main `44bb3d60ca60c42a039bb69326040156994c2cb1`;
fix commit `dc855b6222928252a661945828f88a3022e768fd`) and redact-secret-benchmarks
PR #178 (main `186e6e7053195ad14ebecf823c1cb269d3496654`). The merges rewrote the branch
commits above. The measurement was repeated at both clean mains with the same pinned scanners
(gitleaks 8.30.1, trufflehog 3.97.4):

- **Candidate run** `a9862a93-f185-4abf-94fd-a71d17504fd8`: complete, 1,466 of 1,466
  fixtures, corpus hash `29bde22bb7488be6ff18c8453d0090b6fe3403fac82de1de2540a0898068601c`
  (unchanged), 0 `MISS`. The only `must-not-flag` outcome is the same pre-existing
  heroku-legacy `flagged:1`. Node artifact SHA-256
  `d4d90ede5548722a8a606e0d7ab241e0f2ec59d5ea3159bcaf375f8ab1eb220f`; the facade and wasm
  hashes are unchanged from the branch run.
- **Pinned candidate-mode classification** `715d2d8e-0862-4ba8-9ef2-18b90091030c`: 4,444
  cases / 11,917 variants, benchmark tree clean. The 93-family matrix has **49 `stable`**,
  23 `provisional`, 2 `pending` and 19 `unsupported`. It matches the branch run family for
  family: no regression and no extra change.

The raw records are in [`clean-main/`](clean-main/): `candidate-evidence-v1.json`,
`support-status.json` and `support-matrix.json`. With this, Epic A's final measurement
exists at clean mains.

A published-mode classification at the same benchmark main (`3797613a-a5d0-44a6-9d3c-dbe6caf968ea`,
default product = published `@redact-secret/core` 0.1.0-beta.6) reports 43 `stable`.
In that mode Entra, Docker, New Relic license, Datadog application key and the #574
families stay `provisional`, because beta.6 does not contain the detector changes. Their
open ledger rows there (for example `differential-coverage-gap/new-relic-license-key` and
`differential-coverage-gap/microsoft-entra-client-secret`) are real beta.6 misses. They
can only be resolved against a published beta.7.

### Follow-up: #574 candidate-mode rows and matrix

This follow-up branch adds 12 candidate-mode ledger rows. They settle the only open
gate on `netlify-token` and `confluent-cloud-api-secret`: the candidate span matches
the authored T1 expectation, and both peers report these tokens only beside a
provider keyword. The pinned classification at `43b2d615a0d9fd4a2d49dbaeb1e36c86ea6c856e`
(run `8a2e90a9-e7f9-4731-ae87-ae8c41d018ce`, candidate `44bb3d6`) reports
**51 `stable`**. The only status changes from `715d2d8e` are those two families. The
same branch moves known gaps `product-707`/`product-708` to `fixed` (fix
`dc855b6`), and re-points `benchmarks/pin-manifest.json` from a pre-merge branch
revision to `186e6e7`, with content unchanged.

Before running classify, check `trufflehog --version`. The binary auto-updates
itself when invoked without `--no-update`, and a 3.97.8 binary under a
`3.97.4` directory name re-keys every peer-dependent ledger id: the same tree
then reported 7 `stable`.

## Commands

From the clean product worktree:

```sh
npm run benchmark:candidate -- \
  --benchmark-ref 55c65e628a79a5085590d33fb757d122c426c9bc \
  --benchmark-repo <clean redact-secret-benchmarks checkout> \
  --output-dir <candidate-output>
```

From the clean benchmark worktree at `6e2567d`, with trufflehog 3.97.4 first
on `PATH`:

```sh
npm run eval:classify -- \
  --output=<support-status.json> \
  --candidate-package=<candidate-output>/artifacts/redact-secret-core-0.1.0-beta.7.tgz \
  --candidate-node-package=<candidate-output>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.7.tgz \
  --candidate-wasm-package=<candidate-output>/artifacts/redact-secret-wasm-0.1.0-beta.7.tgz \
  --candidate-source-commit=023367441dfa3314cd19890fed2ef68281ada5fd
npm run eval:matrix -- --input=<support-status.json> --output=<support-matrix.json>
```
