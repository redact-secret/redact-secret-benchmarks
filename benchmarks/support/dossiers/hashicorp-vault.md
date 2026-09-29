---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: hashicorp-vault
families:
  - id: hashicorp-vault:service-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.hashicorp.com/vault/docs/concepts/tokens
      issues:
        - redact-secret/redact-secret-benchmarks#46
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: hashicorp-vault:batch-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.hashicorp.com/vault/docs/concepts/tokens
      issues:
        - redact-secret/redact-secret-benchmarks#46
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: hashicorp-vault:recovery-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.hashicorp.com/vault/docs/concepts/tokens
      issues:
        - redact-secret/redact-secret-benchmarks#46
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
---

# HashiCorp Vault

HashiCorp Vault issues service tokens (prefix `hvs.`), batch tokens (`hvb.`) and recovery tokens (`hvr.`). HCP Terraform tokens are recorded under `hashicorp-terraform`.

All three families are `ready` at T1 on the shipped `vault-token` contract (prefixes and minimum length only).

## Families

### `hashicorp-vault:service-token` — Service token

- **Shape:** Standard Vault service token, prefixed hvs.
- **Sources:** T1 per the shipped `vault-token` contract in the benchmarks assessment: the tokens concept page documents exactly the `hvs.`, `hvb.` and `hvr.` prefixes and a minimum of 24 random characters, and states the structure is opaque, so the 90 to 120 character rule the pinned tools use is corroboration, not contract. Re-checked 2026-09-20 in benchmarks#46 (PR #55).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `hashicorp-vault:batch-token` — Batch token

- **Shape:** Lightweight, non-renewable Vault batch token, prefixed hvb.
- **Sources:** T1 per the shipped `vault-token` contract in the benchmarks assessment: the tokens concept page documents exactly the `hvs.`, `hvb.` and `hvr.` prefixes and a minimum of 24 random characters, and states the structure is opaque, so the 90 to 120 character rule the pinned tools use is corroboration, not contract. Re-checked 2026-09-20 in benchmarks#46 (PR #55).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `hashicorp-vault:recovery-token` — Recovery token

- **Shape:** Vault recovery operation token, prefixed hvr.
- **Sources:** T1 per the shipped `vault-token` contract in the benchmarks assessment: the tokens concept page documents exactly the `hvs.`, `hvb.` and `hvr.` prefixes and a minimum of 24 random characters, and states the structure is opaque, so the 90 to 120 character rule the pinned tools use is corroboration, not contract. Re-checked 2026-09-20 in benchmarks#46 (PR #55).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded. Legacy one-letter token prefixes exist and are not in the taxonomy.

## Open questions

1. The body beyond the 24-character minimum is provider-opaque; tool rules (90 to 120 characters) are not contract.
2. The contract requires an explicit Vault endpoint alongside the token.

## Research log

- redact-secret-benchmarks#46 (PR #55, closed 2026-09-21) — twin coverage; re-checked the tokens concept page on 2026-09-20.
