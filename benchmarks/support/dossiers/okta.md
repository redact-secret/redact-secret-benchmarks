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
      issues:
        - redact-secret/redact-secret#694
        - redact-secret/redact-secret#315
      evidence: null
      researchedAt: 2026-09-24
    blockedBy: "Okta documents no grammar and its 2023 staff answer says not to assume a structure; tools disagree on = in the body and no issued token has been measured."
---

# Okta

Okta issues Management API tokens from the Admin Console (Security, API, Tokens); the value is shown once and stored only as a hash. They are sent as `Authorization: SSWS <token>`. Provider documentation:
[Create an API token](https://developer.okta.com/docs/guides/create-an-api-token/main/) (shows the `SSWS` scheme and an elided example beginning `00`).

## Families

### `okta:api-token` — Management API token (SSWS)

- **Shape:** literal `00` then 40 characters, 42 in total. Alphabet: TruffleHog and Nosey Parker use `[A-Za-z0-9_-]`; gitleaks and betterleaks also allow `=`. Of 52 distinct non-placeholder public candidates, 47 were 42 characters, none contained `=`, and `_` and `-` were both common. Okta's own migration guide shows an unelided value of `00` + 40 `[A-Za-z0-9]` (recorded in the benchmarks empirical observations, not in a core thread; the core threads show only the elided example).
- **Sources:** T2. Provider docs show the `SSWS` scheme and the leading `00` only (no length, no alphabet); one 2019 community answer says "always 42"; a 2023 Okta team answer says "You should not assume a set structure for Okta's API tokens". GitGuardian records the detector as `Prefixed: False`, so `00` is not treated as a prefix. Okta does not appear in GitHub's secret-scanning partner list.
- **Issuance:** UI only (the Okta API cannot create SSWS tokens); a free developer org works. The #694 hands-on checklist (total length, leading `00`, alphabet classes, header, checksum) has no recorded result.
- **Collisions:** `00` is not a distinctive prefix; a value is claimed beside the `SSWS` scheme or a same-line `okta` keyword. TruffleHog gates on an Okta tenant domain.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); detector added by [redact-secret#315](https://github.com/redact-secret/redact-secret/issues/315). No frozen evidence folder exists for #694.

## Candidates that are not families yet

- **Okta OAuth client id and secret** (TruffleHog added a detector 2026-09-23). Not researched here.

## Open questions

1. Can `=` appear in the body? Peer scanners disagree and no provider source decides; the benchmarks record lists it as an unresolved contradiction.
2. Length and alphabet on a freshly issued token (checklist in #694).
3. #694 closed on 2026-09-24 without a close-out comment; the T2 status comes from the benchmarks corroboration decision, not from an issue verdict.

## Research log

- [redact-secret#694](https://github.com/redact-secret/redact-secret/issues/694) — T1 hunt: broad-discovery pass 2026-09-23; every shape-stating source agrees on `00` + 40; no provider-domain grammar. Hands-on check not recorded.
- [redact-secret#582](https://github.com/redact-secret/redact-secret/issues/582#issuecomment-5799683784) — Beta.7 ranking put Okta in the committed set (T2, no provider source); the maintainer later said Okta stays medium/warn ([#702](https://github.com/redact-secret/redact-secret/issues/702#issuecomment-5823353741)).
- [redact-secret#315](https://github.com/redact-secret/redact-secret/issues/315) — added the Okta API token detector (beta.7).
