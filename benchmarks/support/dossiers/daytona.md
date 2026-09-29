---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: daytona
families:
  - id: daytona:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/daytonaio/daytona/blob/01c502bb1f1ff8f2885d0cd490e043736083dca8/apps/api/src/common/utils/api-key.ts#L8-L18
        - https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/daytona.md
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#970
        - redact-secret/redact-secret-benchmarks#464
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/daytona.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Daytona

Daytona provisions sandboxes for AI agents. An API key (`DAYTONA_API_KEY`, `Authorization: Bearer`) creates and controls an organization's sandboxes; the same generator also mints region proxy, SSH-gateway and runner keys, which are lexically identical.

## Families

### `daytona:api-key` — API key (dtn_)

- **Shape:** prefix `dtn_`, then exactly 64 lowercase hex characters (68 in total); no separator or checksum.
- **Sources:** prefix and body T1 under ruling R1 and R9: the provider generator returns `dtn_` + 32 random bytes hex-encoded (public up to v0.190.0, 2026-06-23; the same inline form since 2025-04-28). Core development moved to a private codebase in June 2026, so the contract is dated. Every later public source (`daytona/clients` OpenAPI and CLI, helm-charts scripts, SDK 0.218.0, docs dump) is prefix-only and none contradicts it.
- **Issuance:** not attempted; R9 accepts the dated generator as T1 until a newer provider source contradicts it. An issuance check is optional confirmation.
- **Collisions:** without the prefix the body is SHA-256 hex (including Daytona's own stored key hash), so the prefix is load-bearing. `dtn_secret_<random>` Secrets placeholders and `dtn_artifact_` markers are not credentials.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row until the Beta.12 detector, redact-secret#970, is merged).
- **Open caveat:** T1 only as of v0.190.0 (2026-06-23); a post-release format change is an accepted false negative.

## Candidates that are not families yet

- **Self-provisioned runner keys.** Unprefixed 64 hex (`openssl rand -hex 32`); not attributable.
- **Legacy self-hosted keys.** Unprefixed base64 of a UUID string (48 bytes); no prefix.
- **`DAYTONA_JWT_TOKEN` and OAuth access tokens.** JWTs; the `jwt` detector keeps them.

## Open questions

1. Does the live cloud still issue `dtn_` + 64 lowercase hex? One issued-and-revoked key would move the contract's "as of" date to the issuance date.

## Research log

- redact-secret#860 — epic (open); [issuance-gate research and rulings R9–R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337); [final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret#970 — Beta.12 implementation issue (open; no detector code merges to `main` until 0.1.0-beta.11 is released).
- redact-secret-benchmarks#464 — Beta.12 contracts and synthetic corpus for the #860 issuance-research READY families. Corpus work only, no change to the research verdict.
