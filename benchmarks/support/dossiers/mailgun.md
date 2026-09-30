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
    blockedBy: null
  - id: mailgun:public-validation-key
    research:
      verdict: rejected
      tier: null
      sources:
        - https://help.mailgun.com/hc/en-us/articles/360010523074-Email-Validations
        - https://help.mailgun.com/hc/en-us/articles/203380100-Where-can-I-find-my-API-keys-and-SMTP-credentials
        - https://github.com/mailgun/validator-demo/blob/2c0f9731d26c35ea9fd257979342fc77c5fd38e9/index.html
        - https://devcenter.heroku.com/articles/mailgun-validations
        - https://github.com/mailgun/mailgun-ruby/issues/145
        - https://github.com/mailgun/mailgun-python/blob/ce47f6bb7c9035d2c8070a9cf2c2e1a57eb5b40a/mailgun/filters.py
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/config/gitleaks.toml
        - https://docs.gitlab.com/user/application_security/dast/browser/checks/798.73/
      issues:
        - redact-secret/redact-secret#314
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/confirm-only.md
      researchedAt: 2026-09-29
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
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/confirm-only.md
      researchedAt: 2026-09-29
    blockedBy: null
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
- **Open caveat:** The key- + 32 shape is provider-shown only for the HTTP signing key. Three sources say the current private API key is a prefix-less 32-8-8 hex triplet, so key- may be the older shape. Needs one issued key.

### `mailgun:public-validation-key` — Public validation key (pubkey-)

Researched 2026-09-29 (broad pass; every source recorded, then classified). Verdict `rejected`: the provider documents this key as one for front-end use, which is the "documented as safe to expose" exclusion already in `docs/specs/taxonomy.md` (Stripe `pk_`, Supabase `sb_publishable_`).

- **What it is:** the account's "Verifications Public Key" (or "Public Validation Key"), shown on the dashboard's API Security page beside the HTTP webhook signing key and the private API keys. It authenticated the public email-validation endpoint.
- **Provider statements that it is public:**
  - Mailgun help center, "Email Validations" (read 2026-09-29): "The public endpoint is meant to be used within front-end applications (and is only available on version 3 of the Validations API). To protect the public API Key it has an initial monthly limit that can be adjusted." The same page describes a "Public Verification Limit" account setting and says the private endpoint is for back-end code.
  - Mailgun's own `validator-demo` repository (jQuery plugin, last commit 2019-02-06, pinned) puts the key in browser JavaScript ("replace this with your Mailgun public API key") and tells the reader to sign up "to receive your public API key".
  - Mailgun's validation guide as reproduced by Heroku's Dev Center (last updated 2018-08-23): "Remember to use your public Mailgun API key in publicly accessible code." A 2018 Mailgun-ruby issue quotes the same two-key description: public key "suitable for use in client-side web applications", private key for back ends.
  - Current Mailgun docs no longer show it: the validation API overview and the `mg-auth` page authenticate with `api:YOUR_API_KEY` only, and the v4 validation endpoint has no public variant. `POST /v1/keys/public` still regenerates it ("The account public key"), with no shape stated.
- **Shape:** never stated by Mailgun. The prefix `pubkey-` comes from mailgun-python's log filter (`(key-|pubkey-)[\w\-]+`, described as scrubbing "Mailgun private and public key patterns"), mailgun-ruby's recorded regenerate-key response (a `pubkey-` placeholder) and a 2018 customer report. `pubkey-` + 32 lowercase hex comes from gitleaks (`mailgun-pub-key`, behind a `mailgun` keyword) and about thirty tools that copy it or its ancestors (betterleaks, Checkmarx 2ms, semgrep-rules, PEASS-ng, gitGraber, ScoutSuite). trufflehog, Nosey Parker, CredSweeper and detect-secrets have no `pubkey-` rule. The #582 measurement found 17 `pubkey-` + 32 candidates in public code, 16 of them hex-only.
- **Counter-evidence, kept visible:** Mailgun's Python SDK and Ruby test suite still treat the value as sensitive to log (the Python README says "pubkeys" are scrubbed); the help center says exhausting the public verification limit disables the account, so an exposed key can cost the owner; GitLab's DAST check 798.73 rates a match High, calls the key deprecated and gives a rotation path. None of these says the key grants account access, and the two SDK behaviours are conservative log hygiene. The record does not settle whether a redactor should mask it; it settles that the provider does not present it as a secret.
- **Confirmed in #1012 (2026-09-29):** NOT-A-SECRET. Mailgun's validation docs (archived 2019-04-28) say "Do not use your Mailgun private API key on publicly accessible code. Instead, use your Mailgun public key"; the help center "Email Validations" page (updated 2026-05-17) calls the public endpoint one "meant to be used within front-end applications"; and "Where can I find my API keys" (updated 2025-08-12) lists the Verifications Public Key apart from the API keys. The product `mailgun-api-key` detector excludes `pubkey-` by construction.
- **Consequence:** no grammar is frozen for it. It is a public-by-design value that should stay benign in the benchmark (a `mailgun-api-key` public-id control already records it, and gitleaks 8.30.1's rule still flags it). The taxonomy row stays for now and is not edited here, because a taxonomy edit changes the digest recorded in `fixture-index.json`; removing it or reclassifying it is a separate change.

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
  The #1012 confirm-only pass records it OWNED-ELSEWHERE (`mailgun-api-key`, type `mailgun_api_key`): medium when `mailgun` appears on the same line, high under a Mailgun-named key. No new contract is proposed.
- **Open caveat:** No provider source shows the 32-8-8 shape and its role is unresolved (current private API key or superseded signing key); two scanner rules and three prose sources describe it. Needs one issued key.

## Candidates that are not families yet

- **Mailgun sending or domain keys** and other key types. Mentioned by #701 as
  existing; no shape research.

## Open questions

1. Which shape does a freshly issued private API key have: `key-` + 32 or the
   32-8-8 triplet? Which does a fresh signing key have (#701 checklist)?
2. Is the triplet the current key, a superseded signing key, or both?
3. Answered 2026-09-29: `mailgun:public-validation-key` is documented by Mailgun as a front-end key, so the verdict is `rejected`. Open follow-up: remove or reclassify the taxonomy row (see the family section).
4. Case sensitivity of the `key-` body.

## Research log

- redact-secret#1012 — 2026-09-29 confirm-only pass ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/confirm-only.md)):
  `mailgun:public-validation-key` NOT-A-SECRET; `mailgun:legacy-signing-key-triplet` OWNED-ELSEWHERE.
- redact-secret-benchmarks#473 — 2026-09-29 broad pass for `mailgun:public-validation-key`: Mailgun help center and docs, Mailgun-owned repositories, Heroku Dev Center, seven scanners plus GitLab DAST and the gitleaks lineage, Stack Overflow and Reddit (no relevant hits). Verdict `rejected`.
- redact-secret#582 — Beta.7 ranking; provider documentation silent on format;
  Mailgun broad-discovery pass linked from the evidence record (2026-09-23).
- redact-secret#701 — the triplet may be the current private API key while the
  matrix marked it unsupported; closed 2026-09-25.
- redact-secret-benchmarks#259 — Beta.8 arrival contracts and arrival-24 fixtures for the Travis CI, Neon, Postman collection key and Mailgun triplet families (redact-secret#773); closed 2026-09-25.
