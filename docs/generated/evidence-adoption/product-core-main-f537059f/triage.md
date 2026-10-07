# Triage dispositions (#698)

Scanned product `@redact-secret/core@0.1.0-beta.13` on credential-eval 0.1.0-alpha.15. **Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: 96 maintainer-only fixtures, 0 independently reviewed. 46 root causes rest on a seed case attributed to a maintainer-only record; their dispositions are not independent review.

Decisions are rules applied to recorded evidence (benchmarks/qualification/triage-decisions.ts). A root cause no rule decides is open. Ledger proposals are not ledger rows. Core classifications are the product maintainers' (core #1199 to #1201); a "provisional scope reading" is this repository's reading of the product docs, not a product-owner decision.

## By classification

| Classification | Root causes |
| --- | --- |
| (open) | 92 |
| expectation-or-contract-correction | 13 |
| in-contract-product-bug | 12 |
| justified-peer-divergence | 736 |
| unsupported-or-feature-scope | 56 |

## By kind, classification and status

| Kind | classification | status | Root causes |
| --- | --- |
| core-control-flagged | expectation-or-contract-correction | settled | 1 |
| core-control-flagged | in-contract-product-bug | open | 1 |
| core-positive-miss | unsupported-or-feature-scope | settled | 5 |
| core-positive-partial-or-overbroad | unsupported-or-feature-scope | settled | 1 |
| gate-peer-differential-unsettled | (open) | open | 52 |
| gate-peer-differential-unsettled | (open) | settled | 40 |
| gate-peer-differential-unsettled | expectation-or-contract-correction | settled | 9 |
| gate-peer-differential-unsettled | in-contract-product-bug | open | 8 |
| gate-peer-differential-unsettled | justified-peer-divergence | settled | 736 |
| gate-peer-differential-unsettled | unsupported-or-feature-scope | settled | 32 |
| reference-assertion-failure | expectation-or-contract-correction | settled | 3 |
| reference-assertion-failure | in-contract-product-bug | open | 3 |
| reference-assertion-failure | unsupported-or-feature-scope | settled | 18 |

## By rule

| Rule | Root causes |
| --- | --- |
| core-1205.encoded | 4 |
| core-1205.expectation | 4 |
| core-1205.fix | 4 |
| core-1205.fragment | 4 |
| core-1205.unsupported-family | 16 |
| gate-peer.follows-core-1203.encoded | 1 |
| gate-peer.follows-core-1203.expectation | 7 |
| gate-peer.follows-core-1203.fix | 6 |
| gate-peer.follows-core-1203.fragment | 2 |
| gate-peer.follows-core-1203.unsupported-family | 7 |
| gate-peer.follows-core-1205.encoded | 1 |
| gate-peer.follows-core-1205.expectation | 2 |
| gate-peer.follows-core-1205.fix | 2 |
| gate-peer.follows-core-1205.unsupported-family | 2 |
| gate-peer.follows-encoded-carrier | 11 |
| gate-peer.follows-fragmented-credential | 8 |
| gate-peer.reference-deviates | 52 |
| gate-peer.reference-matches-evidence | 736 |
| gate-peer.t0-pending | 40 |

## Gate proposals by product family (not ledger rows; no status moves)

| Product family | Occurrences | Proposed resolved | Proposed not-assertable | Stay open |
| --- | --- | --- | --- | --- |
| (no product family) | 482 | 389 | 18 | 75 |
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
| `graphql-requests-and-responses-authored--get-url-variables-value` | graphql-requests-and-responses-authored--get-url-variables-value: the expectation needs percent decoding; mark it review-required / unsupported-carrier, or drop the percent-encoded form | 5 |
| `har-exports-authored--bearer-token-in-postdata-params` | har-exports-authored--bearer-token-in-postdata-params: review-required, or author it as `name=value` (then it is the claimed assignment form) | 4 |
| `har-exports-authored--bearer-token-in-url-and-querystring-array` | har-exports-authored--bearer-token-in-url-and-querystring-array: keep span 314-354 (EXACT); drop or mark review-required the queryString member 657-697 | 6 |
| `har-exports-authored--session-cookie-in-headers-and-cookies-arrays` | har-exports-authored--session-cookie-in-headers-and-cookies-arrays: review-required | 4 |
| `hashicorp-terraform-authored--state-json-output-password-with-sensitive-true` | hashicorp-terraform-authored--state-json-output-password-with-sensitive-true: review-required (the `sensitive: true` flag needs a JSON reader) | 4 |
| `http-auth-carriers-authored--basic-empty-password` | http-auth-carriers-authored--basic-empty-password: expect `redact` (or review-required); an expectation that needs base64 decoding is not assertable on the raw-input contract | 2 |
| `http-auth-carriers-authored--basic-rfc-published-example` | http-auth-carriers-authored--basic-rfc-published-example: expect `redact` (or review-required); not assertable without decoding | 2 |
| `jupyter-notebook-files-authored--source-value-split-between-array-elements` | jupyter-notebook-files-authored--source-value-split-between-array-elements: fragment; out of the raw-input contract | 4 |
| `jupyter-notebook-files-authored--stdout-mask-where-source-has-environment-reference` | jupyter-notebook-files-authored--stdout-mask-where-source-has-environment-reference: use a real line break in the notebook text, or allow a warn-level finding | 6 |

Open root causes: 64. Ledger proposals: {"not-assertable":40,"open":101,"resolved":736}.
