---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: doppler
families:
  - id: doppler:service-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: doppler:personal-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: doppler:cli-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: doppler:service-account-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: doppler:service-account-identity-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: doppler:scim-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: doppler:audit-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.doppler.com/reference/auth-token-formats
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#903
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/doppler.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Doppler

Doppler is a secrets manager. One provider page, [auth token formats](https://docs.doppler.com/reference/auth-token-formats), documents seven bearer token types under one `dp.<type>.` scheme, each with its own regex. Doppler publishes no public or publishable token. The #860 candidate was named `doppler:service-token`; the Tier A handoff scoped it to all seven documented types, so all seven taxonomy families are covered by the one record.

## Families

Shared by all seven (provider docs regex, page `dateModified` 2025-05-29, unchanged when re-checked 2026-09-28): prefix `dp.` + type + `.`, then a body of 40 to 44 alphanumeric characters, no separators inside the body, no checksum. Every documentation example and the one empirical observation have a 43-byte body; the documented 40 to 44 band is the contract. All seven are T1 because the issuer states prefix, band, alphabet and separators as a regex per type. Scanner rules (trufflehog, Nosey Parker, gitleaks for `pt` only, GitHub secret scanning without `said`) are corroboration and lag the page.

### `doppler:service-token` — Service token (dp.st.)

- **Shape:** `dp.st.` + 40 to 44 alphanumerics; an optional environment segment of 2 to 35 characters from lowercase letters, digits, underscore and hyphen, then a dot, may sit between the prefix and the body. Role: a service token reads one config; the only type with an optional environment segment.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** the CLI and dashboard preview form (`dp.st` plus an ellipsis and the last 6 characters) fails the grammar and is not a secret.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `doppler:personal-token` — Personal token (dp.pt.)

- **Shape:** `dp.pt.` + 40 to 44 alphanumerics. Role: user-wide scope.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** no other issuer using `dp.` was found.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `doppler:cli-token` — CLI token (dp.ct.)

- **Shape:** `dp.ct.` + 40 to 44 alphanumerics. Role: user-wide scope.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** no other issuer using `dp.` was found.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `doppler:service-account-token` — Service account token (dp.sa.)

- **Shape:** `dp.sa.` + 40 to 44 alphanumerics. Role: service account scope.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** no other issuer using `dp.` was found.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `doppler:service-account-identity-token` — Service account identity token (dp.said.)

- **Shape:** `dp.said.` + 40 to 44 alphanumerics. Role: short-lived, minted by OIDC exchange.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** `dp.said.` versus `dp.sa.`: the body alphabet excludes the dot, so `dp.sa.` plus a body starting `id.` fails; longest prefix wins.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `doppler:scim-token` — SCIM token (dp.scim.)

- **Shape:** `dp.scim.` + 40 to 44 alphanumerics. Role: SCIM provisioning scope.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** no other issuer using `dp.` was found.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `doppler:audit-token` — Audit token (dp.audit.)

- **Shape:** `dp.audit.` + 40 to 44 alphanumerics. Role: audit log scope.
- **Sources:** T1, per-type regex on the provider page.
- **Collisions:** no other issuer using `dp.` was found.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Service-token slugs (`--slug`) and token names.** Non-secret identifiers, not in `dp.` form.
- **Undocumented future types.** None are known; an unknown `dp.<type>.` is outside the contract.

## Open questions

1. Are service-token bodies always 43 characters? An optional issuance check (one service, one personal, one service account token) would narrow, not change, the documented band.
2. Does the environment segment always equal the environment slug? Only asked for `dp.st.`.

## Research log

- redact-secret#860 — epic (open); [research table #40](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852387097); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534) (one detector, seven types).
- redact-secret#903 — implementation issue for the seven-type detector (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY (seven types), 2026-09-28.
- redact-secret-benchmarks#434 — Beta.11 contracts and synthetic corpus for the #860 Tier A READY families; closed 2026-09-28. Corpus work only, no change to the research verdict.
