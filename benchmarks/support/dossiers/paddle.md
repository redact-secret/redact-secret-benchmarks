---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: paddle
families:
  - id: paddle:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.paddle.com/api-reference/about/api-keys
        - https://github.com/PaddleHQ/paddle-node-sdk/blob/651261beddfc65ba5f861729dca17044cbeffb5f/src/__tests__/mocks/notifications/api-key-created.mock.ts
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1033
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/paddle.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Paddle

Paddle is a merchant-of-record billing platform. A Paddle Billing API key (`PADDLE_API_KEY`, `Authorization: Bearer`) is a server-side credential; with full permissions it reads and changes customers, subscriptions, transactions, prices and adjustments (refunds and credits). Sandbox keys act on the sandbox only. Provider docs: <https://developer.paddle.com/api-reference/about/api-keys>.

## Families

### `paddle:api-key` — Billing API key (pdl_live_/pdl_sdbx_apikey_)

- **Shape:** `pdl_live_apikey_` or `pdl_sdbx_apikey_` + 26 `[a-z0-9]` + `_` + 22 `[A-Za-z0-9]` + `_` + 3 `[A-Za-z0-9]` (69 in all, five underscores).
- **Sources:** T1: the provider docs publish the regex and the total length.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** the `apikey_` + 26 key id is a non-secret identifier (Q5); legacy keys are 50 unprefixed `[a-z0-9]`.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1033, merged in redact-secret#1039 and is unreleased).

## Candidates that are not families yet

- **Legacy API keys (before 2025-05-06).** 50 lowercase alphanumerics, no prefix; generic context covers `PADDLE_API_KEY=`.
- **Paddle.js client-side tokens and Paddle Classic vendor auth codes.** A frontend credential by design, and another product.

## Open questions

1. None open.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md) ranks 50 candidates, freezes ten handoffs and records a step-4 disposition for all 50 (merge commit `3785817`, 2026-09-30; the ten handoffs are unchanged since `4f220ea`, 2026-09-29).
- redact-secret#1033 — Beta.12 implementation issue (detector merged to `main` in redact-secret#1039, unreleased).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
