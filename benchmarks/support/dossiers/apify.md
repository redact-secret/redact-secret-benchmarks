---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: apify
families:
  - id: apify:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/apify/awesome-skills/blob/4ba9177da8147607eaebea8022ea6f14b212a8cd/scripts/lint_references.py
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#916
        - redact-secret/redact-secret-benchmarks#436
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/apify.md
      researchedAt: 2026-09-28
    blockedBy: "Length is open-ended by construction (floor of 20); an issuance check could narrow it but nothing requires one. The upper cap of 128 is project policy."
---

# Apify

Apify is a web scraping and automation platform. Its API token (`APIFY_TOKEN`, sent as `Authorization: Bearer`) runs Actors on the account's compute budget and reads datasets, key-value stores and stored integration secrets. Personal, organization and scoped tokens share one prefix. This dossier records the #860 research for the API token only.

## Families

### `apify:api-token` — API token (apify_api_)

- **Shape:** prefix `apify_api_`, then alphanumerics, at least 20, no separators or checksum. No provider source states an exact length; the only observed width is 36 (trufflehog rule, T2). The 128 upper bound in the handoff is project policy for a bounded run, not a provider fact.
- **Sources:** prefix T1 from the docs placeholders (ruling R4: a placeholder establishes the prefix only). Alphabet `[A-Za-z0-9]` and the floor of 20 are T1 from the provider's own leak linter in `apify/awesome-skills`, checked for provider authorship on 2026-09-28 (R2). trufflehog's rule (exact 36, a wider class) is T2 and was not used to narrow the grammar.
- **Issuance:** not attempted. An optional structure-only check (one personal, one organization, one scoped token) could show whether 36 is uniform.
- **Collisions:** `apify_ui_` Console session tokens are a documented sibling with a T1 prefix (R6) but no length or alphabet source. Placeholders such as a prefix followed by a word break the alphanumeric run below 20 characters.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); handoff linked in the frontmatter.

## Candidates that are not families yet

- **`apify_ui_` Console tokens.** Prefix T1 by a runtime `startsWith` branch in provider code (R6); no length or alphabet source. The handoff names a possible second finding type after an issuance check.
- **Actor Run, Integration and Webhook Dispatch API tokens.** GitHub scans for them; no shape is public.
- **Proxy password.** Fourteen alphanumerics, no prefix, from an OpenAPI example; not attributable.

## Open questions

1. Is the body always 36 characters across personal, organization and scoped tokens? A uniform result would allow an exact-width contract later (optional).
2. Can `apify_ui_` be given its own family? It needs a length and alphabet source.

## Research log

- redact-secret#860 — epic (open); [research table #13](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386571); rulings R2, R4 and R6 in the [rulings comment](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275) drive this family.
- redact-secret#916 — implementation issue for the detector (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret-benchmarks#436 — Beta.11 contracts and synthetic corpus for the #860 Tier B READY families; closed 2026-09-28. Corpus work only, no change to the research verdict.
