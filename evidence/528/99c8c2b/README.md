# Evidence: Beta.12 graduation re-pinned to product main 99c8c2b (#464, #528, #1012)

Supersedes [`../4fb7882/README.md`](../4fb7882/README.md), which stays as history.

**Result:** candidate mode (product `99c8c2b`, main after PR #1045) reads **126 stable of 135** scored families
(documented 89, empirical 37; 8 provisional, 1 pending); `eval:matrix` 143 of 173. Published mode (`@redact-secret/core`
0.1.0-beta.11) is unchanged at **98 of 135** (115 of 173). No status was set by hand, and nothing here is a release
claim. Every family new in Beta.12 is stable in candidate mode. The pinned revision has an ACCEPTED performance
evaluation (run 36692811573, three size rows accepted by the maintainer on 2026-09-30), so `pins:check` passes.

No matched plaintext or example credential is retained here.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `99c8c2b33e99142620bcc66f115200ca615d6d0a` (main: PR #1045 — #1040 to #1044 and the benchmark-gap conformance records), clean |
| `redact-secret-benchmarks` | `96fe6cf2c3863771c60210ebbb0d91fddce468f7` (branch `beta12/bench-graduation`), clean; lockfile `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f` |
| Candidate artifacts (`benchmark:candidate`, declared 0.1.0-beta.11, darwin-arm64) | core `3e70490584e529be5097fc8a9a3655cb57a3d2f31b58ef173bf614aab4134b05` (the JavaScript facade is unchanged since 4fb7882), node `a24717c33477dba47be2227e4af93d7c14c9503b94f294b3b475eae65c33e1bf`, wasm `b4b6deeb4e3049686be100bfc3dca8338518eb32b398cb37b85b637ae7ba36ac` |
| Candidate run | `e5866f19-4b5f-4e67-ac0a-40f14c1fd4e3`: complete, full suite, 5,925 fixtures, corpus `529b020f6460e9daa5be50e8167fb23f298d38c1cfdee33f5df1599f41340991` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`) |
| Classification | candidate `0bfa0d25-4850-45a7-9ec7-cf9d3c29eb23` ([`support-status-candidate.json`](support-status-candidate.json)); published `db9efb67-82b4-4aa1-abab-1ec5a2f2af80` ([`support-status-published.json`](support-status-published.json)) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`, version checked) |

## Stable counts, both modes

| Measured at | Mode | `eval:classify` | `eval:matrix` |
| --- | --- | --- | --- |
| develop `67e1046` | published 0.1.0-beta.11 | 98 / 110 | 115 / 172 |
| develop `67e1046` | candidate 4fb7882 | 96 / 110 | 109 / 172 |
| branch `dd4bf91` | candidate 4fb7882 | 113 / 135 | 130 / 173 |
| branch `3870c5f` | candidate 99c8c2b | 118 / 135 | 135 / 173 |
| branch `96fe6cf` | published 0.1.0-beta.11 | 98 / 135 | 115 / 173 |
| branch `96fe6cf` | candidate 99c8c2b | **126 / 135** | **143 / 173** |

Stable in candidate mode since 4fb7882 (13): `bitwarden-secrets-manager-access-token`, `clickhouse-cloud-api-secret` and
`paddle-api-key` (placeholders silent since redact-secret#1042); `browserbase-api-key` and `runpod-api-key` (#948
relabel); `daytona-api-key`, `cerebras-api-key` and `polar-token` (credential-named and typed-neighbour redactions
accepted as policy, below); `aws-secret-access-key` (corroborated route met; the #1044 adjacency and phrase fixtures are
exact); `google-oauth-client-secret` and the three Vercel per-class types (profiles completed to 40 fixtures).

Still provisional (8), none new in Beta.12: `bearer-token`, `connection-string`, `generic-token` and `otpauth-uri` (the
protected policy holdout has not run on a frozen candidate), `deepgram-api-key` (2 metamorphic failures),
`okta-api-token` (4 unresolved contradictions), `slack-app-level-token` and `together-ai-api-key` (corroboration short;
rulings Q-SL and Q-TG). `vercel-token` stays pending (T0 aggregate).

## Relabels (security-first: redaction accepted as policy)

Per [`docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](../../../docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md)
(section "Application to the #464 corpus"): `DAYTONA_API_KEY`, `BROWSERBASE_API_KEY`, `REDIRECTPIZZA_API_TOKEN` and
`RUNPOD_S3_SECRET_KEY` near-miss controls move to `policy`/T3 on `generic-token` (redact). The four review rows move to
their new ids and resolve as `range-matches-corpus`; the candidate reports each authored span exactly. The #1012
`AWS_SECRET_ACCESS_KEY=<12-byte near miss>` joins the same list at `warn`.

Per [`docs/decisions/2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md`](../../../docs/decisions/2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md):
`RUNNER_API_KEY=<64 hex>`, the `Pinecone(api_key=…)` argument and the Polar checkout `clientSecret` member are policy/T3
`generic-token` redact rows; the `PINECONE_API_KEY=pcsk_…` control is a policy/T3 `pinecone-api-key` row (the typed
finding is expected); the Pinecone key beside the Cerebras positive is an authored companion span.

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
[36683614390](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36683614390) (reports in
[`perf-36683611495/`](perf-36683611495/) and [`perf-36683614390/`](perf-36683614390/)) read REGRESSION on three size rows
only. The maintainer accepted them on 2026-09-30 (option A; `benchmarks/accepted-regressions.json`, candidate 99c8c2b
only; reason: the Beta.12 detector additions, about 26 families, partly offset by #1043). Run
[36692811573](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36692811573), dispatched on this branch
after that record, is **ACCEPTED** ([`../99c8c2b-verified/`](../99c8c2b-verified/)); `performance-criteria.json`
`baseline.verifiedCommit` advances to 99c8c2b. Latency (10), initialization (10; browser-wasm small-whole ratio 1.233,
1.202 and 1.074) and memory (16) are within budget.

| Trigger | Baseline (0.1.0-beta.8) | Measured at 99c8c2b | Allowed increase | Verdict |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 203,748 | 6,882 | accepted tradeoff |
| `size/wasm/common/gzip` | 100,058 | 137,650 | 5,003 | accepted tradeoff |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 211,130 | 7,225 | accepted tradeoff |

Informational, not evaluated by the workflow and not recorded as tradeoffs (the same class the maintainer accepted for
Beta.11), measured on the candidate tarballs above (darwin-arm64,
[`../99c8c2b-verified/npm-packed-sizes.json`](../99c8c2b-verified/npm-packed-sizes.json)): `size/npm/core/packed` 41,944
(within 39,461 + 4,096); `size/npm/node-darwin-arm64/packed` 670,578 (baseline 424,514); `size/npm/wasm/packed` 954,396
(baseline 254,413); `size/node-addon/aarch64-apple-darwin` 1,494,656 (baseline 1,004,128).
