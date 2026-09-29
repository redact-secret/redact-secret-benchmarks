---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: langsmith
families:
  - id: langsmith:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.langchain.com/langsmith/create-account-api-key
        - https://github.com/trufflesecurity/trufflehog/blob/363923b901c911a9164f50b6c423f47c15372b1c/pkg/detectors/langsmith/langsmith.go
      issues:
        - redact-secret/redact-secret-benchmarks#219
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#728
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# LangSmith

LangSmith (LangChain) is an observability and evaluation service. Its API keys
come in two roles, both created under Settings > API Keys with an expiry and
displayed once: personal access tokens, which inherit the creating user's
permissions, and service keys, scoped to a workspace or organization.

## Families

### `langsmith:api-key` — API key (personal access token or service key)

- **Shape:** prefix `lsv2_pt_` (personal access token) or `lsv2_sk_` (service
  key), then 32 lowercase hex characters, `_`, and 10 lowercase hex characters
  (51 in total). Every scanner agrees on the layout; TruffleHog merges the two
  roles, other rules split them. The docs render only masked forms of both
  prefixes. LangChain's own SDK redactor accepts a wider first segment
  (`[A-Za-z0-9]{32,}` with any number of `_` tails). Whether the 10-hex tail is a
  checksum, a key-id fragment or random is not documented.
- **Sources:** T2: TruffleHog rule (pinned commit above) plus other scanners; the
  provider page only documents roles, env vars (`LANGSMITH_API_KEY`, legacy
  `LANGCHAIN_API_KEY`) and headers (`X-API-Key`, OTLP `x-api-key`).
- **Issuance:** not attempted; the free Developer tier can issue both roles. The
  checklist is in benchmarks#219.
- **Collisions:** siblings that are not this family: legacy `ls__` keys (provider
  code still redacts them; real shape unknown), self-hosted license key, SCIM
  bearer token, OAuth access and refresh tokens, the internal `X-Service-Key` JWT,
  and unconfirmed deployment keys. Public ids next to keys: workspace and
  organization UUIDs, project names, `short_key`, and `ls_`-prefixed trace
  metadata names such as `ls_provider`.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record, implemented under #728).
- **Open caveat:** The provider documents roles and contexts but no prefix, length or alphabet; segment widths and lowercase hex are scanner-corroborated only (checklist in benchmarks#219).

## Candidates that are not families yet

- **Legacy `ls__` key.** Provider code redacts `ls__` plus 24 characters in a
  test; the real length, alphabet and retirement date are unknown.
- **Personal access token vs service key as separate families.** Peers disagree
  on splitting them; the taxonomy holds one family for both roles.
- **SCIM token, OAuth tokens, deployment keys, license key.** No shape recorded.

## Open questions

1. Is the `_<10 hex>` tail a checksum or an embedded id? The helm chart's
   `apiKeySalt` hints at server-side derivation.
2. Do self-hosted instances issue the same `lsv2_` shapes?
3. Do legacy `ls__` keys still authenticate?
4. When did `lsv2_` replace the older placeholders (`ls__`, `ls_`)? Not documented.

## Research log

- redact-secret-benchmarks#219 — broad-discovery pass (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (empirical route).
- redact-secret#728 — implementation of the LangSmith and Langfuse families.
