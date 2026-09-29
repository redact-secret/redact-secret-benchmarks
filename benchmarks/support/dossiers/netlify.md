---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: netlify
families:
  - id: netlify:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://answers.netlify.com/t/change-to-the-netlify-authentication-token-format/106146
      issues:
        - redact-secret/redact-secret#311
        - redact-secret/redact-secret#582
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: netlify:other-prefixed-tokens
    research:
      verdict: ready
      tier: T1
      sources:
        - https://answers.netlify.com/t/change-to-the-netlify-authentication-token-format/106146
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/netlify/v2/netlify_v2.go
        - https://github.com/netlify/netlify-mcp/blob/57e547a1b23ace88227b6fc0ce014ec390e4c4f7/src/tools/deploy-tools/deploy-site.test.ts
        - https://github.com/puck-security/geiger/blob/be0bc39ca4862f8d6552b6be90538095ee2a794b/internal/modules/netlify.go
        - https://github.com/koki-develop/mask-go/blob/1b861d7ac421b392a5bb962207fd1886b28e013e/builtin_netlify_auth_token.go
        - https://github.com/bzzimmy/kestrel/blob/6d5ff28089d0b775e2a2c3f63366907d45ddb6fd/src/rules/cloud.rs
        - https://github.com/testpatterndev/patterns/blob/64580c807ea3a3c2896ca4e0f7044da56333fff6/data/patterns/global-netlify-token.yaml
      issues:
        - redact-secret/redact-secret#311
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Netlify

Netlify changed its authentication token format on 2023-11-07: every token now
starts with `nf` plus one character that names its class. Personal access
tokens use `nfp`; the CLI, OAuth, app.netlify.com and build classes use four
other letters. Tokens issued before the change are unprefixed and were not
revoked.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `netlify:personal-access-token` — Personal access token

- **Shape:** prefix `nfp_` followed by 36 characters from letters, digits and
  underscore, 40 characters in all.
- **Sources:** T1 for the prefix and the 40-character size: a Netlify-staff
  announcement on answers.netlify.com states the `nf` scheme, `nfp` for personal
  access tokens, and storage capacity increased "to 40 characters". The
  delimiter and body alphabet come from gitleaks 8.30.1 and trufflehog 3.97.4
  (`netlify/v2`), which agree on `nfp_` plus 36 characters of `[A-Za-z0-9_]`.
  Netlify's API guide only documents creating a token and sending it as a
  Bearer header. #582 confirmed Netlify was the only one of the four committed
  Beta.7 candidates with a T1 provider source.
- **Issuance:** not attempted.
- **Collisions:** the other four `nf*` classes share the scheme and length but
  are different credentials. Pre-2023 tokens share one unprefixed shape across
  all five classes, so that legacy form cannot be labelled as a personal token.
  Site, account and deploy IDs and preview URLs are not credentials.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
- **Open caveat:** The underscore delimiter and the [A-Za-z0-9_] body alphabet are stated by scanner rules only; the announcement gives the nfp prefix and a 40-character capacity.

### `netlify:other-prefixed-tokens` — CLI, OAuth, app and build tokens (nfc_/nfo_/nfu_/nfb_)

Researched 2026-09-29 (broad pass; sources recorded first, classified after). Verdict `ready`, tier T1 on the same footing as `netlify:personal-access-token`, with the body evidence weaker for three of the four classes (below).

- **Shape:** prefix `nf` + one class letter + `_`: `nfc_` (Netlify CLI), `nfo_` (OAuth access token), `nfu_` (app.netlify.com), `nfb_` (build), then 36 characters, 40 in all. The observed body alphabet is `[A-Za-z0-9]`; the personal-token rules allow `_` too.
- **Provider-documented (T1):** the 2023-11-07 announcement on answers.netlify.com (account labelled "Netlify Alumni" now) names all five classes, says every new token starts with `nf` plus one identifying character, and tells customers with fixed-size fields to allow 40 characters. It does not write the underscore, the body length or the alphabet. Netlify's own `netlify-mcp` tests use an `nfp_` placeholder, which shows the underscore for the personal class only.
- **Scanner and implementation evidence:** trufflehog's `netlify/v2` detector (behind a `netlify` keyword) and CredSweeper (by prefix) encode `nfp_` only. gitleaks' Netlify rule is a keyword-gated run of 40 to 46 characters from `[a-z0-9=_-]` and encodes no prefix. No scanner among trufflehog, gitleaks, Nosey Parker, detect-secrets, CredSweeper and GitHub's partner list has a rule keyed to `nfc_`, `nfo_`, `nfu_` or `nfb_` as a distinct class. Independent tools that do (geiger with `{30,}`, kestrel with 36 of `[A-Za-z0-9_-]`, testpatterndev with 20-36, mask-go with exactly 36, a Vulnetix rule with 40 or more) all derive the class letters from the announcement and disagree on the body, so they corroborate the prefix set and nothing about the body. Netlify's secret-scanning docs state no prefix.
- **Measured (independent-research, structure only, 2026-09-29):** GitHub code search in text near `netlify` and `NETLIFY_AUTH_TOKEN`, excluding scanner and rule repositories and values with fewer than 14 distinct body characters: 36 distinct candidates in 36 repositories. Distinct `nfp_` values: 28 with a 36-character alphanumeric body and one with 45. Distinct `nfc_` values: 5 with a 36-character alphanumeric body (40 in all), plus two of 20 and 30 characters that contain underscores and look like unrelated identifiers. No real `nfo_`, `nfu_` or `nfb_` value turned up. Nothing was printed or stored, and none was tested against Netlify.
- **Issuance:** not attempted. A CLI login token (`nfc_`) and an OAuth token (`nfo_`) are cheap to mint and revoke; `nfu_` and `nfb_` are minted by the platform (session and build) and are not.
- **Collisions:** each is a distinct credential, so none is a control or positive for the personal access token family. `nfc_` also opens ordinary snake_case names (Unicode normalization code), which the 36-character body, not the prefix, separates. Pre-2023 unprefixed tokens are a separate variant. Site, account and deploy IDs are not credentials.
- **Current contract in core:** none for these four classes; #311 listed them as unsupported variants.
- **Open caveat:** for `nfo_`, `nfu_` and `nfb_` the underscore and 36-character alphanumeric body rest on analogy with `nfp_` and `nfc_` plus the announcement's 40-character size; no real value of those three was observed. One issued token each would settle it. Whether a former-staff forum announcement counts as provider documentation is the same ruling as for `nfp_`.

## Candidates that are not families yet

- **Pre-2023 unprefixed tokens.** Shared by all token classes; gitleaks and
  trufflehog disagree on their exact length bounds and both gate on a `netlify`
  keyword. Recorded in the #311 contract as a known unsupported variant.
- **Build hook URLs.** A separate bearer-secret format that #311 left for an
  explicit scope decision.

## Open questions

1. **`netlify:other-prefixed-tokens`** is researched (2026-09-29, see above). Open: are `nfo_`, `nfu_` and `nfb_` bodies the same 36 alphanumeric characters as `nfp_` and `nfc_`? One issued token per class would answer it.
2. **Delimiter and alphabet.** No Netlify text states the underscore or the
   body alphabet for `nfp_`.

## Research log

- redact-secret-benchmarks#473 — 2026-09-29 broad pass for `netlify:other-prefixed-tokens`: the announcement, Netlify docs and forum search (only the announcement mentions the classes), Netlify-owned repositories, six scanners, eight independent tools, GitHub code-search shape measurement, Stack Overflow and Reddit (no relevant hits). Verdict `ready`, T1.
- redact-secret#311 (closed 2026-09-23) — froze the personal access token
  grammar from the provider announcement and two tools, and listed the legacy
  form, the four other classes and build hooks as unsupported variants.
- redact-secret#582 (2026-09-23) — ranking of Beta.7 candidates; recorded that
  Netlify has a T1 provider source, and that Netlify's prefix-anchored detector
  covers bare values that generic detection does not.
