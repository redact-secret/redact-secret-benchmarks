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
      issues:
        - redact-secret/redact-secret#783
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#867
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: No provider source states prefix, length or alphabet; one scanner lineage and four samples back it. Needs one issued project key (checklist in #783); corroboration 2/2/1 against the 3/3/2 needed.
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
- **Sources:** T2. No provider page, staff statement or SDK code states the
  prefix, length or alphabet; the docs establish only issuance, the
  `TOGETHER_API_KEY` variable and the legacy population. The shape rests on
  one betterleaks rule (Kingfisher only aliases it, so one lineage), one blog
  post, and four full-length samples from the first page of a public code
  search. No pinned scanner has a Together rule.
- **Issuance:** not attempted. The #783 checklist covers prefix, total length
  (expected 50), alphabet, project and expiry variants, and the legacy key.
- **Collisions:** `tgp` appears only in unrelated project names. The
  `TOGETHER_BASE_URL` variable, model names and 64-hex digests are benign. A
  pleno-dlp rule for a bare 64-hex Together key is a sibling shape, not a
  corroboration of this one.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Together AI and Tavily (#867). Legacy keys are not claimed.

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

- redact-secret#783 — discovery pass; disposition distinct family, T2,
  pending hands-on corroboration.
- redact-secret#867 — implementation for Together AI and Tavily.
- redact-secret#774 — Beta.10 epic close-out; provisional T2.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384d.ts`); redact-secret-benchmarks#177 defines the
  empirical path to `stable`.
