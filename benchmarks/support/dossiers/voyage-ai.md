---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: voyage-ai
families:
  - id: voyage-ai:api-key
    research:
      verdict: issuance-gated
      tier: T2
      sources:
        - https://www.mongodb.com/docs/voyageai/management/api-keys/
        - https://github.com/voyage-ai/voyageai-python/blob/cf6b295b691f4923946cd13fd8c2efdd9344d74a/voyageai/util.py
        - https://github.com/betterleaks/betterleaks/blob/2bc07526bd83d8402bed0f7991c4d3e60f345af3/cmd/generate/config/rules/voyageai.go
      issues:
        - redact-secret/redact-secret#785
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: Only the al- Atlas routing prefix has provider evidence; pa- and the 43-character body rest on one scanner rule with no cited origin. Needs one standalone and one Atlas key measured (checklist in #785).
---

# Voyage AI

Voyage AI (now "Voyage AI by MongoDB") has two issuers. The standalone
dashboard (`dash.voyageai.com`) issues keys for `api.voyageai.com`. MongoDB
Atlas issues "model API keys" for `ai.mongodb.com` and regional endpoints.
Both send `Authorization: Bearer` and the SDK reads `VOYAGE_API_KEY`.
Provider documentation: [MongoDB model API keys](https://www.mongodb.com/docs/voyageai/management/api-keys/).
Whether and how core detects a family is not recorded here. The taxonomy
support status is `pending`.

## Families

### `voyage-ai:api-key` — API key (pa- or al-)

- **Shape:** standalone keys start `pa-`; Atlas keys start `al-`, with
  region-scoped variants (`al-eu-` is documented; `al-us-` is not stated
  anywhere found). The provider says prefixes "encode the scope" and that a
  model API key "can't exceed 250 characters". The candidate body is 43
  characters of `[A-Za-z0-9_-]` (46 in all for the unscoped forms), gated on
  a Voyage name, host or SDK context.
- **Sources:** T1 exists only for `al-` as an Atlas routing prefix: the Python
  SDK routes keys starting `al-` to `https://ai.mongodb.com/v1`. `pa-` is the
  SDK's implicit else branch and is stated only on community pages. The 43
  character body and alphabet come from one betterleaks rule (PR 324,
  2026-08-31) with an uncited origin; Kingfisher imports it. The candidate
  tier is T2, provisional; #785 judged T1 not supported for any body grammar.
- **Issuance:** not attempted. The #785 checklist covers one standalone key
  and one Atlas key: prefix, body length, `_` and `-`, region-scoped variants,
  masked list view and signup-issued keys.
- **Collisions:** `pa-` and `al-` are common two-letter prefixes (slugs,
  `al-` transliterations), and a 43-character base64url value matches a
  SHA-256 digest. Placeholders such as `pa-your-key-here` and model names like
  `voyage-3` are benign. Key ids and names are public.
- **Current contract in core:** none recorded; #785 concluded pending. Named
  assignment, Bearer, JSON, YAML and tool-call forms were measured as covered
  by generic paths, and the one-line SDK-call miss is a generic gap.
  See [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`al-us-` scoped keys:** implied by `al-eu-`, unsourced.
- **Legacy keys** issued at signup before the `pa-` prefix: undocumented.

## Open questions

1. **Body length and alphabet.** Is the body always 43, and per prefix or
   overall? A scoped `al-eu-` key cannot share the length of an unscoped one if
   the random part is constant.
2. **`pa-` provenance.** No provider page states it.
3. **GitGuardian.** Only page 1 of 7 of its detector list was read.
4. **MongoDB forum.** JavaScript-only, not read.
5. **Tier of `al-`.** Whether a routing prefix alone earns T1 was left to a
   maintainer; no ruling was found.

## Research log

- redact-secret#785 — discovery pass; disposition pending, no implementation
  (2026-09-27).
- redact-secret#774 — Beta.10 epic close-out; pending research, not
  implemented.
- redact-secret-benchmarks#384 — benchmarks counterpart; negative dispositions
  kept as durable evidence, no corpus.
