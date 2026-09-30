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
        - redact-secret/redact-secret#727
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
  - id: openrouter:management-api-key
    research:
      verdict: issuance-gated
      tier: T0
      sources:
        - https://github.com/OpenRouterTeam/docs/blob/9e4172882651f7a85099a3054d120e66ef850715/guides/overview/terraform.mdx#L41
        - https://github.com/OpenRouterTeam/terraform-provider-openrouter/blob/7fd0e341dc9c638333952e8e4159c198b7028d91/README.md#L39
        - https://github.com/OpenRouterTeam/terraform-provider-openrouter/pull/253
        - https://github.com/OpenRouterTeam/docs/blob/9e4172882651f7a85099a3054d120e66ef850715/guides/features/guardrails/secret-formats.mdx#L36
        - https://github.com/zaydiscold/hydra/blob/cf1926f166be543f3af93a4d50b2bc548d6b6409/server/services/key-utils.js#L4-L6
        - https://github.com/disler/inkwell-agent-sandboxes-and-software-factory/issues/3
        - https://github.com/kljensen/openrouter-keymaster/blob/d54808de2de0df4fae0367a2680ab71379643642/crates/core/src/redaction.rs#L20-L25
      issues:
        - redact-secret/redact-secret-benchmarks#220
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/openrouter-management-api-key.md
      researchedAt: 2026-09-29
    blockedBy: The prefix itself is contested (provider statements say sk-or-mgmt-, three first-hand users say sk-or-v1-) and no body grammar exists; needs one management key measured (free, structure only).
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
  its README and by one staff statement. Body length, alphabet and any embedded version or
  checksum are not documented anywhere found. Three independent first-hand users report
  that their live management keys start `sk-or-v1-` like inference keys; if that is right,
  management keys are `sk-or-v1-` + 64 lowercase hex, the `openrouter:api-key` contract
  already covers them and no separate family is needed.
- **Verdict (#1012, 2026-09-29):** `issuance-gated`, T0. This supersedes the earlier
  `not-found` entry: the prefix now has provider statements but they are contradicted, so no
  prefix claim is T1 while it stands.
- **Sources:**
  - provider docs (R4, prefix claim): OpenRouterTeam/docs `terraform.mdx`, 2026-09-02, "Management API key ... which starts with `sk-or-mgmt-...`"; the terraform provider README (first seen 2026-07-17) repeats it as a placeholder.
  - provider staff statement (R3, prefix, as of 2026-08-25): terraform-provider-openrouter PR #253, "Management keys are a distinct credential with their own prefix, `sk-or-mgmt-...`" (the author's profile names @OpenRouterTeam).
  - provider docs (T1, for inference keys only): OpenRouter's own secret-scanning page states `sk-or-v1-` + 64 lowercase hex and has no management-key row.
  - contradicting first-hand reports (independent, 2026-04-03, 2026-08-10, 2026-08-24): hydra's key utilities ("OR management keys use sk-or-v1- prefix, NOT sk-or-mgmt-"), a report in the inkwell sandboxes repository ("Both key types have the same `sk-or-v1-...` prefix. I confirmed this on my own account") and openrouter-keymaster's redaction module. A format change after 2026-08-24 is possible but unproven.
  - peer rule: osv-scalibr `sk-or-v[0-9]+-[A-Za-z0-9_-]{20,}` would not match `sk-or-mgmt-`. No other peer scanner has an `sk-or-mgmt` rule; 111 code-search hits are docs, placeholders and prefix checks.
  - GitGuardian says one detector covers provisioning keys, which conflicts with the `sk-or-mgmt-` prefix.
- **Issuance:** free at `/settings/management-keys`, shown once, optional expiry fixed at creation; not attempted. The #1012 check: create one key with the shortest expiry and record the exact prefix, total length, body alphabet (lowercase hex only?) and that `GET /api/v1/key` reports it as a management key; then delete it.
- **Collisions:** shares the `sk-or-` stem with inference keys. A real secret, so
  it is never a benign control for `openrouter:api-key`.
- **Current contract in core:** unclaimed per the #726 record
  ([`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)).
  If the keys are `sk-or-v1-` they are redacted under the inference type (the role is not
  lexically visible); if `sk-or-mgmt-`, only in named and Bearer contexts.

## Candidates that are not families yet

- **`OPENROUTER_WEBHOOK_SECRET`** (workspace webhook signing secret). Format
  undocumented; the docs use a placeholder.
- **BYOK payloads** carry other providers' keys; they belong to those families.

## Open questions

1. Is the management-key prefix `sk-or-mgmt-` or `sk-or-v1-`, and what are the body
   length, alphabet and structure? Statements cannot settle it; one issued key can
   (#220 checklist, redact-secret#1012).
2. Does OpenRouter accept uppercase hex in an inference key?
3. Is the `hash` derived from the key (for example a SHA-256)? Undocumented.

## Research log

- redact-secret#1012 — 2026-09-29 contract research for the management key
  ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/openrouter-management-api-key.md)):
  BLOCKED on a contested prefix; three first-hand reports contradict the provider statements.
- redact-secret-benchmarks#220 — broad-discovery pass (2026-09-24), including
  the management-key discussion.
- redact-secret#727 — implementation of the committed AI inference credential families for Beta.8 (closed 2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts; management keys named as a
  separate, unclaimed secret family.
