---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: npm
families:
  - id: npm:granular-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/
      issues:
        - redact-secret/redact-secret-benchmarks#46
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: npm:legacy-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# npm

npm issues granular access tokens in a format introduced in September 2021 (prefix `npm_`, a Base62 body with a CRC32 checksum). Earlier tokens were unprefixed UUID-format values.

`npm:granular-access-token` is `ready` at T1 on the shipped `npm-token` contract; `npm:legacy-token` has no contract and stays unresearched.

## Families

### `npm:granular-access-token` — Granular access token

- **Shape:** 2021-09 format token with a Base62 CRC32 checksum, prefixed npm_.
- **Sources:** T1 per the shipped `npm-token` contract in the benchmarks assessment: the GitHub changelog of 2021-09-23 documents the `npm_` prefix, the underscore delimiter and a six-character Base62 CRC32 checksum. The 36-character body is tool-corroborated. The checksum is not part of the lexical pattern. Re-checked 2026-09-20 in benchmarks#46 (PR #55).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `npm:legacy-token` — Legacy token

- **Shape:** Pre-2021 unprefixed UUID-format token.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded.

## Open questions

1. `npm:legacy-token` is unresearched: no shipped contract covers it, and the same changelog describes the pre-2021 unprefixed UUID-format token only as the predecessor.

## Research log

- redact-secret-benchmarks#46 (PR #55) — re-check of the changelog as the `npm-token` provider source (2026-09-20).
- Related non-research issue: core #160 (detector implementation).
