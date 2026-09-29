---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: fireworks-ai
families:
  - id: fireworks-ai:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.fireworks.ai/tools-sdks/python-client/the-tutorial
        - https://docs.fireworks.ai/api-reference/create-api-key
      issues:
        - redact-secret/redact-secret-benchmarks#227
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#730
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Fireworks AI

Fireworks AI hosts inference and fine-tuning. Keys are created in the console
(`app.fireworks.ai`, API Keys) or with `firectl api-key create`, including for
service accounts. The create response returns the key once and a `prefix`
field, described as the first characters "to visually identify" it.

## Families

### `fireworks-ai:api-key` — API key

- **Shape:** prefix `fw_` followed by 22 or 24 letters and digits (25 or 27 in
  total). Provider docs write the key as `fw_...` and never state a length or
  alphabet. Of nine distinct public non-placeholder values, six had 22-character
  and three 24-character bodies; none contained `0`, `O`, `I` or `l`, which is
  consistent with base58 but not documented. Community rules that require 30 or
  more characters would miss all nine.
- **Sources:** T1 for the prefix (provider docs and provider code). Widths and
  alphabet: maintainer observation report only. No TruffleHog, gitleaks, GitHub,
  betterleaks or Kingfisher rule exists for this prefix.
- **Issuance:** not attempted. Console or `firectl`, with a short expiry; several
  keys would show whether the length varies (checklist in benchmarks#227).
- **Collisions:** `fpk_` Fire Pass keys share `FIREWORKS_API_KEY` and are a separate
  live prefix; unprefixed older keys may exist (GitGuardian says "not prefixed").
  Non-secret: `keyId`, the `prefix` display value, account ids, model paths
  (`accounts/fireworks/models/...`), service-account emails, and `fw_id`,
  `fw_version`, `fw_spec` style identifiers. A keychain reference written by
  `fireconnect` is not a key.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record: the two widths are positive hypotheses, so no other
  width is a negative rule beyond the exact match).
- **Open caveat:** T1 on the fw_ prefix only; the 22 and 24 character widths and the alphabet come from a nine-sample maintainer observation and are provisional positive hypotheses (checklist in benchmarks#227).

## Candidates that are not families yet

- **`fpk_` Fire Pass key** (documented, launched around 2026-07; needs a paid Fire
  Pass). Body length and alphabet not found. Decide whether it is a family or a
  sibling.
- **Possible unprefixed legacy key.** Pre-2024 docs show no prefix; no source
  confirms an older shape.

## Open questions

1. Are 22 and 24 character bodies one generator (base58 length variance) or two formats?
2. Did an unprefixed format exist, and do such keys still work?
3. Do training-scoped, `secure` or service-account keys differ lexically?
4. What are the key names inside `~/.fireworks/auth.ini`? Not documented publicly.

## Research log

- redact-secret-benchmarks#227 — broad-discovery pass (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (wave 2, empirical route).
- redact-secret#730 — implementation of the second-wave families.
