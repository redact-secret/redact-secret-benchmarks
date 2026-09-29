---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: shopify
families:
  - id: shopify:custom-app-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: shopify:public-app-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
---

# Shopify

Shopify issues access tokens for store-installed custom apps (prefix `shpat_`) and for public or listed apps (prefix `shppa_`).

Both families are `ready` at T1 on the shipped `shopify-token` contract (prefix only).

## Families

### `shopify:custom-app-access-token` — Custom app access token

- **Shape:** Access token for a store-installed custom app, prefixed shpat_.
- **Sources:** T1 per the shipped `shopify-token` contract in the benchmarks assessment: Shopify's access-tokens page documents the prefix. The page calls the body an "opaque string" and states no length or character class; the 32-hex body is tool-corroborated only. The contract also requires a `myshopify.com` shop domain alongside the token. Re-checked 2026-09-20 in benchmarks#33 (PR #34).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `shopify:public-app-access-token` — Public app access token

- **Shape:** Access token for a public/listed app, prefixed shppa_.
- **Sources:** T1 per the shipped `shopify-token` contract in the benchmarks assessment: Shopify's access-tokens page documents the prefix. The page calls the body an "opaque string" and states no length or character class; the 32-hex body is tool-corroborated only. The contract also requires a `myshopify.com` shop domain alongside the token. Re-checked 2026-09-20 in benchmarks#33 (PR #34).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`shpca_`** (public storefront token). Core's Shopify module documentation deliberately excludes it. No taxonomy entry.

## Open questions

1. Body length and alphabet are undocumented ("opaque string"); the family is un-probeable for body grammar from provider evidence.

## Research log

- redact-secret-benchmarks#33 (PR #34, 2026-09-20) — re-check of the access-tokens page as the `shopify-token` provider source.
- Related non-research issue: core #316.
