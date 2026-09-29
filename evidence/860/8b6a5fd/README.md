# Evidence: redact-secret#860 families and the Beta.11 candidate re-bound to product main 8b6a5fd

**Result:** candidate mode (product `8b6a5fd`) reads **88 stable of 110** families (documented 63, empirical 25; 20
provisional, 2 pending). Published mode (`@redact-secret/core` 0.1.0-beta.10) reads **61 stable of 110** (documented 38,
empirical 23; 47 provisional, 2 pending). Every family record in both modes is byte-identical to the `ec9224d`
classification. None of the 4,777 fixture outcomes of the full-suite candidate run differs from the `ec9224d` run, and
the review queue has the same ids. The registry is pinned to `8b6a5fd`, and the pinned revision has an ACCEPTED
performance evaluation. Nothing here is a release claim.

This supersedes [`../ec9224d/README.md`](../ec9224d/README.md) as the current measurement. That file stays as history
and holds the #948 analysis: the 177 changed fixtures, the 55-stable reading before the relabel, and the relabel
decision [`docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](../../../docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md).
Against `8f97f14`, the changes are the same ones recorded there. Parity: [`../381/README.md`](../381/README.md).

## Feed-safe re-classification (current)

The two classification files below are superseded by
[`support-status-candidate-feed-safe.json`](support-status-candidate-feed-safe.json) and
[`support-status-published-feed-safe.json`](support-status-published-feed-safe.json). The old files stay as history.

Why: the product's public site feed (redact-secret `docs/contracts/site-feed/v1`) bounds every family display name to
`^[A-Za-z0-9][A-Za-z0-9 ()/,._+-]{0,79}$`. `trigger-dev:secret-api-key` was named `… (tr_<env>_ / tr_<env>_sk_)`, so the
product could not project this matrix into its feed. The name is now `Environment secret key (tr_ENV_ / tr_ENV_sk_)`,
and `tests/taxonomy.test.mjs` holds every family name to that pattern. The rename changes the taxonomy digest
(`86380e35…60dc` → `c6a52802…518c`) and so the fixture semantic index (`085358df…c29e` → `1f960b1a…5106`), which
invalidates peer snapshot reuse; the snapshots were recaptured on the pinned peers with byte-identical findings.

| Item | Identity |
| --- | --- |
| Benchmarks revision | `ec9ffbecb06a9411ec5e9e4490cd0d59511043e0` (branch `beta11/feed-safe-family-names`, clean) |
| Candidate artifacts | the same three tarballs as candidate run `e795030e` (core `467111e2…`, node `19f41652…`, wasm `61d135ba…`), product `8b6a5fde52ecb4dfce13f09c7a947062d21483c7` |
| Classification | candidate `02b5a600-3120-4cb4-a544-2729a08228ce`; published (`@redact-secret/core` 0.1.0-beta.10) `5681f040-dcff-4f20-a5c3-385d5b3e041a` |
| Peers | trufflehog 3.97.4, gitleaks 8.30.1 (`.peer-bin` first on `PATH`), snapshots from refresh run `7a289b82-16d8-4970-8e35-4e2846d74ef0` |

Result: the `families` array is byte-identical to the superseded file in both modes (candidate 88 stable of 110,
published 61), and so are `distribution` and `stableDistribution`. Only `runId`, `generatedAt`, `revision`,
`taxonomyDigest`, `fixtureIndex` and `scannerObservations` differ. The support matrix generated from the candidate file
differs from the one generated from the superseded file only in `sourceReport` and in that one family's `familyName`.

## Why the candidate moved

Product PR #996 (merge `8b6a5fde`), the #902 Wasm follow-up: the PII vocabulary is shared per process and the #902 PII
code is smaller. It touches `crates/secret-scan-core/src/pii.rs` only, and output is byte-identical by design. The
maintainer decided it ships in Beta.11.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `8b6a5fde52ecb4dfce13f09c7a947062d21483c7` (main: PR #996 merge), clean; declared 0.1.0-beta.10 |
| `redact-secret-benchmarks` | re-pin `405892a5ba40b6eeef919d2fb818470ee495092c` (branch `beta11/rebind-ec9224d-credentials`, clean; the #948 relabel of `5b03068` is included) |
| Candidate artifacts (`benchmark:candidate`, darwin-arm64) | core `467111e288a3677e0e13d11f907a33e358a3161bfb1109f6115f80b16c33f74c`, node `19f41652389a9234c2648b058d3a05f60a305114a016c656e93fa35f23ee05ea`, wasm `61d135ba611a154433be9a9a56a38bf4a5fc8747a6b9d5fdf6e4dd6891666f2d` |
| Candidate run | `e795030e-478e-4d21-9775-57456d832143`: complete, full suite, 4,777 fixtures, corpus `d88c19f7…3e2f` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), `eval:validate` passed) |
| Classification (superseded, see above) | candidate `556b1d9f-ff6b-42ed-812b-57ddb41216c2` ([`support-status-candidate.json`](support-status-candidate.json)); published `ad05c435-212b-4dab-9ed1-3aa137f0e29e` ([`support-status-published.json`](support-status-published.json)); fixture index `085358df…c29e`, taxonomy `86380e35…60dc` (both unchanged) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`) |

## Changes since ec9224d

- **Family status:** none in either mode. Every family record is byte-identical.
- **Fixture outcomes:** none of 4,777.
- **Review queue:** the same 9,748 candidate ids. `queue:check` passes with no new ledger row.
- **Public differential:** whole-input and incremental over all 5,001 public fixtures. The digest files of the
  `ec9224d` and `8b6a5fd` builds are byte-identical (SHA-256 `d18cccfb…ee6e`), so 0 fixtures differ. Record:
  [`../../../docs/reports/2026-09-29-beta11-142-blind-carry-over-8b6a5fd.md`](../../../docs/reports/2026-09-29-beta11-142-blind-carry-over-8b6a5fd.md).
- **Diagnostics:** the candidate rows digest `e319bdf7…` is unchanged. The published report is unchanged in full
  (digest `868315e2…`).

## Known gaps

Rerun from the same candidate run. Every record stays fixed and verified with the outcomes of `ec9224d`: product-911
(6 clean, 1 warn), 931, 932, 933 and 935 exact, 934 and 949 clean. product-936 and product-932-masked-key-policy stay
`policy-decision`. Product conformance at `8b6a5fd`:
[Artifact qualification run 36581019627](https://github.com/redact-secret/redact-secret/actions/runs/36581019627)
(success). Per-record files: [`../../911/`](../../911/), [`../../931/`](../../931/) to [`../../935/`](../../935/),
[`../../949/`](../../949/).

## Performance at the pin

`performance-evaluation.yml` run [36582915511](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36582915511)
is the evaluation of record. It was dispatched at `b35f21a`, which carries the accepted rows below, against candidate
`8b6a5fd` and paired with baseline 0.1.0-beta.8. It concludes **success, ACCEPTED**:

- Latency (10 rows), initialization (10) and memory (16) are all within budget.
- The 3 flagged size rows read as accepted tradeoffs.
- Median processing ratios against beta.8 are 0.244–0.283 on the medium workloads and 0.227–0.759 on the small ones.
- The browser-wasm small-whole initialization ratio reads 1.180, within its 1.25 allowance. That row breached twice at
  `ec9224d` and was measured there as noise with thin headroom
  ([`../ec9224d-verified/browser-init-paired.md`](../ec9224d-verified/browser-init-paired.md)). Both `8b6a5fd` runs
  read it within budget (1.189 and 1.180), so no paired check was run.

The earlier run [36581089488](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36581089488) was
dispatched at `405892a`, before the rows existed, and failed on the 3 size rows alone. Its `wasm-sizes.json` and
`quickstart-bundle.json` are the measurements the ledger rows cite, and they are byte-for-byte those of 36582915511.

Rows recorded in `benchmarks/accepted-regressions.json` for candidate `8b6a5fd`:

| Trigger | Baseline (0.1.0-beta.8) | At ec9224d | At 8b6a5fd | Source |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 187,248 | 187,246 | run 36581089488 `wasm-sizes.json` |
| `size/wasm/common/gzip` | 100,058 | 127,661 | 127,655 | run 36581089488 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 194,628 | 194,626 | run 36581089488 `quickstart-bundle.json` |
| `size/npm/wasm/packed` | 254,413 | 917,465 | 900,829 (−1.8%) | candidate tarball, [`../8b6a5fd-verified/npm-packed-sizes.json`](../8b6a5fd-verified/npm-packed-sizes.json) |
| `size/npm/node-darwin-arm64/packed` | 424,514 | 655,692 | 649,386 (−1.0%) | candidate tarball |
| `size/node-addon/aarch64-apple-darwin` | 1,004,128 | 1,460,896 | 1,442,736 (−1.2%) | the `.node` binary inside that tarball |

The default and common WASM builds are within a few bytes of `ec9224d`. The PII builds shrink: full `_pii` gzip
314,806 → 306,971 and common `_pii` 253,442 → 245,057 in the tarball (CI: 310,056 and 248,463). Every row is smaller or
equal, and none grows. `size/npm/core/packed` is within budget and unchanged (41,901; the core tarball is byte-identical).
Native addon, wheel and CLI rows for other targets were not built on this host.

## Commands

Feed-safe re-classification, at `ec9ffbe`:

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog 3.97.4, gitleaks 8.30.1
npm run fixture-index:generate && npm run peers:snapshots:refresh && npm run queue:check
npm run eval:classify -- --candidate-package=<run e795030e artifacts>/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<…>/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<…>/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
```

Before it:

The same as [`../ec9224d/README.md`](../ec9224d/README.md#commands), with `--benchmark-ref 405892a5ba40b6eeef919d2fb818470ee495092c`
and `--candidate-source-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7`.
