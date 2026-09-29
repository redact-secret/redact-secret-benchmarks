---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: digitalocean
families:
  - id: digitalocean:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.digitalocean.com/release-notes/api/
        - https://docs.digitalocean.com/reference/api/oauth/
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#369
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/367/README.md
      researchedAt: 2026-09-17
    blockedBy: The lowercase-hex body alphabet is tool-corroborated only; DigitalOcean's examples are placeholders that establish the 64-character length.
  - id: digitalocean:oauth-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.digitalocean.com/release-notes/api/
        - https://docs.digitalocean.com/reference/api/oauth/
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#369
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/367/README.md
      researchedAt: 2026-09-17
    blockedBy: The lowercase-hex body alphabet is tool-corroborated only; DigitalOcean's examples are placeholders that establish the 64-character length.
  - id: digitalocean:refresh-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.digitalocean.com/release-notes/api/
        - https://docs.digitalocean.com/reference/api/oauth/
      issues:
        - redact-secret/redact-secret#367
        - redact-secret/redact-secret#369
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/367/README.md
      researchedAt: 2026-09-17
    blockedBy: The lowercase-hex body alphabet is tool-corroborated only; one gitleaks rule is case-insensitive and was treated as a tool artifact.
---

# DigitalOcean

DigitalOcean issues three token kinds in a versioned format introduced in the
2022-03-29 API release notes: personal access tokens, OAuth access tokens and
OAuth refresh tokens. They share one grammar apart from the three-letter prefix,
so the families differ by issuance path and prefix.

Verdicts record research on the shape only. The tier is T1 for the prefix; the
body alphabet is a weaker claim. Whether and how core detects a family is not
recorded here.

## Families

### `digitalocean:personal-access-token` — Personal access token

- **Shape:** prefix `dop_v1_` followed by 64 lowercase hexadecimal characters.
- **Sources:** T1 for the prefix, from the API release notes. The OAuth reference
  examples show 64-character bodies and establish the length, but the example
  bodies contain non-hex placeholder text, so they do not establish the alphabet.
  Lowercase hex comes from gitleaks 8.30.1 and trufflehog 3.97.4 (one combined
  `(dop|doo|dor)_v1_` rule).
- **Collisions:** the sibling prefixes below differ only in the three letters.
  Uppercase or mixed-case bodies are intentionally outside the grammar.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `digitalocean:oauth-token` — OAuth token

- **Shape:** prefix `doo_v1_` followed by 64 lowercase hexadecimal characters.
- **Sources:** T1 for the prefix; length from a provider example in the OAuth
  reference; alphabet from the same two tools.

### `digitalocean:refresh-token` — Refresh token

- **Shape:** prefix `dor_v1_` followed by 64 lowercase hexadecimal characters.
- **Sources:** T1 for the prefix; length from a provider example. Gitleaks'
  refresh rule alone is case-insensitive, which the #367 review treated as a tool
  artifact and did not adopt.

## Candidates that are not families yet

- **DigitalOcean System Token.** Listed in GitHub's partner list; no consulted
  source shows its shape (recorded as pending, T0).
- **`dop_v2_` and sibling future versions.** No source; recorded as an
  intentional false negative until a shape is confirmed.

## Open questions

1. **Alphabet.** Is the body always lowercase hex? The examples are placeholders.
   One issued token per kind would settle it.
2. **System token and later versions.** Neither has a provider source.

## Research log

- redact-secret#367 (2026-09-17) — froze the three contracts as T1 with the
  64-character length corroborated by provider examples and the alphabet by
  tools.
- redact-secret#369 (2026-09-18) — implemented the length and alphabet
  validation against that contract.
