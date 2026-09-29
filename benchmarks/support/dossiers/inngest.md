---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: inngest
families:
  - id: inngest:signing-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/inngest/inngest/blob/dabb03f9e093672aaef2ee77eb7accdf0cd00ca3/pkg/authn/signing_key_strategy.go#L15-L25
        - https://www.inngest.com/docs/self-hosting
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#914
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/inngest.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Inngest

Inngest is a durable-function and event platform. A signing key (`INNGEST_SIGNING_KEY`, with the rotation fallback `INNGEST_SIGNING_KEY_FALLBACK`) authenticates the app to the REST API and signs requests between Inngest and the app's serve endpoint. The SDK also sends a derived form, `signkey-<env>-` plus the SHA-256 hex of the key bytes, as a bearer credential; it is lexically identical to the raw key and also authenticates.

## Families

### `inngest:signing-key` — Signing key (signkey-)

- **Shape:** prefix `signkey-prod-`, `signkey-test-` or `signkey-branch-`, then exactly 64 lowercase hex characters (77 or 79 in total).
- **Sources:** prefix T1 from provider code constants (`signkey-prod-` is also in a docs curl example). Hex alphabet T1 from provider code (hex decode, "must be hex string") and the self-hosting docs. The 64-character length is T1 by example under R5: the docs generation command produces 64 lowercase hex, and SDK test fixtures all use it. Re-checked 2026-09-28.
- **Issuance:** not attempted.
- **Collisions:** the self-hosted bare hex key without a prefix is a digest shape and not attributable. Other labels the SDK regex would admit are not provider constants.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Event key (`INNGEST_EVENT_KEY`).** No shape documented; self-hosted event keys are arbitrary strings.
- **Self-hosted bare hex signing key.** Not lexically attributable.

## Open questions

1. Are there environment labels beyond `prod`, `test` and `branch`? A future label is an accepted gap.
2. `INNGEST_SIGNING_KEY=` by name only reads medium in the coverage probe because `signing_key` is ambiguous in generic vocabulary; that is a generic-detection question, not a family question.

## Research log

- redact-secret#860 — epic (open); [research table #50](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852387196); [Tier B re-rank](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871765611) (READY); [rulings R5](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275).
- redact-secret#914 — implementation issue (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
