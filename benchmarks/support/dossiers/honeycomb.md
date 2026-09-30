---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: honeycomb
families:
  - id: honeycomb:ingest-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.honeycomb.io/api/authentication
        - https://github.com/honeycombio/libhoney-py/blob/11b59417c1df1d97384dc5e870f2ea462da02b80/libhoney/client.py#L11-L18
        - https://github.com/honeycombio/libhoney-go/blob/02e9dbf361012fafbe8698f429b65630500dc10a/libhoney.go#L74-L178
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1034
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/honeycomb.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Honeycomb

Honeycomb is an observability platform. An ingest key (`HONEYCOMB_API_KEY`, `X-Honeycomb-Team`, OpenTelemetry exporter headers) sends telemetry into an environment; a management key manages environments and API keys for the team. Provider docs: <https://docs.honeycomb.io/api/authentication>.

## Families

### `honeycomb:ingest-key` — Ingest key (hc?ik_, hc?ic_)

- **Shape:** `hc` + one `[a-z]` + `ik_` (environment) or `ic_` (classic) + exactly 58 `[a-z0-9]` (64 in all: the key id and secret concatenated).
- **Sources:** T1: prefix and concatenation from the docs; length from the docs placeholder, the libhoney-go 64-byte gate and fixtures (R5); the classic regex in two provider SDKs (R1).
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** key ids (`hc?ik_` + 26), configuration-key and environment ids are non-secret identifiers.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row on `main` until the Beta.12 detector, redact-secret#1034, is merged).

## Candidates that are not families yet

- **Management key (`hc?mk_` + 26 + `:` + 32).** ISSUANCE-GATED: the alphabet of both segments is unresolved (the docs placeholder is digits only and no fixture exists); `honeycomb_management_key` waits for a maintainer-issued key.
- **Configuration keys (22 unprefixed alphanumerics) and classic keys (32 hex).** No distinctive shape; generic context.

## Open questions

1. What are the alphabet classes of the management key's 26- and 32-byte segments? One issued and revoked key, structure only, would settle it.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/README.md) ranks 50 candidates and freezes ten handoffs at `4f220ea`, 2026-09-29.
- redact-secret#1034 — Beta.12 implementation issue (open; the detector is on an unmerged product branch).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
