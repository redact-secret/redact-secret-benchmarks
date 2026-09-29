---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: notion
families:
  - id: notion:legacy-integration-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developers.notion.com/page/changelog
      issues:
        - redact-secret/redact-secret#642
        - redact-secret/redact-secret#300
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: notion:integration-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://developers.notion.com/page/changelog
        - https://github.com/gitleaks/gitleaks/blob/83d9cd684c87d95d656c1458ef04895a7f1cbd8e/config/gitleaks.toml#L2652
        - https://github.com/trufflesecurity/trufflehog/blob/363923b901c911a9164f50b6c423f47c15372b1c/pkg/detectors/notion/notion.go
      issues:
        - redact-secret/redact-secret-benchmarks#225
        - redact-secret/redact-secret#514
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#729
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Notion

Notion issues API credentials in several forms: internal connection
"installation access tokens" (formerly internal integration secrets), OAuth
access and refresh tokens for public connections, and, since 2026-05, personal
access tokens (PATs) and `ntn` CLI tokens. The 2024-09-11 changelog states that
from 2024-09-25 newly generated Public API tokens use `ntn_` instead of `secret_`,
that existing `secret_` tokens keep working, and that Notion "strongly advises
against" using regexes to identify or validate them because the format may change.

## Families

### `notion:legacy-integration-token` — Legacy integration token

- **Shape:** prefix `secret_` followed by 43 letters and digits. The prefix and
  its continued validity are provider-stated. The 43-character body is tool-only
  (both pinned scanners agree).
- **Sources:** T1 for the prefix (changelog entry, re-fetched live 2026-09-23 in
  the #642 record). Body: T2. The "format may change" statement covers bodies, not
  the documented prefixes.
- **Issuance:** not attempted; new tokens are `ntn_`, so a fresh legacy sample cannot
  be minted. Notion's own MCP server code still says `secret_` marks legacy tokens
  while its README uses `ntn_`.
- **Collisions:** `secret_` also appears as the OAuth client secret shape (unverified)
  and as an unrelated word in many strings; page and database ids (UUIDs or 32-hex)
  and share-URL ids are public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (T1 provider source recorded in the #642 evidence; the grammar was frozen under #300).
- **Open caveat:** T1 on the secret_ prefix only; the 43-character alphanumeric body is tool-corroborated and Notion says token formats may change.

### `notion:integration-token` — Integration token

- **Shape:** prefix `ntn_`, 11 digits, then 35 letters and digits (50 in total).
  The prefix is provider-documented. The body comes from one contributor's samples
  in gitleaks issue 1890, carried into betterleaks, Kingfisher and TruffleHog;
  secretlint agrees on lengths; flare-redact disagrees (no digit run). Notion's docs
  show a placeholder with 33 lowercase letters after `ntn_`, which does not fit.
- **Sources:** T2. Provider changelog for the prefix; scanner rules (permalinks above)
  for the body. The meaning of the 11-digit run is unexplained.
- **Issuance:** not attempted. Internal connection tokens come from the developer
  portal Configuration tab; PATs from Settings; checklist in benchmarks#225.
- **Collisions:** the same `ntn_` prefix is documented for PATs, `ntn` CLI tokens and
  connection tokens, and possibly OAuth access tokens (Notion's MCP server comment);
  a shared body grammar is unknown. `nrt_` (OAuth refresh, one docs sample of
  13 digits plus 32 alphanumerics) and `development_ntn_` are siblings. Ids
  (`bot_id`, `workspace_id`, PAT record id) are UUIDs and public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record; already implemented before #729, which left it unchanged).
- **Open caveat:** The prefix is provider-documented but the 11 digit plus 35 alphanumeric body is tool-only, from one contributor's samples, and Notion advises against regexes for its tokens (checklist in benchmarks#225).

## Candidates that are not families yet

- **`nrt_` refresh token** and **`development_ntn_`** dev-environment tokens:
  unclaimed; the refresh sample is one docs example.
- **OAuth client secret**, **organization bot token** (Enterprise Admin API): formats
  undocumented.

## Open questions

1. Do PATs, CLI tokens, OAuth access tokens and internal tokens share one body?
2. Does the 11-digit run repeat across tokens of one user, workspace or connection?
3. Is `secret_` still issued anywhere in 2026?
4. Which GitHub secret-scanning type covers `ntn_`?

## Research log

- redact-secret#300 — dedicated Notion detector; froze both grammars (2026-09-16).
- redact-secret#514 — added the current `ntn_` format next to `secret_` (2026-09-21).
- redact-secret#642 — T1 provider sources for eight families, including `secret_`
  (2026-09-23).
- redact-secret-benchmarks#225 — broad-discovery pass for `ntn_` (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (empirical route).
- redact-secret#729 — Wave-1 implementation; the Notion detector unchanged.
