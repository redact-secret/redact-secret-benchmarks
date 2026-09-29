---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: firecrawl
families:
  - id: firecrawl:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/firecrawl/firecrawl/tree/f75a8d40b103129f56f947418bfa06a04a9ad5b0
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#908
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/firecrawl.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Firecrawl

Firecrawl is a web crawl and scrape API. An API key (`FIRECRAWL_API_KEY`, `Authorization: Bearer`) spends the team's credits and is commonly set in agent web tools and MCP servers.

## Families

### `firecrawl:api-key` — API key (fc-)

- **Shape:** prefix `fc-`, then exactly 32 lowercase hex characters (35 in total): a dashless UUIDv4, so hex character 13 is `4` and character 17 is one of `8 9 a b`. No separators after the prefix, no checksum.
- **Sources:** prefix T1 from provider docs and SDK/MCP code (`startsWith('fc-')`). Body T1 under R1 from provider server code: the key normalizer strips `fc-` and re-inserts dashes "based on the uuidv4 format", the `api_keys.key` column is a Postgres random UUID default, and the auth controller rejects anything failing a UUID check. Re-checked 2026-09-28.
- **Issuance:** not attempted; optional check of one dashboard key.
- **Collisions:** `fc-` is short and appears in CSS and calendar class names (`fc-daygrid-day`), which fail the body. A bare dashed UUID is not attributable and stays out.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Legacy bare dashed UUID keys** (before 2024-04-16, still accepted by the server). Not attributable; generic context covers named assignments.
- **`fco_` OAuth access token** (opaque, introspected) and **`fcmcp_` MCP delegated credential** (HMAC, base64url, up to 2048): no fixed grammar.

## Open questions

1. Does the dashboard still show any unprefixed key? Part of the optional issuance checklist.
2. `fco_` and `fcmcp_` could be revisited if a grammar is published.

## Research log

- redact-secret#860 — epic (open); [research table #04](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386450); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534).
- redact-secret#908 — implementation issue (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
