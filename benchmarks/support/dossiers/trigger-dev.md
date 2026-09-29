---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: trigger-dev
families:
  - id: trigger-dev:secret-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/triggerdotdev/trigger.dev/tree/c2b7a72180bbb2dcbc31caa8539e0ca8f8e9e9b8
        - https://github.com/triggerdotdev/trigger.dev/blob/0b35cc35e053bc4a38cbe80ff4d7d543e8cca7d3/apps/webapp/app/models/api-key.server.ts
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#904
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/trigger-dev.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: trigger-dev:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/triggerdotdev/trigger.dev/tree/c2b7a72180bbb2dcbc31caa8539e0ca8f8e9e9b8
        - https://github.com/triggerdotdev/trigger.dev/blob/0b35cc35e053bc4a38cbe80ff4d7d543e8cca7d3/apps/webapp/app/models/api-key.server.ts
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#904
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/trigger-dev.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Trigger.dev

Trigger.dev runs background and agent jobs. An environment secret key triggers and manages jobs in one project environment (`dev`, `stg`, `prod`, `preview`), and those jobs run with that environment's secrets. A personal access token acts for a user across projects. All grammar comes from provider code at a pinned commit (published SDK regex and webapp generators), re-checked on 2026-09-28.

## Families

### `trigger-dev:secret-api-key` — Environment secret key (tr_<env>_ / tr_<env>_sk_)

- **Shape:** `tr_` + one of `dev`, `stg`, `prod`, `preview` + `_` (root key) or `_sk_` (additional key, allowed since 2026-08-25), then an alphanumeric body of exactly 24 characters; legacy root keys (up to v4.0.0) have exactly 20. No checksum.
- **Sources:** T1. The additional-key grammar is a regex in the published SDK core; the root and legacy grammars are generator code (R1); the docs corroborate the prefixes. Legacy 20-byte roots are kept because lookup is by value and no statement says they stopped authenticating.
- **Issuance:** not attempted.
- **Collisions:** `pk_<env>_` + 20 is the public key and must stay benign. Env slugs outside the four (`tr_test_`, `tr_staging_`) are not in the provider's union.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `trigger-dev:personal-access-token` — Personal access token (tr_pat_)

- **Shape:** `tr_pat_` + exactly 40 characters from a lowercase alphabet without `0` and `l`.
- **Sources:** T1, generator code (R1) plus docs prefix.
- **Collisions:** none found; scope is the user, which is why it is a separate family from the environment key.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`tr_oat_` organization access token.** A secret, but no generator was found; length and alphabet are unknown (T0).
- **`tr_uat_` + JWT** (short-lived delegated) and **public access tokens** (bare HS256 JWT): the generic JWT detection applies.
- **`tr_proj_` project refs.** Non-secret identifiers.

## Open questions

1. Grammar of `tr_oat_` organization access tokens.
2. Whether 20-byte legacy root keys still authenticate.

## Research log

- redact-secret#860 — epic (open); [research table #20](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386687); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534).
- redact-secret#904 — implementation issue for both types (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
