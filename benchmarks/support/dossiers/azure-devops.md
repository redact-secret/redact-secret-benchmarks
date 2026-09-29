---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: azure-devops
families:
  - id: azure-devops:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate#pat-format
        - https://learn.microsoft.com/en-us/purview/sit-defn-azure-devops-personal-access-token
      issues:
        - redact-secret/redact-secret#298
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: null
---

# Azure DevOps

Azure DevOps issues personal access tokens (PATs) for its REST APIs and Git
operations. Microsoft publishes the current PAT format, which makes this one of
the few families whose length and marker are provider-stated. Other Azure
credentials (Entra client secrets, storage connection strings) are separate
providers and are not covered here.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `azure-devops:personal-access-token` — Personal access token

- **Shape:** 84 alphanumeric characters (`[A-Za-z0-9]`, case-sensitive) with the
  fixed signature `AZDO` at zero-based offsets 76 to 79, so 76 characters, then
  `AZDO`, then 4 characters. The provider says 52 of the 84 are random and does
  not say what the other 32 hold, so only the length, marker position and
  alphabet are claims here.
- **Sources:** T1. The Azure DevOps PAT article states "PATs are 84 characters
  long" with a fixed `AZDO` signature at positions 76 through 80. Microsoft
  Purview's sensitive-information-type page gives the alphabet in its detailed
  pattern. That page's own `Format` summary says "letters, digits, and special
  characters", which contradicts the detailed pattern and its worked example;
  the detailed pattern was followed. The positions wording spans five positions
  for a four-character marker, and only the zero-based half-open reading fits
  the Purview example.
- **Issuance:** not attempted.
- **Collisions:** the legacy PAT format is a 52-character alphanumeric value
  with no embedded marker and no distinguishing structure.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Legacy 52-character PAT.** No marker and no prefix; #298 records it as an
  unsupported variant that carries no structure to build a grammar on.

## Open questions

1. **Purview format line.** The page carries two contradictory alphabet
   statements. An issued PAT with a non-alphanumeric character would settle it.
2. **The other 32 non-random characters.** No source says what they contain.

## Research log

- redact-secret#298 (2026-09-16) — froze the 84-character grammar with the
  `AZDO` signature from the Azure DevOps article and the Purview definition.
- redact-secret#642 (2026-09-23) — re-fetched both provider pages, settled the
  wording contradictions above, and re-tiered the family to T1. The
  benchmark-side qualification landed in redact-secret-benchmarks#112.
