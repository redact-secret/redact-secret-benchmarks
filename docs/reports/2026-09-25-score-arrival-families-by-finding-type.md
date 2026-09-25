# Scoring the four finding-type arrival families (#730)

This report records the first classification run after
[`2026-09-24-score-arrival-families-by-finding-type.md`](../decisions/2026-09-24-score-arrival-families-by-finding-type.md).
That decision lets `eval:classify` score the four arrival families that the
product types inside a shared detector, each under its own id. It covers the
last open box of redact-secret#730 ("All five selected or formally replaced
families are registered and scored provisional or better"), which
`slack-user-token` had not met.

## Conditions

- Peers: trufflehog 3.97.4 (the keg at `/opt/homebrew/Cellar/trufflehog/3.97.4/bin`, first on `PATH`) and gitleaks 8.30.1.
- Published mode: `@redact-secret/core` 0.1.0-beta.7. `eval:classify` run `4f8cc9ca-a5c3-4f9f-a11a-52655e91693e`.
- Candidate mode: product main `10263e5e295e7c086700fe3823c6554f709ca3b5`, built with the product's
  `scripts/benchmark-candidate.mjs` from a clean detached worktree against a clone of this branch at
  `d3e68d3`. `eval:classify` run `8cd26f3b-edfc-4780-b7da-7f4ecb58d33a`. Artifact SHA-256: core
  `8b6e759b…2662520`, wasm `3ecbb583…b03080`, node darwin-arm64 `29cdd694…faac7`.

## The four families

| Family (taxonomy) | Tier | Published beta.7 | Candidate 10263e5 |
| --- | --- | --- | --- |
| `github-fine-grained-pat` (`github:fine-grained-personal-access-token`) | T2 | provisional | provisional |
| `stripe-webhook-signing-secret` (`stripe:webhook-signing-secret`) | T1 | stable (documented) | stable (documented) |
| `slack-app-level-token` (`slack:app-level-token`) | T2 | provisional | provisional |
| `slack-user-token` (`slack:user-token`) | T1 | provisional | **stable (documented)** |

Why each family that is not stable reads provisional:

- **`github-fine-grained-pat` and `slack-app-level-token`, both modes.** Neither
  has a `benchmarks/support/empirical-observations.json` record, so the
  corroborated route, uncertainty and supported contexts are all missing. Each
  also has 9 benign cases against a floor of 14. The same gate applies to a
  registry T2 family.
- **`slack-app-level-token`, published only.** It also has four `open`
  differential rows. In each, beta.7 flags a negative twin (`_` separator, a
  letter in the digit section) through `slack-token`/`slack_token`. The twin
  method counts that finding as co-detection under beta.7's coarser type. The
  differential rows still block stable.
- **`slack-user-token`, published only.** It has 7 metamorphic critical
  failures, 7 hard mutation failures, and two `open` differential rows where
  beta.7 reports nothing on a positive that trufflehog and gitleaks cover.
  Candidate 10263e5 clears all of them.

In candidate mode every positive of the four families is labelled with the
arrival id. No twin is flagged by the owning detector: the only twin findings
are `bearer-token` (3) and `generic-token` (4), which are other registry
families.

## Stable counts

| Mode | All scored families | Registry only |
| --- | --- | --- |
| Published 0.1.0-beta.7 | 41 / 74 (31 documented, 10 empirical) | 40 / 70 |
| Candidate 10263e5 | 56 / 74 (40 documented, 16 empirical) | 54 / 70 |

The candidate's registry-only count matches the 54/70 that #262 read at
`3144bb3`. The two extra families are `slack-user-token` and
`stripe-webhook-signing-secret`, which are now scored. The family count moves
from 70 to 74 because of the unit change, not because anything regressed.

Support matrix (108 taxonomy families): published 58 stable, 32 provisional,
1 pending and 17 unsupported. Candidate: 73 stable, 17 provisional, 1 pending
and 17 unsupported.

## #730's other selected families

These registry families are unchanged by this decision. Each reads provisional
or better in both modes:

| Family | Published beta.7 | Candidate 10263e5 |
| --- | --- | --- |
| `perplexity-api-key` | provisional | provisional |
| `fireworks-ai-api-key` | provisional | stable (documented) |
| `pinecone-api-key` | provisional | provisional |
| `gitlab-runner-authentication-token` | provisional | provisional |

## Ledger

No review-queue id changed. The decision edits no fixture, case or adapter.
A full queue dump in both modes found every row for the four families already
in `benchmarks/review-ledger.json`: 170 published-keyed and 175
candidate-keyed. It found no missing ids and no re-keys, so there was nothing
to triage. The only change is which existing rows now count toward these
families' status: the six published-keyed `open` rows listed above.
