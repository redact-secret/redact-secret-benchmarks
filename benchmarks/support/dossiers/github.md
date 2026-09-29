---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: github
families:
  - id: github:classic-personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
      issues:
        - redact-secret/redact-secret#517
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/decisions/2026-09-20-map-github-token-families-onto-independent-finding-types.md
      researchedAt: 2026-09-20
    blockedBy: null
  - id: github:oauth-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
      issues:
        - redact-secret/redact-secret#517
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/decisions/2026-09-20-map-github-token-families-onto-independent-finding-types.md
      researchedAt: 2026-09-20
    blockedBy: null
  - id: github:app-user-to-server-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
      issues:
        - redact-secret/redact-secret#517
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/decisions/2026-09-20-map-github-token-families-onto-independent-finding-types.md
      researchedAt: 2026-09-20
    blockedBy: null
  - id: github:app-server-to-server-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
      issues:
        - redact-secret/redact-secret#517
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/decisions/2026-09-20-map-github-token-families-onto-independent-finding-types.md
      researchedAt: 2026-09-20
    blockedBy: null
  - id: github:oauth-refresh-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
      issues:
        - redact-secret/redact-secret#517
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/decisions/2026-09-20-map-github-token-families-onto-independent-finding-types.md
      researchedAt: 2026-09-20
    blockedBy: null
  - id: github:fine-grained-personal-access-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
      issues:
        - redact-secret/redact-secret-benchmarks#223
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#371
        - redact-secret/redact-secret#517
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#729
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-27
    blockedBy: null
---

# GitHub

GitHub issues several token classes that share one prefix table on its
[token formats](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats)
page: classic personal access tokens (`ghp_`), OAuth access and refresh tokens
(`gho_`, `ghr_`), GitHub App user-to-server (`ghu_`) and server-to-server
(`ghs_`) tokens, and fine-grained personal access tokens (`github_pat_`). Core #517
audited all six families per family (decided 2026-09-20; the ADR is linked in each
family's frontmatter): prefixes and roles are T1 from the token-formats page, and the
five classic-format families carry the 36-byte body of GitHub's 2021 post.

## Families

### `github:classic-personal-access-token` — Classic personal access token

- **Sources:** prefix and role from the token-formats page; body from GitHub's 2021-04-05 token-format post; contracted per family in #517 (T1; body tool-corroborated).
- **Open caveat:** Only the prefix and token role are provider-documented; the 36-character body follows GitHub's 2021-04-05 token-format post (36-byte body, CRC32 in the last six characters), and core does not verify the checksum.

### `github:oauth-access-token` — OAuth access token

- **Sources:** prefix and role from the token-formats page; body from GitHub's 2021-04-05 token-format post; contracted per family in #517 (T1; body tool-corroborated).
- **Open caveat:** Only the prefix and token role are provider-documented; the 36-character body follows GitHub's 2021-04-05 token-format post (36-byte body, CRC32 in the last six characters), and core does not verify the checksum.

### `github:app-user-to-server-token` — GitHub App user-to-server token

- **Sources:** prefix and role from the token-formats page; body from GitHub's 2021-04-05 token-format post; contracted per family in #517 (T1; body tool-corroborated).
- **Open caveat:** Only the prefix and token role are provider-documented; the 36-character body follows GitHub's 2021-04-05 token-format post (36-byte body, CRC32 in the last six characters), and core does not verify the checksum.

### `github:app-server-to-server-token` — GitHub App server-to-server token

- **Sources:** prefix and role from the token-formats page; body from GitHub's 2021-04-05 token-format post; contracted per family in #517 (T1; body tool-corroborated). The #223 pass notes
  that GitHub announced a new `ghs_APPID_JWT` installation-token format
  (variable length, about 520 characters, rollout from 2026-04-27), which
  belongs to this family and not to the fine-grained one.
- **Open caveat:** Only the prefix and token role are provider-documented; the 36-character body follows GitHub's 2021-04-05 token-format post (36-byte body, CRC32 in the last six characters), and core does not verify the checksum.

### `github:oauth-refresh-token` — OAuth refresh token

- **Sources:** prefix and role from the token-formats page; body from GitHub's 2021-04-05 token-format post; contracted per family in #517 (T1; body tool-corroborated).
- **Open caveat:** Only the prefix and token role are provider-documented; the 36-character body follows GitHub's 2021-04-05 token-format post (36-byte body, CRC32 in the last six characters), and core does not verify the checksum.

### `github:fine-grained-personal-access-token` — Fine-grained personal access token

- **Shape:** prefix `github_pat_`, then 22 alphanumeric characters, `_`, and 59
  alphanumeric characters (93 in all). No checksum and no fixed leading digits
  are claimed. GitHub's docs state no length, alphabet or segment split.
- **Sources:** T1 for the prefix only (the token-formats table). The 22 + 59
  split comes from a community regex in GitHub community discussion 36441, which
  a commenter who appears to be the fine-grained PAT product manager endorsed
  (the #223 pass infers staff status from content; "purely a
  high-entropy string that's looked up on our backend"). Scanner rules
  (gitleaks, Nosey Parker, secretlint: `github_pat_` + 82 word characters;
  trufflehog v2: 36 to 255) differ on whether `_` may sit anywhere in the body.
  The tier is T2. A third-party README claims a body checksum; no provider
  source does, and the staff comment reads against it.
- **Issuance:** Settings > Developer settings > Personal access tokens >
  Fine-grained tokens. Not attempted. The token exists before organization
  approval; a leaked one is revoked by the owner, or by GitHub after a report.
- **Collisions:** classic `ghp_` and the App `ghs_` JWT form are separate
  secret families, not benign twins. Snake_case identifiers that contain
  `github_pat_` (for example a function name) false-positive open-ended rules.
  Token ids in audit logs are public identifiers.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (Beta.8 arrival contracts, wave 1); the freeze is in the #726 evidence linked
  above.
- **Open caveat:** Only the prefix is provider-documented; the 22 + 59 segment split and absence of a checksum rest on a community regex, a staff endorsement and scanner rules. Needs issued-key observations.

## Candidates that are not families yet

- **`github_test_token`.** Listed in GitHub's supported secret-scanning
  patterns with no description or shape.

## Open questions

1. Does a fresh fine-grained token always start with two fixed digits, and is
   the first segment truly opaque? Community sources say `11`; none is
   provider-stated (#223 checklist).
2. Does the body carry a checksum? The community README says yes; GitHub staff
   words and the 2021 `gh?_` engineering post (CRC32 in the last six
   characters) cover a different scheme.
3. Do GHES and GHE.com issue the same shape as github.com?

## Research log

- redact-secret-benchmarks#223 — broad-discovery pass for the family (33
  sources graded); closed 2026-09-24 after routing to #211.
- redact-secret#517 — per-family audit of all six GitHub families (decided 2026-09-20): the five classic-format families are contracted at T1, and the fine-grained token gets `github_pat_` 22 + 59 (93 bytes).
- redact-secret-benchmarks#371 — follow-up of #367 for the fine-grained family.
- redact-secret#726 — freezes the wave-1 contract (T2, empirical route).
- redact-secret#729 — wave-1 implementation record.
- redact-secret-benchmarks#367 — 2026-09-26 reconciliation of fixture debt for
  the family; kept the prefix as the only provider-backed property.
