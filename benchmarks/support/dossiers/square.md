---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: square
families:
  - id: square:access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.squareup.com/docs/oauth-api/receive-and-manage-tokens
        - https://developer.squareup.com/reference/square/o-auth-api/obtain-token
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1107
        - redact-secret/redact-secret-benchmarks#583
        - redact-secret/redact-secret-benchmarks#584
      evidence: https://github.com/redact-secret/redact-secret/blob/fa955d28eed59c70a9c4380ed130d1b82d439cd9/docs/audits/evidence/1014/square.md
      researchedAt: 2026-09-30
    blockedBy: null
  - id: square:oauth-application-secret
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.squareup.com/docs/oauth-api/walkthrough
        - https://developer.squareup.com/reference/square/o-auth-api/obtain-token
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1107
        - redact-secret/redact-secret-benchmarks#583
        - redact-secret/redact-secret-benchmarks#584
      evidence: https://github.com/redact-secret/redact-secret/blob/fa955d28eed59c70a9c4380ed130d1b82d439cd9/docs/audits/evidence/1014/square.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Square

Square is a payments platform. An access token (`SQUARE_ACCESS_TOKEN`, sent as `Authorization: Bearer`) acts for a merchant or the developer's own account within its OAuth scopes; the OAuth application secret (`client_secret`) lets an integration exchange authorization codes and renew or revoke seller tokens. Square is moving access tokens to JWTs; the `jwt` detector keeps those. Provider docs: <https://developer.squareup.com/docs/oauth-api/receive-and-manage-tokens>.

## Families

### `square:access-token` — Access token (EAAA)

- **Shape:** `EAAA` + exactly 60 `[A-Za-z0-9_-]` (64 in all).
- **Sources:** T1 by example under R5 (the docs page that defines the token); corroborated by trufflehog `square`, gitleaks `square-access-token` and a Veles request (T2). Square says "don't use token length for validation" and its ObtainToken reference shows `EAAl` + 59 (63 in all), so the claim is conditional on ruling Q8 and the conflicting widths stay unclaimed.
- **Issuance:** recommended, not attempted: [#584](https://github.com/redact-secret/redact-secret-benchmarks/issues/584). The maintainer runs `npm run issuance:square` on one key he issues in the Square developer dashboard (structure only, then revokes it). The result is pending issuance by the maintainer.
- **Collisions:** Meta `EAA…` Graph tokens (far longer), lowercase `eaaa…` Docker digests, Base64 runs of `A`, and JWT-format Square tokens (`jwt` keeps them).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the Beta.14 detector `square-token`, redact-secret#1107, on `main` and unreleased).

### `square:oauth-application-secret` — OAuth application secret (sq0csp-, sandbox-sq0csb-)

- **Shape:** `sq0csp-` + 43 or 44, or `sandbox-sq0csb-` + 43, over `[A-Za-z0-9_-]`.
- **Sources:** the walkthrough shows 43 (production and sandbox), the ObtainToken reference and its generated SDK fixture show 44 (R5); the union follows the Polar era-union precedent. gitleaks 8.30.1 has no `sq0csp-` rule; trufflehog `squareapp` reads 40 to 50 and also the public `sq0i??` application ids.
- **Issuance:** same check as above; it settles 43 vs 44 and whether the sandbox secret has one width.
- **Collisions:** `sq0idp-`, `sq0ids-`, `sq0idb-` and `sandbox-sq0idb-` application ids are public by design (Q5); `sq0cgb-` authorization codes are short-lived.
- **Current contract in core:** the same detector, finding type `square_oauth_application_secret`.

## Candidates that are not families yet

- **`sq0atp-` legacy personal access token and `EAAl`/`EQAA` forms.** Scanner rules or one provider example only; unclaimed until the issuance check shows whether they are real prefixes or placeholder edits.

## Open questions

1. Q8 (open): may R5 support an exact-width grammar when the provider disclaims length validation? Recommendation yes; if refused, both families wait on the issuance check.
2. Does the sandbox access token also start with `EAAA`, and are `EAAl` and `EQAA` real prefixes? One issued and revoked key per role, structure only, would settle it.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; [handoff](https://github.com/redact-secret/redact-secret/blob/fa955d28eed59c70a9c4380ed130d1b82d439cd9/docs/audits/evidence/1014/square.md) records Square READY under R5 with Q8.
- redact-secret#1107 — Beta.14 implementation issue (detector merged to `main` in redact-secret PR #1227, unreleased).
- redact-secret-benchmarks#583 — contracts, corpus and arrival evidence for the second wave (Square first).
- redact-secret-benchmarks#584 — structure-only issuance checks; Square is added to its scope.
