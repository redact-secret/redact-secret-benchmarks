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
      verdict: ready
      tier: T2
      sources:
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds-programmatic-access.html
        - https://docs.aws.amazon.com/STS/latest/APIReference/API_Credentials.html
        - https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/cmd/generate/config/rules/aws.go
        - https://github.com/Yelp/detect-secrets/blob/5e141933554a0b74e7341841f318be21e895339c/detect_secrets/plugins/aws.py
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/aws/session_keys/sessionkey.go
        - https://github.com/awslabs/git-secrets/blob/7d6b970cbd3c216353cb22b383b70c150140662e/git-secrets
        - https://github.com/hashicorp/aws-sdk-go-base/blob/41fc7e1b09a140821eb9cbe6889bb53072a0da2e/logging/aws.go
        - https://github.com/BishopFox/jsluice/blob/0ddfab153e060a9eeaded4d8669233f7c071e7e4/secret-aws.go
        - https://github.com/gitleaks/gitleaks/pull/1816
        - https://awsteele.com/blog/2020/09/26/aws-access-key-format.html
        - https://summitroute.com/blog/2018/06/20/aws_security_credential_formats/
        - https://blog.adobe.com/security/uncovering-the-hidden-identities-within-aws-access-keys
        - https://hackingthe.cloud/aws/general-knowledge/iam-key-identifiers/
        - https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns
      issues:
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#1012
        - redact-secret/redact-secret#1027
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4fb78827f1ddf5b3106f25130ca510a836ada186/docs/audits/evidence/1012/aws-sts-temporary-access-key.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: aws:sts-service-bearer-token
    research:
      verdict: not-found
      tier: null
      sources:
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_bearer.html
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes
        - https://docs.aws.amazon.com/codeartifact/latest/ug/tokens-authentication.html
        - https://docs.aws.amazon.com/codeartifact/latest/APIReference/API_GetAuthorizationToken.html
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/cmd/generate/config/rules/aws.go
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/aws/access_keys/accesskey.go
        - https://github.com/hashicorp/aws-sdk-go-base/blob/41fc7e1b09a140821eb9cbe6889bb53072a0da2e/logging/aws.go
        - https://github.com/BishopFox/jsluice/blob/0ddfab153e060a9eeaded4d8669233f7c071e7e4/secret-aws.go
      issues:
        - redact-secret/redact-secret-benchmarks#473
      evidence: null
      researchedAt: 2026-09-29
    blockedBy: null
  - id: aws:context-specific-credential
    research:
      verdict: rejected
      tier: null
      sources:
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-prefixes
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_api_keys_for_aws_services.html
        - https://docs.aws.amazon.com/IAM/latest/APIReference/API_ServiceSpecificCredential.html
        - https://aws.amazon.com/blogs/security/securing-amazon-bedrock-api-keys-best-practices-for-implementation-and-management/
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/cmd/generate/config/rules/aws.go
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/aws/access_keys/accesskey.go
        - https://github.com/hashicorp/aws-sdk-go-base/blob/41fc7e1b09a140821eb9cbe6889bb53072a0da2e/logging/aws.go
        - https://github.com/BishopFox/jsluice/blob/0ddfab153e060a9eeaded4d8669233f7c071e7e4/secret-aws.go
      issues:
        - redact-secret/redact-secret-benchmarks#473
      evidence: null
      researchedAt: 2026-09-29
    blockedBy: null
  - id: aws:iam-user-secret-access-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
        - https://docs.aws.amazon.com/IAM/latest/APIReference/API_AccessKey.html
        - https://github.com/awslabs/git-secrets/blob/7d6b970cbd3c216353cb22b383b70c150140662e/git-secrets
        - https://github.com/Yelp/detect-secrets/blob/5e141933554a0b74e7341841f318be21e895339c/detect_secrets/plugins/aws.py
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/aws/common.go
        - https://github.com/hashicorp/aws-sdk-go-base/blob/41fc7e1b09a140821eb9cbe6889bb53072a0da2e/logging/aws.go
        - https://summitroute.com/blog/2018/06/20/aws_security_credential_formats/
        - https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns
      issues:
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#1012
        - redact-secret/redact-secret#1028
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4fb78827f1ddf5b3106f25130ca510a836ada186/docs/audits/evidence/1012/aws-iam-user-secret-access-key.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# AWS

AWS issues long-term IAM user access keys, short-term STS credentials and related service credentials, told apart by a four-letter identifier prefix (AKIA, ASIA, ABIA, ACCA), plus a separate 40-character secret paired with an access key ID. Amazon Bedrock API keys are recorded under `aws-bedrock` and not here.

`aws:iam-user-access-key` is `ready` at T1 on the shipped `aws-access-key` contract. The 2026-09-29 pass (#473) settled the other four: ASIA is `ready` (T1 prefix, T2 body), the secret access key is `ready` (T2, context-constrained only), the ABIA bearer token is `not-found`, and ACCA is `rejected`. Whether and how core detects a family is not recorded here.

## Families

### `aws:iam-user-access-key` — IAM user access key

- **Shape:** Long-term access key ID for an IAM user, prefixed AKIA.
- **Sources:** T1 per the shipped `aws-access-key` contract in the benchmarks assessment: the IAM unique-identifier prefix table documents the AKIA prefix. The 16-character base32 body and the 40-character companion secret are tool-corroborated, not provider-stated. Provider source re-checked 2026-09-20 in benchmarks#36 (PR #38). The contract does not cover ASIA.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:sts-temporary-access-key` — STS temporary access key

- **Shape:** Short-lived access key ID from STS operations, prefixed ASIA: four prefix characters plus a 16-character body, 20 in all. It is usable only together with a secret access key and a session token, so the key ID alone authenticates nothing.
- **Verdict:** `ready`, T1 for the prefix and T2 for the body (2026-09-29, wide-first pass, #473).
- **Provider documentation (T1 for the prefix).** The IAM unique-identifier table lists ASIA as temporary (AWS STS) access key IDs, "unique only in combination with the secret access key and the session token", and warns that prefixes "may vary based on when they were created". The programmatic-access page says ASIA keys are created with STS operations. The STS `Credentials` type bounds the key ID at 16 to 128 word characters, and `AssumeRole` states the session token size is "not fixed", so no length can be asserted for the token.
- **Body (T2 corroboration, dated 2026-09-29).** The 16-character body is not stated by AWS in prose. It rests on the peer rules (gitleaks `aws.go` at `b58d3f1`, detect-secrets `aws.py` at `5e14193`, TruffleHog `session_keys` at `48b58d3`), on AWS-owned code (`awslabs/git-secrets` at `7d6b970`, which lists ASIA with 16 more characters) and on independent implementations (HashiCorp `aws-sdk-go-base` and BishopFox `jsluice`). Independent research agrees: Scott Piper (2018), Aidan Steele (2020) and Adobe (2025).
- **Contradiction, bounded.** gitleaks narrowed the body to base32 (`A-Z`, `2-7`) in April 2025 (PR 1816, no maintainer discussion). detect-secrets, git-secrets, TruffleHog and hashicorp accept any `A-Z0-9`. Steele (2020) observed only base32 characters (`0`, `1`, `8` and `9` absent) and dated a change in the key ID's internal structure to 27 to 29 March 2019; Piper (2018) also gives base32. No reviewed source shows an ASIA key with a digit outside `2-7`, so the taxonomy note that "some legacy ASIA values" do is uncorroborated. Treat it as a bound: a base32-only contract cannot see such a value if one exists, and a fixture must not treat a digit outside base32 as proof of non-credential. No provider source decides which peer is right.
- **What is not established.** The fifth-character and last-character structure (I or J, A or Q) and the account-ID encoding are reverse-engineered and undocumented by AWS ("subject to change"), so they are not grammar. The session token has no documented alphabet or length; the docs' own examples are base64-shaped, and TruffleHog matches it as 100 or more base64 characters, a heuristic. A bare ASIA key ID is the weakest half: use it only with a paired secret or session token, as GitHub secret scanning does (`aws_temporary_access_key_id` needs a secret and a token).
- **Not issued.** Nothing was minted; STS issuance needs an AWS account and was not attempted.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:sts-service-bearer-token` — STS service bearer token

- **Shape:** AWS documents that the access key ID inside an STS service bearer token starts with ABIA. It says nothing about the bearer token string itself.
- **Verdict:** `not-found` (2026-09-29, #473) for the family as named: a bearer credential prefixed ABIA.
- **What the sources say.** The service-bearer-token page says services such as CodeArtifact (and, by the same permission, ECR Public) call `sts:GetServiceBearerToken` and hand back a token, and that "the token's access key ID begins with the ABIA prefix", which helps read CloudTrail. The CodeArtifact API types the returned token only as a string, with no length, alphabet or prefix, and a 15-minute to 12-hour life. The prefix table lists ABIA in the same row style as AKIA.
- **What was searched and not found.** AWS docs (IAM, STS, CodeArtifact, ECR Public), AWS SDK and CLI source hits, search-result listings of AWS re:Post and Medium threads on the `GetServiceBearerToken` permission error (titles only, not opened), a Docker forum thread on CodeArtifact tokens in a Dockerfile (no shape described), blogs (Hacking the Cloud, Steele's tweet and blog, Adobe, Summit Route), Hacker News, and GitHub code search. Every one names the ABIA prefix or the permission only. None states the token's shape, and no scanner has a rule for the CodeArtifact or ECR Public token; the peers (gitleaks, TruffleHog `access_keys`, hashicorp, jsluice) list ABIA only as an access-key-ID prefix.
- **Consequence.** The ABIA key ID, if it turns up bare, is an identifier shaped like the other key IDs and would belong to a key-ID candidate, not to a bearer-token family. Whether a bare ABIA ID needs a detector is a core policy question; this dossier has no grammar for the token that actually authenticates. Revisit only if AWS documents the token format or a decoded token structure is published.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:context-specific-credential` — Context-specific credential

- **Shape:** ACCA is the prefix of a service-specific credential ID, at least 20 and at most 128 word characters. It identifies a credential and does not authenticate.
- **Verdict:** `rejected` (2026-09-29, #473): the ACCA value is a management handle, not a secret, and the secret half is recorded elsewhere.
- **Why.** The IAM prefix table gives ACCA as "Context-specific credential". AWS's own Bedrock guidance says "the prefix to a service-specific credential ID is ACCA" and shows it in CloudTrail fields. The IAM API returns the ID as the unique identifier used to update, reset or delete the credential, and lists it in ordinary `list-service-specific-credentials` output. The credential that authenticates is a different field: the generated `ServicePassword` (with a generated user name built from the IAM user and account ID) for CodeCommit and Keyspaces, or the `ServiceCredentialSecret` and `ServiceApiKeyValue` for Bedrock and CloudWatch Logs API keys. Bedrock's long-term key has its own documented `ABSK` prefix and is the `aws-bedrock` family, not this one.
- **Peer view.** gitleaks, TruffleHog (`access_keys`, which pairs the ID with a secret before it reports), hashicorp and jsluice all include ACCA in a key-ID prefix set, so ACCA-shaped IDs get matched. None documents that ACCA is a credential in its own right. No source gives a body alphabet beyond the API's word-character pattern.
- **Reversible.** If core wants ACCA key-ID detection as it has for AKIA, the prefix is T1 and the peers corroborate a 20-character form; that would be a key-ID candidate, and the taxonomy description ("temporary credential") should change with it, because the docs describe a service-specific credential ID.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `aws:iam-user-secret-access-key` — IAM user secret access key

- **Shape:** The 40-character secret paired with an access key ID, standard base64 characters (letters, digits, `+`, `/`). It has no prefix or lexical marker. Temporary (ASIA) credentials carry a secret of the same shape.
- **Verdict:** `ready` at T2, context-constrained only (2026-09-29, #473). No bare-value claim is supported.
- **Provider side (T1 does not apply).** AWS never states the length or alphabet in prose. The `SecretAccessKey` field in the IAM and STS APIs is typed only as a string. AWS documentation examples are 40 characters long, with one exception: the `AssumeRole` and `GetSessionToken` sample responses show a value one character longer, a documentation slip that no reviewed source treats as a format.
- **T2 corroboration (dated 2026-09-29, five owners, four classes).** `awslabs/git-secrets` at `7d6b970` (AWS-owned code) matches `[A-Za-z0-9/+=]{40}` after an AWS-named key; detect-secrets `aws.py` at `5e14193` states "AWS secret access keys are 40 characters long" and gates on an `aws` keyword and a quote; TruffleHog `common.go` at `48b58d3` uses a 40-character base64 run with an entropy floor and only reports it beside a key ID; HashiCorp `aws-sdk-go-base` at `41fc7e1` masks "40-character, base-64" strings (independent implementation); Scott Piper (2018) describes 40 characters decoding to 30 random bytes (independent research, a summary class); GitHub secret scanning lists `aws_secret_access_key` only as a paired token.
- **Contradictions, bounded.** git-secrets allows `=` and detect-secrets omits it; standard base64 has no `=` inside 40 characters, so the contract should anchor on the `+` and `/` alphabet. The peers disagree on the keyword set and the quoting they demand; none makes the bare value a finding without its neighbour.
- **Consequence.** Any 40-character base64 run is a hash, a path or an ordinary token, so a bare-value positive is unsupported. The supportable claim is a value assigned to an AWS-named key, or sitting beside an AKIA or ASIA key ID. The AWS example value is documented and is a placeholder, not a credential; keep it out of positive fixtures.
- **Not issued.** No key was created or observed.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **ABIA key ID (bare).** Documented prefix, no documented token grammar; a key-ID shape like AKIA. Held until core decides whether an identifier that authenticates nothing is in scope.
- **ACCA key ID (bare).** Same reasoning; see the `rejected` verdict above.
- **STS session token.** A long base64-looking value, "not fixed" in size per AWS, no prefix. No grammar exists to research; recorded as the companion of the ASIA key ID, not a family.
- **Other IAM unique-ID prefixes** (AGPA, AIDA, AIPA, ANPA, ANVA, APKA, AROA, ASCA). Resource identifiers, not credentials.

## Open questions

1. Does AWS document the CodeArtifact and ECR Public bearer token format anywhere? Nothing reviewed does; a decoded structure published by AWS would reopen `aws:sts-service-bearer-token`.
2. Does any ASIA key ID carry a digit outside `2-7`? The taxonomy note says legacy ones do; no reviewed source shows one.
3. Do the two keys of an IAM user ever show a secret that is not 40 characters? No source reports one.

## Research log

- redact-secret-benchmarks#36 (PR #38, 2026-09-20) — re-check of the IAM prefix table as the `aws-access-key` provider source.
- redact-secret-benchmarks#473 (2026-09-29) — wide-first pass on the four unresearched families: ASIA `ready`, secret access key `ready` (T2, context-only), ABIA `not-found`, ACCA `rejected`. Searched: AWS IAM, STS, CodeArtifact, Bedrock and CLI docs; gitleaks, detect-secrets, TruffleHog, git-secrets, HashiCorp and BishopFox source; the gitleaks base32 PR; GitHub's supported-pattern table; Summit Route, Steele, Adobe and Hacking the Cloud write-ups; Hacker News. Reddit was unreachable (search filter and browser both refused it) and the Stack Overflow web pages returned no text to the browser, so those two communities are not covered.
- Related non-research issues: core #254 and #318.
