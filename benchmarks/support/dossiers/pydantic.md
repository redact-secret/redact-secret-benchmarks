---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: pydantic
families:
  - id: pydantic:logfire-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/pydantic/logfire/blob/a413dc789002d35cbc3b1a281e0d936c0930762e/logfire-sdk/logfire/_internal/auth.py#L36-L41
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1106
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/pydantic-logfire.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Pydantic

Pydantic Logfire is an observability platform; write, read and API tokens share one prefix namespace. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/pydantic-logfire.md>.

## Families

### `pydantic:logfire-token` — see the taxonomy row

- **Shape:** `pylf_v<n>_<region>_` + an optional organization UUID + an alphanumeric body whose floor is a policy (Q7).
- **Sources:** T1 lexical grammar; the body floor is policy (Q7, non-blocking). READY. Benchmark contract and corpus pending (#583).
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1106, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1106 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
