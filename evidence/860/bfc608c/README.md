# Evidence: Beta.12 code candidate bfc608c, candidate and published classification (trufflehog 3.97.4)

**Result:** candidate mode (product `bfc608cce75f79f6a5cab037d7e558ba629777f6`, main after PR #1101) reads **126 stable of
135** registered families (documented 88, empirical 38; 8 provisional, 1 pending). Published mode
(`@redact-secret/core` 0.1.0-beta.11 from npm) reads **97 stable of 135** (documented 67, empirical 30; 37 provisional,
1 pending). The support matrix generated from the candidate file reads **140 stable, 11 provisional, 5 pending and 17
unsupported of 173** taxonomy families (beta.11: 105/20/9/18 of 152). Nothing here is a release claim. The release
commit is expected to differ from `bfc608c` by version strings only.

Four families leave `stable` against the beta.11 support matrix: `stripe:secret-key-live`, `stripe:secret-key-test`,
`stripe:restricted-key-live`, `stripe:restricted-key-test`. See [Families that left stable](#families-that-left-stable).

## Files

| File | Mode | Run |
| --- | --- | --- |
| [`candidate-evidence-v1.json`](candidate-evidence-v1.json) | `benchmark:candidate`, full suite, complete, `eval:validate` passed | `9758f6c5-6724-4401-abf4-5e2d1f4f2886` |
| [`support-status-candidate.json`](support-status-candidate.json) | candidate (three tarballs built from `bfc608c`, `product.sourceCommit` `bfc608c`) | `9f573ce2-6e67-4fb6-968e-fba9f63e49f6` |
| [`support-matrix-candidate.json`](support-matrix-candidate.json) | matrix generated from that file. **This is the file for core's `benchmarks/support-matrix.json`.** | |
| [`support-status-published.json`](support-status-published.json) | published npm package 0.1.0-beta.11 (`publishedPackage`) | `3d70751a-b2e6-4193-91c5-361f26c86ea0` |
| [`support-matrix-published.json`](support-matrix-published.json) | matrix generated from that file | |

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `bfc608cce75f79f6a5cab037d7e558ba629777f6`, clean detached worktree, declared 0.1.0-beta.11 (not yet bumped) |
| `redact-secret-benchmarks` | `4c79d52fa1fa89a794c49fb74cdf6a461e2d6856` (origin/develop, clean); lockfile `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f` |
| Candidate artifacts (darwin-arm64) | core `8bda9ce64f2bcc0b96b75edc1cfd8ce03534078ccd664c80ed3807ce55b6924a`, node `45d29c3d8f4ef6f2ed58f7b7e7115710a666cabbedd5ecbecd196313aad686e1`, wasm `9f23d389ac2585c569c3c4dacbc76531394f1599b65c0f75a9d426bd9e47c0f4` |
| Published tarballs (`npm pack`) | core `3e704905…4b05`, node `db1f0574…ccb`, wasm `5d9cb247…13f6`, identical to the beta.11 evidence ([`../94fc18a-published/README.md`](../94fc18a-published/README.md)) |
| Candidate run corpus | `14e3d0a227f8661b936642aeb67a1d35113c85c0d3075111b1f96e6637ed1390`, 5,800 expanded + 150 fixed fixtures |
| Fixture index / taxonomy | `58f09c35…dbdd` (5,950 fixtures) / `7a210894…` (beta.11: `5919a676…` / `c6a52802…`) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`); committed snapshots reused |

## Families now present vs beta.11

The matrix has 173 families (beta.11: 152), 92 providers (76). No beta.11 family is missing. All 21 new families read
`stable` in candidate mode: axiom:api-token, axiom:personal-token, bitwarden:secrets-manager-access-token,
browserbase:api-key, cerebras:inference-api-key, clickhouse-cloud:api-key, clojars:deploy-token, crates-io:api-token,
crates-io:trusted-publishing-token, daytona:api-key, dynatrace:api-token, google:oauth-client-secret,
honeycomb:ingest-key, nvidia:ngc-api-key, paddle:api-key, polar:api-credential, polar:organization-access-token,
rubygems:api-key, runpod:api-key, sonarqube:analysis-token, sonarqube:user-token.

Status changes in the candidate matrix against beta.11: 13 provisional to stable, 4 pending to stable, 1 unsupported to
stable, 4 stable to provisional (below).

## Families that left stable

`stripe:secret-key-live`, `stripe:secret-key-test`, `stripe:restricted-key-live`, `stripe:restricted-key-test`.

- **Candidate mode:** provisional on `differential.unresolvedContractDisagreements: 24`. The 24 ids are the `stripe-token`
  differential rows of the #1030 `policy-org-{live,test}-{floor,above}-{bare,quoted,unicode-crlf}` fixtures (12
  fixtures, two peers each). The review ledger carries rows only for published-mode ids (commit `dad951f0` triaged 12
  of them against the published package); the candidate-mode ids are not triaged. Metamorphic and mutation critical
  items are 0 for the four families. This is a benchmarks-side gate, not a product regression.
- **Published mode (0.1.0-beta.11):** the same four families read provisional, with `metamorphic.criticalFailures: 108`
  and 12 mutation items. The published package predates the #1030 fix (product PR #1101) and so fails the new
  `sk_org_` corpus fixtures, which the corpus gained after the beta.11 reading. The candidate resolves them.
  The beta.11 package against the older corpus read stable; the corpus changed, the package did not.

Product drift gate, run locally (`scripts/check-support-matrix-drift.py`, baseline `v0.1.0-beta.11:benchmarks/support-matrix.json`,
candidate `support-matrix-candidate.json`): exactly these 4 regressions, fingerprints `7d87dcc3ecb77790`
(restricted-key-live), `4c015bebcedbecd2` (restricted-key-test), `50709430446f113c` (secret-key-live),
`608006939b36ad3a` (secret-key-test). Triaging the 24 candidate-mode ledger rows would return all four to stable and
remove the regressions.

## Commands

At `4c79d52f`, clean:

```sh
npm ci && npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog --version -> 3.97.4
# product worktree at bfc608c (clean)
npm run benchmark:candidate -- --benchmark-ref 4c79d52fa1fa89a794c49fb74cdf6a461e2d6856 \
  --benchmark-repo <this worktree> --output-dir <dir>
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.11.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.11.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.11.tgz \
  --candidate-source-commit=bfc608cce75f79f6a5cab037d7e558ba629777f6 --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
npm run eval:matrix -- --input=<dir>/support-status-<mode>.json --output=<dir>/support-matrix-<mode>.json
npm run fixture-index:check && npm run queue:check
```
