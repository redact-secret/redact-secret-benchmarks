---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: google
families:
  - id: google:generic-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.cloud.google.com/docs/authentication/api-keys
      issues:
        - redact-secret/redact-secret#296
        - redact-secret/redact-secret#519
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: google:oauth2-credential
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://developers.google.com/identity/protocols/oauth2
      issues:
        - redact-secret/redact-secret#487
        - redact-secret/redact-secret#519
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/519/README.md
      researchedAt: 2026-09-21
    blockedBy: null
---

# Google

Google issues several credential types. This dossier covers the general API key
(also used for Gemini and Maps) and the OAuth 2.0 client secret, refresh token and
access token. Service account keys (a PEM private key inside a JSON export) are
detected structurally and have no Google-specific prefix. Firebase's legacy FCM
server key is a different credential.

Verdicts record research on the shape only. Whether and how core detects a
family is not recorded here.

## Families

### `google:generic-api-key` — Generic API key

- **Shape:** prefix `AIza` followed by 35 characters from letters, digits,
  underscore and hyphen, 39 characters in all.
- **Sources:** T1 for the prefix and total length, from one example on Google
  Cloud's API keys page ("The API key string is an encrypted string, for
  example, `AIza…`"). The page states no prefix rule and no grammar. The
  35-character body comes from gitleaks 8.30.1 (`gcp-api-key`) and flare-redact,
  which agree, and from trufflehog's `googlegemini` rule with the split
  `AIzaSy` plus 33, the same total length.
- **Collisions:** Gemini keys use this same shape; #519 decided they are not a
  separate family because restriction to an API is not visible in the bytes.
  The page now describes "authorization keys" that authenticate as a service
  account and gives no string format for them; the reported `AQ.` prefix does
  not appear on it. A Firebase Web SDK `apiKey` has the same shape and was
  moved from exempt to redacted by #749. The OAuth client ID
  (`...apps.googleusercontent.com`) and a service account email are public
  identifiers.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
- **Open caveat:** The provider shows the AIza prefix and a 39-character length in one example, not a stated grammar; the 35-character body alphabet is tool-corroborated.

### `google:oauth2-credential` — OAuth2 credential

- **Shape:** three formats with literal prefixes: `GOCSPX-` (client
  secret), `1//` (refresh token) and `ya29.` (access token). No body length or
  alphabet is established for any of them.
- **Sources:** none reach a grammar. Google's OAuth 2.0 protocol page states only
  an upper bound of 512 bytes for a refresh token and gives no example. Tools:
  flare-redact has a single `1//` rule with an open 20 to 160 range, trufflehog
  has an open-ended `ya29.` rule, and no consulted tool has a `GOCSPX-` rule.
  #519 recorded all three as pending, T0.
- **Collisions:** the OAuth client ID is a public application identifier. A
  `client_secret` assignment can still be caught by generic contextual rules.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`AQ.` authorization keys.** Reported for service-account API keys; Google's
  page documents the key type without a string format. Tracked separately in
  #642.
- **Service account private key (JSON export).** Recorded as supported by the
  structural PEM match (#519, #163), not a provider-prefixed grammar.

## Open questions

1. **`GOCSPX-`, `1//`, `ya29.` bodies.** No length or alphabet source. One issued
   credential of each kind would settle them; the three could then become
   separate families.
2. **`AQ.` format.** Does the prefix exist, and what does Google say about it?
3. **AIza body.** Only one provider example exists; an issued key would confirm
   the 35-character alphabet.

## Research log

- redact-secret#296 (2026-09-16) — added dedicated Google Cloud and Gemini API
  key detection.
- redact-secret#487 (2026-09-20) — evaluated the three OAuth formats; no source
  corroborates a body grammar for any of them.
- redact-secret#519 (2026-09-21) — family-by-family Google audit; Gemini subsumed
  under the `AIza` shape, the three OAuth formats kept pending at T0.
- redact-secret#642 (2026-09-23) — re-fetched the API keys page and re-tiered
  `google:generic-api-key` to T1 on the prefix example; noted the new
  "authorization keys" text.
- redact-secret#749 (2026-09-24) — reversed the Firebase config exemption; not a
  change to the shape.
