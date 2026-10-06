---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: unkey
families:
  - id: unkey:root-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/unkeyed/unkey/blob/20378e892035dad8ca3590765651cd25c964f78e/internal/services/keys/create_v1.go
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1104
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/unkey.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Unkey

Unkey is an API key management service; a root key manages workspaces and APIs. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/unkey.md>.

## Families

### `unkey:root-key` — see the taxonomy row

- **Shape:** `unkey_` + 8 + `unkeyv1` + 42 base58 (63 in all; the last 6 are a CRC-32C) or the dashboard form `unkey_3Z` + 22 base58 (30 in all).
- **Sources:** T1 (RFC 0017, the version 1 generator and the root-key handler test, R1 and R9; the dashboard form from generator code, width and lead derived). READY for the two current root-key grammars. The corpus (`beta8-583d`) builds a real CRC-32C into every version 1 positive; the checksum-mismatch twin is unclaimed because a post-check is ruling Q1 (open). gitleaks 8.30.1 and trufflehog 3.97.4 have no Unkey rule.
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** customer-prefixed version 1 keys (`<prefix>_…unkeyv1…`, ruling Q10, unclaimed), the deprecated Go `unkey_` + 21 or 22 form, `key_` and `api_` identifiers and `unkey_<word>` names.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1104, unreleased). The benchmark contract is `benchmarks/lib/beta8/583d.ts` (T1, lexical grammar; the checksum post-check is policy, Q1) with the corpus `fixtures/generated/beta8/583d.mjs`.

## Candidates that are not families yet

## Open questions

1. Q1 (open): may a checksum post-check reject a lexically valid version 1 key whose CRC-32C does not verify? Until then the mismatch twin is unclaimed.
2. Q10 (open): are customer-prefixed version 1 keys (`unkey_api_key`) in scope? Unclaimed meanwhile.
3. Older root keys (before 2023-11) and the Go 21 to 22 form have no cited grammar; a maintainer-issued or dated-source check would settle them.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1104 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; contract and corpus authored in slice 583d (detector `unkey-root-key`).
