---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: linear
families:
  - id: linear:personal-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://linear.app/changelog/2021-08-19-github-secret-scanning
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#374
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: linear:oauth-access-token
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://linear.app/changelog/2021-08-19-github-secret-scanning
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: null
---

# Linear

Linear issues personal API keys and OAuth access tokens. Since 2021-08-19 both
carry a Linear-specific prefix, added so that GitHub secret scanning could detect
them. Linear's OAuth documentation also shows a bare 64-character hex access
token with no prefix.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `linear:personal-api-key` — Personal API key

- **Shape:** prefix `lin_api_` followed by 40 alphanumeric characters (no `_` or
  `-` in the body).
- **Sources:** T1 for the prefix: Linear's changelog says API keys and OAuth
  access tokens were changed to include the prefixes `lin_api_` and
  `lin_oauth_`. Length and alphabet come from gitleaks 8.30.1 (`linear-api-key`)
  and trufflehog 3.97.4 (`linearapi`), which agree.
- **Collisions:** `lin_oauth_` is a separate credential. Gitleaks also has a
  context-gated 32-hex `linear-client-secret` rule for another Linear value.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
- **Open caveat:** The 40-character alphanumeric body is tool-corroborated (gitleaks, trufflehog); Linear states only the lin_api_ prefix.

### `linear:oauth-access-token` — OAuth access token

- **Shape:** prefix `lin_oauth_`; no body grammar is established.
- **Sources:** the 2021 changelog names the prefix, which shows it exists but
  gives no length or alphabet. No gitleaks or trufflehog rule covers it. GitHub
  lists a Linear OAuth access token type without a grammar. The 40-character
  API-key length must not be reused.
- **Collisions:** the provider's OAuth example is a bare 64-character hex string
  with no prefix, which is not distinguishable from ordinary hex.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
  The #367 contract lists this variant as an interim guard at T0.

## Candidates that are not families yet

- **Unprefixed 64-character hex OAuth access token.** Shown in Linear's OAuth
  documentation; recorded as pending, T0, because without a prefix it is not a
  candidate for a provider rule.

## Open questions

1. **`lin_oauth_` body.** Length and alphabet are unknown. One issued OAuth
   access token would settle it.
2. **Prefix coverage.** Does the unprefixed hex token still get issued alongside
   the prefixed one?

## Research log

- redact-secret#367 (2026-09-17) — froze `lin_api_` plus 40 alphanumeric at T2
  and left the OAuth variant as an interim T0 guard.
- redact-secret#374 (2026-09-18) — validated the API-key length independently
  of the OAuth prefix.
- redact-secret#642 (2026-09-23) — re-tiered `linear:personal-api-key` to T1 on
  the prefix by adding the 2021 changelog, which also shows `lin_oauth_` exists.
  Its grammar was left untouched. The benchmark-side qualification landed in
  redact-secret-benchmarks#112.
