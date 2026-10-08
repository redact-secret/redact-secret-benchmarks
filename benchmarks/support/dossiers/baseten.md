---
provider: baseten
families:
  - id: baseten:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/redact-secret/redact-secret/blob/5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf/docs/audits/evidence/1111/README.md
      issues:
        - redact-secret/redact-secret#1111
      evidence: https://github.com/redact-secret/redact-secret/blob/5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf/docs/audits/evidence/1111/README.md
      researchedAt: 2026-10-07
    blockedBy: null
---

# Baseten

## Families

### `baseten:api-key`

The upstream research handoff is adopted in core `5fddf1a60d0297f0914e4b15c42a33c90a3d8fdf`. This repository records a T3 pending benchmark contract and synthetic registry-wide policy coverage. The research tier describes upstream source evidence; it does not promote the benchmark contract or measured support.

Published beta.14 contains no detector for this family. A reviewed contract, dedicated corpus and independent measurement remain follow-up work.

## Open questions

Independent benchmark intake remains separate from core #1111. Keys created before 2026-10-01 15:00 GMT are unprefixed and their undocumented shape stays unclaimed.
