---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: resend
families:
  - id: resend:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/resend/resend-cli#authentication
        - https://resend.com/docs/api-reference/api-keys/create-api-key
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#915
        - redact-secret/redact-secret-benchmarks#436
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/resend.md
      researchedAt: 2026-09-28
    blockedBy: "Segment layout and length rest on provider examples and SDK fixtures (R5), not a stated grammar; the alphanumeric superset was chosen deliberately over the base58 seen in samples."
---

# Resend

Resend is a transactional email API. An API key (`RESEND_API_KEY`, `Authorization: Bearer`) sends email as the account's verified domains; a `full_access` key also manages domains, keys and audiences. `full_access` and `sending_access` keys share one shape.

## Families

### `resend:api-key` — API key (re_)

- **Shape:** prefix `re_`, then 8 characters, an underscore, and 24 characters (36 in total), alphanumeric in both segments.
- **Sources:** prefix T1: the provider CLI rejects a key that does not start with `re_` ("Your key must start with `re_`"). The 8 + `_` + 24 layout is T1 by example under ruling R5: the create-API-key docs example, plus provider SDK fixtures (three distinct values across the Go, Python, Node and .NET SDKs). The live docs example was re-measured on 2026-09-28. The three samples are consistent with base58, but three samples show what is present, not what is excluded, so the handoff takes the alphanumeric superset (the #655 Entra precedent).
- **Issuance:** not attempted.
- **Collisions:** `re_` is very short and ends many identifiers and Python names; the leading boundary removes glued cases and the handoff adds a mixed-case post check (false-negative cost about 6e-8). No other issuer using `re_` was found.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Webhook signing secret (`whsec_`).** A Svix scheme; a separate credential, not researched here.
- **`re_` + GUID** (.NET mock server) and **`re_` + 36 lowercase alphanumerics** (Go webhook example): test stubs or placeholders that contradict the docs layout.

## Open questions

1. Does a real key ever contain `0`, `O`, `I` or `l`? An issuance check would show whether the alphabet is base58 or full alphanumeric.
2. Is the 8/24 split stable across key types (`full_access` versus `sending_access`)?

## Research log

- redact-secret#860 — epic (open); [research table #02](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386450); [Tier B re-rank](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871765611) (READY); [rulings R5](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275).
- redact-secret#915 — implementation issue (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret-benchmarks#436 — Beta.11 contracts and synthetic corpus for the #860 Tier B READY families; closed 2026-09-28. Corpus work only, no change to the research verdict.
