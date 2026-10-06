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
- **Sources:** T1 (provider code, R1 and R9): `xataio/xata` `key.go` and the `jxskiss/base62` encoder it calls fix the prefix, the `[0-9A-Za-z]` alphabet and the 40-character cap; the 32 to 36 body width is derived from the encoder (99.9% of keys are 32 to 34). READY. Contract and seeded corpus authored in #583 (`benchmarks/lib/beta8/583b.ts`, `fixtures/generated/beta8/583b.mjs`). The CRC32 is policy (ruling Q1, open), so checksum-mismatch twins are unclaimed; the 35 and 36 widths are an inclusion decision and their positives are lexical-only. No pinned peer has a Xata rule.
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector `xata-api-key` is registered on `main`, redact-secret#1102, unreleased). One registry contract covers both finding types (`xata_user_api_key`, `xata_organization_api_key`); no second arrival family.

## Candidates that are not families yet

## Open questions

1. Q1 (open): may a CRC32 post-check reject a lexically valid value? Until ruled, the checksum-mismatch twins stay unclaimed.
2. Do classic-platform (pre-2026) keys share this grammar? No provider source says; unclaimed.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1102 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; Xata authored as slice 583b.
