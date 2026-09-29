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
        - https://github.com/mongodb/openapi/blob/5e6f651422c9ac9efd2ad21eba8a4256c38af864/openapi/v2.yaml#L1781-L1798
        - https://github.com/mongodb/docs/blob/2fdb2535da7d5595a9974569f1e7b981b797cd45/content/voyageai/source/management/api-keys.txt#L119-L121
        - https://github.com/mongodb-labs/ai-ml-pipeline-testing/blob/dce1cd9ec156d602b7af040678bcb022bbbf1159/.evergreen/utils.sh#L134-L146
      issues:
        - redact-secret/redact-secret#785
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#1013
        - redact-secret/redact-secret-benchmarks#384
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/voyage-ai-api-key.md
      researchedAt: 2026-09-29
    blockedBy: Every 43-character body source traces to MongoDB. al- needs ruling Q-VO1 or Q-VO2, pa- needs Q-VO2 or one dashboard key; al-eu- needs one EU-scoped key in any case (checklists in redact-secret#1013).
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
  anywhere found). The provider says prefixes "encode the scope". Its
  "can't exceed 250 characters" is the limit on a key's **name**
  (`name: maxLength: 250` in the Atlas Admin API schema), not on the key; an
  earlier reading here took it as a key-length ceiling (corrected by
  redact-secret#1013). The candidate body is 43
  characters of `[A-Za-z0-9_-]` (46 in all for the unscoped forms), gated on
  a Voyage name, host or SDK context.
- **Sources:** T1 for both prefixes: the Python SDK routes `al-` keys to
  `https://ai.mongodb.com/v1`, and MongoDB's own pipeline tests (2026-09-11)
  state that dashboard keys begin `pa-` and Atlas keys begin `al-`; MongoDB's
  docs (2026-09-01) state `al-eu-` for EU-scoped keys. For the body,
  redact-secret#1013 found the Atlas Admin API OpenAPI example
  (`AiModelApiKeyResponse`, 2026-07-14): one full-length `al-` + 43
  alphanumeric value, with `maskedSecret` `al-` + `****` + 4. The betterleaks
  rule (PR #324, 2026-08-31) and Kingfisher's native rules (`pa-` 2025-12-05,
  `al-` 2026-05-18) were written by a MongoDB engineer who says so in the PR,
  so every body source is one MongoDB voice and the corroborated route fails
  for want of a third independent owner. Third-party code checks the `pa-`
  prefix only.
- **Pending rulings (redact-secret#1013):** Q-VO1 (is the Atlas Admin API
  example the `al-` grammar?) would make `al-` + 43 `[A-Za-z0-9_-]` T1. Q-VO2
  (is a dated scanner rule by provider staff who say so an R3 staff
  statement?) would make both `pa-` and `al-` + 43 T1. Neither covers
  `al-eu-`, whose length only an issued key can show.
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
2. **`pa-` provenance.** No provider page states it; MongoDB-owned test code
   does (#1013).
3. **GitGuardian.** Only page 1 of 7 of its detector list was read.
4. **MongoDB forum.** JavaScript-only, not read.
5. **Tier of `al-`.** Whether a routing prefix alone earns T1 was left to a
   maintainer; no ruling was found.

## Research log

- redact-secret#1013 — 2026-09-29 T1/T2 pass ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/voyage-ai-api-key.md)):
  STILL-BLOCKED; `al-` one ruling from T1; "250 characters" is the key-name
  limit.
- redact-secret#785 — discovery pass; disposition pending, no implementation
  (2026-09-27).
- redact-secret#774 — Beta.10 epic close-out; pending research, not
  implemented.
- redact-secret-benchmarks#384 — benchmarks counterpart; negative dispositions
  kept as durable evidence, no corpus.
