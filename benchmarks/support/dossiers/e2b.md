---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: e2b
families:
  - id: e2b:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/e2b-dev/infra/tree/132dadd2ef55bbac301528500e8a4538caf4b163
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#905
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/e2b.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# E2B

E2B runs cloud sandboxes for agent code. A team API key (`E2B_API_KEY`, sent as `X-API-Key`) creates and controls sandboxes on the team's quota. The docs name the variable and show `e2b_` placeholders only; the grammar comes from provider code.

## Families

### `e2b:api-key` — Team API key (e2b_)

- **Shape:** prefix `e2b_`, then exactly 40 lowercase hex characters (44 in total), no separators or checksum.
- **Sources:** T1 under ruling R1 from `e2b-dev/infra`: the key package sets `ApiKeyPrefix = "e2b_"` and generates 20 random bytes hex-encoded, and the legacy SQL generator and a local-dev seed test agree. The prefix and `keyLength = 20` were unchanged when re-checked on 2026-09-28. One contradicting third-party connector page (32 length) was traced to an illustrative value.
- **Issuance:** not attempted; optional structure check on one console-issued key.
- **Collisions:** the 40-hex body alone is SHA-1 and git-SHA shaped, so the prefix is load-bearing. Package names such as `e2b_code_interpreter` fail the exact-40-hex body. An uppercase-hex body is accepted by the server verifier but never issued.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`sk_e2b_` + 40 hex user access token.** Retired: generation stopped 2026-07-01, tokens stopped working 2026-08-01. The leading boundary keeps `e2b_` inside it from being read as an API key.
- **Sandbox envd and traffic tokens.** Sixty-four hex, no prefix; not lexically attributable.

## Open questions

1. Confirm 44 total length and lowercase hex on one console-issued key (optional).

## Research log

- redact-secret#860 — epic (open); [research table #05](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386450); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534).
- redact-secret#905 — implementation issue (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret-benchmarks#434 — Beta.11 contracts and synthetic corpus for the #860 Tier A READY families; closed 2026-09-28. Corpus work only, no change to the research verdict.
