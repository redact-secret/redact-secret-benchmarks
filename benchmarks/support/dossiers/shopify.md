---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: shopify
families:
  - id: shopify:custom-app-access-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: shopify:public-app-access-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# Shopify

Shopify issues access tokens for store-installed custom apps (prefix `shpat_`) and for public or listed apps (prefix `shppa_`).

No family in this dossier has a recorded research verdict. Whether and how core detects a family is not recorded here.

## Families

### `shopify:custom-app-access-token` — Custom app access token

- **Shape:** Access token for a store-installed custom app, prefixed shpat_.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `shopify:public-app-access-token` — Public app access token

- **Shape:** Access token for a public/listed app, prefixed shppa_.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`shpca_`** (public storefront token). Core's Shopify module documentation deliberately excludes it. No taxonomy entry.

## Open questions

1. **Both families are unresearched.** Searched: core and benchmarks issue titles for Shopify, core `docs/specs`, evidence and decisions, benchmarks `docs/` and `benchmarks/support`. The only Shopify issue is core #316 (false-positive tests for public versus secret prefixes across Stripe, Shopify and Supabase), which is test-depth work, not a grammar verdict.
2. **Lead, not a verdict.** The benchmarks contract for `shopify-token` cites Shopify's access-tokens page (https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) as T1 for the `shpat_` and `shppa_` prefixes, with the 32-hex body tool-corroborated. Re-checked 2026-09-20 (benchmarks#33): the page calls the body an "opaque string" and states no length or character class, so the body is not probeable from provider evidence. The contract also requires a `myshopify.com` shop domain alongside the token. Decide whether that row counts as a research record.

## Research log

No research issues. Related non-research issue: core #316.
