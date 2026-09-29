---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: openrouter
families:
  - id: openrouter:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://openrouter.ai/docs/guides/features/guardrails/secret-formats
        - https://openrouter.ai/docs/api/api-reference/api-keys/create-keys
      issues:
        - redact-secret/redact-secret-benchmarks#220
        - redact-secret/redact-secret#726
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
  - id: openrouter:management-api-key
    research:
      verdict: not-found
      tier: null
      sources: []
      issues:
        - redact-secret/redact-secret-benchmarks#220
        - redact-secret/redact-secret#726
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# OpenRouter

OpenRouter routes requests to many model providers behind one OpenAI-compatible
API. It issues inference API keys (`openrouter.ai/settings/keys`) and management
keys (`/settings/management-keys`, formerly "provisioning keys") that administer
keys but cannot call completion endpoints. Both are shown once at creation.

## Families

### `openrouter:api-key` — Inference API key

- **Shape:** prefix `sk-or-v1-` followed by 64 lowercase hexadecimal characters
  (73 in total). OpenRouter's own Secrets guardrail page states this shape, and
  the create-key API example matches it. OAuth PKCE keys use the same shape per
  the vendored OpenAPI example.
- **Sources:** T1, provider documentation (guardrail secret formats, create-keys
  reference), corroborated by TruffleHog, flare-redact and betterleaks. Betterleaks
  is case-insensitive; a few rules use looser classes than hex.
- **Issuance:** not attempted. Free accounts can create a key; the checklist is in
  benchmarks#220. No pre-`v1` or `v2` shape was found.
- **Collisions:** the key `hash` returned by the API is 64 hex characters, the same
  body without the prefix, so a bare 64-hex string is not a key. The `label` is a
  masked form (`sk-or-v1-` plus a short head and tail). OpenAI `sk-` and Anthropic
  `sk-ant-` keys are different families. `sk-or-mgmt-` is the sibling below.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record; management and uppercase variants are intentional gaps).

### `openrouter:management-api-key` — Management API key

- **Shape:** prefix `sk-or-mgmt-`, stated only on the Terraform provider page and
  its README. Body length, alphabet and any embedded version or checksum are not
  documented anywhere found.
- **Sources:** provider docs give the prefix on Terraform-related pages only; the
  management-keys guide gives no prefix or length. GitGuardian says one detector
  covers provisioning keys, which conflicts with the `sk-or-mgmt-` prefix.
- **Issuance:** free, shown once, optional expiry fixed at creation; not attempted.
- **Collisions:** shares the `sk-or-` stem with inference keys. A real secret, so
  it is never a benign control for `openrouter:api-key`.
- **Current contract in core:** unclaimed per the #726 record
  ([`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)).

## Candidates that are not families yet

- **`OPENROUTER_WEBHOOK_SECRET`** (workspace webhook signing secret). Format
  undocumented; the docs use a placeholder.
- **BYOK payloads** carry other providers' keys; they belong to those families.

## Open questions

1. What are the `sk-or-mgmt-` body length, alphabet and structure? Optional
   management-key issuance in the #220 checklist would settle it.
2. Does OpenRouter accept uppercase hex in an inference key?
3. Is the `hash` derived from the key (for example a SHA-256)? Undocumented.

## Research log

- redact-secret-benchmarks#220 — broad-discovery pass (2026-09-24), including
  the management-key discussion.
- redact-secret#726 — freeze of the Beta.8 contracts; management keys named as a
  separate, unclaimed secret family.
