---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: cerebras
families:
  - id: cerebras:inference-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/Cerebras/vscode-cerebras-chat/blob/e03602fa96f3ddfc8122ea2655bfa39424a5d157/src/provider.ts#L113
        - https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/cerebras.md
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#975
        - redact-secret/redact-secret-benchmarks#464
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/cerebras.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Cerebras

Cerebras hosts inference on its own hardware. An inference API key (`CEREBRAS_API_KEY`, `Authorization: Bearer`) calls the Cerebras Cloud API on the account's quota and billing. The Management API key for dedicated endpoints is a separate credential of unknown shape.

## Families

### `cerebras:inference-api-key` — Inference API key (csk-)

- **Shape:** prefix `csk-` (current) or `csk_` (the 2025-10 window, still accepted), then exactly 48 characters (52 in total). The body alphabet `[A-Za-z0-9_-]` is project policy under ruling R10, not a provider fact.
- **Sources:** length T1 under R1 (the provider VS Code extension validator rejects any key not starting `csk_` or `csk-` or not 52 long; introduced 2025-08-29, unchanged since) and both prefixes T1 under R3 (staff statements on 2025-10-23 and 2025-10-24; provider docs state "starts with `csk-`"). No provider source states the alphabet; tool rules say `[a-z0-9]` (tool-only, not adopted, R8).
- **Issuance:** not attempted; R10 lets project policy fill the alphabet as long as the fill is at least as wide as any provider-stated class.
- **Collisions:** the leading boundary excludes Pinecone `pcsk_` / `pcsk-` (the byte before `csk` is `p`); Pinecone keeps `pcsk_` with a 69- or 70-byte body, so no width overlaps.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row until the Beta.12 detector, redact-secret#975, is merged).
- **Open caveat:** the alphabet is policy (R10), so a tool that follows the `[a-z0-9]` rule lags on any uppercase, `_` or `-` body; a future length change would be a false negative.

## Candidates that are not families yet

- **Management API keys.** Shape unknown; not covered.

## Open questions

1. What alphabet does the provider actually issue? An issued sample would replace the policy fill with a T1 class.

## Research log

- redact-secret#860 — epic (open); [issuance-gate research and rulings R9–R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337); [final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret#975 — Beta.12 implementation issue (open; no detector code merges to `main` until 0.1.0-beta.11 is released).
- redact-secret-benchmarks#464 — Beta.12 contracts and synthetic corpus for the #860 issuance-research READY families. Corpus work only, no change to the research verdict.
