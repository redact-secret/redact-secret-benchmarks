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
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
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

- **Shape:** the announcement names four further classes with the same `nf`
  plus identifying-character scheme. No grammar research exists for them.
- **Sources:** the same announcement names the classes and nothing else was
  found. No length, alphabet or delimiter was checked separately.
- **Collisions:** each is a distinct credential; none is a control or positive
  for the personal access token family.

## Candidates that are not families yet

- **Pre-2023 unprefixed tokens.** Shared by all token classes; gitleaks and
  trufflehog disagree on their exact length bounds and both gate on a `netlify`
  keyword. Recorded in the #311 contract as a known unsupported variant.
- **Build hook URLs.** A separate bearer-secret format that #311 left for an
  explicit scope decision.

## Open questions

1. **`netlify:other-prefixed-tokens` is unresearched.** Searched: core #311 and
   its comments, #582 and its evidence, the detector module notes. Each of the
   four classes is out of #311's scope and has no grammar research. Are the
   bodies the same 36 characters of `[A-Za-z0-9_]`? One issued token per class
   would answer it.
2. **Delimiter and alphabet.** No Netlify text states the underscore or the
   body alphabet for `nfp_`.

## Research log

- redact-secret#311 (closed 2026-09-23) — froze the personal access token
  grammar from the provider announcement and two tools, and listed the legacy
  form, the four other classes and build hooks as unsupported variants.
- redact-secret#582 (2026-09-23) — ranking of Beta.7 candidates; recorded that
  Netlify has a T1 provider source, and that Netlify's prefix-anchored detector
  covers bare values that generic detection does not.
