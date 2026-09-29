---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: microsoft-entra
families:
  - id: microsoft-entra:application-client-secret
    research:
      verdict: ready
      tier: T1
      sources:
        - https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.applications/add-mgapplicationpassword?view=graph-powershell-1.0
      issues:
        - redact-secret/redact-secret#655
        - redact-secret/redact-secret#707
        - redact-secret/redact-secret-benchmarks#161
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/655/README.md
      researchedAt: 2026-09-24
    blockedBy: "T1 is a maintainer ruling on two SDK-example values (3 chars, 8Q~, 34, 40 total); the marker digit to length coupling and the alphabet come from Microsoft security-utilities code and tools."
---

# Microsoft Entra ID

Microsoft Entra ID (formerly Azure AD) issues client secrets for app registrations. The secret value is shown once at creation; Microsoft Graph exposes only a 3-character `hint`. Provider documentation:
the [Add-MgApplicationPassword reference](https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.applications/add-mgapplicationpassword?view=graph-powershell-1.0) (Microsoft Graph PowerShell SDK).

## Families

### `microsoft-entra:application-client-secret` — Application client secret

- **Shape:** 3 leading characters, a digit, the literal `Q~`, then 31 to 34 characters; the current generation is `8Q~` with 34 (40 in total), the previous `7Q~` with 31 (37 in total). Alphabet `[A-Za-z0-9_.~-]`; the first three characters are per-secret (the Graph `hint` equals them). A leading `-` occurs in issued secrets (four field reports, and Microsoft's own SEC101/156 rule allows it); core accepted it after [redact-secret#707](https://github.com/redact-secret/redact-secret/issues/707).
- **Sources:** two example secrets in the Graph PowerShell SDK reference show 40 characters with `8Q~` at offsets 4 to 6 (measured on the live page 2026-09-23; values not reproduced). A Graph SDK maintainer calls them "not real secrets"; Microsoft's own push gate flags them as SEC101/156. T1 by example only, accepted by maintainer ruling on the precedent of `terraform-cloud-token` and `supabase-management-token`. Corroboration: `microsoft/security-utilities` SEC101/156 (`8Q~` + 34 and `7Q~` + 31), GitLab, TruffleHog v2. Other Microsoft pages conflict without contradicting the examples: Graph REST says "16-64 characters", Purview says "up to 40" with no `Q~`.
- **Issuance:** not attempted; secrets can be created and deleted per app registration.
- **Collisions:** no provider prefix; the `<digit>Q~` marker is the identifying element.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row `microsoft-entra:application-client-secret`); evidence [#655 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/655/README.md).

## Candidates that are not families yet

- **`7Q~` 37-character previous format.** Documented only in Microsoft code; within the same family's grammar range.
- **Legacy 32-character secrets with no marker** (shown in Graph REST docs). No source ties them to a current shape.

## Open questions

1. Is the marker digit only ever 7 or 8? Provider examples show 8; Microsoft code 7 and 8; core accepts any digit.
2. Is the digit coupled to length (7 to 37, 8 to 40)? Core does not couple them (#161 in the #575 record).
3. A fresh secret would settle alphabet and leading-character rules.

## Research log

- [redact-secret#655](https://github.com/redact-secret/redact-secret/issues/655) — T1 evidence: FOUND by example only (2026-09-23); the maintainer accepted the example as T1 (#575 record).
- [redact-secret#707](https://github.com/redact-secret/redact-secret/issues/707) — product fix: leading run accepts `-` (closed 2026-09-24).
- [redact-secret-benchmarks#161](https://github.com/redact-secret/redact-secret-benchmarks/issues/161) — benchmarks promotion intake for the leading-dash false negative.
- [redact-secret#297](https://github.com/redact-secret/redact-secret/issues/297) — earlier detection work for this family.
