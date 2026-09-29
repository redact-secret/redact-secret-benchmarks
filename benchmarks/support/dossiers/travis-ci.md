---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: travis-ci
families:
  - id: travis-ci:api-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://developer.travis-ci.com/authentication
        - https://docs.travis-ci.com/user/triggering-builds
      issues:
        - redact-secret/redact-secret#523
        - redact-secret/redact-secret-benchmarks#259
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/523/README.md
      researchedAt: 2026-09-25
    blockedBy: Travis CI states no token length or alphabet; the 22-character shape and the travis keyword gate rest on two scanner rules. No provider-issued token has been observed.
---

# Travis CI

Travis CI issues an API token through the `travis token` CLI command and
accepts it in an `Authorization: token` header, as shown on its
[authentication](https://developer.travis-ci.com/authentication) page. The
family was chosen in #523, which ranked CI-provider credentials by lexical
evidence and picked Travis CI over CircleCI and Buildkite.

## Families

### `travis-ci:api-token` — API token

- **Shape:** 22 alphanumeric characters, recognized only on a line that
  contains `travis` (case-insensitive). The frozen grammar is the intersection
  of two scanner rules: gitleaks (`travis` keyword, then 22 of `[a-z0-9]` with
  case-insensitive matching) and trufflehog (`travis` prefix, then 22 of
  `[a-zA-Z0-9_]`). The underscore is left out of positives. The #523 contract
  adds precision guards: the run must mix letters and digits, must not be one
  repeated character, and is skipped under an identifier key (`_slug`, `_id`,
  `_number`, `_url`).
- **Sources:** the two provider pages show only a masked twelve-character
  placeholder in the header and state no length or alphabet, so the tier is T2
  (two-tool corroboration). No provider-documented prefix exists.
- **Issuance:** `travis token` against a Travis CI account. Not attempted.
- **Collisions:** Travis build, job and repository ids are numeric and commit
  SHAs are 40 hex, so identifiers on Travis lines do not fit the shape. A
  22-character mixed-case value under any non-identifier key on a Travis line is
  reported. About 2 percent of uniformly random 22-byte tokens have no digit and
  would be missed.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`travisci_api_token`, confidence-gated); frozen in the #523 evidence.

## Candidates that are not families yet

- **CircleCI and Buildkite.** Ranked second and third in #523 (one tool rule
  each, provider grammar not checked); each needs its own contract issue.
- **GitHub Actions.** No token grammar and no scanner rule; rejected as a
  candidate in #523.

## Open questions

1. Real length and alphabet of an issued Travis token (the `_` disagreement
   between gitleaks and trufflehog is unresolved).
2. #523's own acceptance boxes for benign controls and "no new false alarms"
   were left unticked at close.

## Research log

- redact-secret#523 — ranks Travis CI, CircleCI, Buildkite and GitHub Actions,
  freezes the Travis grammar (T2); closed 2026-09-25. Deferred from beta.6 on
  2026-09-21 because usage and lexical evidence pointed in opposite directions.
- redact-secret-benchmarks#259 — Beta.8 arrival contracts and arrival-24 fixtures for the Travis CI, Neon, Postman collection key and Mailgun triplet families (redact-secret#773); closed 2026-09-25.
