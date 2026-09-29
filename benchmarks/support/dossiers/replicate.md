---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: replicate
families:
  - id: replicate:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://replicate.com/docs/topics/security/api-tokens
        - https://replicate.com/changelog/2024-04-03-bearer-tokens
      issues:
        - redact-secret/redact-secret-benchmarks#215
        - redact-secret/redact-secret-benchmarks#217
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#727
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Replicate

Replicate hosts model inference behind an HTTP API. Its only documented
credential is the API token, created at `replicate.com/account/api-tokens`. A
default token exists per account and more can be added, each with a name.
Provider documentation: [API tokens](https://replicate.com/docs/topics/security/api-tokens).

The verdict records research on the shape only. Whether and how core detects
it is not recorded here.

## Families

### `replicate:api-token` — API token

- **Shape:** prefix `r8_`, 40 characters in total (a 37-character body). The
  provider states the prefix and the total length. It states no body alphabet.
  TruffleHog accepts letters, digits, `-` and `_`; flare-redact accepts letters
  and digits only. No checksum or embedded account id is documented.
- **Sources:** T1 for prefix and length (the API-tokens page). Alphabet: scanner
  rules only, contested. Both `Authorization: Bearer` and the older
  `Authorization: Token` header are accepted (2024-04-03 changelog), and the docs
  show a masked example (`r8_`, two visible characters, asterisks).
- **Issuance:** not attempted. Free accounts can create tokens. Replicate scans
  public GitHub repositories for committed tokens and disables the ones it finds
  (it joined the GitHub Secret Scanning Partner Program in 2024-04).
- **Collisions:** `r8.im/<owner>/<model>` container registry references and
  64-hex model version ids are public and share the `r8` stem or sit next to
  tokens. The `cog login` token from `replicate.com/auth/token` may be a
  different credential; the relation is undocumented and not claimed.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (Beta.8 arrival contracts, frozen in the #726 record linked above; the
  provider-stated length is exact and the alphabet is provisional).
- **Open caveat:** Body alphabet is not provider-stated (TruffleHog admits - and _, flare-redact does not); one issued token would settle it (checklist in benchmarks#217).

## Candidates that are not families yet

- **`cog` login token** (`replicate.com/auth/token`, used for the `r8.im`
  registry). Same-or-different credential is unknown; no shape is recorded.

## Open questions

1. Can `-` or `_` appear in the body? One issued token cannot rule them out.
2. When was the `r8_` prefix introduced, and do unprefixed older tokens still
   authenticate? The earliest dated evidence is the 2024-04 changelog.
3. Do organization tokens differ in shape from user tokens?
4. Is the `cog` login token the same credential as the API token?

## Research log

- redact-secret-benchmarks#215 — epic for the Beta.8 contract research (#216-#235);
  each family has its own research issue.
- redact-secret-benchmarks#217 — broad-discovery pass (2026-09-24): provider
  docs, SDK sources, scanner rules; hands-on checklist left unexecuted.
- redact-secret#727 — implementation of the committed AI inference credential families for Beta.8 (closed 2026-09-24).
- redact-secret#726 — freeze of the 15 Beta.8 arrival contracts; records the
  provider length as T1 and the alphabet as tool-corroborated.
