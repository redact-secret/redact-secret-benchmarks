---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: xata
families:
  - id: xata:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/xataio/xata/blob/fc4ac97f62a3830c4e4202b08a3ca51855970113/internal/api/key/key.go#L19-L57
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1102
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/xata.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Xata

Xata is a serverless Postgres platform; `xau_` and `xao_` keys authenticate the API as a user or an organization. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/xata.md>.

## Families

### `xata:api-key` — see the taxonomy row

- **Shape:** `xau_`/`xao_` + a bit-packed base62 body (20 random bytes plus a little-endian CRC32); the validator caps the key at 40 characters.
- **Sources:** T1 (provider code, R1 and R9). READY. Benchmark contract and corpus pending (#583).
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1102, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1102 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
