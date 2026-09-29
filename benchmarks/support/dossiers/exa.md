---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: exa
families:
  - id: exa:api-key
    research:
      verdict: not-found
      tier: T0
      sources: []
      issues:
        - redact-secret/redact-secret#787
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#868
        - redact-secret/redact-secret#866
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: No source states a prefix, length or alphabet for the secret; one issued key would show whether it is a UUID (checklist in #787).
---

# Exa

Exa (`exa.ai`, formerly Metaphor) issues API keys from
`dashboard.exa.ai/api-keys`, sent as `x-api-key` or `Authorization: Bearer`.
A Team Management API also issues "service keys". The hosted MCP server takes
the key as a `?exaApiKey=` query parameter, which its tracker flags as a leak
vector. Whether and how core detects a family is not recorded here.

## Families

### `exa:api-key` — API key (no evidenced shape)

- **Shape:** none established. The Team Management API documents the key
  `id`, `teamId` and `userId` as UUIDs, but the create response has no secret
  field and the docs do not say whether the secret equals the id. One weak
  code-search measurement found a UUID-shaped value in 1 of 10 assignments,
  and 0 of 15 in a second pass; that is not a distribution. A claimed `exa-`
  prefix came from an untraceable search summary and is contradicted by the
  provider pages.
- **Sources:** none. No provider page, staff statement, SDK code or scanner
  rule states a secret grammar. `exa-py` does no validation. No scanner has an
  Exa rule (tree and path checks; rule contents inside multi-rule files were
  not read). The Exa docs, including the
  [update key reference](https://exa.ai/docs/reference/team-management/update-api-key),
  document only the identifiers.
- **Issuance:** not attempted. The #787 checklist asks for total length,
  whether the secret matches the UUID layout, whether it differs from the key
  id, and whether a service key has the same shape.
- **Collisions:** every UUID in Exa responses and logs (key id, team id, user
  id, request ids) shares the possible shape, so a bare-UUID rule would be
  unusable. Placeholders `your-api-key` and `YOUR-EXA-API-KEY` are benign.
- **Current contract in core:** none. #868 did not land Exa; it stays with
  `generic-token`, and its SDK keyword-argument form is read by
  `generic-token` since #866. A positional `Exa("...")` stays out. See
  [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Keyword-gated provider keys (#868).

## Candidates that are not families yet

- **Service keys** (Team Management, "Service keys" tab): a second credential
  class with unknown shape.

## Open questions

1. **Secret grammar.** Is the secret a lowercase UUID? If so the only
   supportable rule is a keyword-anchored UUID rule, which `generic-token`
   already provides for env, JSON, YAML and header forms.
2. **Verdict wording.** #787 says "generic coverage sufficient", #868 says no
   shape is stated. This dossier records `not-found` (no shape established)
   rather than `rejected`; a maintainer may prefer the latter.
3. **Rule contents.** Kingfisher, betterleaks and osv-scalibr rule files were
   checked by name only, and benchmarks `detector-inventory.json` was not.
4. **Format drift.** No changelog entry on key format was found.

## Research log

- redact-secret#787 — discovery pass; disposition generic coverage sufficient,
  no distinct family (2026-09-27).
- redact-secret#868 — keyword-gated coverage; Exa did not land, with the
  reason recorded in the spec.
- redact-secret#866 — generic-token SDK-call-argument gap, measured for Exa.
- redact-secret#774 — Beta.10 epic close-out; `exa-api-key` unscored, no
  detector.
- redact-secret-benchmarks#384 — benchmarks counterpart; arrival family
  `exa-api-key` measures the keyword gate and SDK-call forms only.
