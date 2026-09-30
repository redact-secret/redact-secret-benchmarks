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
      verdict: issuance-gated
      tier: T1
      sources:
        - https://developers.notion.com/page/changelog
        - https://x.com/NotionHQ/status/1914437336789553311
        - https://github.com/makenotion/notion-mcp-server/blob/730ae781ba28beeaf0865025a3f2ed4c25ea2387/src/openapi-mcp-server/mcp/token.ts#L21-L32
        - https://github.com/makenotion/lore/blob/6e741b1bb91a36b47213f4d3af5bbdfaa2f2081d/src/auth/token-prefix.ts#L6-L44
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/config/gitleaks.toml#L2652-L2656
        - https://github.com/secretlint/secretlint/blob/0001184f56165e7db7ab1b3adc1f957911c78f46/packages/%40secretlint/secretlint-rule-notion/src/index.ts#L38-L50
        - https://github.com/Samsung/CredSweeper/blob/f21ab2f2553eea288a72273b9658cd297ab1d11f/credsweeper/rules/config.yaml#L1630-L1644
      issues:
        - redact-secret/redact-secret-benchmarks#225
        - redact-secret/redact-secret#514
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#729
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/notion-integration-token.md
      researchedAt: 2026-09-29
    blockedBy: Leading digit run (11 per gitleaks and secretlint, 9 per CredSweeper) and body alphabet rest on peer rules only (one class); needs one integration token and one PAT measured (structure only).
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
- **Verdict (#1012, 2026-09-29):** `issuance-gated`, T1 on the prefix. This supersedes
  the earlier `ready` T2 entry (empirical route, #726): the #1012 record finds one
  corroboration class for the body and a new contradicting rule, so the corroborated
  route is not met. Notion's "format may change" warning stays in force.
- **Sources:**
  - provider changelog (T1, prefix): 2024-09-11 entry, "newly generated Public API tokens will automatically use the ntn_ prefix", plus the warning against regex validation.
  - provider statement off the docs domain (R3, prefix): @NotionHQ on X, 2025-04-21, "The ntn_ format is our current standard for integration tokens"; no length or alphabet.
  - provider code (R6, prefix and role only): notion-mcp-server accepts `ntn_` and `secret_` with a length of 8 to 300 and says it avoids coupling to an exact server-side length; notion-skills-github-sync also accepts `development_ntn_` and redacts at a floor of 20; lore classes `ntn_` as production personal access or bot token, `development_ntn_` as development and `secret_` as integration.
  - peer scanner rules (T2 input, one lineage): gitleaks `ntn_` + 11 digits + 35 alphanumerics (betterleaks and Kingfisher carry the same rule); secretlint agrees.
  - contradicting peer rule: CredSweeper `ntn_` + 9 digits + 36 to 255 of `[0-9A-Za-z_-]`; its 50-character test samples have a 9-digit lead followed by a letter.
  - Searched with nothing further: the docs `llms-full.txt` (placeholders), the Notion SDKs (no validation), trufflehog (`secret_` only), noseyparker and osv-scalibr (no Notion rule). GitHub's list names the type without a regex.
- **Issuance:** not attempted. Internal connection tokens come from the developer
  portal Configuration tab; PATs from Settings; checklist in benchmarks#225. The #1012
  check: issue one internal-integration token and one personal access token, and for each
  record the total length (50?), the count of leading digits after `ntn_` (11 or 9), whether
  the rest is only `[A-Za-z0-9]`, and whether the two tokens share the digit run (is it an
  ID?). Then revoke.
- **Collisions:** the same `ntn_` prefix is documented for PATs, `ntn` CLI tokens and
  connection tokens, and possibly OAuth access tokens (Notion's MCP server comment);
  a shared body grammar is unknown. `nrt_` (OAuth refresh, one docs sample of
  13 digits plus 32 alphanumerics) and `development_ntn_` are siblings. Ids
  (`bot_id`, `workspace_id`, PAT record id) are UUIDs and public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record; already implemented before #729, which left it unchanged):
  `ntn_` + exactly 11 digits + exactly 35 `[A-Za-z0-9]`. A token with a 9-digit lead, if
  CredSweeper's samples reflect real issuance, is a false negative; `development_ntn_` stays
  out through the leading boundary.
- **Open caveat:** The prefix is provider-documented but the 11 digit plus 35 alphanumeric body is tool-only, one class, and contradicted by a new peer rule (9 digits); Notion advises against regexes for its tokens (checklist in benchmarks#225).

## Candidates that are not families yet

- **`nrt_` refresh token** and **`development_ntn_`** dev-environment tokens:
  unclaimed; the refresh sample is one docs example.
- **OAuth client secret**, **organization bot token** (Enterprise Admin API): formats
  undocumented.

## Open questions

1. Is the leading digit run 11 or 9, and is the alphabet `[A-Za-z0-9]` or does it admit `_` and `-`? Only a measured token settles it (redact-secret#1012).
2. Do PATs, CLI tokens, OAuth access tokens and internal tokens share one body?
3. Does the 11-digit run repeat across tokens of one user, workspace or connection?
4. Is `secret_` still issued anywhere in 2026?
5. Which GitHub secret-scanning type covers `ntn_`?

## Research log

- redact-secret#1012 — 2026-09-29 contract research for `ntn_`
  ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/notion-integration-token.md)):
  BLOCKED on the body; new provider statement and provider code for the prefix,
  a contradicting CredSweeper rule.
- redact-secret#300 — dedicated Notion detector; froze both grammars (2026-09-16).
- redact-secret#514 — added the current `ntn_` format next to `secret_` (2026-09-21).
- redact-secret#642 — T1 provider sources for eight families, including `secret_`
  (2026-09-23).
- redact-secret-benchmarks#225 — broad-discovery pass for `ntn_` (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (empirical route).
- redact-secret#729 — Wave-1 implementation; the Notion detector unchanged.
