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
      verdict: issuance-gated
      tier: T1
      sources:
        - https://linear.app/changelog/2021-08-19-github-secret-scanning
        - https://linear.app/developers/oauth-2-0-authentication
        - https://github.com/linear/linear-solutions/blob/4529f1e807d19e25f3c3889737f5b4bf90c242fe/integration_guides/README.md#L11-L12
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#642
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/linear-oauth-access-token.md
      researchedAt: 2026-09-29
    blockedBy: No source of any class states the body length or alphabet, and Linear's own OAuth examples are unprefixed; needs one OAuth app issuing an access token (structure only).
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

- **Shape:** prefix `lin_oauth_`; no body grammar is established. Untested hypothesis,
  not evidence: `lin_oauth_` + 64 lowercase hex, since Linear's unprefixed
  authorization-code example is 64 hex.
- **Verdict (#1012, 2026-09-29):** `issuance-gated`, T1 on the prefix only. This refines the
  earlier `not-found`, T0 entry: the prefix is now also stated by a provider docs repository,
  but nothing states a body, so a contract needs one issued token.
- **Sources:**
  - provider changelog (T1, prefix): 2021-08-19, "OAuth access tokens ... lin_api_ and lin_oauth_".
  - provider docs placeholder (R4, prefix): the linear-solutions integration guides write `lin_oauth_...` and say the token "starts with `lin_oauth_` (not `lin_api_`)".
  - provider docs examples (R5): the OAuth 2.0 page shows three example tokens, all unprefixed and 64 characters (the authorization-code access token is lowercase hex; the refresh and client-credentials tokens are `[a-z0-9]`). No `lin_` string appears on that page or on the actor-authorization, app-manifest, GraphQL and agents pages. The prefixed format and the unprefixed examples are an unresolved contradiction that only a prefixed provider example or issuance settles.
  - Not evidence: 29 third-party redactor rules disagree on the length (`{40}`, `{40,}`, `{32,}`, `{30,}` with `_-`, `{20,}`, `{10,}`) and cite no sample; koki-develop/mask-go#147 finds no source and declines to ship a rule.
  - Searched with nothing further: gitleaks, betterleaks, trufflehog (`linearapi` only), noseyparker, Kingfisher, CredSweeper, secretlint and osv-scalibr have no `lin_oauth_` rule; the `linear/linear` SDK monorepo has no `lin_oauth` or `lin_api` string. GitHub's list names the type without a regex.
- **Issuance:** create an OAuth app in a free workspace; run the authorization-code flow once and the `client_credentials` (actor=app) flow once. For each access token record whether it starts `lin_oauth_`, the body length, whether the body is only `[0-9a-f]`, and whether the refresh token carries a prefix; then revoke.
- **Collisions:** the provider's OAuth example is a bare 64-character hex string
  with no prefix, which is not distinguishable from ordinary hex.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
  The #367 contract lists this variant as an interim guard at T0, capped per #551; any rule
  written before issuance would be a guess.

## Candidates that are not families yet

- **Unprefixed 64-character hex OAuth access token.** Shown in Linear's OAuth
  documentation; recorded as pending, T0, because without a prefix it is not a
  candidate for a provider rule.

## Open questions

1. **`lin_oauth_` body.** Length and alphabet are unknown, and the prefixed
   format contradicts Linear's unprefixed 64-character examples. One issued OAuth
   access token would settle both (redact-secret#1012 checklist).
2. **Prefix coverage.** Does the unprefixed hex token still get issued alongside
   the prefixed one?

## Research log

- redact-secret#1012 — 2026-09-29 contract research for `lin_oauth_`
  ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/linear-oauth-access-token.md)):
  BLOCKED on the body; no source of any class, prefix newly corroborated in a docs repository.
- redact-secret#367 (2026-09-17) — froze `lin_api_` plus 40 alphanumeric at T2
  and left the OAuth variant as an interim T0 guard.
- redact-secret#374 (2026-09-18) — validated the API-key length independently
  of the OAuth prefix.
- redact-secret#642 (2026-09-23) — re-tiered `linear:personal-api-key` to T1 on
  the prefix by adding the 2021 changelog, which also shows `lin_oauth_` exists.
  Its grammar was left untouched. The benchmark-side qualification landed in
  redact-secret-benchmarks#112.
