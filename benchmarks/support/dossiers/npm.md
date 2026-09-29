---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: npm
families:
  - id: npm:granular-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/
      issues:
        - redact-secret/redact-secret-benchmarks#46
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: npm:legacy-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/
        - https://github.blog/security/announcing-npms-new-access-token-format/
        - https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/
        - https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/
        - https://docs.npmjs.com/about-access-tokens
        - https://github.com/Yelp/detect-secrets/blob/5e141933554a0b74e7341841f318be21e895339c/detect_secrets/plugins/npm.py
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/npmtoken/npmtoken.go
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/cmd/generate/config/rules/npm.go
        - https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/specifics/npm_token
        - https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns
      issues:
        - redact-secret/redact-secret-benchmarks#473
      evidence: null
      researchedAt: 2026-09-29
    blockedBy: null
---

# npm

npm issues granular access tokens in a format introduced in September 2021 (prefix `npm_`, a Base62 body with a CRC32 checksum). Earlier tokens were unprefixed UUID-format values.

`npm:granular-access-token` is `ready` at T1 on the shipped `npm-token` contract. `npm:legacy-token` is `ready` at T1 for its shape (2026-09-29, #473), with a hard limit: it is a bare UUID, so only a context-constrained claim is supportable, and npm revoked every classic token on 2025-12-09.

## Families

### `npm:granular-access-token` — Granular access token

- **Shape:** 2021-09 format token with a Base62 CRC32 checksum, prefixed npm_.
- **Sources:** T1 per the shipped `npm-token` contract in the benchmarks assessment: the GitHub changelog of 2021-09-23 documents the `npm_` prefix, the underscore delimiter and a six-character Base62 CRC32 checksum. The 36-character body is tool-corroborated. The checksum is not part of the lexical pattern. Re-checked 2026-09-20 in benchmarks#46 (PR #55).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `npm:legacy-token` — Legacy token

- **Shape:** Unprefixed UUID-pattern token, 36 characters including hyphens (8-4-4-4-12 hex groups). Called "legacy" in the 2021 announcements and "classic" from 2025.
- **Verdict:** `ready`, T1 (2026-09-29, wide-first pass, #473). The earlier reading that the changelog mentions the format only as a predecessor was wrong: the GitHub changelog and the authored GitHub blog post of 2021-09-23 both state the previous tokens "were created as a UUID pattern of 36 characters", and that the new tokens change the delimiter away from a hyphen.
- **Corroboration (dated 2026-09-29, T2-grade on top of T1).** detect-secrets `npm.py` at `5e14193` matches an `_authToken=` value of 36 hex-and-hyphen characters (or an `npm_` value) in `.npmrc` form and cites a Stack Overflow question on npmrc auth tokens; TruffleHog `npmtoken.go` at `48b58d3` matches a lowercase UUID after the keyword `npm` and verifies it against the registry's `whoami` endpoint; GitGuardian's npm detector page lists a plain and a prefixed npm token format. gitleaks (`npm.go` at `b58d3f1`) and GitHub secret scanning (`npm_access_token`) cover only the `npm_` form, so the UUID form is absent from both.
- **Lifecycle.** New classic tokens could not be created after 2025-11-05, and npm revoked all remaining ones on 2025-12-09 after moving the date from 2025-11-19. The npm docs now say legacy tokens "have been removed". No live legacy token can be issued or verified, so no issuance step is possible and no observation can be captured; only leaked-history values remain.
- **Limits.** The UUID version is not stated by npm (v4 is likely, unconfirmed), the hex case is tool-stated (TruffleHog lowercase, detect-secrets either), and the pattern is identical to every other UUID (request IDs, package integrity strings, database keys). Treat as context-gated: an `_authToken` assignment in npmrc form, or an `npm` keyword neighbour, as the peers do. A bare UUID is not a supportable positive, and a UUID in any other context is a benign control, not a near-miss.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded.

## Open questions

1. Which UUID version did npm mint? Unstated by npm; only a decoded historical token would settle it, and none can be issued now.
2. Do any peer rules besides detect-secrets and TruffleHog cover the UUID form? gitleaks lists only `npm_`; GitHub lists only `npm_`.

## Research log

- redact-secret-benchmarks#473 (2026-09-29) — wide-first pass on `npm:legacy-token`: `ready` T1, context-gated. Searched: npm and GitHub announcements (2021, 2025), npm docs, detect-secrets, TruffleHog, GitGuardian, GitHub's pattern table, Hacker News (only the 2025 revocation stories surfaced). Reddit was unreachable and the Stack Overflow question cited by detect-secrets returned no text to the browser, so neither is covered.

- redact-secret-benchmarks#46 (PR #55) — re-check of the changelog as the `npm-token` provider source (2026-09-20).
- Related non-research issue: core #160 (detector implementation).
