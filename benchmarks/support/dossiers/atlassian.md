---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: atlassian
families:
  - id: atlassian:api-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/
        - https://community.atlassian.com/forums/Bitbucket-questions/Can-we-confirm-BitBucket-s-token-prefixes/qaq-p/3093481
        - https://community.developer.atlassian.com/t/about-the-format-of-atlassian-security-tokens/62553
        - https://github.com/DataDog/dd-sensitive-data-scanner/blob/4e53b6ac37ab4b6699f4331868a1c486f0d21147/sds/src/secondary_validation/atlassian_token_checksum.rs
      issues:
        - redact-secret/redact-secret#643
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/643/README.md
      researchedAt: 2026-09-24
    blockedBy: "T1 needs a maintainer ruling that an Atlassian Team forum answer counts as provider documentation; length, alphabet, the = delimiter and the CRC32 suffix are empirical only."
  - id: atlassian:access-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# Atlassian

Atlassian issues account API tokens (Jira, Confluence, Bitbucket via Basic auth with the account email) and, for Bitbucket, workspace, project and repository access tokens and legacy app passwords. Provider documentation for the account token is the support page on
[managing API tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/); it states no lexical shape and calls the length "varied".

Research ([redact-secret#643](https://github.com/redact-secret/redact-secret/issues/643), closed 2026-09-23) found no Atlassian documentation page, OpenAPI spec, changelog entry or blog post that states the prefix or any shape. The T2 contract was later accepted through the corroboration route recorded in the benchmarks decision of 2026-09-24 (`docs/decisions/2026-09-24-qualify-empirical-stable-by-corroboration.md`).

## Families

### `atlassian:api-token` — API token

- **Shape:** prefix `ATAT`. Observed current tokens are 192 characters: a fixed 12-character header `ATATT3xFfGF0`, a 171-character body from `[A-Za-z0-9_-]`, one literal `=`, then 8 uppercase hex characters that two scanner implementations treat as a CRC32 of everything before them. The maintainer confirmed the header, length and `=` position on one freshly issued key; the CRC32 was not confirmed on it. Tokens created before 2023-01-18 were unprefixed and 24 characters; the support page says all older tokens expired by 2026-05-12.
- **Sources:** the `ATAT` prefix rests on one answer (2025-08-25) by an account labelled "Atlassian Team" on Atlassian's community site; whether that meets the T1 bar is an open maintainer ruling. A 2022 staff post says tokens are opaque and clients cannot depend on format, which predates the 2023 change. Everything else is T2: gitleaks, trufflehog (jiratoken v2), Nosey Parker, CredSweeper and Datadog's scanner (the checksum validator) plus the maintainer key and a five-key community report.
- **Issuance:** one maintainer-issued key was used for the header check. A fresh key would settle the CRC32 (evidence checklist in the #643 passes).
- **Collisions:** `ATBB` (Bitbucket app passwords, stopped working 2026-06-09) and `ATCT` (Bitbucket access tokens) share the layout. The `=` is outside the contract's alphabet; core stops at it so `KEY=<token>` assignments still parse.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#643 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/643/README.md).

### `atlassian:access-token` — Access token

Unresearched. The #643 evidence mentions `ATCT` only as a sibling prefix (same staff answer, same 192-character layout observed) and no research issue targets it.

## Candidates that are not families yet

- **`ATBB` app passwords.** Prefix staff-stated in the same answer; 36 characters (`ATBB` + 24 alphanumeric + 8 hex) from a tool and one sample. Stopped working 2026-06-09, so a live value should not exist. No taxonomy entry.
- **Organization admin API keys with the `ATCTT3xFfGN0` header.** Reported by a TruffleHog contributor; no provider source read.

## Open questions

1. Does an "Atlassian Team" forum answer count as provider documentation for the `ATAT` prefix? Decides T1 versus T2.
2. Is the trailing 8 hex a CRC32 on real keys? One fresh issued key answers it.
3. Should the family cover the `=` and suffix, or only the body before it? Product question, not a provider fact.
4. `atlassian:access-token` (`ATCT`) needs its own research issue.

## Research log

- [redact-secret#643](https://github.com/redact-secret/redact-secret/issues/643) — T1 evidence hunt for `atlassian:api-token`. Four passes (2026-09-22/23), verdict: no provider-documentation source; one borderline staff forum answer awaiting a ruling. Family stays T2.
- [redact-secret#575](https://github.com/redact-secret/redact-secret/issues/575) — Epic A roll-up; left #643 out of the second batch for lack of a ruling.
