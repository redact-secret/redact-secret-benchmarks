---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: pulumi
families:
  - id: pulumi:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://www.pulumi.com/docs/reference/cloud-rest-api/access-tokens/
      issues:
        - redact-secret/redact-secret#522
        - redact-secret/redact-secret-benchmarks#67
      evidence: null
      researchedAt: 2026-09-21
    blockedBy: null
  - id: pulumi:organization-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://www.pulumi.com/docs/reference/cloud-rest-api/access-tokens/
      issues:
        - redact-secret/redact-secret#522
        - redact-secret/redact-secret-benchmarks#67
      evidence: null
      researchedAt: 2026-09-21
    blockedBy: null
  - id: pulumi:team-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://www.pulumi.com/docs/reference/cloud-rest-api/access-tokens/
      issues:
        - redact-secret/redact-secret#522
        - redact-secret/redact-secret-benchmarks#67
      evidence: null
      researchedAt: 2026-09-21
    blockedBy: null
---

# Pulumi

Pulumi Cloud issues access tokens for individual users (personal), for an
organization, and for a team. Pulumi's Cloud REST API reference documents one
prefix for the token value and no kind-specific variant, so the three families
share a grammar and differ by issuance path.

Verdicts record research on the shape only. The tier is T1 for the prefix; the
body is a separate, weaker claim. Whether and how core detects a family is not
recorded here.

## Families

### `pulumi:personal-access-token` — Personal access token

- **Shape:** prefix `pul-` followed by exactly 40 lowercase hexadecimal
  characters.
- **Sources:** T1 for the prefix: the Cloud REST API access-token page states the
  token creation response includes "the tokenValue (prefixed with 'pul-')", and
  the personal-access-tokens sibling page repeats it. Neither page states a
  length or alphabet. The 40 lowercase-hex body comes from gitleaks 8.30.1
  (`pulumi-api-token`) and a second tool (pleno-dlp) that agree, plus one
  community article showing a 40-hex example per kind; the article is
  corroboration, not an independent third source.
- **Collisions:** none identified. The prefix is short (`pul-`), so bodies
  outside the 40-hex form (uppercase, other lengths) are outside this
  grammar.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
- **Open caveat:** Body length and alphabet (40 lowercase hex) rest on two tool rules, not on Pulumi text; one issued token would confirm it.

### `pulumi:organization-access-token` — Organization access token

- **Shape:** identical to the personal token.
- **Sources:** the same T1 prefix statement; the community article shows a
  separate 40-hex example for this kind. No source states a distinct grammar.
- **Open caveat:** Same as the personal token; no kind-specific prefix or body is documented, so identical grammar is an inference from the shared prefix statement.

### `pulumi:team-access-token` — Team access token

- **Shape:** identical to the personal token.
- **Sources:** the same T1 prefix statement; the community article shows a
  separate 40-hex example for this kind. No source states a distinct grammar.
- **Open caveat:** Same as the personal token; no kind-specific prefix or body is documented, so identical grammar is an inference from the shared prefix statement.

## Candidates that are not families yet

None found.

## Open questions

1. **Body grammar.** Is the body always exactly 40 lowercase hex, for all three
   kinds? Only tool rules and one article say so. Issuing one token per kind
   would settle it.
2. **Per-kind evidence.** The organization and team kinds are distinguished
   only by issuance path; no Pulumi page shows a per-kind example.
3. **No evidence file.** The decision record for #522 carries the research; no
   frozen evidence folder exists for it.

## Research log

- redact-secret#522 (2026-09-21) — froze the grammar as the documented prefix
  plus the tool-corroborated exact-length hex body for all three token kinds.
- redact-secret-benchmarks#67 (2026-09-21) — backfilled the benchmark contract
  as T1 with the prefix quote; the second tool is recorded in review prose
  only, not as a pinned corroboration.
