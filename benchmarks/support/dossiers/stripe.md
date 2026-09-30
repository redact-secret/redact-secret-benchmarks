---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: stripe
families:
  - id: stripe:secret-key-live
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.stripe.com/keys
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: stripe:secret-key-test
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.stripe.com/keys
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: stripe:restricted-key-live
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.stripe.com/keys
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: stripe:restricted-key-test
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.stripe.com/keys
      issues:
        - redact-secret/redact-secret-benchmarks#33
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: stripe:organization-api-key
    research:
      verdict: issuance-gated
      tier: T1
      sources:
        - https://docs.stripe.com/keys
        - https://docs.stripe.com/keys/organization-api-keys
        - https://github.com/stripe/stripe-cli/blob/1090068baae4c3d732fd500a9d3dbe4b94bc91a0/pkg/cmd/listen.go#L193-L196
        - https://github.com/koki-develop/mask-go/blob/1b861d7ac421b392a5bb962207fd1886b28e013e/builtin_stripe_secret_key.go#L100-L113
        - https://github.com/lazyluke16-dotcom/richmond-rapid-connect/blob/5c057a98ccc24602917441f6c78f3a6aa15dc740/src/lib/stripe.server.ts#L12-L18
        - https://github.com/baristaze/tadas/blob/b55571cd85ec5a7fe16bc463537980909f87ee4f/integrations/src/tadas/integrations/settings.py#L94-L114
      issues:
        - redact-secret/redact-secret-benchmarks#45
        - redact-secret/redact-secret-benchmarks#127
        - redact-secret/redact-secret#513
        - redact-secret/redact-secret#1012
        - redact-secret/redact-secret#1030
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/stripe-organization-api-key.md
      researchedAt: 2026-09-29
    blockedBy: Whether a live_ or test_ segment follows sk_org_, and the body length and alphabet; needs one organization API key measured (structure only). Product gap redact-secret#1030 is filed.
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
    blockedBy: null
---

# Stripe

Stripe issues several credential classes. API keys carry an environment segment
(`sk_live_`, `sk_test_`, `rk_live_`, `rk_test_`) or an organization marker
(`sk_org_`). Publishable keys (`pk_`) are documented as safe to expose.
Webhook signing secrets (`whsec_`) are not API keys and are per-endpoint.
Provider documentation: [API keys](https://docs.stripe.com/keys).

## Families

### `stripe:secret-key-live` — Live secret key

- **Shape:** prefix `sk_live_`.
- **Sources:** T1 on the provider-documented prefix (docs.stripe.com/keys), per the shipped `stripe-token` contract in the benchmarks assessment (re-checked 2026-09-20, benchmarks#33, closed by PR #34). The page states nothing about body length or alphabet; the 32-character body is tool-corroborated only and stays undecided here. Core issue #316 (related, not research) expanded false-positive tests for public vs secret prefixes.

### `stripe:secret-key-test` — Test secret key

- **Shape:** prefix `sk_test_`.
- **Sources:** T1 on the provider-documented prefix (docs.stripe.com/keys), per the shipped `stripe-token` contract in the benchmarks assessment (re-checked 2026-09-20, benchmarks#33, closed by PR #34). The page states nothing about body length or alphabet; the 32-character body is tool-corroborated only and stays undecided here. Test-mode keys still count as secrets under the test-depth rule in #316.

### `stripe:restricted-key-live` — Live restricted key

- **Shape:** prefix `rk_live_`.
- **Sources:** T1 on the provider-documented prefix (docs.stripe.com/keys), per the shipped `stripe-token` contract in the benchmarks assessment (re-checked 2026-09-20, benchmarks#33, closed by PR #34). The page states nothing about body length or alphabet; the 32-character body is tool-corroborated only and stays undecided here.

### `stripe:restricted-key-test` — Test restricted key

- **Shape:** prefix `rk_test_`.
- **Sources:** T1 on the provider-documented prefix (docs.stripe.com/keys), per the shipped `stripe-token` contract in the benchmarks assessment (re-checked 2026-09-20, benchmarks#33, closed by PR #34). The page states nothing about body length or alphabet; the 32-character body is tool-corroborated only and stays undecided here.

### `stripe:organization-api-key` — Organization API key

- **Shape:** prefix `sk_org_`, named on Stripe's key-types page and its organization
  keys page, which says the keys "support sandboxes and live mode" and have no `rk_org_`
  sibling. No Stripe page, SDK, mock or peer scanner rule gives a literal key, a body
  length or an alphabet. Two independent applications branch on `sk_org_live_` and
  `sk_org_test_`, so a mode segment after the prefix is plausible but unconfirmed.
- **Verdict (#1012, 2026-09-29):** `issuance-gated`, T1 on the provider-documented prefix
  `sk_org_` and nothing else. This supersedes the earlier `ready` entry, which rested on the
  prefix alone with the body undecided; the 1012 record reads the gap as blocking a
  contract. Per decision `2026-09-24-stop-asserting-provider-undecided-format-properties`
  a pending fixture never asserts an undecided body (benchmarks#127).
- **Sources:**
  - provider docs (T1, prefix): the keys page and the organization API keys page.
  - provider code (R6, substring only): stripe-cli `listen.go` tests for the substring `sk_org`, no grammar.
  - independent implementations (one class): mask-go accepts `sk_org_live_`, `sk_org_test_` and bare `sk_org_`; richmond-rapid-connect branches on `sk_org_test_` and `sk_org_live_`; tadas lists both and also `rk_org_`, which Stripe says does not exist.
  - Not evidence: three committed `sk_org_live_`-shaped values in unrelated repositories, withheld; they are a lead that the `live_` segment occurs.
  - Searched with nothing further: eleven Stripe docs pages, nine Stripe SDK and mock repositories, and the rules of gitleaks, trufflehog, betterleaks, CredSweeper, noseyparker and GitLab. GitHub's partner list has no organization row.
- **Issuance:** needs a Stripe organization. Create one organization API key in a sandbox (and read a live one if available) and record only the bytes after `sk_org_` (`test_`, `live_` or none), the body length, whether the body is only `[A-Za-z0-9]` and the total length; then roll or delete the key.
- **Collisions:** none worth naming for the prefix, which is unique to Stripe organization keys. `rk_org_` does not exist per Stripe and must stay excluded; `sk_live_`/`sk_test_` are the account-scoped siblings.
- **Current contract in core:** core claims `sk_org_` + at least 20 `[A-Za-z0-9]`, and since product PR [#1101](https://github.com/redact-secret/redact-secret/pull/1101) (merge `bfc608cce75f79f6a5cab037d7e558ba629777f6`, closing [#1030](https://github.com/redact-secret/redact-secret/issues/1030)) also `sk_org_live_` and `sk_org_test_` + at least 20 alphanumerics, as the same `stripe` finding as `sk_org_`. This is the support-policy floor: it follows the optional mode segment that two independent applications branch on, not a provider-stated grammar, and no issued key has been observed. The benchmarks side has not followed: no fixture, contract row or measured status covers the mode-segment forms yet. Living spec: [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
- **Open caveat:** nothing beyond the `sk_org` prefix is provider-stated; an interim rule is a policy floor, not a grammar.

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
- **Open caveat:** T1 on the whsec_ prefix and Stripe context only; body width and alphabet are not provider-stated, and Svix and Standard Webhooks issue whsec_ secrets too.

## Candidates that are not families yet

- **`absec_`** (Stripe Apps signing secret). Seen only in search results; not fetched.
- **Publishable keys `pk_live_` / `pk_test_`.** Documented safe to expose; benign
  controls, not a family.

## Open questions

1. Body length and alphabet of the `sk_`/`rk_` keys and of `sk_org_`: no Stripe page states them (benchmarks#33, #45, #127); the 32-character body is tool-corroborated only.
2. `stripe:organization-api-key`: does `live_` or `test_` follow `sk_org_`, and what are the body length and alphabet? Only a structure-only measurement from a Stripe organization closes it (redact-secret#1012; core claims the segment at the policy floor since #1030 / PR #1101); benchmarks#127 stays pending on that alone.
3. Do Dashboard, API, v2 event destination, Connect and CLI secrets share width and
   alphabet? Do real secrets ever contain `+`, `/` or `=`?
4. Is a 64-character variant real, or an artifact of placeholders and hex digests?
5. Should a non-Stripe `whsec_` (Svix) count as this family?
6. Two open TruffleHog PRs (#4920, #4973) add a `whsec_` rule; a merge would change
   the peer baseline.

## Research log

- redact-secret#1012 — 2026-09-29 contract research for `stripe:organization-api-key`
  ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/stripe-organization-api-key.md)):
  BLOCKED on the mode segment and body; the prefix is the only T1 fact. Status
  comment 2026-09-30 files the product gap as #1030.
- redact-secret#1030 — 2026-09-30 core claims `sk_org_live_`/`sk_org_test_` + at
  least 20 alphanumerics as the same `stripe` finding as `sk_org_`, at the
  support-policy floor (PR #1101, merge `bfc608cce75f79f6a5cab037d7e558ba629777f6`).
  The verdict stays `issuance-gated`: no issued key observed, body length and
  alphabet after the segment still unknown.
- redact-secret-benchmarks#224 — broad-discovery pass for the webhook secret
  (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (documented, context-constrained).
- redact-secret#729 — Wave-1 implementation; split `stripe_webhook_signing_secret`
  from `stripe_credential`.
- redact-secret-benchmarks#367 — beta.10 fixture-debt reconciliation (2026-09-27);
  redact-secret-benchmarks#372 froze the webhook contract and added an independent
  positive. Both closed 2026-09-27.
- redact-secret-benchmarks#45 — 2026-09-20 review of the pending `stripe-token`
  fixtures (`sk_org_`, `whsec_`): prefixes documented, no body grammar from the
  provider or either pinned peer; retained pending.
- redact-secret#513 — completion of the Stripe family in core (`sk_org_`, `whsec_`,
  `pk_` kept out); redact-secret-benchmarks#127 reviewed the benchmark side.
- redact-secret#316 — related false-positive test depth for public vs secret prefixes
  (Stripe, Shopify, Supabase); not a shape research issue.
