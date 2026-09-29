---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: hashicorp-terraform
families:
  - id: hashicorp-terraform:user-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.hashicorp.com/terraform/cloud-docs/api-docs/user-tokens
      issues:
        - redact-secret/redact-secret#521
        - redact-secret/redact-secret-benchmarks#67
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/521/README.md
      researchedAt: 2026-09-21
    blockedBy: null
  - id: hashicorp-terraform:organization-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.hashicorp.com/terraform/cloud-docs/api-docs/organization-tokens
      issues:
        - redact-secret/redact-secret#521
        - redact-secret/redact-secret-benchmarks#67
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/521/README.md
      researchedAt: 2026-09-21
    blockedBy: null
  - id: hashicorp-terraform:team-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.hashicorp.com/terraform/cloud-docs/api-docs/team-tokens
      issues:
        - redact-secret/redact-secret#521
        - redact-secret/redact-secret-benchmarks#67
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/521/README.md
      researchedAt: 2026-09-21
    blockedBy: null
---

# HashiCorp Terraform (HCP Terraform / Terraform Enterprise)

HCP Terraform and Terraform Enterprise issue API tokens for users, organizations
and teams. HashiCorp's API reference publishes one full-width example for each
kind, and all three share a single grammar, so the three families are separated
by issuance path rather than by shape. Vault tokens are a different HashiCorp
product and are recorded in the `hashicorp-vault` dossier.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `hashicorp-terraform:user-token` — User token

- **Shape:** 14 alphanumeric characters, the literal marker `.atlasv1.`, then 67
  alphanumeric characters (90 in all). No checksum or other marker is
  documented beyond the `.atlasv1.` version tag.
- **Sources:** T1. The `user-tokens` API page publishes a full example whose
  segments measure exactly 14 and 67. Two tools corroborate the family but
  disagree on width: gitleaks 8.30.1 uses a looser 60 to 70 character tail over
  a wider alphabet, trufflehog 3.97.4 uses the exact 14/67 widths (#521
  evidence, observed 2026-09-21).
- **Collisions:** a tail of 60 to 66 bytes is accepted by gitleaks and not by
  the exact width, so a peer disagreement there is expected. HashiCorp's CLI
  documentation uses a short placeholder of the same overall form.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `hashicorp-terraform:organization-token` — Organization token

- **Shape:** identical to the user token.
- **Sources:** T1. The `organization-tokens` page publishes its own example with
  the same 14/67 split, independent of the user-token page. The Terraform
  Enterprise mirror of this page shows the same shape.
- **Collisions:** none by shape; see the user token. The value does not say
  which kind it is.
- **Current contract in core:** same detector as the user token; see
  [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `hashicorp-terraform:team-token` — Team token

- **Shape:** identical to the user token.
- **Sources:** T1. The `team-tokens` page publishes a third example with the same
  14/67 split. Agreement across the three separately authored pages is the
  basis for the exact widths.
- **Collisions:** none by shape; see the user token.
- **Current contract in core:** same detector as the user token; see
  [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Agent pool token.** The #521 record treats it as covered by the same shape
  and did not audit it separately. No distinct grammar was found; a taxonomy
  entry would be needed only if issuance differs.
- **Terraform Enterprise (self-hosted) token.** The mirrored Enterprise API
  reference publishes the identical example, so it is recorded as the same
  grammar and not as a separate family.

## Open questions

1. **Tail width.** The exact 67 comes from three examples and one tool. Does
   HashiCorp ever issue a tail in the 60 to 66 range that gitleaks accepts?
   One issued token per kind would settle it.
2. **Issuance not attempted.** No token was minted; all evidence is provider
   examples and scanner rules.

## Research log

- redact-secret#521 (2026-09-21) — settled the grammar as one shape for user,
  team and organization tokens on three provider pages plus two tools, tier T1.
  Agent-pool and Enterprise tokens were recorded as the same shape.
- redact-secret-benchmarks#67 (2026-09-21) — backfilled the benchmark contract
  as T1 with the three provider pages; the exact-width choice over gitleaks'
  looser range was carried into the contract review.
