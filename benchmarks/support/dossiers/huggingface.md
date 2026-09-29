---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: huggingface
families:
  - id: huggingface:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://huggingface.co/docs/huggingface.js/hub/modules
        - https://huggingface.co/.well-known/openapi.json
      issues:
        - redact-secret/redact-secret#654
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/654/README.md
      researchedAt: 2026-09-23
    blockedBy: "T1 is a maintainer ruling on an SDK-reference type annotation (prefix) and an OpenAPI example (length 34); the alphabet is not provider-stated and api_org_ has no current source."
---

# Hugging Face

Hugging Face issues user access tokens (`hf_` prefix) from account settings; organization tokens (`api_org_`) are legacy. Provider documentation:
the [`@huggingface/hub` SDK reference](https://huggingface.co/docs/huggingface.js/hub/modules) and the Hub OpenAPI spec at `/.well-known/openapi.json`.

## Families

### `huggingface:api-token` — API token

- **Shape:** `hf_` then 34 characters. Core accepts `[A-Za-z0-9]`; every observed sample and letters-only tool regex is narrower, and no source says digits never occur. `hf_oauth_…` and `hf_jwt_…` are other documented `hf_` tokens, so a later `_` in a body does not prove it is not Hugging Face.
- **Sources:** prefix: the SDK reference types `AccessToken` as `hf_${string}` (a type annotation, not prose; accepted as T1 by maintainer ruling in the #575 record). Length: the `POST /api/credentials/revoke` example is `hf_` plus 34 placeholder characters; the schema says only `minLength` 1 and `maxLength` 200, so length is on example strength. Alphabet: T2 only; Hugging Face's own current code (hf-mcp-server, agent-manager) and a retired inference-playground validator use `hf_[A-Za-z0-9]{34}`, which is code, not documentation, and tools split on the alphabet ([#654](https://github.com/redact-secret/redact-secret/issues/654#issuecomment-5785640146)).
- **Issuance:** not attempted.
- **Collisions:** the `api_org_` variant has no current provider-domain source (a 2021 archived page shows a placeholder; the current SDK rejects org tokens at login), so it stays outside the T1 contract.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row `huggingface:api-token`); evidence [#654 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/654/README.md).

## Candidates that are not families yet

- **`api_org_` organization tokens.** Legacy variant kept in the detector but without a current source; see above.
- **`hf_oauth_` and `hf_jwt_` tokens.** Documented by the provider; no taxonomy entries.

## Open questions

1. Does provider code (current hf-mcp-server and agent-manager, and the retired inference-playground validator) count for the alphabet? #654 leaves that to the reviewer.
2. Does a current source for `api_org_` exist?

## Research log

- [redact-secret#654](https://github.com/redact-secret/redact-secret/issues/654) — T1 evidence: FOUND for `hf_` (SDK type) and length 34 (OpenAPI example); maintainer accepted both as T1 (recorded in the #575 record, closed 2026-09-23).
- [redact-secret#485](https://github.com/redact-secret/redact-secret/issues/485#issuecomment-5751080096) — adopted `api_org_` as a second prefix shape at T2 (2026-09-20); staff say organization tokens are deprecated.
- [redact-secret#575](https://github.com/redact-secret/redact-secret/issues/575) — Epic A second batch that moved this family to stable.
