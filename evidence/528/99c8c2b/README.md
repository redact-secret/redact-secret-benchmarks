# Evidence: Beta.12 graduation re-pinned to product main 99c8c2b (#464, #528, #1012)

Supersedes [`../4fb7882/README.md`](../4fb7882/README.md), which stays as history.

**Result:** candidate mode (product `99c8c2b`, main after PR #1045) reads **118 stable of 135** scored families
(documented 86, empirical 32; 16 provisional, 1 pending); `eval:matrix` 135 of 173. Published mode
(`@redact-secret/core` 0.1.0-beta.11) is unchanged at **98 of 135** (115 of 173). No status was set by hand, and nothing
here is a release claim. The pinned revision still has **no ACCEPTED regression-budget evaluation**: the three size
rows below breach, so `pins:check` fails until the maintainer decides.

No matched plaintext or example credential is retained here.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `99c8c2b33e99142620bcc66f115200ca615d6d0a` (main: PR #1045 — #1040 to #1044 and the benchmark-gap conformance records), clean |
| `redact-secret-benchmarks` | `3870c5fdd429ed50d32cbaf2007b33c68961da76` (branch `beta12/bench-graduation`), clean; lockfile `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f` |
| Candidate artifacts (`benchmark:candidate`, declared 0.1.0-beta.11, darwin-arm64) | core `3e70490584e529be5097fc8a9a3655cb57a3d2f31b58ef173bf614aab4134b05` (the JavaScript facade is unchanged since 4fb7882), node `a24717c33477dba47be2227e4af93d7c14c9503b94f294b3b475eae65c33e1bf`, wasm `b4b6deeb4e3049686be100bfc3dca8338518eb32b398cb37b85b637ae7ba36ac` |
| Candidate run | `2e45374e-56e4-4e6a-9c0b-77d48ec3e841`: complete, full suite, 5,886 fixtures, corpus `1fa4d9d353a975ecb36c2194203da841b82211a62a0025241018aca444228d98` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`) |
| Classification | candidate `46ca9da8-6d09-4fd5-a3eb-53d0800aa1c1` ([`support-status-candidate.json`](support-status-candidate.json)); published `7bf18be8-2920-472b-98cc-f8d04ec656ab` ([`support-status-published.json`](support-status-published.json)) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`, version checked) |

## Stable counts, both modes

| Measured at | Mode | `eval:classify` | `eval:matrix` |
| --- | --- | --- | --- |
| develop `67e1046` | published 0.1.0-beta.11 | 98 / 110 | 115 / 172 |
| develop `67e1046` | candidate 4fb7882 | 96 / 110 | 109 / 172 |
| branch `dd4bf91` | candidate 4fb7882 | 113 / 135 | 130 / 173 |
| branch `3870c5f` | published 0.1.0-beta.11 | 98 / 135 | 115 / 173 |
| branch `3870c5f` | candidate 99c8c2b | **118 / 135** | **135 / 173** |

Newly stable in candidate mode since 4fb7882 (5): `bitwarden-secrets-manager-access-token`, `clickhouse-cloud-api-secret`
and `paddle-api-key` (their placeholder controls are silent since redact-secret#1042), `browserbase-api-key` and
`runpod-api-key` (their provider-named near-miss controls are relabelled under the #948 decision, below, and the
placeholder is silent).

Still provisional among the new families (8):

- `daytona-api-key`: `RUNNER_API_KEY=<64 hex>` is redacted by `generic-token` (not a provider-named variable, so not
  relabelled).
- `cerebras-api-key`: two Pinecone-shaped controls (one reported by the typed `pinecone-api-key` detector, one an SDK
  keyword argument) and the Pinecone neighbour on a positive.
- `polar-token`: the Polar checkout `clientSecret` object member (a public id by construction) is redacted by
  `generic-token`.
- `aws-secret-access-key`: corroborated route short (2 references, 2 owners; see
  `benchmarks/support/empirical-observations.json`). Its two T3 policy fixtures that were missed at 4fb7882 (value above
  the AKIA line, the `secret access key for … :` phrase) are exact at 99c8c2b (redact-secret#1044).
- `google-oauth-client-secret`, `vercel-personal-access-token`, `vercel-app-access-token`, `vercel-app-refresh-token`:
  corpus below the stable-empirical profile (35 and 29 of 40 fixtures; twin pairs 6 and 7 of 8).

## #948 relabel applied to four #464 controls

Per [`docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](../../../docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md)
(section "Application to the #464 corpus"): `DAYTONA_API_KEY`, `BROWSERBASE_API_KEY`, `REDIRECTPIZZA_API_TOKEN` and
`RUNPOD_S3_SECRET_KEY` near-miss controls move to `policy`/T3 on `generic-token` (redact). The four review rows move to
their new ids and resolve as `range-matches-corpus`; the candidate reports each authored span exactly.

## Known gaps

All seven records reach `verified` at this pin. The candidate run above meets every fixture's expectation:

| Record | Fixing commit | Product record (productConformance passed) | Fixtures at 99c8c2b |
| --- | --- | --- | --- |
| product-1015 | `4fa06aeb` | benchmark-gap-1015 | 1 control silent |
| product-1016 | `39bf06f7` | benchmark-gap-1016 | 3/3 EXACT |
| product-1017 | `7e0bad0a` | benchmark-gap-1017 | 2/2 EXACT |
| product-1018 | `67afc725` | benchmark-gap-1018 | 1/1 EXACT |
| product-1038 | `b3beba41` | benchmark-gap-1038 | 1/1 EXACT |
| product-1041 | `3d4f9a7d` | benchmark-gap-1041 | 1 control silent |
| product-1042 | `3e53ea06` | benchmark-gap-1042 | 7 controls silent |

Product conformance is Artifact qualification [run 36681168598](https://github.com/redact-secret/redact-secret/actions/runs/36681168598)
(the Rust native host on ubuntu, macOS and Windows, browser WebAssembly on Chromium, Firefox and WebKit, the CLI, the
addon, the Python wheel and the MCP golden path all pass). The run's conclusion is `failure` only because its benchmark
pin-drift job finds the product pin's benchmarks commit (`4098786`, this branch) not yet on benchmarks `develop`, and
the inventory job aggregates that; the same holds for main's run 36683448754 at 99c8c2b. Both clear when this branch
lands. `benchmarkRevalidation` in the product manifest stays pending until this evidence reaches benchmarks `main`.

## Performance at the pin

Runs [36683611495](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36683611495) and
[36683614390](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36683614390), dispatched on this
branch against candidate `99c8c2b`, paired with baseline 0.1.0-beta.8 (`3144bb3`); reports in
[`perf-36683611495/`](perf-36683611495/) and [`perf-36683614390/`](perf-36683614390/). Both read **REGRESSION** on size
only. Latency (10), initialization (10; browser-wasm small-whole ratio 1.233 and 1.202 against the 1.25 ceiling) and
memory (16) are within budget; the absolute acceptance criteria pass. No tradeoff is recorded.

| Trigger | Baseline (0.1.0-beta.8) | Measured at 99c8c2b (both runs) | Allowed increase |
| --- | ---: | ---: | ---: |
| `size/wasm/full/gzip` | 137,639 | 203,748 | 6,882 |
| `size/wasm/common/gzip` | 100,058 | 137,650 | 5,003 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 211,130 | 7,225 |

Measured on the candidate tarballs above (darwin-arm64), not evaluated by the workflow: `size/npm/core/packed` 41,944
(within 39,461 + 4,096); `size/npm/node-darwin-arm64/packed` 670,578 (baseline 424,514); `size/npm/wasm/packed` 954,396
(baseline 254,413); `size/node-addon/aarch64-apple-darwin` 1,494,656 (baseline 1,004,128).
