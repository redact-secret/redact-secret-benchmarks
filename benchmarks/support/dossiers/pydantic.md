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
        - https://github.com/pydantic/pydantic-ai/blob/b2e37b94a275084716c820065e8c912809daed7c/pydantic_ai_slim/pydantic_ai/providers/gateway.py#L407-L418
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

- **Shape:** `pylf_v<n>_<region>_` + an optional organization UUID (8-4-4-4-12 hex, v2 API keys) + an alphanumeric body, `[A-Za-z0-9]` with a policy floor of 20; every provider fixture and one third-party rule use 44.
- **Sources:** T1 lexical grammar under R1 (two provider SDK parsers) and R2 (the provider scrubber's `pylf_v\d+_` rule). No provider source states a body width, so the floor of 20 is a policy (Q7, non-blocking) recorded in `policy-body-floor`, never T1; no fixture asserts silence below it. Write, read, API and AI Gateway keys are one family and one finding type.
- **Issuance:** not attempted; the handoff records an optional structure-only check (version, region, organization id and its hex case, body length, alphabet) that would not change the contract.
- **Collisions:** `pylf_v1_us_...` and masked `pylf_v1_us_0kYhc****` placeholders, the scrubber pattern `pylf_v\d+_` in config text, `logfire-us` hostnames, legacy unprefixed tokens (out of scope), and the scanner-only v3/v4 80-byte shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector `pydantic-logfire-token` is registered on `main`, redact-secret#1106, unreleased). The benchmark contract and corpus are authored in `benchmarks/lib/beta8/583f.ts` and `fixtures/generated/beta8/583f.mjs`.

## Candidates that are not families yet

- **Bodies containing `-` or `_` that are not a UUID segment, and `pylf_v3_`/`pylf_v4_` 80-byte shapes.** The gateway parser admits the wider body class and one scanner fixture shows v3/v4, but no provider source issues them; unclaimed.

## Open questions

1. Q7 (open, non-blocking): may a narrowing policy floor serve as the T1 floor when no alphabet is narrowed? Recommendation yes; if refused the floor falls to `{1,}` and the sub-floor placeholder controls would need review.
2. Does the provider scrubber's posture (redact the bare `pylf_v\d+_` prefix) argue for a floor below 20? The benchmark claims nothing under the floor either way.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1106 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; contract, seeded corpus and twins authored from the handoff (583f); the floor is the Q7 policy.
