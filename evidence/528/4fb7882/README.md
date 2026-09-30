# Evidence: Beta.12 graduation at product main 4fb7882 (#464, #528, #1012)

> **Superseded** by [`../99c8c2b/README.md`](../99c8c2b/README.md): the registry was re-pinned to product main `99c8c2b`
> (PR #1045). This file stays as history.

**Result:** candidate mode (product `4fb7882`, main after PRs #1037 and #1039) reads **113 stable of 135** scored
families (documented 81, empirical 32; 21 provisional, 1 pending). Published mode (`@redact-secret/core`
0.1.0-beta.11) reads **98 stable of 135** (68 / 30; 36 provisional, 1 pending); every new family is provisional there
because the release predates its detector. The support matrix reads 130 (candidate) and 115 (published) stable of 173
taxonomy families. Nothing here is a release claim, and no status was set by hand.

The registry is pinned to `4fb7882`, but the pinned revision has **no ACCEPTED performance evaluation**: both runs at
the pin breach reviewed budgets (below), so `pins:check` fails until the maintainer decides.

No matched plaintext or example credential is retained here.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `4fb78827f1ddf5b3106f25130ca510a836ada186` (main: PR #1039 on PR #1037), clean |
| `redact-secret-benchmarks` | `dd4bf9137ee81619ec9886ca6150ea926d8bfc76` (branch `beta12/bench-graduation`), clean; lockfile `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f` |
| Candidate artifacts (`benchmark:candidate`, declared 0.1.0-beta.11, darwin-arm64) | core `3e70490584e529be5097fc8a9a3655cb57a3d2f31b58ef173bf614aab4134b05`, node `de0f2839978d17879abe015dd683d7322b285b8283196e1bc1c91b1f4f0ed56f`, wasm `54fdece4853747171b9d7b4b6c7200e028480629a571c4ee6b19a422606e1d46` |
| Candidate run | `23d8899a-e9c8-457b-89ff-18517909539d`: complete, full suite, 5,886 fixtures, corpus `c7a1c1d7b51677639584aa9b812563aad50e91b6c62bc747c70861236debc6e6` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate` inside `benchmark:candidate`) |
| Classification | candidate `8d944ba4-a34f-419c-84dd-ff098cbf4d8c` ([`support-status-candidate.json`](support-status-candidate.json)); published `00f6e432-0d2a-4ed4-a2e5-8ba049d2afef` ([`support-status-published.json`](support-status-published.json)) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`, version checked before each run) |

## Stable counts, both modes

| Measured at | Mode | `eval:classify` | `eval:matrix` |
| --- | --- | --- | --- |
| develop `67e1046` (before) | published 0.1.0-beta.11 | 98 / 110 | 115 / 172 |
| develop `67e1046` (before) | candidate 4fb7882 | 96 / 110 | 109 / 172 |
| this branch `dd4bf91` (after) | published 0.1.0-beta.11 | 98 / 135 | 115 / 173 |
| this branch `dd4bf91` (after) | candidate 4fb7882 | 113 / 135 | 130 / 173 |

Before, candidate mode read lower than published because 355 rows it raises had no ledger entry; the re-triage below
records them.

**New scored families stable in candidate mode (12):** `axiom-token`, `axiom-personal-token`, `clojars-deploy-token`,
`crates-io-token`, `crates-io-trusted-publishing-token`, `dynatrace-token`, `honeycomb-api-key`, `nvidia-api-key`,
`polar-api-credential`, `rubygems-api-key`, `sonarqube-token`, `sonarqube-analysis-token`.

**Older families stable in candidate mode once its rows are triaged (5):** `cohere-api-key`, `datadog-application-key`,
`github-token`, `groq-api-key`, `mistral-api-key`.

**New scored families still provisional (13), each on the evaluator's own gates:**

- Benign controls the product flags: `daytona-api-key`, `clickhouse-cloud-api-secret`, `browserbase-api-key`,
  `cerebras-api-key`, `runpod-api-key`, `bitwarden-secrets-manager-access-token`, `polar-token`, `paddle-api-key`. Part
  are placeholders (redact-secret#1042), part are random near-miss or encoded values under a provider-named variable
  that `generic-token` redacts under the #948 policy (a corpus relabel under
  `docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`, not done here), and one is a
  genuine Pinecone key authored as a Cerebras control.
- Corpus below the empirical profile size: `google-oauth-client-secret` (35 of 40 fixtures, 6 of 8 twin pairs) and the
  three Vercel per-class types (29 of 40, plus the #1042 placeholder).
- `aws-secret-access-key`: the corroborated route is short (see `benchmarks/support/empirical-observations.json`), and
  two T3 policy fixtures (a value above its AKIA line, a prose "secret access key is …" phrase) are not reported: the
  product claims only the line of, or directly below, an AKIA/ASIA ID and a name followed by `=` or `:`.

## Review-ledger triage

Carried by structural identity: 2,869 rows (the graduation re-keys the #464/#528 fixture rows; the gitleaks buffer
change re-keys gitleaks rows). The 329 open #528 differential rows: 288 resolved, 36 open
`differential-coverage-gap/<family>/<peer>` (the published release predates the detector; the candidate reports the
authored span with its own family), 5 open `benign-false-alarm-unconfirmed/generic-token`. The 154 open #464 rows: 128
resolved, 26 open under the same classes. Candidate mode raises 721 rows: 537 resolved, 181 not assertable under
`decision=differential.peer-coarser-classification`, 3 open.

## Known gaps

| Record | State | Fixing commit | At 4fb7882 (run above) |
| --- | --- | --- | --- |
| product-1015 (`sk-ant-admin01-` placeholder) | fixed | `4fa06aeb` | silent |
| product-1016 (Kubernetes `name:`/`value:`) | fixed | `39bf06f7` | 3/3 authored spans, redact |
| product-1017 (Deepgram `createClient`, WebSocket subprotocol) | fixed | `7e0bad0a` | 2/2 redact |
| product-1038 (`os.environ["NAME"] = "…"`) | fixed | `b3beba41` | redact |
| product-1018 (LiteLLM `masked_api_key` row, new) | fixed | `67afc725` | redact; moved out of the removed product-932-masked-key-policy |
| product-1041 (`placeholder-not-a-key` under `secret_access_key`) | promoted | — | redacted (new since #1026) |
| product-1042 (seven placeholder controls) | promoted | — | redacted or warned |

They stop at `fixed`: `verified` needs product conformance evidence, and product main has no
`benchmark-gap-1015…1018`/`-1038` manifest records yet. Its Artifact qualification at `4fb7882`
([run 36663697022](https://github.com/redact-secret/redact-secret/actions/runs/36663697022)) also fails on the MCP golden
path (redact-secret#1040). The product manifest record `benchmark-gap-932-masked-key-policy` now points at a removed
known-gap record and needs repointing to `benchmark-gap-1018` on the product side.

## Performance at the pin

`performance-evaluation.yml` was dispatched twice on this branch against candidate `4fb7882`, paired with baseline
0.1.0-beta.8 (`3144bb3`): runs [36664267964](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36664267964)
and [36665636535](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36665636535), reports in
[`perf-36664267964/`](perf-36664267964/) and [`perf-36665636535/`](perf-36665636535/). Both are **REGRESSION**. Latency
(10) and memory (16) are within budget; the absolute acceptance criteria pass. No tradeoff is recorded: the 1db8ff3
acceptances do not carry over, and the maintainer decides.

| Trigger | Baseline (0.1.0-beta.8) | Measured at 4fb7882 | Allowed increase |
| --- | ---: | ---: | ---: |
| `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` | 1 | 1.268 (run 1), 1.472 (run 2) | 0.25 |
| `size/wasm/full/gzip` | 137,639 | 205,227 | 6,882 |
| `size/wasm/common/gzip` | 100,058 | 136,250 | 5,003 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 212,609 | 7,225 |

Not evaluated by the workflow, measured on the candidate tarballs above (darwin-arm64): `size/npm/core/packed` 41,944
(within 39,461 + 4,096); `size/npm/node-darwin-arm64/packed` 674,797 (baseline 424,514); `size/npm/wasm/packed` 953,344
(baseline 254,413); `size/node-addon/aarch64-apple-darwin` 1,513,392 (baseline 1,004,128).

## Commands

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"
# product worktree at 4fb7882 (clean)
npm run benchmark:candidate -- --benchmark-ref dd4bf9137ee81619ec9886ca6150ea926d8bfc76 \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at dd4bf91 (clean)
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.11.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.11.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.11.tgz \
  --candidate-source-commit=4fb78827f1ddf5b3106f25130ca510a836ada186 --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
gh workflow run performance-evaluation.yml --ref beta12/bench-graduation -f candidate_revision=4fb78827f1ddf5b3106f25130ca510a836ada186
```
