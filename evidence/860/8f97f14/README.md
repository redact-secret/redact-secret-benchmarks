# Evidence: redact-secret#860 families and the Beta.11 candidate re-bound to product main 8f97f14

> **Superseded** by [`../ec9224d/README.md`](../ec9224d/README.md): the Beta.11 candidate was re-bound to product main
> `ec9224d` (PR #994). #948 changes 177 fixture outcomes by design; with the relabel recorded, the same 88 families are
> stable in candidate mode. This file stays as history.

**Result:** candidate mode (product `8f97f14`, the re-bound Beta.11 candidate) reads 88 stable of 110 families
(documented 63, empirical 25; 20 provisional, 2 pending), the same as at `1db8ff3`. Published mode
(`@redact-secret/core` 0.1.0-beta.10) reads 61 stable of 110 (documented 38, empirical 23; 47 provisional, 2 pending),
also unchanged. No family changes status, profile, reasons or evidence in either mode, and none of the 4,768 fixture
outcomes of the full-suite candidate run differs from the `1db8ff3` run. The registry is pinned to `8f97f14`, and the
pinned revision has an ACCEPTED performance evaluation. Nothing here is a release claim.

This supersedes [`../1db8ff3/README.md`](../1db8ff3/README.md) as the current measurement; that file stays as history.
Parity and runtime: [`../381/README.md`](../381/README.md). No matched plaintext or example credential is retained here.

## Why the candidate moved

The maintainer decided that two product PRs merged after `1db8ff3` ship in Beta.11:

- PR #991 (#980 scan-path performance backlog: #981, #982, #983, #984, #985, #986, #989). Output is byte-identical by
  design.
- PR #992 (#990). It changes output on purpose so that streamed output equals the whole-input scan. `X-Authorization:
  Bearer <token>` is now reported whole-input as a plain Bearer token (16+ bytes). Every line-reading detector now treats
  a lone `\r` as a line end; LF and CRLF results are unchanged. A phone `ext` at a line end is an empty extension, and
  `generic-token` and `bearer-token` have fewer streaming false negatives.

The other merges in `1db8ff3..8f97f14` (#960, #961, #959, #966, #967, #968, #969, #976) change documentation, CI,
manifests and scripts only. The one package-visible effect is `packages/javascript/README.md` (#968), which is why the
core facade tarball hash differs.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3` (main: PR #992 merge), clean |
| `redact-secret-benchmarks` | `005b19b85368d24910da437f31db701d670a2b8d` (branch `beta11/rebind-8f97f14-credentials`, the re-pin commit), clean; lockfile `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Candidate artifacts (`benchmark:candidate`, declared 0.1.0-beta.10, darwin-arm64) | core `467111e288a3677e0e13d11f907a33e358a3161bfb1109f6115f80b16c33f74c`, node `b32d462b2daec575834a7287bec74b679a09f93f28717a56956f0b2169b629f8`, wasm `b6819bfd95c911db056f93cb78b3341cba7bfb05a22262f8c44461c0c4e1b966` |
| Candidate run | `74888ff3-48ed-4459-b2fe-32906a5a95cb`: complete, full suite, 4,768 fixtures, corpus `a89a8d117ef2e3b80fb2a7e6b612fc5c464030bfc4d9cd05c52204aba8706d75` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`) |
| Classification | candidate `d9376ea1-b015-4060-b1ea-b55a07dbb95b` ([`support-status-candidate.json`](support-status-candidate.json)); published `3f0c506f-97eb-469f-aa0d-9b78d04ce295` ([`support-status-published.json`](support-status-published.json)); fixture index `e893fa62…220c`, taxonomy digest `86380e35…60dc` (both unchanged) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`) |

## Changes since 1db8ff3

- **Family status:** none, in either mode. Every family record (status, reasons, qualification profile, evidence tier and
  basis, evidence, fixture profile) is identical to the `1db8ff3` classification.
- **Fixture outcomes:** none of 4,768. Each fixture's outcome and finding count equals the `1db8ff3` run
  (`e56cd9b2-cedc-4e2f-ad93-70062bc3990d`), so no #990 change surfaces in the scored corpus. The public corpus has no
  `X-Authorization` header and no lone `\r` line end. Its one `Proxy-Authorization` fixture
  (`policy-qualified-credentials--bearer-token-proxy-header`) scores the same.
- **Differential of the two builds:** a whole-input and incremental differential of the 1db8ff3 and 8f97f14 Node
  packages over all 4,992 public fixtures (the 46 categories, including the calibration-only one) finds 0 differing
  fixtures. The record is next to the blind aggregate:
  [`../../../docs/reports/2026-09-29-beta11-142-blind-carry-over.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/reports/2026-09-29-beta11-142-blind-carry-over.md).

## Known gaps

Rerun from the same candidate run; every record stays fixed and verified. Per-record files are
[`../../911/`](../../911/), [`../../931/`](../../931/) to [`../../935/`](../../935/) and [`../../949/`](../../949/).

| Record | State | At 1db8ff3 | At 8f97f14 |
| --- | --- | --- | --- |
| product-911 (untargeted benign shapes) | verified | 6 clean, 1 warn (`pytest-fake-fixtures`, policy) | same |
| product-931 (Mailchimp `-us<dc>`) | verified | 3/3 exact | 3/3 exact |
| product-932 (Deepgram/Cohere forms) | verified | 3/3 exact (the LiteLLM `masked_` line split to policy) | 3/3 exact |
| product-933 (previous-line context) | verified | 3/3 exact | 3/3 exact |
| product-934 (repeated-filler placeholders) | verified | 2/2 clean | 2/2 clean |
| product-935 (`postgresql+psycopg`) | verified | exact | exact |
| product-949 (Inngest/Resend placeholders) | verified | 3/3 clean | 3/3 clean |
| product-936 | policy-decision (unchanged) | New Relic and older keyword spans warn | same |

## Performance at the pin

`performance-evaluation.yml` run [36557682258](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36557682258) is the evaluation of record. It was dispatched on this
branch at `c61df33`, which carries the accepted rows below, against candidate `8f97f14` and paired with baseline
0.1.0-beta.8 (`3144bb3`). The workflow concludes **success, ACCEPTED**:

- Latency (10 rows), initialization (10) and memory (16) are all within budget, and the RC acceptance criteria all pass.
- The 3 flagged size rows read as accepted tradeoffs.
- Median processing ratios against beta.8 fall from about 0.79 at `1db8ff3` to 0.24–0.27 on the medium workloads, and
  from 0.54–1.07 to 0.22–0.77 on the small ones.
- The rust-core initialization ratio reads 1.71–2.42 on a median under 0.1 ms. That is below the trigger's 2 ms paired
  floor, so it is within budget.

Reports: [`../8f97f14-verified/`](../8f97f14-verified/).

Earlier runs of the same candidate, kept for the record:

- [36553832221](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36553832221), before acceptance. It was dispatched at `005b19b`, before the accepted rows existed.
  Latency, initialization and memory were within budget, and it concluded failure on the 3 size rows alone. Its
  `wasm-sizes.json` and `quickstart-bundle.json` are the measurements the ledger rows cite. They are byte-for-byte the
  sizes 36557682258 measured.
- [36555971146](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36555971146), a noise breach. At `c61df33` it concluded failure on one row,
  `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio`, at 1.277 against 1.25 allowed.
- Paired `1db8ff3 → 8f97f14` runs and A/A runs, `rounds=20`, which measured that row head to head:
  - paired: [36556597811](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556597811), [36556606329](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556606329), [36556615116](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556615116);
  - A/A: [36556623621](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556623621), [36556627045](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556627045).

  8f97f14 is +1.0%, +2.7% and +1.3% on the row (95% intervals about ±13%), and 0.0% to +1.8% on the medium row. The
  A/A runs move the row −1.3% and +11.0%. That is noise, not a shift caused by the +2.8% larger WASM, and it was not
  recorded as an accepted tradeoff: [`../8f97f14-verified/browser-init-paired.md`](../8f97f14-verified/browser-init-paired.md).

Rows recorded in `benchmarks/accepted-regressions.json` for candidate `8f97f14`. They carry the 2026-09-28 maintainer
decisions and the later decision that #991 and #992 ship with the #983 increment accepted:

| Trigger | Baseline (0.1.0-beta.8) | At 1db8ff3 | At 8f97f14 | Source |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 179,388 | 184,422 (+2.8%) | run 36553832221 `wasm-sizes.json` (36557682258 identical) |
| `size/wasm/common/gzip` | 100,058 | 122,544 | 125,295 (+2.2%) | run 36553832221 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 186,761 | 191,801 (+2.7%) | run 36553832221 `quickstart-bundle.json` |
| `size/npm/wasm/packed` | 254,413 | 871,030 | 887,249 (+1.9%) | candidate tarball, [`../8f97f14-verified/npm-packed-sizes.json`](../8f97f14-verified/npm-packed-sizes.json) |
| `size/npm/node-darwin-arm64/packed` | 424,514 | 629,779 | 635,892 (+1.0%) | candidate tarball |
| `size/node-addon/aarch64-apple-darwin` | 1,004,128 | 1,421,552 | 1,422,800 (+0.1%) | the `.node` binary inside that tarball |

**The WASM increment is larger than the +1.3% full / +0.9% common quoted for #983.** Local builds with the product
recipe split it as follows:

| WASM gzip | 1db8ff3 | 37a1dcd (after PR #991) | 8f97f14 (after PR #992) |
| --- | ---: | ---: | ---: |
| full | 179,383 | 183,196 (+2.1%) | 184,453 (+0.7%) |
| common | 122,572 | 124,714 (+1.7%) | 125,307 (+0.5%) |

The #991 step is the whole performance backlog, not #983 alone. The #992 step comes from the correctness fixes (the
shared line splitter and the new hints). Both steps are recorded under the accepted rows above.

Not recorded: `size/npm/core/packed` is within budget (39,461 → 41,901). Native addon, wheel and CLI rows for other
targets were not built on this host.

## Commands

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog 3.97.4, gitleaks 8.30.1
# product worktree at 8f97f14 (clean)
npm run benchmark:candidate -- --benchmark-ref 005b19b85368d24910da437f31db701d670a2b8d \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at 005b19b (clean)
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=8f97f14d97d73b76602e5396eea35d0a5a4f0eb3 --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
gh workflow run performance-evaluation.yml --ref beta11/rebind-8f97f14-credentials -f candidate_revision=8f97f14d97d73b76602e5396eea35d0a5a4f0eb3
# paired/A-A check of one row: add -f baseline_revision=<commit> -f rounds=20
node --import tsx scripts/regression-budgets.mjs evaluate --summary <run>/summary.json --paired <run>/paired.json \
  --wasm-sizes <run>/wasm-sizes.json --quickstart-bundle <run>/quickstart-bundle.json \
  --source-commit 8f97f14d97d73b76602e5396eea35d0a5a4f0eb3 --json-out ../8f97f14-verified/regression-budgets.json \
  --markdown-out ../8f97f14-verified/regression-budgets.md
```
