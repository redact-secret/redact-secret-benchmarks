# Triage dispositions (#698)

Scanned product `@redact-secret/core@0.1.0-beta.13` on credential-eval 0.1.0-alpha.5. **Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: 96 maintainer-only fixtures, 0 independently reviewed. 46 root causes rest on a seed case attributed to a maintainer-only record; their dispositions are not independent review.

Decisions are rules applied to recorded evidence (benchmarks/qualification/triage-decisions.ts). A root cause no rule decides is open. Ledger proposals are not ledger rows. Core classifications are the product maintainers' (core #1199 to #1201); a "provisional scope reading" is this repository's reading of the product docs, not a product-owner decision.

## By classification

| Classification | Root causes |
| --- | --- |
| (open) | 91 |
| expectation-or-contract-correction | 9 |
| in-contract-product-bug | 6 |
| justified-peer-divergence | 421 |
| unsupported-or-feature-scope | 10 |

## By kind, classification and status

| Kind | classification | status | Root causes |
| --- | --- |
| core-control-flagged | (open) | open | 1 |
| core-positive-miss | (open) | open | 5 |
| core-positive-partial-or-overbroad | (open) | open | 1 |
| gate-peer-differential-unsettled | (open) | open | 26 |
| gate-peer-differential-unsettled | (open) | settled | 34 |
| gate-peer-differential-unsettled | expectation-or-contract-correction | settled | 9 |
| gate-peer-differential-unsettled | in-contract-product-bug | fixed-in-candidate | 6 |
| gate-peer-differential-unsettled | justified-peer-divergence | settled | 421 |
| gate-peer-differential-unsettled | unsupported-or-feature-scope | settled | 10 |
| reference-assertion-failure | (open) | open | 24 |

## By rule

| Rule | Root causes |
| --- | --- |
| assertion.follows-seed | 21 |
| assertion.no-seed-root-cause | 3 |
| gate-peer.follows-core-1203.encoded | 1 |
| gate-peer.follows-core-1203.expectation | 9 |
| gate-peer.follows-core-1203.fix | 6 |
| gate-peer.follows-core-1203.fragment | 2 |
| gate-peer.follows-core-1203.unsupported-family | 7 |
| gate-peer.follows-core-root-cause | 5 |
| gate-peer.reference-deviates | 21 |
| gate-peer.reference-matches-evidence | 421 |
| gate-peer.t0-pending | 34 |
| no-rule | 6 |
| unclassified-by-core | 1 |

## Gate proposals by product family (not ledger rows; no status moves)

| Product family | Occurrences | Proposed resolved | Proposed not-assertable | Stay open |
| --- | --- | --- | --- | --- |
| (no product family) | 111 | 74 | 12 | 25 |
| aws-access-key | 9 | 8 | 1 | 0 |
| aws-secret-access-key | 6 | 6 | 0 | 0 |
| bearer-token | 4 | 2 | 0 | 2 |
| connection-string | 21 | 21 | 0 | 0 |
| deepgram-api-key | 1 | 0 | 1 | 0 |
| generic-token | 12 | 8 | 0 | 4 |
| github-token | 111 | 105 | 6 | 0 |
| gitlab-token | 31 | 31 | 0 | 0 |
| google-api-key | 3 | 0 | 3 | 0 |
| heroku-api-key-legacy | 1 | 0 | 1 | 0 |
| npm-token | 32 | 32 | 0 | 0 |
| sendgrid-token | 106 | 76 | 10 | 20 |
| stripe-token | 50 | 50 | 0 | 0 |
| twilio-api-key-secret | 4 | 4 | 0 | 0 |
| twilio-auth-token | 4 | 4 | 0 | 0 |

## Proposed credential-evidence changes (proposals only; the adopted snapshot is not edited)

| Case | Proposal | Root causes |
| --- | --- | --- |
| `authored-provider-neutral--pytest-fake-fixtures` | authored-provider-neutral--pytest-fake-fixtures: allow a warn-level finding on the control (policy-ambiguous, review-required) or rename the variable | 2 |
| `exa--exa-api-key-other-host-twin` | exa-api-key-other-host-twin: scope the twin to the Exa family or accept a generic finding | 1 |
| `http-auth-carriers-authored--basic-empty-password` | http-auth-carriers-authored--basic-empty-password: expect `redact` (or review-required); an expectation that needs base64 decoding is not assertable on the raw-input contract | 2 |
| `http-auth-carriers-authored--basic-rfc-published-example` | http-auth-carriers-authored--basic-rfc-published-example: expect `redact` (or review-required); not assertable without decoding | 2 |
| `structured-credential-files-authored--service-account-key-file-minified-json` | service-account-key-file-minified-json: expected span 134-548 (ends at the footer), not 134-550 | 1 |
| `structured-credential-files-authored--service-account-key-file-pretty-json` | service-account-key-file-pretty-json: expected span 150-564 (ends at the footer), not 150-566 | 1 |

Open root causes: 57. Ledger proposals: {"not-assertable":34,"open":51,"resolved":421}.
