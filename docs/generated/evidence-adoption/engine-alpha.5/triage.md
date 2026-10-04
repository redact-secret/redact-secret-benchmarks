# Triage dispositions (#698)

Scanned product `@redact-secret/core@0.1.0-beta.13` on credential-eval 0.1.0-alpha.5. **Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: 96 maintainer-only fixtures, 0 independently reviewed. 274 root causes rest on a seed case attributed to a maintainer-only record; their dispositions are not independent review.

Decisions are rules applied to recorded evidence (benchmarks/qualification/triage-decisions.ts). A root cause no rule decides is open. Ledger proposals are not ledger rows. Core classifications are the product maintainers' (core #1199 to #1201); a "provisional scope reading" is this repository's reading of the product docs, not a product-owner decision.

## By classification

| Classification | Root causes |
| --- | --- |
| (open) | 112 |
| in-contract-product-bug | 4 |
| justified-peer-divergence | 368 |
| unsupported-or-feature-scope | 294 |

## By kind, classification and status

| Kind | classification | status | Root causes |
| --- | --- |
| core-control-flagged | (open) | open | 4 |
| core-positive-miss | in-contract-product-bug | fixed-in-candidate | 1 |
| core-positive-miss | unsupported-or-feature-scope | settled | 68 |
| core-positive-partial-or-overbroad | (open) | open | 2 |
| core-positive-partial-or-overbroad | unsupported-or-feature-scope | settled | 8 |
| gate-peer-differential-unsettled | (open) | open | 16 |
| gate-peer-differential-unsettled | (open) | settled | 30 |
| gate-peer-differential-unsettled | justified-peer-divergence | settled | 368 |
| gate-peer-differential-unsettled | unsupported-or-feature-scope | settled | 29 |
| reference-assertion-failure | (open) | open | 60 |
| reference-assertion-failure | in-contract-product-bug | fixed-in-candidate | 3 |
| reference-assertion-failure | unsupported-or-feature-scope | settled | 189 |

## By rule

| Rule | Root causes |
| --- | --- |
| amqp-userinfo-quote | 4 |
| encoded-carrier | 188 |
| fragmented-credential | 64 |
| gate-peer.follows-core-root-cause | 38 |
| gate-peer.reference-deviates | 7 |
| gate-peer.reference-matches-evidence | 368 |
| gate-peer.t0-pending | 30 |
| no-declared-family | 13 |
| unclassified-by-core | 66 |

## Gate proposals by product family (not ledger rows; no status moves)

| Product family | Occurrences | Proposed resolved | Proposed not-assertable | Stay open |
| --- | --- | --- | --- | --- |
| (no product family) | 104 | 66 | 12 | 26 |
| aws-access-key | 9 | 8 | 1 | 0 |
| connection-string | 21 | 21 | 0 | 0 |
| deepgram-api-key | 1 | 0 | 1 | 0 |
| generic-token | 4 | 4 | 0 | 0 |
| github-token | 88 | 82 | 6 | 0 |
| gitlab-token | 31 | 31 | 0 | 0 |
| google-api-key | 3 | 0 | 3 | 0 |
| heroku-api-key-legacy | 1 | 0 | 1 | 0 |
| npm-token | 32 | 32 | 0 | 0 |
| sendgrid-token | 93 | 68 | 6 | 19 |
| stripe-token | 50 | 50 | 0 | 0 |
| twilio-api-key-secret | 2 | 2 | 0 | 0 |
| twilio-auth-token | 4 | 4 | 0 | 0 |

Open root causes: 82. Ledger proposals: {"not-assertable":30,"open":45,"resolved":368}.
