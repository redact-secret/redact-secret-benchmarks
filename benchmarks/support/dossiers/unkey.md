---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: unkey
families:
  - id: unkey:root-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/unkeyed/unkey/blob/20378e892035dad8ca3590765651cd25c964f78e/internal/services/keys/create_v1.go
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1104
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/unkey.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Unkey

Unkey is an API key management service; a root key manages workspaces and APIs. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/unkey.md>.

## Families

### `unkey:root-key` — see the taxonomy row

- **Shape:** `unkey_` + 8 + `unkeyv1` + 42 base58 (CRC-32C checksum) and the dashboard `3Z` form.
- **Sources:** T1 (provider code, R1 and R9). READY for the two current root-key grammars. Benchmark contract and corpus pending (#583); needs a real CRC-32C case.
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1104, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1104 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
