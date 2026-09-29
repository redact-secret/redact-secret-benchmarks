---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: postman
families:
  - id: postman:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://learning.postman.com/docs/developer/postman-api/authentication/
      issues:
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret#700
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-25
    blockedBy: null
  - id: postman:collection-access-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://learning.postman.com/docs/collaborating-in-postman/sharing/
        - https://learning.postman.com/api-docs/api-reference/collection-access-keys/get-collection-access-keys
        - https://gitlab.com/gitlab-org/security-products/secret-detection/secret-detection-rules/-/blob/e1c7e83815a7e55cc1514dd59d4e56459e39cbfb/rules/mit/postman/postman.toml
      issues:
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret#700
        - redact-secret/redact-secret-benchmarks#259
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-25
    blockedBy: null
---

# Postman

Postman issues two credential forms in the Beta.7 record. API keys are sent in
the `X-API-Key` header, per the provider's
[authentication page](https://learning.postman.com/docs/developer/postman-api/authentication/),
which states no prefix, length or example. Collection access keys are read-only
keys for one collection, shared through the collection URL's `access_key`
parameter. Postman was one of the four committed families in #582's ranking.

## Families

### `postman:api-key` — API key

- **Shape:** `PMAK-`, 24 lowercase hex characters, a literal `-`, then 34
  lowercase hex characters (59-character body, 64 in all).
- **Sources:** T2. gitleaks (`PMAK-` + 24 hex + `-` + 34 hex) and Nosey Parker
  agree on the structure; trufflehog corroborates only the prefix and a
  59-character body. Postman's own Insights Agent redaction config fixes the
  same structure, which is provider-owned code but not documentation. 31 of 33
  public-code candidates matched and none had a 35 to 36 character second
  segment; one unsourced proposal says 34 to 36. Uppercase hex is outside the
  benchmark claim.
- **Issuance:** Postman account settings; expiry is set when the key is
  created. Not attempted.
- **Collisions:** the Insights Agent config also scrubs a bare `PMAK-` + 24 hex,
  which is the id part of every full key, so the benchmark keeps that fragment
  as a near miss and not a credential. `PMAT-` is a separate credential.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`postman_api_key`, always redacted).
- **Open caveat:** Postman's docs state no PMAK- grammar (only the header). The 24 + 34 hex structure comes from scanners and Postman's own redaction config; no issued key has been measured.

### `postman:collection-access-key` — Collection access key

- **Shape:** `PMAT-` followed by 26 characters. Postman renders a masked key
  with a four-character tail and a 26-character count, valid 60 days after last
  use, and states no alphabet.
- **Sources:** T2. The uppercase `[A-Z0-9]` body comes from GitLab's secret
  detection rule alone (pinned above); the product accepts either case.
  GitHub's partner list has `postman_collection_key` beside `postman_api_key`.
- **Issuance:** collection sharing in Postman, or the collection access keys
  API. Not attempted.
- **Collisions:** the `access_key` query parameter of a collection URL is
  where the value appears. `PMAK-` keys are distinct.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`postman_collection_access_key`, always redacted). #700 asked whether `PMAT-`
  was its own family or an unsupported form; it is now a registry detector.
- **Open caveat:** The PMAT- prefix and 26-character count are shown masked in provider docs; the uppercase alphanumeric body comes from GitLab's rule alone. No issued key observed.

## Open questions

1. Does the `PMAK-` second segment ever differ from 34 characters, and can hex
   be uppercase? No issued key has been measured.
2. Is the `PMAT-` alphabet always uppercase?
3. Do other Postman credential forms exist? The Beta.7 module doc said none is
   documented.

## Research log

- redact-secret#582 — Beta.7 ranking; provider documentation silent on format
  (2026-09-23), Postman broad-discovery pass linked from the evidence record.
- redact-secret#700 — found the `PMAT-` collection access key outside the
  `PMAK-` grammar; closed 2026-09-25.
- redact-secret-benchmarks#259 — Beta.8 arrival contracts and arrival-24 fixtures for the Travis CI, Neon, Postman collection key and Mailgun triplet families (redact-secret#773); closed 2026-09-25.
