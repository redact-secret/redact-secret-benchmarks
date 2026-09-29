---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: clickhouse-cloud
families:
  - id: clickhouse-cloud:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/gitleaks/gitleaks/pull/1826
        - https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/clickhouse-cloud.md
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#971
        - redact-secret/redact-secret-benchmarks#464
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/clickhouse-cloud.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# ClickHouse Cloud

ClickHouse Cloud is the hosted ClickHouse service. An API key is a key ID and key secret pair used as HTTP Basic credentials against the Cloud control-plane API (`CLICKHOUSE_CLOUD_API_KEY` / `CLICKHOUSE_CLOUD_API_SECRET`); an admin key can create, scale and delete services and manage members. Only the secret carries a detectable marker.

## Families

### `clickhouse-cloud:api-key` — API key secret (4b1d)

- **Shape:** prefix `4b1d`, then exactly 38 alphanumeric characters `[A-Za-z0-9]` (42 in total), mixed case; no separator or checksum. The key ID (Basic-auth username) is not claimed.
- **Sources:** prefix T1 under R3 (a ClickHouse employee wrote in gitleaks PR #1826, merged 2025-04-16: "we specifically choose a prefix (4b1d...)"), body and alphabet T1 under R2 and R3 (the same author's rule `4b1d[A-Za-z0-9]{38}`, corroborated by provider-owned Terraform examples since 2023-05 and a 2024 unit-test fixture, all 42 bytes). T1 as of 2025-04-16.
- **Issuance:** not attempted; the one contradiction (a 2023 knowledge-base example of 39 bytes) is older than the staff statement, so R3 date order sets it aside.
- **Collisions:** `4b1d` is valid hex, so the leading boundary is load-bearing; the product adds an at-least-one-uppercase guard as policy (removes hex digests starting `4b1d`), which is not a provider fact. UUIDs containing `-4b1d-` are not keys.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row until the Beta.12 detector, redact-secret#971, is merged).
- **Open caveat:** the uppercase guard is project policy (false-negative cost about 1e-9), not a provider fact; secrets supplied through the API's `hashData` have no fixed shape and are an accepted false negative.

## Candidates that are not families yet

- **Key ID.** No prefix; 17 or 20 alphanumerics, unresolved; overlaps generic ids. Named contexts cover it.
- **Database user passwords, ClickStack/HyperDX keys.** Separate credentials, not researched.

## Open questions

1. Is the key ID 17 or 20 characters? Only an issued key settles it, and it would not make the ID detectable.
2. Is a second live secret width in use? No newer source shows one.

## Research log

- redact-secret#860 — epic (open); [issuance-gate research and rulings R9–R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337); [final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret#971 — Beta.12 implementation issue (open; no detector code merges to `main` until 0.1.0-beta.11 is released).
- redact-secret-benchmarks#464 — Beta.12 contracts and synthetic corpus for the #860 issuance-research READY families. Corpus work only, no change to the research verdict.
