---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: twilio
families:
  - id: twilio:auth-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://www.twilio.com/docs/iam/api/authtoken
        - https://github.com/twilio/twilio-cli/blob/48957956fecbd279a2cb8249f20a432fa646484a/src/commands/profiles/create.js
        - https://github.com/twilio-labs/serverless-toolkit/blob/1669e746ab6e2993f2ca560aad81959c811fed88/packages/twilio-run/src/checks/check-auth-token.ts
      issues:
        - redact-secret/redact-secret#662
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/662/README.md
      researchedAt: 2026-09-24
    blockedBy: null
  - id: twilio:api-key-secret
    research:
      verdict: ready
      tier: T2
      sources:
        - https://www.twilio.com/docs/iam/api-keys/key-resource-v1
        - https://github.com/twilio/twilio-oai/blob/5aa7f31977ce5812f7b7bc1f46a38555ebaa2888/spec/json/twilio_iam_v1.json
      issues:
        - redact-secret/redact-secret#661
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/661/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Twilio

Twilio issues an account Auth Token (paired with the Account SID `AC` + 32 hex) and API keys (a key SID `SK` + 32 hex plus a secret returned once at creation). The SIDs have provider-documented patterns; the two secrets do not.
Provider documentation: [Auth Token resource](https://www.twilio.com/docs/iam/api/authtoken), [API key resource](https://www.twilio.com/docs/iam/api-keys/key-resource-v1).

## Families

### `twilio:auth-token` — Account auth token

- **Shape:** exactly 32 characters, no prefix, no marker; lowercase hex per scanners. Secondary, regional, test and subaccount tokens have no stated shape. Twilio's sample code sometimes accepts `[a-z0-9]` and calls it hexadecimal, most likely loosely.
- **Sources:** T2. Length 32 is checked client-side in `twilio-cli` (`profiles:create`, skippable with a hidden flag), `serverless-toolkit` ("32 characters long and made of letters and numbers") and three more Twilio-owned repos. The #662 record calls this a T1 candidate for length only, with caveats a maintainer must accept; no ruling was found. Alphabet: TruffleHog (`[0-9a-f]{32}` beside an `AC` SID), CredSweeper; GitGuardian records `Prefixed: False`. The Auth Token resource schema types `auth_token` as an untyped string.
- **Issuance:** not attempted; a token is bound to the account.
- **Collisions:** any 32-hex run (MD5, UUID without dashes); hence the same-line `AC` SID or `twilio` gate.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#662 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/662/README.md).
- **Open caveat:** Length 32 is Twilio-owned client-side code (T1 candidate needing a maintainer ruling); the lowercase-hex alphabet is tool-corroborated; no prefix or marker, so it is only claimed beside same-line Twilio context.

### `twilio:api-key-secret` — API key secret

- **Shape:** 32 alphanumeric characters (`[0-9A-Za-z]`), no prefix. The paired key SID is `SK` + 32 hex (34 characters) per the provider schema and glossary; core's pairing marker accepts a wider alphabet than the schema. The secret is the basic-auth password paired with the SID and the HMAC key for Access Tokens.
- **Sources:** T2. No provider source states length or alphabet (`new_key.secret` in the OpenAPI spec is an untyped nullable string). 32 rests on TruffleHog's `twilioapikey` detector and 32-character placeholder masks in Twilio sample repositories (a placeholder is not a spec).
- **Issuance:** not attempted; the secret is shown once.
- **Collisions:** same as the auth token; the `SK` SID within the same line is the context gate.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#661 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/661/README.md).
- **Open caveat:** No Twilio source states the secret's length or alphabet; 32 alphanumeric rests on TruffleHog and placeholder masks; only the paired SK SID has a documented grammar.

## Candidates that are not families yet

- **Account SID (`AC` + 32 hex) and API key SID (`SK` + 32 hex).** Documented patterns but identifiers, not secrets; used as context gates.

## Open questions

1. Does Twilio-owned client-side code satisfy the T1 bar for the auth token length? Maintainer ruling pending.
2. Do issued auth tokens or API secrets ever contain characters outside lowercase hex (or alphanumerics)?
3. Do secondary, regional and test tokens have the same shape?

## Research log

- [redact-secret#661](https://github.com/redact-secret/redact-secret/issues/661) — API key secret: NOT FOUND, exhaustive (2026-09-23).
- [redact-secret#662](https://github.com/redact-secret/redact-secret/issues/662) — auth token: FOUND for length only, with caveats (2026-09-23).
- Both were corroborated as T2 on 2026-09-24 (benchmarks decision `2026-09-24-qualify-empirical-stable-by-corroboration`); product findings #741 to #747 were the remaining gates.
