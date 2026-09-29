---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: heroku
families:
  - id: heroku:oauth-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://devcenter.heroku.com/articles/oauth
        - https://devcenter.heroku.com/changelog-items/2842
        - https://devcenter.heroku.com/changelog-items/3175
      issues:
        - redact-secret/redact-secret-benchmarks#235
      evidence: null
      researchedAt: 2026-09-24
    blockedBy: The HRKU- prefix and the 41 and 65 character lengths are provider-stated; the AA start and the body alphabet of the 65-character form are example- and scanner-derived.
  - id: heroku:legacy-api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://devcenter.heroku.com/changelog-items/2842
        - https://devcenter.heroku.com/changelog-items/3175
      issues:
        - redact-secret/redact-secret-benchmarks#232
      evidence: null
      researchedAt: 2026-09-24
    blockedBy: Provider shows the bare UUID only as a changelog example; no marker separates it from Heroku ids, so it is claimable only beside a heroku keyword. No legacy token can be newly issued.
---

# Heroku

Heroku's Platform API authenticates with OAuth access tokens. Since 2024-04-01
newly granted tokens carry an `HRKU-` prefix; before that they were bare UUIDs
that stay valid until regenerated. The provider documents the change in its
[OAuth article](https://devcenter.heroku.com/articles/oauth) and changelog
([2842](https://devcenter.heroku.com/changelog-items/2842),
[3175](https://devcenter.heroku.com/changelog-items/3175)). Heroku itself calls
the token an "API key" in places (the Dashboard, the CLI's `HEROKU_API_KEY`).

## Families

### `heroku:oauth-access-token` — OAuth access token (HRKU-prefixed)

- **Shape:** two documented prefixed generations. `HRKU-` plus a UUID (41
  characters), granted 2024-04-01 to 2025-04-22, and `HRKU-` plus 60 characters
  of `[A-Za-z0-9_-]` (65 characters), granted from 2025-04-23. Every 65-character
  example starts `AA` after the prefix. Both older generations stay valid until
  regenerated.
- **Sources:** T1 for the prefix and both lengths (changelog 2842, 3175 and
  3176, the OAuth article). The `AA` start is example-observed; gitleaks and
  trufflehog pin it, osv-scalibr does not, and a trufflehog issue disputes it
  (a contributor's fresh tokens all matched `AA`). The OAuth article's own
  response examples still show the 41-character form while its prose says 65.
  Changelog 3176 mentions "additional security checks", which may mean an
  internal structure or checksum; nothing documents it.
- **Issuance:** `heroku authorizations:create` (non-expiring by default),
  Dashboard, or the OAuth flows. Not attempted. Revocable from the Dashboard.
- **Collisions:** the bare-UUID legacy token, the OAuth refresh token and client
  secret (also bare UUIDs), and app, release, request and authorization ids
  (public UUIDs printed beside the token in CLI output). An undated 40-hex
  token in the authentication article may be a stale example.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`heroku_api_key`; see its `HRKU-` rows).

### `heroku:legacy-api-key` — Legacy API key (bare UUID)

- **Shape:** an unprefixed lowercase 8-4-4-4-12 hex UUID (36 characters),
  granted before 2024-04-01. Heroku states no grammar in prose; the shape is one
  changelog example.
- **Sources:** T2. Provider changelog 2842 (example), gitleaks, trufflehog and
  Nosey Parker rules, which all gate on a `heroku` keyword. Hex case is
  disputed (gitleaks and Semgrep accept uppercase; Nosey Parker does not).
- **Issuance:** cannot be reissued; new tokens are prefixed. Not observable.
- **Collisions:** structurally identical to Heroku app, release, request and
  user ids and to current UUID-shaped secrets (client secret, refresh token),
  so a same-line keyword is the only gate. An app id on a `HEROKU_APP_ID` line
  is the recorded false-positive control.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`heroku_api_key_legacy`, confidence-gated).

## Candidates that are not families yet

- **OAuth refresh token and client secret.** Bare UUIDs today, secret, and
  indistinguishable from the legacy shape. No taxonomy entry.
- **Heroku Postgres `DATABASE_URL`.** A different family (a GitHub partner
  pattern exists).

## Open questions

1. Does `AA` mean a version tag or header? Is it always present in the
   65-character form? #235 checklist asks for a second token.
2. Can Heroku still mint any 41-character token? Provider text says old ones
   stay valid; osv-scalibr#1796 argued the 65-only rule misses them.
3. Which shape does a fresh Dashboard "API key" have?
4. Was uppercase hex ever issued in the bare-UUID generation?

## Research log

- redact-secret-benchmarks#235 — `HRKU-` broad-discovery pass (26 sources);
  closed 2026-09-24, routed to #209. Records the 41-character generation as
  provider-documented, not an "undocumented-width variant".
- redact-secret-benchmarks#232 — bare-UUID broad-discovery pass (22 sources);
  closed 2026-09-24, routed to #207.
