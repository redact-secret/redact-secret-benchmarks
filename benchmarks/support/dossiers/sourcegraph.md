---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: sourcegraph
families:
  - id: sourcegraph:access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/sourcegraph/sourcegraph-public-snapshot/blob/c864f15af264f0f456a6d8a83290b5c940715349/internal/accesstoken/personal_access_token.go#L13-L48
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1103
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/sourcegraph.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Sourcegraph

Sourcegraph is a code search platform; a personal access token authenticates the API and `src` CLI. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/sourcegraph.md>.

## Families

### `sourcegraph:access-token` — see the taxonomy row

- **Shape:** `sgp_` + an optional instance identifier (`local` or 16 hex) + `_` + 40 lowercase hex.
- **Sources:** T1 (provider generator and validator, R1 and R9). READY for `sgp_`. Benchmark contract and corpus pending (#583).
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1103, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1103 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
