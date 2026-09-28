# Evidence: redact-secret#860 families and the Beta.11 candidate at product main 1db8ff3

**Result:** candidate mode (product `1db8ff3`, the frozen Beta.11 candidate) reads 88 stable of 110 families (documented
63, empirical 25; 20 provisional, 2 pending). All 24 #860 families are documented-stable. Of the 86 older families, 64
are stable. Published mode (`@redact-secret/core` 0.1.0-beta.10) reads 61 stable of 110 (documented 38, empirical 23;
47 provisional, 2 pending), and all 24 new families are provisional there, because the release predates their
detectors. The registry is pinned to `1db8ff3`, and the pinned revision has an ACCEPTED performance evaluation. Nothing
here is a release claim.

This supersedes [`../1127bf9/README.md`](../1127bf9/README.md) as the current measurement; that file stays as history.
Parity and runtime: [`../381/README.md`](../381/README.md). No matched plaintext or example credential is retained here.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `1db8ff38b16e50c51229eb27025452952bf621e1` (main: PR #958, the #950 performance recovery plus batch 3), clean |
| `redact-secret-benchmarks` | `1ec72e7ac74a916686ae981af6492022efa79644` (branch `beta11/376-batch-3`), clean; lockfile `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Candidate artifacts (`benchmark:candidate`, declared 0.1.0-beta.10, darwin-arm64) | core `4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1`, node `63f98456a49dd96c7fc75b5e29080e757bd987dc516bda459696e48185b6ab60`, wasm `af0633663d713456a82d297f23023280cff05ad5f56489e9e72854601af2b1a1` |
| Candidate run | `e56cd9b2-cedc-4e2f-ad93-70062bc3990d`: complete, full suite, 4,768 fixtures, corpus `a89a8d117ef2e3b80fb2a7e6b612fc5c464030bfc4d9cd05c52204aba8706d75` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`) |
| Classification | candidate `9874aa6b-77fc-4546-926d-b6198be4be11` ([`support-status-candidate.json`](support-status-candidate.json)); published `3844cc58-3b84-42f2-a040-d9c215fc35f7` ([`support-status-published.json`](support-status-published.json)); fixture index `e893fa62…220c`, taxonomy digest `86380e35…60dc` |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`) |

## Changes since 1127bf9

- `inngest-signing-key` and `resend-api-key` become documented-stable: at `1db8ff3` the handoff-listed placeholders are
  silent (redact-secret#949).
- Mailchimp, Deepgram HTTPie and the previous-line Heroku, Confluent and Twilio positives of #379 are now redacted, not
  warned. No family changes status because of this: `mailchimp-api-key` and `confluent-cloud-api-secret-legacy` stay
  provisional on 4 older open differential rows each, and `deepgram-api-key` on twin, metamorphic and mutation failures.
- Candidate mode raises 4 new differential rows. All 4 are resolved under existing classes: `range-matches-corpus` ×3
  and `peer-measures-broader-span` ×1.

## Known gaps

| Record | State | Fixing commit | At 1db8ff3 |
| --- | --- | --- | --- |
| product-931 (Mailchimp `-us<dc>`) | fixed | `03d6a2b2` | 3/3 authored spans, redact |
| product-932 (Deepgram/Cohere forms) | fixed | `127260c1` | 3/4 redacted; the LiteLLM `masked_` Cohere line stays unreported by product policy (#932) |
| product-933 (previous-line context) | fixed | `03d6a2b2` | 3/3 redact |
| product-934 (repeated-filler placeholders) | fixed | `c5760402` | silent |
| product-935 (`postgresql+psycopg`) | fixed | `4e865058` | redact |
| product-949 (Inngest/Resend placeholders) | fixed | `9605eb5d` | silent |
| product-936 | policy-decision (unchanged) | — | New Relic and older keyword spans still warn |

The records moved to promoted (the manifest records `benchmark-gap-931…935` and `-949` are on product main at
`1db8ff3`) and then to fixed. They are not `verified` yet: every one of these manifest records still has
`gates.productConformance.status: pending` on product main, and `verified` needs product conformance evidence as well as
this benchmark rerun.

## Performance at the pin

`performance-evaluation.yml` run [36480959728](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36480959728)
was dispatched on this branch against candidate `1db8ff3` and paired with baseline 0.1.0-beta.8 (`3144bb3`). It is
**ACCEPTED**. Latency (10 rows), initialization (10) and memory (16) are all within budget. The two WASM size rows are
accepted tradeoffs. Reports: [`../1db8ff3-verified/`](../1db8ff3-verified/).

An earlier dispatch on `develop`'s definition ([36480340241](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36480340241),
same candidate) had one initialization-ratio breach, browser-wasm small-whole at 1.364. The rerun above measured it
within budget, and the orchestrator's pre-merge run ([36478901810](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36478901810),
at `52d6a47`) did not flag it either. It is recorded here as run noise, not accepted.

Maintainer decisions of 2026-09-28, recorded in `benchmarks/accepted-regressions.json` for candidate `1db8ff3` only:

| Trigger | Baseline (0.1.0-beta.8) | Measured at 1db8ff3 | Source |
| --- | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 179,388 | run 36480959728 `wasm-sizes.json` |
| `size/wasm/common/gzip` | 100,058 | 122,544 | run 36480959728 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 186,761 (fetched; 489,101 emitted incl. lazy pii files) | the #937 quickstart method, [`../1db8ff3-verified/quickstart-bundle.md`](../1db8ff3-verified/quickstart-bundle.md) |
| `size/npm/wasm/packed` | 254,413 | 871,030 | candidate tarball, [`../1db8ff3-verified/npm-packed-sizes.json`](../1db8ff3-verified/npm-packed-sizes.json) |

Not recorded:
- `size/npm/core/packed` is within budget (39,461 → 41,650).
- `size/npm/node-darwin-arm64/packed` also breaches (424,514 → 629,779, +48%). The decision covers the Wasm tarball,
  so this row is left for the maintainer. It is not judged by the performance workflow, which does not measure npm
  tarballs.

## Commands

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"
# product worktree at 1db8ff3 (clean)
npm run benchmark:candidate -- --benchmark-ref 1ec72e7ac74a916686ae981af6492022efa79644 \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at 1ec72e7 (clean)
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=1db8ff38b16e50c51229eb27025452952bf621e1 --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
gh workflow run performance-evaluation.yml --ref beta11/376-batch-3 -f candidate_revision=1db8ff38b16e50c51229eb27025452952bf621e1
```
