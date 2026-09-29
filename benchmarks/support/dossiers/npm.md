---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: npm
families:
  - id: npm:granular-access-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
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

No family in this dossier has a recorded research verdict. Whether and how core detects a family is not recorded here.

## Families

### `npm:granular-access-token` — Granular access token

- **Shape:** 2021-09 format token with a Base62 CRC32 checksum, prefixed npm_.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `npm:legacy-token` — Legacy token

- **Shape:** Pre-2021 unprefixed UUID-format token.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded.

## Open questions

1. **Both families are unresearched.** Searched: core and benchmarks issue titles for npm, core `docs/specs`, evidence and decisions, benchmarks `docs/` and `benchmarks/support`. The detector issue (core #160) is an implementation record; the other npm issues are release-pipeline work.
2. **Lead, not a verdict.** The benchmarks contract for `npm-token` cites the GitHub changelog of 2021-09-23 (https://github.blog/changelog/2021-09-23-npm-has-a-new-access-token-format/) as T1 for the `npm_` prefix, the underscore delimiter and a six-character Base62 CRC32 checksum, with the 36-character body tool-corroborated (re-checked 2026-09-20, benchmarks#46). The checksum is not part of the lexical pattern. Decide whether that row counts as a research record for the granular token.
3. The legacy UUID-format token is described only by the same changelog as the predecessor; no source gives its grammar.

## Research log

No research issues. Related non-research issue: core #160.
