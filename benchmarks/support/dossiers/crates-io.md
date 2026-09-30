---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: crates-io
families:
  - id: crates-io:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/rust-lang/crates.io/blob/7b2475e26337856ab054844c9078bb23c11b2f19/crates/crates_io_database/src/utils/token.rs#L10-L91
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1031
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/crates-io.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: crates-io:trusted-publishing-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/rust-lang/crates.io/blob/f937ab051067e793ed647c7b587a5419db85949b/crates/crates_io_trustpub/src/access_token.rs#L21-L102
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1031
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/crates-io.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# crates.io

crates.io is the Rust package registry. An API token (`CARGO_REGISTRY_TOKEN`, `~/.cargo/credentials.toml`) publishes, yanks and changes owners of crates within its scopes; a trusted-publishing token is minted from a CI OIDC exchange and can publish for its short lifetime.

## Families

### `crates-io:api-token` — API token (cio)

- **Shape:** `cio` + exactly 32 `[A-Za-z0-9]` (35 in all).
- **Sources:** T1 under R1 from the server code; unprefixed tokens are no longer accepted.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** `cio` is a trigram: the exact body and both identifier boundaries carry the precision; a standalone random 35-byte value starting with `cio` is the accepted false positive.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1031, merged in redact-secret#1039 and is unreleased).

### `crates-io:trusted-publishing-token` — Trusted-publishing token (cio_tp_)

- **Shape:** `cio_tp_` + exactly 32 `[A-Za-z0-9]` (31 + one check character, 39 in all).
- **Sources:** T1 under R1 from the server code. The check character corroborates only and never rejects (policy; ruling Q1 open).
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** none; the API-token body excludes `_`, so a `cio_tp_` token never reads as an API token.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1031, merged in redact-secret#1039 and is unreleased).

## Open questions

1. Ruling Q1: should a failed `cio_tp_` check character ever become an intentional false negative?

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md) ranks 50 candidates, freezes ten handoffs and records a step-4 disposition for all 50 (merge commit `3785817`, 2026-09-30; the ten handoffs are unchanged since `4f220ea`, 2026-09-29).
- redact-secret#1031 — Beta.12 implementation issue (detector merged to `main` in redact-secret#1039, unreleased).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
