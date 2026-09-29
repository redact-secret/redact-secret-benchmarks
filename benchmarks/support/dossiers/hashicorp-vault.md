---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: hashicorp-vault
families:
  - id: hashicorp-vault:service-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: hashicorp-vault:batch-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: hashicorp-vault:recovery-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# HashiCorp Vault

HashiCorp Vault issues service tokens (prefix `hvs.`), batch tokens (`hvb.`) and recovery tokens (`hvr.`). HCP Terraform tokens are recorded under `hashicorp-terraform`.

No family in this dossier has a recorded research verdict. Whether and how core detects a family is not recorded here.

## Families

### `hashicorp-vault:service-token` — Service token

- **Shape:** Standard Vault service token, prefixed hvs.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `hashicorp-vault:batch-token` — Batch token

- **Shape:** Lightweight, non-renewable Vault batch token, prefixed hvb.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `hashicorp-vault:recovery-token` — Recovery token

- **Shape:** Vault recovery operation token, prefixed hvr.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded. Legacy one-letter token prefixes exist and are not in the taxonomy.

## Open questions

1. **All three families are unresearched.** Searched: core and benchmarks issue titles for Vault and HashiCorp (only unrelated Azure Key Vault and release-status issues matched), core `docs/specs`, evidence and decisions, benchmarks `docs/` and `benchmarks/support`. No research record exists.
2. **Lead, not a verdict.** The benchmarks contract for `vault-token` cites Vault's tokens concept page (https://developer.hashicorp.com/vault/docs/concepts/tokens) as T1 for exactly three prefixes and a minimum of 24 random characters, and records that the provider states the structure is opaque, so the 90 to 120 character rule the pinned tools use is corroboration, not contract (re-checked 2026-09-20, benchmarks#46). Decide whether that row counts as a research record.

## Research log

No research issues.
