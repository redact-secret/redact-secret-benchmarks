---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: polar
families:
  - id: polar:organization-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/kit/crypto.py#L11-L32
        - https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/organization_access_token/service.py#L42
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1020
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/polar.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: polar:api-credential
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/kit/crypto.py#L11-L32
        - https://github.com/polarsource/polar/blob/6a4f2f6d6083ef503cd23cb7f432ab2c60515973/server/polar/oauth2/constants.py#L5-L16
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1020
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/polar.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Polar

Polar.sh is a payments and billing platform for developers. Organization access tokens act on the organization's products, checkouts, customers, subscriptions and orders; personal access tokens, OAuth access and refresh tokens, the OAuth client secret and the client registration token act for a user or an organization or mint tokens.

## Families

### `polar:organization-access-token` — Organization access token (polar_oat_)

- **Shape:** `polar_oat_` + exactly 43 `[A-Za-z0-9]`: 37 random, then the CRC32 of those 37 in base62, zero-padded to 6.
- **Sources:** T1 under R1 and R9 from the provider server code; the service postdates the 2025-01-02 checksum era, so there is one era. The checksum corroborates only and never rejects (policy; ruling Q1 open).
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** `whsec_` webhook secrets come from the same generator but `stripe-token` owns the prefix (misattributed, still redacted); `polar_ci_` is a public client id (Q5).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1020, merged in redact-secret#1039 and is unreleased).

### `polar:api-credential` — API credentials (polar_pat_, polar_at_u_/o_, polar_rt_u_/o_, polar_cs_, polar_crt_)

- **Shape:** one of seven role prefixes + exactly 43 `[A-Za-z0-9_-]`, the union of the URL-safe era (before 2025-01-02) and the alphanumeric-plus-checksum era.
- **Sources:** T1 under R1 and R9 from the provider server code and its commit history. No checksum applies: an era-1 body is all-alphanumeric about a quarter of the time.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** `polar_at_` without the `u_`/`o_` sub-type is not a prefix; checkout `polar_c_`/`polar_cl_` secrets are handed to the browser.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1020, merged in redact-secret#1039 and is unreleased).

## Candidates that are not families yet

- **Checkout client secrets (`polar_c_`, `polar_cl_`).** Handed to the browser checkout by design; not a server credential.
- **Session, authorization-code and verification tokens (`polar_us_`, `polar_cst_`, `polar_mst_`, `polar_ac_`, `polar_ev_`, `polar_cev_`, `polar_oauth2_`, `polar_auth_session_`).** Short-lived or single-use credentials with the same body grammar; a later extension may claim them.

## Open questions

1. Ruling Q1: should a failed `polar_oat_` checksum ever become an intentional false negative? Today it corroborates only.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md) ranks 50 candidates, freezes ten handoffs and records a step-4 disposition for all 50 (merge commit `3785817`, 2026-09-30; the ten handoffs are unchanged since `4f220ea`, 2026-09-29).
- redact-secret#1020 — Beta.12 implementation issue (detector merged to `main` in redact-secret#1039, unreleased).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
