---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: supabase
families:
  - id: supabase:secret-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://supabase.com/docs/guides/api/api-keys
        - https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys
        - https://github.com/supabase/cli/blob/a09ff6cf59e89fae5c92458c7b838a09b9a9d777/apps/cli-go/pkg/config/apikeys.go
      issues:
        - redact-secret/redact-secret-benchmarks#231
        - redact-secret/redact-secret#742
        - redact-secret/redact-secret#515
      evidence: null
      researchedAt: 2026-09-24
    blockedBy: The 22 + _ + 8 layout is stated on the self-hosting page ("same format as the platform"); the hosted checksum algorithm and input are unresolved, so the checksum value is not asserted.
  - id: supabase:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://supabase.com/docs/guides/platform/personal-access-tokens
      issues:
        - redact-secret/redact-secret#515
        - redact-secret/redact-secret-benchmarks#81
      evidence: null
      researchedAt: 2026-09-21
    blockedBy: T1 on the sbp_ prefix (documented by example) only; the exact 40-character body for sbp_ and sbp_v0_ is tool-corroborated (TruffleHog's shape).
---

# Supabase

Supabase issues several credential classes, each assessed independently (core
decision from #515: no class is evidence for another). Opaque `sb_publishable_` and
`sb_secret_` API keys are replacing the legacy JWT `anon` and `service_role` keys,
which the provider plans to remove by end of 2026. Management-API personal access
tokens (`sbp_`) are a separate class.

## Families

### `supabase:secret-key` — Project secret key

- **Shape:** prefix `sb_secret_`, then a 22-character random part, `_`, and an
  8-character checksum (31 characters after the prefix, 41 in total). The
  self-hosting page states this and says hosted keys use the same format. The
  base64url alphabet and a SHA-256 checksum construction come from provider code
  only (the self-hosting script and CLI defaults), so `_` and `-` can appear inside
  the segments and only the underscore at body offset 22 is structural. The hosted
  checksum input is unresolved; the self-hosted gateway does not validate it.
- **Sources:** T1 (provider documentation plus the CLI source at the permalink above,
  which yields local-dev sample keys with the 22/8 layout; those are public and are
  not to be reused as fixtures). Docs also state the secret is a short string, not
  a JWT, and can be revealed again through the Management API (`reveal=true`).
- **Issuance:** not attempted. Multiple secret keys are allowed; the Management
  API `prefix` and `hash` field forms were not observed.
- **Collisions:** `sb_publishable_` keys are documented safe to expose and are the
  primary benign control. Legacy `anon` and `service_role` JWTs start `eyJ`; hosted
  ones carry `iss` `supabase`, the CLI's local ones `supabase-demo`. Earlier positives
  with 40 alphanumerics predate the grammar. Secrets are auto-revoked when pushed to
  public GitHub repositories (provider statement).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (T1 layout row, checked by position; the tightening followed #742).

### `supabase:personal-access-token` — Personal access token

- **Shape:** prefix `sbp_` or `sbp_v0_`, each followed by exactly 40 lowercase
  letters and digits. The provider page documents the `sbp_` prefix by example and the
  classic vs scoped distinction, not the body. The body grammar is TruffleHog's
  shipped shape for `sbp_`; `sbp_v0_` is the same body under a longer prefix.
- **Sources:** T1 on the prefix, T2 on the body (record in benchmarks#81, from the
  core decision of 2026-09-20).
- **Issuance:** not attempted.
- **Collisions:** the secret key class above; evidence is kept independent in both
  directions.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Legacy `anon` and `service_role` JWTs.** Hosted JWTs carry `iss` `supabase`
  and a `ref`; the anon key is documented as a publishable value. Core scoped an
  exclusion for the legacy anon JWT in #472. No taxonomy family exists.
- **`sb_publishable_` keys.** Safe to expose by documentation; a benign control.

## Open questions

1. Does the self-hosting page count as T1 for hosted keys? The row above assumes yes.
2. What are the hosted checksum algorithm and input (project ref?), and is it
   validated server-side?
3. The alphabet appears only in provider code; is it stated in prose anywhere?
4. What do the Management API `prefix` and `hash` fields, and the dashboard's masked
   display, look like?
5. A third-party claim of `openssl rand -hex 24` (48 hex) cited in the older
   benchmark review was not found again.

## Research log

- redact-secret#515 — split the credential classes and lifted the management token
  (`sbp_`) out of T0 (2026-09-21); `sb_secret_` stayed open-floor T0 until #742.
- redact-secret-benchmarks#81 — backfilled the management-token contract at T1.
- redact-secret-benchmarks#231 — broad-discovery pass for `sb_secret_`
  (2026-09-24); found the self-hosting grammar.
- redact-secret#742 — twin false positives on the 22 + `_` + 8 layout; benchmark
  re-reviewed the family T0 to T1 (benchmarks#207, #238).
- redact-secret#472 — legacy anon JWT exclusion (related).
- redact-secret#316 — public vs secret prefix test depth for Stripe, Shopify and
  Supabase (related; not a shape research issue).
