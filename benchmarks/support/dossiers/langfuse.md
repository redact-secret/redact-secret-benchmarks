---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: langfuse
families:
  - id: langfuse:secret-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://langfuse.com/docs/observability/sdk/overview
        - https://github.com/langfuse/langfuse/blob/dbf5107df264bfcb0613a29237143e78ce16ca8a/packages/shared/src/server/auth/apiKeys.ts
      issues:
        - redact-secret/redact-secret-benchmarks#221
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#728
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: The provider documents prefixes and roles but no body grammar; the UUIDv4 body is provider code (the key generator), and self-hosted operators can set arbitrary values.
---

# Langfuse

Langfuse is an open-source LLM observability platform, offered as Langfuse Cloud
(EU, US, JP and HIPAA regions) and self-hosted. Each project (and, later,
organization) has a public key `pk-lf-...` and a secret key `sk-lf-...`; the
secret is shown once and only its hash is stored. The public key is documented
as safe for browser code.

## Families

### `langfuse:secret-key` — Secret API key

- **Shape:** prefix `sk-lf-` followed by a lowercase UUIDv4 in `8-4-4-4-12` form
  (42 characters in total), version nibble `4` and variant nibble in `8 9 a b`.
  This is what the provider's key generator builds, unchanged from the earliest
  code seen (2023-06) to 2026-09. Organization keys and the AI-gateway feature
  use the same generator.
- **Sources:** T2. Provider code (permalink above and the earliest generator file)
  gives the shape; provider docs give prefixes, roles, env vars
  (`LANGFUSE_SECRET_KEY`) and Basic-auth use. TruffleHog's rule (pinned commit
  `363923b`, keyword- and public-key-gated) agrees.
- **Issuance:** not attempted; a free Hobby cloud account can create keys. The
  checklist is in benchmarks#221.
- **Collisions:** `pk-lf-` public key has the same length and charset and differs
  by one letter; it is the main sibling control. Display form is `sk-lf-...` plus
  four hex characters. Self-hosted headless init and the admin API accept operator
  chosen secrets (the docs' own example is `sk-lf-1234567890`), and Langfuse's own
  log redactor is wider than UUID-only (`sk-lf-[A-Za-z0-9_-]+`). A possible
  `sk-lf-gw-` gateway shape appears only in UI stories, a test fixture and a PR
  description; no code mints it.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record: issuer-minted keys only).

## Candidates that are not families yet

- **Self-hosted operator-defined secrets** (prefix-only or free-form). Outside the
  minted-shape claim.
- **`sk-lf-gw-` gateway keys.** Unconfirmed prefix; the gateway accepts the secret
  alone as a Bearer or `x-api-key` value.
- **Base64 Basic-auth blob** (`pk-lf-...:sk-lf-...` encoded, used for public API
  and OTLP headers). The secret is present but not as a literal.

## Open questions

1. Will gateway keys get a distinct prefix when the feature leaves its allowlist?
2. Is the organization-key prefix documented? The code says it matches the project one.
3. Should detection use `pk-lf-` proximity? The gateway sends the secret alone.
4. Is a base64 Basic-auth header in scope?

## Research log

- redact-secret-benchmarks#221 — broad-discovery pass (2026-09-24), with
  provider-code permalinks for the generator, admin API and gateway.
- redact-secret#726 — freeze of the Beta.8 contracts (empirical route).
- redact-secret#728 — implementation of the LangSmith and Langfuse families.
