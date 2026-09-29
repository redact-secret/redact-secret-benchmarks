---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: cloudflare
families:
  - id: cloudflare:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developers.cloudflare.com/fundamentals/api/get-started/token-formats/
        - https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#373
        - redact-secret/redact-secret#566
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/566/README.md
      researchedAt: 2026-09-21
    blockedBy: The 8-character lowercase-hex checksum width and alphabet come from one tool; Cloudflare only says a checksum follows the 40-character body.
---

# Cloudflare

Cloudflare issues scannable API tokens in a documented format: a distinct prefix,
a 40-character body and a checksum. Older tokens (a 40-character alphanumeric
value and a 37 to 45 character hex global key) have no prefix and are not
distinguishable from ordinary opaque values.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `cloudflare:api-token` — Scannable API token

- **Shape:** prefix `cfut_`, a 40-character alphanumeric body, then an
  8-character lowercase-hex checksum, 53 characters in all. The provider says
  a checksum follows the body, so a bare `cfut_` plus 40 characters is
  malformed under this grammar. No checksum algorithm is computed or claimed.
- **Sources:** T1 for the prefix, the body length and the existence of a
  checksum: the token-formats page says every prefixed token has a distinct
  prefix followed by 40 characters and a checksum, and the create-token page
  documents `cfut_` as the scannable format. Width and alphabet of the checksum
  come from trufflehog's Cloudflare v2 detector, one tool; gitleaks has no
  `cfut_` rule. #566 re-fetched the token-formats page on 2026-09-21 (last
  updated 2026-04-20) and found no published width or alphabet.
- **Issuance:** not attempted.
- **Collisions:** `cfat_` (account-owned token) and `cfk_` (global key) share the
  same format cell and are separate credentials, see below. The legacy
  unprefixed formats are recorded as an evidence-based exclusion.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`cfat_` account token.** Documented on the account-owned tokens page with the
  same `[40 characters][checksum]` cell; trufflehog's rule matches both `cfut_`
  and `cfat_`. Adopted alongside `cfut_` under #481; no taxonomy entry exists.
- **`cfk_` scannable global key.** Provider-documented to exist with the same
  format cell, but no tool corroborates its checksum shape. #481 split it into
  #486, which re-checked every source and was closed as won't-fix: `cfk_` stays unsupported until Cloudflare states the checksum shape or a tool ships a rule ([comment](https://github.com/redact-secret/redact-secret/issues/486#issuecomment-5750665630)).
- **Legacy unprefixed token and 37 to 45 character hex global key.** Excluded as
  indistinguishable from opaque values.

## Open questions

1. **Checksum shape.** Are the 8 checksum characters always lowercase hex? One
   issued token would settle it, and would also settle `cfat_`.
2. **`cfk_` grammar.** Needs a source for its checksum width and alphabet before
   it can be a family.
3. **Checksum-less `cfut_`.** #566 found no provider text that supports a
   40-character body without a checksum; the misses reported in #408 came from
   benchmark fixture bodies, not a provider format.

## Research log

- redact-secret#367 (2026-09-17) — froze the `cfut_` contract as T1 with the
  checksum recorded as a single-tool support-policy choice.
- redact-secret#373 (2026-09-18) — implemented the suffix-structure validation
  against that contract.
- redact-secret#408 (2026-09-18) — release-candidate triage of the shape-1
  misses; traced to the benchmark fixture generator.
- redact-secret#481 and #486 (2026-09-20) — adopted `cfat_`, and closed `cfk_`
  as won't-fix (unsupported) for lack of a checksum corroboration.
- redact-secret#566 (2026-09-21) — re-fetched the provider pages and found no
  evidence that supports widening the grammar; the `cfut_` freeze stands.
