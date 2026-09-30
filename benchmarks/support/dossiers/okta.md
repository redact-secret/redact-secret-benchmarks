---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: okta
families:
  - id: okta:api-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://developer.okta.com/docs/guides/create-an-api-token/main/
        - https://github.com/okta/okta-developer-docs/blob/ae696b9f70cd1bca21f640f4ad3bbdff461279ff/packages/%40okta/vuepress-site/docs/guides/oie-upgrade-api-sdk-to-oie-sdk/main/index.md
        - https://github.com/okta/okta-management-openapi-spec/blob/74fcd17fad54332caee96ebbb11fd7f203b03e4f/dist/current/management-dev-noEnums-minimal.yaml#L60548
        - https://github.com/okta/okta-developer-docs/blob/8aff3329cb8e651d2182ce6dcd5ebd303b42a690/packages/@okta/vuepress-site/books/api-security/api-keys/other-options/index.md#L18
      issues:
        - redact-secret/redact-secret#694
        - redact-secret/redact-secret#315
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/okta-api-token.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Okta

Okta issues Management API tokens from the Admin Console (Security, API, Tokens); the value is shown once and stored only as a hash. They are sent as `Authorization: SSWS <token>`. Provider documentation:
[Create an API token](https://developer.okta.com/docs/guides/create-an-api-token/main/) (shows the `SSWS` scheme and an elided example beginning `00`).

## Families

### `okta:api-token` — Management API token (SSWS)

- **Shape:** literal `00` then 40 characters, 42 in total. Alphabet: TruffleHog and Nosey Parker use `[A-Za-z0-9_-]`; gitleaks and betterleaks also allow `=`. Of 52 distinct non-placeholder public candidates, 47 were 42 characters, none contained `=`, and `_` and `-` were both common. Okta's own migration guide shows an unelided value of `00` + 40 `[A-Za-z0-9]` (recorded in the benchmarks empirical observations, not in a core thread; the core threads show only the elided example).
- **Sources:** T2. Provider prose shows the `SSWS` scheme and the leading `00` only (no length, no alphabet), but Okta's own repositories hold three dated, distinct full-length examples, all `00` + 40 alphanumeric: the OIE-upgrade guide, the management OpenAPI spec (2025-01 to 2026-03) and an API-security book page (2019) (redact-secret#1013). A 2019 devforum answer says "always 42 characters" and gives `^00[a-zA-Z0-9\-\_]{40}$`; its author's staff status is not confirmed on the forum. Both 2023 items the benchmark ledger records come from one devforum thread (2023-09-21): an Okta team reply, "You should not assume a set structure for Okta's API tokens" (the same reply says there are no plans to change it), and a customer's `[A-Za-z0-9-]` reading whose own regex admits `_`. gitleaks' `=` comes from its generic `AlphaNumericExtended` helper (PR #1599), not from Okta evidence; no Okta example contains `=`. GitGuardian records the detector as `Prefixed: False`, which classifies its detector rather than the tokens. Okta does not appear in GitHub's secret-scanning partner list.
- **Pending ruling Q-OK (redact-secret#1013):** the corroborated route already clears; the family is blocked only by four unresolved contradictions. #1013 proposes all four as bounded (exclude `=`; freeze the currently issued shape with a re-review trigger; no fixture asserts `_`; exclude non-`00` shapes), with `_` optionally settled by accepting the 2019 answer as R3. The ledger carries those proposals on each contradiction but keeps them unresolved until the ruling.
- **Issuance:** UI only (the Okta API cannot create SSWS tokens); a free developer org works. The #694 hands-on checklist (total length, leading `00`, alphabet classes, header, checksum) has no recorded result.
- **Collisions:** `00` is not a distinctive prefix; a value is claimed beside the `SSWS` scheme or a same-line `okta` keyword. TruffleHog gates on an Okta tenant domain.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); detector added by [redact-secret#315](https://github.com/redact-secret/redact-secret/issues/315). No frozen evidence folder exists for #694.
- **Open caveat:** Okta states no grammar in prose and its 2023 staff answer says not to assume a structure; three provider examples agree on `00` + 40. READY-T2 once Q-OK accepts the four bounded dispositions; no issuance is required (an optional check could only close the `_` question).

## Candidates that are not families yet

- **Okta OAuth client id and secret** (TruffleHog added a detector 2026-09-23). Not researched here.

## Open questions

1. Can `=` appear in the body? Only gitleaks' generic helper admits it; no Okta source shows one. Unresolved in the ledger until ruling Q-OK.
2. Length and alphabet on a freshly issued token (checklist in #694).
3. #694 closed on 2026-09-24 without a close-out comment; the T2 status comes from the benchmarks corroboration decision, not from an issue verdict.

## Research log

- redact-secret#1013 — 2026-09-29 T1/T2 pass ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/okta-api-token.md)): READY-T2 once the four contradictions are recorded bounded (Q-OK); `=` and the 2023 thread corrected.
- [redact-secret#694](https://github.com/redact-secret/redact-secret/issues/694) — T1 hunt: broad-discovery pass 2026-09-23; every shape-stating source agrees on `00` + 40; no provider-domain grammar. Hands-on check not recorded.
- [redact-secret#582](https://github.com/redact-secret/redact-secret/issues/582#issuecomment-5799683784) — Beta.7 ranking put Okta in the committed set (T2, no provider source); the maintainer later said Okta stays medium/warn ([#702](https://github.com/redact-secret/redact-secret/issues/702#issuecomment-5823353741)).
- [redact-secret#315](https://github.com/redact-secret/redact-secret/issues/315) — added the Okta API token detector (beta.7).
