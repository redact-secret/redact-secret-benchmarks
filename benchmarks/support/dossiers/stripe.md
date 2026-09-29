---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: stripe
families:
  - id: stripe:secret-key-live
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: stripe:secret-key-test
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: stripe:restricted-key-live
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: stripe:restricted-key-test
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: stripe:organization-api-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: stripe:webhook-signing-secret
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.stripe.com/webhooks
        - https://docs.stripe.com/webhooks/signature
        - https://docs.stripe.com/api/webhook_endpoints/object
        - https://docs.stripe.com/keys
      issues:
        - redact-secret/redact-secret#513
        - redact-secret/redact-secret-benchmarks#224
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#372
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#729
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-27
    blockedBy: T1 on the whsec_ prefix and Stripe context only; body width and alphabet are not provider-stated, and Svix and Standard Webhooks issue whsec_ secrets too.
---

# Stripe

Stripe issues several credential classes. API keys carry an environment segment
(`sk_live_`, `sk_test_`, `rk_live_`, `rk_test_`) or an organization marker
(`sk_org_`). Publishable keys (`pk_`) are documented as safe to expose.
Webhook signing secrets (`whsec_`) are not API keys and are per-endpoint.
Provider documentation: [API keys](https://docs.stripe.com/keys).

## Families

### `stripe:secret-key-live` — Live secret key

- **Shape:** prefix `sk_live_` (taxonomy description only).
- **Sources:** no research recorded in this dossier. Core issue #316 (related, not
  research) expanded false-positive tests for public vs secret prefixes.

### `stripe:secret-key-test` — Test secret key

- **Shape:** prefix `sk_test_` (taxonomy description only).
- **Sources:** no research recorded. Test-mode keys still count as secrets under
  the test-depth rule in #316.

### `stripe:restricted-key-live` — Live restricted key

- **Shape:** prefix `rk_live_` (taxonomy description only).
- **Sources:** no research recorded.

### `stripe:restricted-key-test` — Test restricted key

- **Shape:** prefix `rk_test_` (taxonomy description only).
- **Sources:** no research recorded.

### `stripe:organization-api-key` — Organization API key

- **Shape:** prefix `sk_org_`, named on Stripe's key-types page and its organization
  keys page. No page gives a body length or alphabet. Core adopted the shape on the
  documented prefix alone (#513); the corpus keeps it pending because it asserts no
  ground truth without a documented body grammar (benchmarks#127).
- **Sources:** no verdict recorded; see Open questions.

### `stripe:webhook-signing-secret` — Webhook signing secret

- **Shape:** prefix `whsec_` followed by a body of at least 32 Base64-alphabet
  characters, optional trailing `=` padding. Stripe documents only the prefix (in
  the Dashboard and v2 event destination flows, and for CLI secrets, which are
  "different" from Dashboard ones) and calls signing secrets "not API keys". The
  API object example shows 32 mixed-case alphanumerics; a CLI docs placeholder has
  14; an SDK example uses 64 zeros. Stripe's own CLI scrubber admits `+`, `/` and `=`,
  while a second regex in the same repository accepts letters and digits only.
- **Sources:** T1 for the prefix and configuration context (provider docs). Body:
  provider code and example plus scanner rules, contradictory on alphabet. SDKs use
  the whole string, prefix included, as the HMAC key and never Base64-decode it.
- **Issuance:** not attempted. Sandbox Dashboard or `stripe listen --print-secret`
  is free; checklist in benchmarks#224. There is no `live` or `test` segment.
- **Collisions:** Svix and Standard Webhooks also use `whsec_` (Base64 of 24 to 64
  bytes, decoded before use), plus asymmetric siblings `whsk_`/`whpk_`. Public or
  non-secret values nearby: `we_` endpoint ids, `ed_` event destination ids,
  `evt_` ids, `Stripe-Signature` digests, `pk_` keys.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record as context-gated for qualification; the #729
  implementation detects the prefix bare, as attribution is a benchmark concept).

## Candidates that are not families yet

- **`absec_`** (Stripe Apps signing secret). Seen only in search results; not fetched.
- **Publishable keys `pk_live_` / `pk_test_`.** Documented safe to expose; benign
  controls, not a family.

## Open questions

1. `stripe:secret-key-live`, `-test`, `restricted-key-live`, `-test`: no research
   pass is recorded for these prefixes; the sources gave no basis for a verdict.
2. `stripe:organization-api-key`: core (#513) contracts it on prefix documentation;
   benchmarks#127 keeps it pending for lack of a body grammar. Neither is a
   research verdict, so it stays unresearched until one is recorded.
3. Do Dashboard, API, v2 event destination, Connect and CLI secrets share width and
   alphabet? Do real secrets ever contain `+`, `/` or `=`?
4. Is a 64-character variant real, or an artifact of placeholders and hex digests?
5. Should a non-Stripe `whsec_` (Svix) count as this family?
6. Two open TruffleHog PRs (#4920, #4973) add a `whsec_` rule; a merge would change
   the peer baseline.

## Research log

- redact-secret-benchmarks#224 — broad-discovery pass for the webhook secret
  (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (documented, context-constrained).
- redact-secret#729 — Wave-1 implementation; split `stripe_webhook_signing_secret`
  from `stripe_credential`.
- redact-secret-benchmarks#367 — beta.10 fixture-debt reconciliation (2026-09-27);
  redact-secret-benchmarks#372 froze the webhook contract and added an independent
  positive. Both closed 2026-09-27.
- redact-secret#513 — completion of the Stripe family in core (`sk_org_`, `whsec_`,
  `pk_` kept out); redact-secret-benchmarks#127 reviewed the benchmark side.
- redact-secret#316 — related false-positive test depth for public vs secret prefixes
  (Stripe, Shopify, Supabase); not a shape research issue.
