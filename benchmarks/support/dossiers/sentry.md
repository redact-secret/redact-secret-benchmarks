---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: sentry
families:
  - id: sentry:user-auth-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://github.com/getsentry/sentry/blob/b5116cbbd0b81d62592318b0f3de660c215bcdb6/src/sentry/models/apitoken.py
        - https://github.com/getsentry/sentry/blob/f5d6d77049257892315c3823ebb504d189ddafb8/src/sentry/types/token.py
        - https://github.com/getsentry/sentry-cli/blob/c880db5fc6b69378b62310b7fdbd74637bcd5fb4/src/utils/auth_token/user_auth_token.rs
      issues:
        - redact-secret/redact-secret#659
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/659/README.md
      researchedAt: 2026-09-24
    blockedBy: "No Sentry web domain states the format (skills.sentry.dev shows a sntryu_ placeholder labelled org token); prefix, 64 lowercase hex and legacy unprefixed tokens rest on Sentry server and CLI code."
  - id: sentry:organization-auth-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://github.com/getsentry/rfcs/blob/6bdc964983762d614dfc9127d669d15ce521be3f/text/0091-ci-upload-tokens.md
        - https://github.com/getsentry/sentry/blob/d4aa9756a10f576272b95437231c9dd32546e514/src/sentry/utils/security/orgauthtoken_token.py
        - https://github.com/getsentry/sentry-cli/blob/c880db5fc6b69378b62310b7fdbd74637bcd5fb4/src/utils/auth_token/org_auth_token.rs
      issues:
        - redact-secret/redact-secret#658
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/658/README.md
      researchedAt: 2026-09-24
    blockedBy: "Nothing on a Sentry web domain states it; RFC 0091 (github.com, header still says draft) and Sentry code do. Whether a provider-authored RFC counts as T1 is an open maintainer ruling."
---

# Sentry

Sentry issues personal (user) auth tokens, organization auth tokens (used for CI and source-map upload), internal-integration tokens and DSNs. No page on docs.sentry.io, sentry.io, develop.sentry.dev or cli.sentry.dev states the auth-token formats; the shapes come from Sentry's own code and design RFC on github.com.

## Families

### `sentry:user-auth-token` — User auth token

- **Shape:** `sntryu_` then 64 lowercase hex characters (32 random bytes hex-encoded; the database column allows 71). Sentry's docs call these "Personal Tokens", and GitHub's pattern is `sentry_personal_token`. Unprefixed user tokens created before the prefix shipped (getsentry/sentry#68148, merged 2024-04-17; bare 64 hex) remain valid and fall outside this contract.
- **Sources:** T2. `getsentry/sentry` `types/token.py` sets `USER = "sntryu_"` and `apitoken.py` builds the token as prefix plus `secrets.token_hex(nbytes=32)`; `sentry-cli` requires the body to hex-decode to exactly 32 bytes. Scanners: gitleaks, TruffleHog v2, CredSweeper, betterleaks. One placeholder `sntryu_...` on `skills.sentry.dev` (Sentry's agent-skill library) is the only provider-domain appearance and labels the token an org token, so it is contested as a T1 source.
- **Issuance:** not attempted; 0 maintainer observations.
- **Collisions:** `sntrys_`, `sntrya_` and `sntryi_` are sibling token types.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#659 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/659/README.md).

### `sentry:organization-auth-token` — Organization auth token

- **Shape:** `sntrys_`, a base64-encoded JSON payload starting `eyJ` (standard base64 with any `=` padding kept), a second `_`, then a 43-character secret (`b64encode(token_bytes(32))` with `=` stripped). The parser requires exactly two `_`. Seven measured tokens have payloads of 96 to 152 characters and totals of 147 to 203, including self-hosted tokens with `url` null or empty.
- **Sources:** T2. RFC 0091 in `getsentry/rfcs` states the static prefix and the `PREFIX_FACTS_SECRET` structure; the secret recipe is an "implementation detail". Generator (`orgauthtoken_token.py`) and `sentry-cli` confirm it. Claims of a Base64URL alphabet or fixed total length in other tools are contradicted by the generator; the base64url question is settled by Sentry's own code.
- **Issuance:** not attempted; no freshly issued token checked.
- **Collisions:** the contract's `eyJ` anchor and `{26,}` payload floor are looser than every observed token, deliberately, to keep `url`-less payloads.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#658 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/658/README.md).

## Candidates that are not families yet

- **`sntrya_` and `sntryi_` tokens** (other `AuthTokenType` values in `token.py`): no research issue, no taxonomy entry.
- **Legacy unprefixed 64-hex user tokens.** Valid, no identifying element.

## Open questions

1. Does RFC 0091, hosted on github.com with header status draft, meet the provider-source bar? The repo README lists it as an accepted RFC; develop.sentry.dev says proposals live as RFCs.
2. Does the `skills.sentry.dev` placeholder count for the `sntryu_` prefix?
3. Payload key order and null-or-empty `url` on self-hosted installs are provisional.
4. Neither token has been checked against a freshly issued one.

## Research log

- [redact-secret#658](https://github.com/redact-secret/redact-secret/issues/658) — organization token: no Sentry web-domain source; RFC 0091 candidate awaiting a ruling (2026-09-23).
- [redact-secret#659](https://github.com/redact-secret/redact-secret/issues/659) — user token: FOUND-partial from a placeholder on a Sentry domain, contested (2026-09-23).
- T2 contracts for both were corroborated and qualified on 2026-09-24 (benchmarks decision `2026-09-24-qualify-empirical-stable-by-corroboration`).
