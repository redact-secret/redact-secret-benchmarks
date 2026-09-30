# Evidence: deepgram-api-key re-measured at product main da69ebf (redact-secret#1046)

Follows [`../../528/99c8c2b/README.md`](../../528/99c8c2b/README.md), which stays as history.

**Result:** in candidate mode (product `da69ebf`, main after PR redact-secret#1047), **127 of 135** scored families are
stable (documented 89, empirical 38; 7 provisional, 1 pending), and `eval:matrix` reads 144 of 173. The only change
from `99c8c2b` is `deepgram-api-key`, which moves from provisional to **stable** (empirical profile). Its metamorphic
critical failures drop from 2 to 0, and it has 0 unresolved mutation rows and 0 unresolved differential rows. No
status was set by hand, and no fixture, contract or ledger row changed. Published mode (`@redact-secret/core`
0.1.0-beta.11) was not re-run: the published package is unchanged, so its reading stays at 98 of 135. None of this
is a release claim.

No matched plaintext or example credential is retained here.

## The two metamorphic failures at 99c8c2b

A family-filtered run of the metamorphic and mutation cases against the `99c8c2b` candidate found that both failures
come from one variant: `beta8-384e--deepgram-api-key-websocket-subprotocol--metamorphic` under `context.indent`,
which puts four spaces before the first line. Both of that variant's assertions failed, `present-within-envelope`
and `same-detection`. The fixture is a `GET wss://api.deepgram.com/...` request line followed by a
`Sec-WebSocket-Protocol: token, <value>` header. The transform is valid, since indentation does not change what the
request is. The defect was in the product: its #1017 HTTP-block rule read a request or header line only at column 0.
Product issue redact-secret#1046 is fixed by PR redact-secret#1047, whose merge commit is `da69ebf`. It makes both the
whole-input rule and the incremental retention hint read an indented line as the same line unindented, which only
widens detection. The same filtered run at `da69ebf` reads 119/119 `present-within-envelope` and 90/90
`same-detection` metamorphic assertions passing for the family.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `da69ebf5090e0fb9519eb07829ff46001ede0de2` (main: PR #1047), clean |
| `redact-secret-benchmarks` | `0d914af5961941b2cad5e57cdaadbae98cc625bb` (branch `beta12/deepgram-repin`, registry re-pinned to `da69ebf`), clean; lockfile `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f` |
| Candidate artifacts (`benchmark:candidate`, declared 0.1.0-beta.11, darwin-arm64) | core `3e70490584e529be5097fc8a9a3655cb57a3d2f31b58ef173bf614aab4134b05` (unchanged), node `9d729a48e982330f37e388074d0bd962a467f8fd699bee9df7ec36236eff2679`, wasm `624095da8cf27bf80250b2ba65950c08b58a70bbfafb39c61eb96e1e360f8f71` |
| Candidate run | `8a2b70bc-b0cc-499b-82b8-96fee170e592`: complete, full suite, 5,925 fixtures, corpus `529b020f6460e9daa5be50e8167fb23f298d38c1cfdee33f5df1599f41340991` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), validated by `eval:validate`). Every fixture outcome and finding count is identical to the `99c8c2b` run. |
| Classification | candidate `25f10ca6-1b5f-483d-bdbb-9c74f7e6cf57` ([`support-status-candidate.json`](support-status-candidate.json)) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, `.peer-bin` first on `PATH`, versions checked before the run) |

## Stable counts

| Measured at | Mode | `eval:classify` | `eval:matrix` |
| --- | --- | --- | --- |
| develop `81f7d79` | candidate 99c8c2b | 126 / 135 | 143 / 173 |
| branch `0d914af` | candidate da69ebf | **127 / 135** | **144 / 173** |

Still provisional (7): `bearer-token`, `connection-string`, `generic-token` and `otpauth-uri` (the protected policy
holdout has not run on a frozen candidate), `okta-api-token` (4 unresolved contradictions, ruling Q-OK), and
`slack-app-level-token` and `together-ai-api-key` (corroboration short; rulings Q-SL and Q-TG). `vercel-token` stays
pending (T0 aggregate).
