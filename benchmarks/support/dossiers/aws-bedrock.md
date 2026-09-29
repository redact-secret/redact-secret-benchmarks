---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: aws-bedrock
families:
  - id: aws-bedrock:long-term-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://aws.amazon.com/blogs/security/securing-amazon-bedrock-api-keys-best-practices-for-implementation-and-management/
        - https://docs.aws.amazon.com/IAM/latest/APIReference/API_ServiceSpecificCredential.html
        - https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-reference.html
      issues:
        - redact-secret/redact-secret#778
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#864
        - redact-secret/redact-secret-benchmarks#384
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/864/README.md
      researchedAt: 2026-09-27
    blockedBy: null
  - id: aws-bedrock:short-term-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://aws.amazon.com/blogs/security/securing-amazon-bedrock-api-keys-best-practices-for-implementation-and-management/
        - https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-reference.html
        - https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-revoke.html
        - https://github.com/aws/aws-bedrock-token-generator-python/blob/228eec2bfcf209d53dc776c902e00d9e6548e508/aws_bedrock_token_generator/token_generator.py
        - https://github.com/aws/aws-bedrock-token-generator-js/blob/86277e1489354192c64ffc8f995601daacc1f715/src/token.ts
        - https://github.com/aws/aws-bedrock-token-generator-java/blob/65a626daa1314c16536030c86adafbad4a6b2d56/src/main/java/software/amazon/bedrock/token/BedrockTokenGenerator.java
      issues:
        - redact-secret/redact-secret#779
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#864
        - redact-secret/redact-secret-benchmarks#384
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/864/README.md
      researchedAt: 2026-09-27
    blockedBy: null
---

# Amazon Bedrock

Amazon Bedrock accepts two kinds of API key as `Authorization: Bearer` or in
the `AWS_BEARER_TOKEN_BEDROCK` variable. A long-term key is issued by AWS as
an IAM service-specific credential. A short-term key is minted client-side as
a presigned URL that lasts at most 12 hours. The two are told apart by prefix.
Provider documentation: [API key reference](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-reference.html).

Both families were promoted to T1 by a maintainer ruling on 2026-09-27. The
ruling is scoped narrowly: the AWS blog prints a scan pattern, not a format
specification. Whether and how core detects a family is not recorded here.

## Families

### `aws-bedrock:long-term-api-key` — Long-term API key (ABSK)

- **Shape:** prefix `ABSK` followed by standard Base64 (`+`, `/`, up to two
  `=`), not URL-safe. The decoded form is `BedrockAPIKey-<user>-at-<account>:<secret>`.
  Wiz measured 132 characters for a primary key; a `+1` secondary key or a
  longer user name gives more. The 109 to 269 band in the git-secrets and
  gitleaks rules is the scanner authors' tolerance, not provider-stated.
- **Sources:** T1 for prefix and alphabet, from the AWS Security Blog
  (2025-10-17) scan pattern, accepted by ruling. The IAM API reference
  supports the public alias versus secret split only. Length is T2 (Wiz
  measurement, scanner tolerance). Only betterleaks, a gitleaks port, was found
  to carry the shape among the other scanners checked.
- **Issuance:** not attempted. Console (Bedrock, API keys, long-term) or
  `aws iam create-service-specific-credential`; shown once; maximum two keys
  per IAM user. The #778 checklist covers length, padding and decoded head.
- **Collisions:** distinct from `AKIA`/`ASIA` access key ids and from the
  public credential alias. GitGuardian's page says "Not prefixed", which
  contradicts the blog. A scanner-author claim that GitHub secret scanning
  covers it is contradicted by GitHub's own pattern page.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md);
  final evidence in the #864 record linked in the frontmatter.
- **Open caveat:** T1 covers the ABSK prefix and Base64 alphabet only; total length (132, or 136 for a secondary key) and non-default IAM user names are T2. Needs issued keys (checklist in #778).

### `aws-bedrock:short-term-api-key` — Short-term API key (bedrock-api-key-)

- **Shape:** prefix `bedrock-api-key-`, then Base64 of a SigV4-presigned
  `CallWithBearerToken` URL ending in `&Version=1`. The first 133 Base64
  characters after the prefix are constant (they encode the fixed host, action,
  algorithm and credential parameters). Padded standard Base64, no URL-safe
  variant. Length is undocumented: about 500 characters with an empty session
  token, longer with one; "over 1000" is a vendor-blog figure.
- **Sources:** T1 for prefix, head and alphabet, from three AWS-authored token
  generators (Python, JavaScript, Java) and the AWS blog regex, whose printed
  body class is malformed (the intended class is standard Base64). Tail length
  is T2.
- **Issuance:** not attempted. Generated client-side or from the console;
  never listed or revocable per key, only by denying the generating session.
  The #779 checklist compares console output with SDK output.
- **Collisions:** shares the header and variable with the long-term key; the
  prefix decides. The decoded URL exposes an `ASIA` access key id, but the
  encoded form is Base64-wrapped. Claude Platform on AWS keys use a different
  prefix and are a separate product.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md);
  final evidence in the #864 record linked in the frontmatter.
- **Open caveat:** T1 covers the prefix, the fixed 133-character head and the alphabet; total length and the session-token part are T2 (undocumented). Needs console-issued keys to compare with SDK output (checklist in #779).

## Candidates that are not families yet

- **Claude Platform on AWS keys** (`aws-external-anthropic-api-key-` and a
  short-term form): reported by BeyondTrust only, no AWS source read.
- **Decoded presigned URL form** of a short-term key: a different lexical form
  of the same secret, left as a separate question in #779.

## Open questions

1. **Long-term length.** Is 132 universal or layout-dependent (secondary key,
   other user names)? Issued keys settle it.
2. **Console vs SDK.** Is a console-issued short-term key byte-identical to an
   SDK-minted one?
3. **Version drift.** `&Version=1` is the only marker in all three SDKs since
   2025-06; nothing documents a change.
4. **Regions and partitions.** GovCloud and China hosts and scope are unread.
5. **Reddit.** Unreachable in both passes, so absence there is weak.

## Research log

- redact-secret#778 — long-term key discovery, Reddit supplement, T1 ruling of
  2026-09-27.
- redact-secret#779 — short-term key discovery, Reddit supplement, T1 ruling
  of 2026-09-27.
- redact-secret#864 — implementation; its frozen evidence record is linked by
  permalink in the frontmatter.
- redact-secret#774 — Beta.10 epic close-out; both keys stable at T1 in the
  benchmarks run.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384b.ts`).
