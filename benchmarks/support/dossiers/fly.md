---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: fly
families:
  - id: fly:access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/superfly/macaroon/blob/a0202e10fd947786884323dcbce46efbe8652171/format.go#L11-L60
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1109
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/fly.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Fly.io

Fly.io is an application platform; access tokens are macaroons, sent as `FlyV1 fm2_…`. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/fly.md>.

## Families

### `fly:access-token` — see the taxonomy row

- **Shape:** A run starting at the first `fm1r_`, `fm1a_` or `fm2_` member (std Base64, 64 or more characters), including comma-joined `fo1_` members.
- **Sources:** T1 conditional on Q7 (floor derived from wire-format code). READY, conditional on Q7. Benchmark contract and corpus pending (#583); needs a bundle-span case (the span starts at `fm`, the scheme stays outside).
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1109, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1109 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
