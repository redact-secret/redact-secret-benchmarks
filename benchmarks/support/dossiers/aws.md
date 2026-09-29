---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: aws
families:
  - id: aws:iam-user-access-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes
      issues:
        - redact-secret/redact-secret-benchmarks#36
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: aws:sts-temporary-access-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: aws:sts-service-bearer-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: aws:context-specific-credential
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: aws:iam-user-secret-access-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# AWS

AWS issues long-term IAM user access keys, short-term STS credentials and related service credentials, told apart by a four-letter identifier prefix (AKIA, ASIA, ABIA, ACCA), plus a separate 40-character secret paired with an access key ID. Amazon Bedrock API keys are recorded under `aws-bedrock` and not here.

`aws:iam-user-access-key` is `ready` at T1 on the shipped `aws-access-key` contract. The other four families have no shipped contract and stay unresearched. Whether and how core detects a family is not recorded here.

## Families

### `aws:iam-user-access-key` — IAM user access key

- **Shape:** Long-term access key ID for an IAM user, prefixed AKIA.
- **Sources:** T1 per the shipped `aws-access-key` contract in the benchmarks assessment: the IAM unique-identifier prefix table documents the AKIA prefix. The 16-character base32 body and the 40-character companion secret are tool-corroborated, not provider-stated. Provider source re-checked 2026-09-20 in benchmarks#36 (PR #38). The contract does not cover ASIA.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:sts-temporary-access-key` — STS temporary access key

- **Shape:** Short-lived access key ID issued by AWS STS, prefixed ASIA; requires an accompanying session token.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:sts-service-bearer-token` — STS service bearer token

- **Shape:** AWS STS service-issued bearer credential, prefixed ABIA.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:context-specific-credential` — Context-specific credential

- **Shape:** Context-specific temporary credential, prefixed ACCA.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:iam-user-secret-access-key` — IAM user secret access key

- **Shape:** The 40-character secret paired with an IAM user access key ID. Has no distinguishing prefix or lexical marker.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded.

## Open questions

1. **Four families are unresearched:** `aws:sts-temporary-access-key`, `aws:sts-service-bearer-token`, `aws:context-specific-credential` and `aws:iam-user-secret-access-key`. The `aws-access-key` contract is anchored to AKIA only, so no shipped contract or detector covers them; the same prefix table documents ASIA, ABIA and ACCA.
2. The taxonomy notes ASIA needs a session token and that some legacy ASIA values use digits outside base32; no research issue covers either.
3. The secret access key has no prefix or lexical marker, so it may end as `rejected` or `not-found` once someone researches it.

## Research log

- redact-secret-benchmarks#36 (PR #38, 2026-09-20) — re-check of the IAM prefix table as the `aws-access-key` provider source.
- Related non-research issues: core #254 and #318.
