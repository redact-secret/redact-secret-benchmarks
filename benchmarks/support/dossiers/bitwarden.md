---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: bitwarden
families:
  - id: bitwarden:secrets-manager-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/bitwarden/sdk-internal/blob/824c1cf06636daa2778d53435cdbf354ab58eff2/crates/bitwarden-core/src/auth/access_token.rs#L47-L85
        - https://github.com/bitwarden/server/blob/bb3a9daf9883353fa942a17ba5d8c2b1f642960b/bitwarden_license/src/Commercial.Core/SecretsManager/Commands/AccessTokens/CreateAccessTokenCommand.cs#L14-L29
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1019
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/bitwarden.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Bitwarden

Bitwarden Secrets Manager stores secrets for machine accounts. A machine-account access token (`BWS_ACCESS_TOKEN`, used by the `bws` CLI, the SDKs and CI integrations) carries both the client secret and the symmetric key that decrypts the secrets, so a leaked token exposes every secret the account can read. Provider docs: <https://bitwarden.com/help/access-tokens/>.

## Families

### `bitwarden:secrets-manager-access-token` — Secrets Manager access token

- **Shape:** `0.` + a UUID + `.` + exactly 30 `[A-Za-z0-9]` + `:` + 22 standard Base64 + `==` (94 in all).
- **Sources:** every part T1 under R1: the provider SDK parser (version, UUID, a key that decodes to 16 bytes), the server generator (30 alphanumerics) and the docs example (segment lengths).
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** none known; a semantic version followed by a UUID and Password Manager `user.<uuid>` client ids are benign siblings. An unpadded key is parser-accepted but never issued, so it is outside the family.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row on `main` until the Beta.12 detector, redact-secret#1019, is merged).

## Candidates that are not families yet

- **Password Manager personal and organization API keys.** `user.`/`organization.` + UUID client id with a 30-character secret; no distinctive token grammar, generic context only.

## Open questions

1. Does a future token version (other than `0`) change the layout? It would be a grammar change to re-research.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/README.md) ranks 50 candidates and freezes ten handoffs at `4f220ea`, 2026-09-29.
- redact-secret#1019 — Beta.12 implementation issue (open; the detector is on an unmerged product branch).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
