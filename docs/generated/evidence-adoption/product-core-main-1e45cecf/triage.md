# Triage dispositions (#698)

Scanned product `@redact-secret/core@0.1.0-beta.12` on credential-eval 0.1.0-alpha.4. **Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: 96 maintainer-only fixtures, 0 independently reviewed. 274 root causes rest on a seed case attributed to a maintainer-only record; their dispositions are not independent review.

Decisions are rules applied to recorded evidence (benchmarks/qualification/triage-decisions.ts). A root cause no rule decides is open. Ledger proposals are not ledger rows. Core classifications are the product maintainers' (core #1199 to #1201); a "provisional scope reading" is this repository's reading of the product docs, not a product-owner decision.

## By classification

| Classification | Root causes |
| --- | --- |
| (open) | 30 |
| expectation-or-contract-correction | 33 |
| in-contract-product-bug | 14 |
| justified-peer-divergence | 368 |
| unsupported-or-feature-scope | 333 |

## By kind, classification and status

| Kind | classification | status | Root causes |
| --- | --- |
| core-control-flagged | expectation-or-contract-correction | settled | 3 |
| core-control-flagged | in-contract-product-bug | fixed-in-candidate | 1 |
| core-positive-miss | in-contract-product-bug | fixed-in-candidate | 1 |
| core-positive-miss | unsupported-or-feature-scope | settled | 68 |
| core-positive-partial-or-overbroad | expectation-or-contract-correction | settled | 2 |
| core-positive-partial-or-overbroad | unsupported-or-feature-scope | settled | 8 |
| gate-peer-differential-unsettled | (open) | settled | 30 |
| gate-peer-differential-unsettled | expectation-or-contract-correction | settled | 10 |
| gate-peer-differential-unsettled | in-contract-product-bug | fixed-in-candidate | 6 |
| gate-peer-differential-unsettled | justified-peer-divergence | settled | 368 |
| gate-peer-differential-unsettled | unsupported-or-feature-scope | settled | 29 |
| reference-assertion-failure | expectation-or-contract-correction | settled | 18 |
| reference-assertion-failure | in-contract-product-bug | fixed-in-candidate | 6 |
| reference-assertion-failure | unsupported-or-feature-scope | settled | 228 |

## By rule

| Rule | Root causes |
| --- | --- |
| amqp-userinfo-quote | 4 |
| core-1203.encoded | 4 |
| core-1203.expectation | 23 |
| core-1203.fix | 4 |
| core-1203.fragment | 4 |
| core-1203.unsupported-family | 44 |
| encoded-carrier | 188 |
| fragmented-credential | 64 |
| gate-peer.follows-core-1203.encoded | 1 |
| gate-peer.follows-core-1203.expectation | 10 |
| gate-peer.follows-core-1203.fix | 6 |
| gate-peer.follows-core-1203.fragment | 2 |
| gate-peer.follows-core-1203.unsupported-family | 7 |
| gate-peer.follows-core-root-cause | 19 |
| gate-peer.reference-matches-evidence | 368 |
| gate-peer.t0-pending | 30 |

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

## Proposed credential-evidence changes (proposals only; the adopted snapshot is not edited)

| Case | Proposal | Root causes |
| --- | --- | --- |
| `authored-provider-neutral--pytest-fake-fixtures` | authored-provider-neutral--pytest-fake-fixtures: allow a warn-level finding on the control (policy-ambiguous, review-required) or rename the variable | 2 |
| `exa--exa-api-key-other-host-twin` | exa-api-key-other-host-twin: scope the twin to the Exa family or accept a generic finding | 1 |
| `http-auth-carriers-authored--basic-empty-password` | http-auth-carriers-authored--basic-empty-password: expect `redact` (or review-required); an expectation that needs base64 decoding is not assertable on the raw-input contract | 6 |
| `http-auth-carriers-authored--basic-rfc-published-example` | http-auth-carriers-authored--basic-rfc-published-example: expect `redact` (or review-required); not assertable without decoding | 6 |
| `structured-credential-files-authored--aws-credentials-file-two-profiles` | aws-credentials-file-two-profiles: add the two `aws_access_key_id` values as expected secret spans or allowed co-detections | 3 |
| `structured-credential-files-authored--service-account-key-file-minified-json` | service-account-key-file-minified-json: expected span 134-548 (ends at the footer), not 134-550 | 5 |
| `structured-credential-files-authored--service-account-key-file-pretty-json` | service-account-key-file-pretty-json: expected span 150-564 (ends at the footer), not 150-566 | 5 |
| `twilio-compound-credentials-authored--api-key-sid-alone` | twilio-compound-credentials-authored--api-key-sid-alone: re-author the value as `SK` + 32 lowercase hex (the product returns clean) or expect a redact | 5 |

Open root causes: 0. Ledger proposals: {"not-assertable":30,"open":45,"resolved":368}.
