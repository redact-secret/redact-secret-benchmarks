---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: xai
families:
  - id: xai:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.x.ai/developers/rest-api-reference/management/auth
        - https://docs.x.ai/developers/quickstart
        - https://docs.x.ai/developers/management-api-guide
      issues:
        - redact-secret/redact-secret-benchmarks#216
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#727
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# xAI

xAI issues Grok API keys from the console (`console.x.ai`, API Keys page) and,
separately, management keys for the Management API. Keys belong to a team and
the full value is returned once, at creation.

## Families

### `xai:api-key` — API key

- **Shape:** prefix `xai-` followed by 80 characters. The provider's API-key
  response schema shows one example with an 80-character alphanumeric body; the
  docs never state the length or the alphabet in prose. A third-party masked
  error (LiteLLM, 2025-03) also shows an 80-character body. The alphabet is
  contested: TruffleHog admits `_`, betterleaks admits `_` and `-`, the
  others accept letters and digits only. No real key with `_` or `-` was seen.
- **Sources:** the family tier follows the assessment contract (T2, #208 record: the
  prefix is provider-documented, the body is not); the prefix alone is T1. Length is provider-example plus tool rules;
  alphabet is unresolved. The official Python SDK reads `XAI_API_KEY` and
  validates nothing. GitHub lists xAI as a secret-scanning partner (regex not
  published).
- **Issuance:** not attempted; a free console account can create a key. Checklist
  in benchmarks#216.
- **Collisions:** management keys (`XAI_MANAGEMENT_KEY`; tools report an
  `xai-token-` prefix, provider docs are silent). Public values next to keys:
  `apiKeyId` and `teamId` UUIDs, ACL strings such as `api-key:endpoint:chat`,
  `xai-org` and `xai-sdk` names, and the redacted form (`xai-...` plus four
  characters). A Groq `gsk_` value stored under `XAI_API_KEY` is not an xAI key.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record: 80 characters from the provisional union alphabet).
- **Open caveat:** T1 on the prefix only; the 80-character length rests on one provider example plus tools and the body alphabet is unresolved (checklist in benchmarks#216).

## Candidates that are not families yet

- **Management key** (`xai-token-` plus 80 characters, per osv-scalibr only).
  Provider docs give no format, so no taxonomy family is proposed.

## Open questions

1. Can `_` or `-` appear in the body?
2. Did 2024 beta-era keys use another shape? Not found.
3. Is the `xai-token-` management prefix real? Only a tool source says so.
4. A search summary claimed project-scoped sub-prefixes; no fetched page supports it.
5. GitGuardian marks the type "not prefixed", which conflicts with every other source.

## Research log

- redact-secret-benchmarks#216 — broad-discovery pass (2026-09-24), including the
  right-boundary disagreement between peers.
- redact-secret#727 — implementation of the committed AI inference credential families for Beta.8 (closed 2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (this family: empirical route,
  alphabet provisional).
