---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: together
families:
  - id: together:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.together.ai/docs/api-keys-authentication
        - https://github.com/betterleaks/betterleaks/blob/6cf4f1a29160b68be7c6390599b9b773234e5a43/cmd/generate/config/rules/togetherai.go
        - https://github.com/mongodb/kingfisher/blob/82d050530cdef9af070b8f9a75701c9c27a948c3/crates/kingfisher-rules/data/rules/togetherai.yml#L8
        - https://github.com/Samsung/CredSweeper/blob/f21ab2f2553eea288a72273b9658cd297ab1d11f/credsweeper/rules/config.yaml#L1814-L1827
        - https://github.com/togethercomputer/together-py/blob/9c9c34e47686344b996eaf19a7c470f72dcdecd6/src/together/lib/cli/_track_cli.py#L205
      issues:
        - redact-secret/redact-secret#783
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#867
        - redact-secret/redact-secret#1013
        - redact-secret/redact-secret-benchmarks#384
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/together-api-key.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Together AI

Together AI issues API keys from a project's API keys page
(`api.together.ai/settings/api-keys`), shown once, sent as
`Authorization: Bearer`, with an optional expiration date. Current keys are
project-scoped. The provider docs also state that a population of deprecated
"legacy" keys exists; those cannot be scoped or revoked, only regenerated.
Provider documentation: [API keys and authentication](https://docs.together.ai/docs/api-keys-authentication).
Whether and how core detects a family is not recorded here.

## Families

### `together:api-key` — Project API key (tgp_v1_)

Taxonomy id `together:api-key` is the research name `together-ai:api-key`
(#783, epic #774); the core spec uses `together-ai:api-key`. It is the same
credential: the current project-scoped key. The arrival id `together-api-key`
was renamed to the detector id `together-ai-api-key`.

- **Shape:** prefix `tgp_v1_` followed by 43 characters of `[A-Za-z0-9_-]`
  (50 in all), lowercase prefix, with identifier boundaries on both sides.
  A `tgp_v2_` prefix is only a scanner negative; no source says a v2 exists.
  Recognised bare or in any context.
- **Sources:** T2. No provider page or staff statement states the prefix,
  length or alphabet; the docs establish only issuance, the
  `TOGETHER_API_KEY` variable and the legacy population. The exact width
  rests on three peer rules from three owners: betterleaks; Kingfisher's
  native rule, added 2025-08-27 and replaced by a betterleaks alias only on
  2026-08-21, so its own lineage (the earlier "Kingfisher only aliases it" was
  wrong; corrected by redact-secret#1013); and CredSweeper (2026-05-11). Four
  full-length samples from a public code search agree (#783). Together's own
  CLI redactor in together-py (2026-04-27) confirms the `tgp_` prefix and a
  `[A-Za-z0-9_-]` body with no length. No pinned scanner has a Together rule.
- **Pending ruling Q-TG (redact-secret#1013):** must the second non-summary
  class corroborate the exact width, or is prefix + alphabet from provider
  code enough when three peer owners agree on it? Until ruled, together-py is
  not counted and the ledger reads 4 references, 4 owners, 1 class; a "yes"
  makes the family READY-T2, a "no" leaves one issued project key (prefix
  `tgp_v1_`, total 50, `_` or `-` in the body) as the only way through.
- **Issuance:** not attempted. The #783 checklist covers prefix, total length
  (expected 50), alphabet, project and expiry variants, and the legacy key.
- **Collisions:** `tgp` appears only in unrelated project names. The
  `TOGETHER_BASE_URL` variable, model names and 64-hex digests are benign. A
  pleno-dlp rule for a bare 64-hex Together key is a sibling shape, not a
  corroboration of this one.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Together AI and Tavily (#867). Legacy keys are not claimed.
- **Open caveat:** No provider source states the length; three peer lineages and four samples back it, provider code backs prefix and alphabet only. Corroboration 4/4/1 against the 3/3/2 needed until Q-TG is ruled; otherwise one issued project key (checklist in #783).

## Candidates that are not families yet

- **Legacy Together keys:** format undocumented; a common belief of 64 hex
  characters was searched for and found in no source except the pleno-dlp
  rule, so it is not recorded as a grammar.

## Open questions

1. **Legacy format.** What does a deprecated key look like, and how many
   accounts still hold one?
2. **Version drift.** Does the `v1` segment imply later versions?
3. **Length stability.** Is 43 fixed? The 26 and 31 character bodies seen in
   code search are unexplained and were not widened for.
4. **Corroboration.** The benchmarks ledger holds this family `provisional`
   at 2/2/1 against 3/3/2 required; a fresh 2026-09-27 pass found no new source.
5. **Reddit and Stack Overflow.** Domain-filtered searches were blocked.

## Research log

- redact-secret#1013 — 2026-09-29 T1/T2 pass ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/together-api-key.md)):
  READY-T2 conditional on Q-TG; Kingfisher lineage corrected.
- redact-secret#783 — discovery pass; disposition distinct family, T2,
  pending hands-on corroboration.
- redact-secret#867 — implementation for Together AI and Tavily.
- redact-secret#774 — Beta.10 epic close-out; provisional T2.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384d.ts`); redact-secret-benchmarks#177 defines the
  empirical path to `stable`.
