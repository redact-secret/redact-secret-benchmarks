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
        - redact-secret/redact-secret#741
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/643/README.md
      researchedAt: 2026-09-24
    blockedBy: null
  - id: atlassian:access-token
    research:
      verdict: issuance-gated
      tier: T0
      sources:
        - https://community.atlassian.com/forums/Bitbucket-questions/Can-we-confirm-BitBucket-s-token-prefixes/qaq-p/3093481
        - https://support.atlassian.com/bitbucket-cloud/docs/using-access-tokens/
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/atlassian/v2/atlassian.go
        - https://github.com/trufflesecurity/trufflehog/pull/3065
        - https://github.com/Samsung/CredSweeper/blob/f21ab2f2553eea288a72273b9658cd297ab1d11f/credsweeper/rules/config.yaml
        - https://github.com/praetorian-inc/trajan/blob/8d8d43a52eacafb0c262f1c7927050966465b381/pkg/bitbucket/bitbucket.go
        - https://support.atlassian.com/organization-administration/docs/manage-an-organization-with-the-admin-apis/
      issues:
        - redact-secret/redact-secret#643
        - redact-secret/redact-secret#741
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/atlassian-access-token.md
      researchedAt: 2026-09-29
    blockedBy: The ATCT prefix needs an R3 ruling on the Atlassian Team community answer; the body layout (header, length, = position, CRC tail) rests on two peer rules (one class). Needs one Bitbucket access token measured.
---

# Atlassian

Atlassian issues account API tokens (Jira, Confluence, Bitbucket via Basic auth with the account email) and, for Bitbucket, workspace, project and repository access tokens and legacy app passwords. Provider documentation for the account token is the support page on
[managing API tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/); it states no lexical shape and calls the length "varied".

Research ([redact-secret#643](https://github.com/redact-secret/redact-secret/issues/643), closed 2026-09-23) found no Atlassian documentation page, OpenAPI spec, changelog entry or blog post that states the prefix or any shape. The T2 contract was later accepted through the corroboration route recorded in the benchmarks decision of 2026-09-24 (`docs/decisions/2026-09-24-qualify-empirical-stable-by-corroboration.md`).

## Families

### `atlassian:api-token` — API token

- **Shape:** prefix `ATAT`. Observed current tokens are 192 characters: a fixed 12-character header `ATATT3xFfGF0`, a 171-character body from `[A-Za-z0-9_-]`, one literal `=`, then 8 uppercase hex characters that two scanner implementations treat as a CRC32 of everything before them. The maintainer confirmed the header, length and `=` position, and the 171-character `[A-Za-z0-9_-]` body and the final 8 characters in `[0-9A-F]`, on one freshly issued key ([web-search pass](https://github.com/redact-secret/redact-secret/issues/643#issuecomment-5786038856)); the CRC32 was not confirmed on it. Tokens created before 2023-01-18 were unprefixed and 24 characters; the support page says all older tokens expired by 2026-05-12.
- **Sources:** the `ATAT` prefix rests on one answer (2025-08-25) by an account labelled "Atlassian Team" on Atlassian's community site; whether that meets the T1 bar is an open maintainer ruling. A 2022 staff post says tokens are opaque and clients cannot depend on format, which predates the 2023 change. Everything else is T2: gitleaks, trufflehog (jiratoken v2), Nosey Parker, CredSweeper and Datadog's scanner (the checksum validator) plus the maintainer key and a five-key community report.
- **Issuance:** one maintainer-issued key was used for the header check. A fresh key would settle the CRC32 (evidence checklist in the #643 passes).
- **Collisions:** `ATBB` (Bitbucket app passwords, stopped working 2026-06-09) and `ATCT` (Bitbucket access tokens) share the layout. The `=` is outside the contract's alphabet, but since #741 core includes a directly following `=` plus 8 uppercase hex in the span.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#643 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/643/README.md).
- **Open caveat:** T1 needs a maintainer ruling that an Atlassian Team forum answer counts as provider documentation; length, alphabet, the = delimiter and the CRC32 suffix are empirical only.

### `atlassian:access-token` — Access token

Researched 2026-09-29 (broad pass, evidence classified afterwards).

**Verdict (#1012, 2026-09-29): `issuance-gated`, tier T0.** This supersedes the benchmarks#473 entry (`ready`, T2, written the same day). The product research record reads the corroboration more strictly: the body layout rests on two peer scanner rules (trufflehog and CredSweeper), one class; the `ATCT` prefix is T1 under R3 only if the maintainer accepts the "Atlassian Team" community answer as a staff statement (#643 treated the same thread as borderline, and the `ATAT` dossier above holds the same open question); Atlassian's own docs say API keys "support variable length values, not fixed length values"; and betterleaks uses an `ATCT` value as a false-positive test for its `ATAT` rule. The benchmarks#473 material below (trajan, the structure-only count, the CRC32 readings) is kept as history; it is an independent-research summary class and does not change the class count. The two records should be reconciled by maintainer ruling before any contract freezes. Tier T0 here means no claim is T1 or T2 without that ruling, not that the shape is unknown.

- **Shape:** prefix `ATCT`. Observed tokens are 192 characters with the same layout as the API token: a fixed 12-character header (`ATCTT3xFfGN0`, the fourth and fifth characters differ from the `ATATT3xFfGF0` API-token header), a 171-character body from `[A-Za-z0-9_-]`, one literal `=`, then 8 uppercase hex characters. The trailing 8 are a CRC32 of everything before them, `=` included, in two independent readings (CredSweeper's filter and the measurement below). Auth scheme: Bearer, or `x-token-auth` as the Basic user name for git over HTTPS; the provider pages show `{repository_access_token}` and `{workspace_access_token}` placeholders and no shape.
- **Sources (all classified after the search):**
  - provider-example (class 4 in the empirical spec): the 2025-08-25 answer by the "Atlassian Team" account on community.atlassian.com states `ATCT` for workspace, project and repository access tokens. The asker's own observation of the 12-character header is not an Atlassian statement. Whether a forum answer is provider documentation is the same open ruling as for `atlassian:api-token`, so this family does not claim T1.
  - peer-scanner-rule: trufflehog's `atlassian/v2` detector (pinned commit; `ATCTT3xFfG` + base64url-ish body + `=` + 8 alphanumerics, verified against the admin orgs endpoint with a Bearer header) and Samsung CredSweeper's "Bitbucket Repository Access Token" rule (`ATCTT3xFfGN0`, 80-800 body characters, `=` or its URL/JSON-escaped forms, 8 uppercase hex, CRC32 filter). Nosey Parker, gitleaks and detect-secrets have no `ATCT` rule (gitleaks keys on `ATATT3` only; Nosey Parker on `ATATT3xFfGF0`).
  - independent-implementation: Praetorian's trajan chooses Bearer for `ATCTT3x` and Basic plus email for `ATATT3x`. pleno-dlp, openclaw's redaction list, caido data-grep and about a dozen other tools copy trufflehog's regex; they add no independent signal and are not counted.
  - independent-research: a structure-only measurement of GitHub code search, 2026-09-29, query on the 10-character header stem. 80 distinct candidate values in 74 repositories: 73 are 192 characters (one each of 191, 193 and 199, four of 183), 79 carry the `ATCTT3xFfGN0` header, 74 have `=` at position 184 with 8 uppercase hex after it, and 72 pass the CRC32 check. Nothing was printed or stored; the values are unverified against Atlassian and some may be truncated or hand-edited, so this is a lower-bound shape count. Contexts in the results: most are Bitbucket (`x-token-auth`, `bitbucket.org`), some Jira, Confluence or Bearer use.
  - A trufflehog contributor reported the same header and exactly 192 characters for organization admin API keys (PR 3065, 2024-07-15), so the `ATCT` header spans more than Bitbucket access tokens. Service-account API keys were not checked.
- **Corroboration against the T2 route:** four dated references from four owners (Atlassian, trufflesecurity, Samsung, Praetorian) plus the measurement, across provider-example, peer-scanner-rule and independent-implementation. That meets the 3 references, 3 owners and 2 non-summary classes bar in `docs/specs/empirical-qualification.md`; no contradiction found beyond the caveats below.
- **Issuance:** not attempted; a Bitbucket repository access token is free to mint and revoke, which would settle the prefix length question below (evidence checklist item 8 in the #643 record). The #1012 check (repository access token in a free workspace, optionally one organization admin API key): whether it starts `ATCTT3xFfGN0`, total length (192?), exactly one `=` and its position, whether the last 8 bytes are `[0-9A-F]`, whether CRC32 of the preceding bytes equals that tail, and whether the part before `=` is only `[A-Za-z0-9_-]`. Then revoke.
- **Role ambiguity:** Bitbucket access tokens (staff answer) and organization admin API keys (trufflehog's verifier treats `ATCTT` as an org admin key; its PR says observed keys were 192 characters). A contract can be bounded as "any `ATCT` token" regardless of role. A 2022 staff post ("clients cannot depend on their size, structure, or format") predates the prefixes.
- **Current contract in core (1012):** none; `atlassian-api-token` claims `ATAT` only and `ATCT` and `ATBB` are deliberately excluded. Today `ATCT` tokens are redacted only in named and header contexts.
- **Collisions:** shares the layout of `atlassian:api-token` (`ATAT`) and of the dead `ATBB` app passwords; the header differs, so an `ATAT`-anchored rule does not match it. Bitbucket Data Center HTTP access tokens (`BBDC-` prefix, from CredSweeper's rule list) and Jira/Confluence Data Center personal access tokens are different, unprefixed-by-`AT` credentials and are not this family.
- **Current contract in core:** none. `atlassian-api-token` covers `ATAT` only; the taxonomy note records that the pinned TruffleHog detector targets this family.
- **Open caveat:** the anchor length is unsettled (staff say `ATCT`, tools use 10 or 12 characters, and every observed value shares 12); the `=` plus 8 hex tail is empirical. A fresh token minted through each route (repository, project, workspace, admin key, service account) would confirm all routes share one header.

## Candidates that are not families yet

- **`ATBB` app passwords.** Prefix staff-stated in the same answer; 36 characters (`ATBB` + 24 alphanumeric + 8 hex) from a tool and one sample. Stopped working 2026-06-09, so a live value should not exist. No taxonomy entry.
- **Organization admin API keys with the `ATCTT3xFfGN0` header.** Reported by a TruffleHog contributor (PR 3065); no provider source read. They share the `atlassian:access-token` shape and are covered there until a route-level split is shown to matter.

## Open questions

1. Does an "Atlassian Team" forum answer count as provider documentation for the `ATAT` prefix, and (R3, asked in redact-secret#1012) for the `ATCT` prefix? Decides T1 versus T2 for `ATAT` and whether `ATCT` has any T1 fact.
2. Is the trailing 8 hex a CRC32 on real keys? One fresh issued key answers it.
3. Answered by #741 (closed 2026-09-24): the span covers the `=` and the 8-hex suffix.
4. Answered 2026-09-29: `atlassian:access-token` (`ATCT`) is researched here under #473; do the repository, project, workspace, admin-key and service-account routes share the `ATCTT3xFfGN0` header?

## Research log

- redact-secret#1012 — 2026-09-29 contract research for `ATCT`
  ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/atlassian-access-token.md)):
  BLOCKED on the body and on the R3 ruling; the stricter reading supersedes the benchmarks#473 `ready` T2 verdict.
- [redact-secret#643](https://github.com/redact-secret/redact-secret/issues/643) — T1 evidence hunt for `atlassian:api-token`. Four passes (all 2026-09-22), verdict: no provider-documentation source; one borderline staff forum answer awaiting a ruling. Family stays T2.
- [redact-secret-benchmarks#473](https://github.com/redact-secret/redact-secret-benchmarks/issues/473) — 2026-09-29 broad pass for `atlassian:access-token`: community, Bitbucket and Atlassian docs, seven scanners, trufflehog and CredSweeper source, Stack Overflow and Reddit (nothing on either), GitHub code-search shape measurement. Verdict `ready`, T2.
- [redact-secret#575](https://github.com/redact-secret/redact-secret/issues/575) — Epic A roll-up; left #643 out of the second batch for lack of a ruling.
