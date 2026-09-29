---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: sendgrid
families:
  - id: sendgrid:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://support.sendgrid.com/hc/en-us/articles/44146758703387-Can-I-Use-a-Reduced-Shorter-API-Key-Size-in-SendGrid
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
---

# SendGrid

SendGrid issues API keys with the prefix `SG.`; full-access and restricted-access keys share one format.

## Families

### `sendgrid:api-key` — API key

- **Shape:** SG. prefixed API key (full-access and restricted-access permission scopes share this format).
- **Sources:** `ready`, T1 per the shipped `sendgrid-token` contract in the benchmarks assessment. Its provider source is a SendGrid support article stating a fixed total key length of 69 characters (added 2026-09-20 by benchmarks PR #34, closing #33). The `SG.` prefix, the dot-separated 22 and 43 character segments and the alphabet are tool-corroborated, not stated by that page.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded.

## Open questions

1. The 22 and 43 character segment split and the alphabet rest on scanner rules, not on a SendGrid page.

## Research log

- redact-secret-benchmarks#33 (PR #34, 2026-09-20) — added the SendGrid support article as the contract's provider source.
- Related non-research issues: core #285, #402, #404, #553.
