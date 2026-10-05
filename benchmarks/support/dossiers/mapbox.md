---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: mapbox
families:
  - id: mapbox:secret-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/mapbox/parse-mapbox-token/blob/015a6b470fdb489a2635a4889c9f5b1d545a512c/index.js
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1108
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/mapbox.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Mapbox

Mapbox is a maps platform; `sk.` secret tokens carry account scopes (public `pk.` tokens are not secrets). Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/mapbox.md>.

## Families

### `mapbox:secret-access-token` — see the taxonomy row

- **Shape:** `sk.` + a base64url JSON payload (`eyJ` lead) + `.` + a 22-character base64url signature.
- **Sources:** T1 conditional on Q7 (structural floor derived from provider code). READY, conditional on Q7. Benchmark contract and corpus pending (#583); needs a no-double-report case against `jwt`.
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1108, unreleased). The benchmark contract is a T3 placeholder (`benchmarks/lib/beta8/583p.ts`) that asserts no format until the slice lands.

## Candidates that are not families yet

## Open questions

1. Authoring the contract, the seeded corpus and the arrival evidence from the handoff (#583).

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1108 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; detector present in the registry, benchmark contract/corpus pending.
