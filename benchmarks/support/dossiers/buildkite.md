---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: buildkite
families:
  - id: buildkite:access-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://github.com/buildkite/agent/blob/4b52e509c730797c2a97487972fdf99477fd07e6/internal/redact/redact.go#L30-L69
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1105
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/buildkite.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Buildkite

Buildkite is a CI platform; its tokens authenticate API access, agents, jobs, packages and portals. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/buildkite.md>.

## Families

### `buildkite:access-token` — see the taxonomy row

- **Shape:** One of 15 provider-listed prefixes + a base64url-and-dot body of 24 or more characters.
- **Sources:** T2 to T1 by role (provider redaction rule, R2). READY. Benchmark contract and corpus pending (#583); needs a JWT-body case the existing peer rule does not know.
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1105, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1105 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
