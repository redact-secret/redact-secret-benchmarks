---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: dynatrace
families:
  - id: dynatrace:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.dynatrace.com/docs/dynatrace-api/basics/dynatrace-api-authentication
        - https://github.com/Dynatrace/dynatrace-operator/blob/2a39d88a0ee1fbb61e2d22db02520b3dc92ffc80/pkg/util/dttoken/token.go#L14-L58
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1032
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/dynatrace.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Dynatrace

Dynatrace access tokens (`DT_API_TOKEN`, `Authorization: Api-Token …`) and platform tokens authenticate the environment and account APIs; depending on scopes they read monitoring data (which can include payloads and logs), change configuration, ingest data or manage the account. Provider docs: <https://docs.dynatrace.com/docs/dynatrace-api/basics/dynatrace-api-authentication>.

## Families

### `dynatrace:api-token` — Access and platform token (dt0c01, dt0s..)

- **Shape:** `dt0` + `c`|`s` + two digits + `.` + 24 `[A-Z2-7]` + `.` + 64 `[A-Z2-7]` (96 in all).
- **Sources:** T1: structure, both lengths and the prefix table are the docs (`dt0c01` by the docs placeholder, R4); the base32 alphabet is the provider operator generator (R1) and the docs example.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** the token identifier alone (prefix + public portion) is documented as safe to log (Q5).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1032, merged in redact-secret#1039 and is unreleased).

## Candidates that are not families yet

- **OAuth client secrets and tenant tokens in other shapes.** Not in the documented three-part format.

## Open questions

1. None open.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md) ranks 50 candidates, freezes ten handoffs and records a step-4 disposition for all 50 (merge commit `3785817`, 2026-09-30; the ten handoffs are unchanged since `4f220ea`, 2026-09-29).
- redact-secret#1032 — Beta.12 implementation issue (detector merged to `main` in redact-secret#1039, unreleased).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
