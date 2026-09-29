---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: aws
families:
  - id: aws:iam-user-access-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
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

No family in this dossier has a recorded research verdict. Whether and how core detects a family is not recorded here.

## Families

### `aws:iam-user-access-key` — IAM user access key

- **Shape:** Long-term access key ID for an IAM user, prefixed AKIA.
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

1. **Every AWS family is unresearched.** Searched: core and benchmarks issue titles for AWS and AKIA, core `docs/specs`, `docs/audits/evidence` and `docs/decisions`, benchmarks `docs/` and `benchmarks/support`. Only bug and false-positive issues exist (core #254 example credentials redacted, #318 public identifiers and near misses); no research issue or close-out states a verdict.
2. **Lead, not a verdict.** The taxonomy cites the IAM unique-identifier prefix table (https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes) for AKIA, ASIA, ABIA and ACCA. The benchmarks contract for `aws-access-key` records it as a T1 source, states the 16-character base32 body and the 40-character secret are tool-corroborated, and was re-checked 2026-09-20 in benchmarks#36. Decide whether that contract row counts as a research record for the AKIA family.
3. The taxonomy notes ASIA needs a session token and that some legacy ASIA values use digits outside base32; no research issue covers either.
4. The secret access key has no prefix or lexical marker, so it may end as `rejected` or `not-found` once someone researches it.

## Research log

No research issues. Related non-research issues: core #254 and #318, benchmarks#36.
