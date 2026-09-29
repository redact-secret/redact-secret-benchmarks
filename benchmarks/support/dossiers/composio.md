---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: composio
families:
  - id: composio:project-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/ComposioHQ/composio/tree/34484551843e575e79cca244d9fca3e4459f59e9
        - https://github.com/trufflesecurity/trufflehog/issues/5321
        - https://github.com/gitleaks/gitleaks/issues/2276
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#909
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/composio.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: composio:org-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/ComposioHQ/composio/tree/34484551843e575e79cca244d9fca3e4459f59e9
        - https://github.com/trufflesecurity/trufflehog/issues/5321
        - https://github.com/gitleaks/gitleaks/issues/2276
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#909
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/composio.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: composio:user-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/ComposioHQ/composio/tree/34484551843e575e79cca244d9fca3e4459f59e9
        - https://github.com/trufflesecurity/trufflehog/issues/5321
        - https://github.com/gitleaks/gitleaks/issues/2276
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#909
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/composio.md
      researchedAt: 2026-09-28
    blockedBy: "A provider CLI code comment shows a 20-byte body, a T2 source (R6) that conflicts with the staff-stated 43; an issuance check on one composio login key is kept as confirmation."
---

# Composio

Composio is an agent tool platform whose keys authorize tool calls against a user's connected third-party accounts. Three key kinds share one `_`-separated scheme and are distinguished by prefix: project (`ak_`, `x-api-key`), organization (`oak_`, `x-org-api-key`) and user (`uak_`, issued by `composio login`). The three taxonomy families map one to one onto these.

## Families

### `composio:project-api-key` — Project API key (ak_)

- **Shape:** prefix `ak_`, exactly 20 body characters from `[A-Za-z0-9_-]` (URL-safe nanoid), no checksum.
- **Sources:** T1. Width and alphabet from a dated staff statement (2026-09-17, Composio's Head of Security, on trufflehog#5321 and gitleaks#2276; ruling R3), plus the provider OpenAPI example (`ak_` + 20) and CLI redaction regexes (alphabet, R2). trufflehog PR 5322 carries the same widths and was still open on 2026-09-28.
- **Issuance:** optional confirmation only (checklist in the handoff).
- **Collisions:** `ak_` is short and its alphabet includes `_` and `-`, so a 20-character snake_case identifier fits; the handoff proposes a mixed-case post check (false-negative cost about 6e-5). `oak_` and `uak_` contain `ak_` but are excluded by the leading boundary. A bkend.ai `ak_` + 64 hex is another provider.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `composio:org-api-key` — Org API key (oak_)

- **Shape:** prefix `oak_`, exactly 20 body characters from `[A-Za-z0-9_-]`.
- **Sources:** T1, same staff statement and OpenAPI/CLI sources as above.
- **Issuance:** optional confirmation (one `oak_` key).
- **Collisions:** distinctive enough without the mixed-case guard; the handoff says applying it is harmless.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `composio:user-api-key` — User API key (uak_)

- **Shape:** prefix `uak_`, exactly 43 body characters from `[A-Za-z0-9_-]`.
- **Sources:** T1 for prefix (docs, SDK constant with an executing `startsWith` branch, R6) and for length and alphabet (the same staff statement). A CLI code comment showing `uak_` + 20 is T2 under R6 and does not override; the file is dated 2025-06 and may show an older short format.
- **Issuance:** the step-2 selection gated this shape on that conflict; the Tier A handoff lifted the gate under R6 and asked the maintainer to confirm. The issuance check (one `composio login` key, expect 43) stays as confirmation.
- **Collisions:** none beyond the shared `ak_` substring, handled by the leading boundary.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`ck_` Connect consumer key / scoped project key.** A secret, but no length or alphabet source exists.
- **`cak_` agent key.** Seen only as a mock placeholder; shape unknown.
- **`pr_` project ids and 12-byte org ids.** Non-secret identifiers.

## Open questions

1. Is the `uak_` body 43 characters on a key issued today? The maintainer was asked to [confirm or keep the gate](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534); no separate confirming comment exists, but #909 (merged, opened by the same account 84 seconds later) specifies `uak_` + 43 as READY per R6, and the later scheduling comments list no Composio gate. Only an issuance check remains.
2. Did an older `uak_` + 20 format ever exist? Would need a dated provider source.
3. `ck_` body length and alphabet, so it could become a family.

## Research log

- redact-secret#860 — epic (open); [research table #31](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386808); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534) (this family READY, `uak_` gate lifted under R6); [rulings R1, R3](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851), [rulings R2 to R8](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275).
- redact-secret#909 — implementation issue for the three keys (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
