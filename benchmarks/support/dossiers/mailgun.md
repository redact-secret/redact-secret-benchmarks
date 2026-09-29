---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: mailgun
families:
  - id: mailgun:private-api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/account-management/get-v5-accounts-http_signing_key
        - https://documentation.mailgun.com/docs/mailgun/api-reference/openapi-final/tag/Account-Management/
      issues:
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret#701
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-25
    blockedBy: The key- + 32 shape is provider-shown only for the HTTP signing key. Three sources say the current private API key is a prefix-less 32-8-8 hex triplet, so key- may be the older shape. Needs one issued key.
  - id: mailgun:public-validation-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: mailgun:legacy-signing-key-triplet
    research:
      verdict: ready
      tier: T2
      sources: []
      issues:
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret#701
        - redact-secret/redact-secret-benchmarks#259
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-25
    blockedBy: No provider source shows the 32-8-8 shape and its role is unresolved (current private API key or superseded signing key); two scanner rules and three prose sources describe it. Needs one issued key.
---

# Mailgun

Mailgun authenticates its API with HTTP Basic auth under the user name `api`.
The provider's [authentication page](https://documentation.mailgun.com/docs/mailgun/api-reference/mg-auth)
states no format rule for the primary API key. The only key-shaped example in
the reviewed documentation is the account HTTP signing key response: `key-`
followed by 32 lowercase hex. Mailgun issues several key types and the docs do
not say whether they share a shape. The family was a Beta.7 stretch candidate
in #582.

## Families

### `mailgun:private-api-key` — Private API key and HTTP webhook signing key

- **Shape:** `key-` followed by 32 characters from `[a-z0-9]`. Mailgun's own PHP
  SDK test uses a signing key with letters past `f`, so the body is not
  hex-only. Case is outside the benchmark claim since 2026-09-24.
- **Sources:** T2. trufflehog (`key-` + 32 `[a-z0-9]`, no keyword), gitleaks
  (`key-` + 32 hex behind a `mailgun` keyword) and Nosey Parker agree. The one
  provider example is for the webhook signing key, so one detector covers both
  roles because the interface gives them one shape.
- **Issuance:** Mailgun help articles returned 403 in the #582 pass and were not
  read. Not attempted.
- **Collisions:** the public validation key (`pubkey-`) and the 8-8 hex key `id`
  shape shown in the docs. A 32-8-8 triplet (below) may be the current private
  key.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`mailgun_api_key`, confidence-gated on a `mailgun` keyword).

### `mailgun:public-validation-key` — Public validation key (pubkey-)

- **Sources:** none reviewed for a verdict. The taxonomy note calls it
  documented as public, and the empirical record says Mailgun's Python SDK still
  scrubs it from logs as a conservative choice. Left unresearched; see open
  questions.

### `mailgun:legacy-signing-key-triplet` — Prefix-less 32-8-8 hex key triplet

- **Shape:** dash-separated lowercase hex groups of 32, 8 and 8 characters,
  without a prefix. The taxonomy id says "legacy signing key", but three
  sources describe it as the newer private API key: a Mailgun-repo contributor
  (2019), customer reports (2018) and a trufflehog issue (2025). Both pinned
  peers match the shape. No issued key has been observed.
- **Sources:** T2 by scanner rules; no provider text. This family carries no
  frontmatter `sources` because the rule links reviewed are version tags, not
  permalinks.
- **Collisions:** an unrelated 32-8-8 hex value is not a credential; the shape is
  recognized only beside a `mailgun` keyword.
- **Current contract in core:** #701 made the product's `mailgun_api_key`
  detector also report this shape, inside the shared detector; see
  [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Mailgun sending or domain keys** and other key types. Mentioned by #701 as
  existing; no shape research.

## Open questions

1. Which shape does a freshly issued private API key have: `key-` + 32 or the
   32-8-8 triplet? Which does a fresh signing key have (#701 checklist)?
2. Is the triplet the current key, a superseded signing key, or both?
3. `mailgun:public-validation-key`: is `pubkey-` documented as public by
   Mailgun, and should the family be `rejected` as not a secret? The reviewed
   sources do not settle it.
4. Case sensitivity of the `key-` body.

## Research log

- redact-secret#582 — Beta.7 ranking; provider documentation silent on format;
  Mailgun broad-discovery pass linked from the evidence record (2026-09-23).
- redact-secret#701 — the triplet may be the current private API key while the
  matrix marked it unsupported; closed 2026-09-25.
- redact-secret-benchmarks#259 — Beta.8 arrival contracts and arrival-24 fixtures for the Travis CI, Neon, Postman collection key and Mailgun triplet families (redact-secret#773); closed 2026-09-25.
