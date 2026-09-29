---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: discord
families:
  - id: discord:bot-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.discord.com/developers/reference
        - https://github.com/discord/discord-api-docs/blob/0eb810206eecc4562899c4c9ca2bd2d354e31e25/developers/reference.mdx
        - https://github.com/discord-net/Discord.Net/blob/d34a50eeabb39699a2329fbdac735b7d2b069824/src/Discord.Net.Core/Utils/TokenUtils.cs
      issues:
        - redact-secret/redact-secret#646
        - redact-secret/redact-secret#670
        - redact-secret/redact-secret-benchmarks#159
        - redact-secret/redact-secret-benchmarks#128
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/646/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Discord

Discord issues bot tokens from the Developer Portal bot page and uses them as `Authorization: Bot <token>`. Provider documentation:
[API reference, Authentication](https://docs.discord.com/developers/reference). It contains one example header and no prose grammar.

## Families

### `discord:bot-token` — Bot token

- **Shape:** three base64url segments joined by two dots, no padding. Segment 1 is the base64url of the bot user id in decimal ASCII (24 characters for an 18-digit id, 26 for a 19-digit id, the latter for bots created since 2022-07-22). Segment 2 is 6 characters. Segment 3 is 27 characters for tokens issued before about May 2022 and 38 since; old tokens keep 27 until reset. Alphabet `[A-Za-z0-9_-]`.
- **Sources:** the only provider-domain evidence is the API reference's example header, measured 24/6/27 (legacy shape); an example is not a grammar, so T1 is not met. T2 corroboration: Discord.Net token utilities (segment 1 decodes to a ulong id, no padding), detect-secrets, sif, botstrap and TruffleHog (legacy branch only, keyword-gated). The 38-character segment and 26-character head rest on dated community reports and third-party regexes, and neither pinned peer scanner covers them. Discord gives no stability guarantee.
- **Issuance:** not attempted. A fresh token (expected 26/6/38 for a new application) is the open empirical check.
- **Collisions:** none with a fixed prefix; the shape is three dotted base64url runs, so ordinary dotted identifiers and other JWT-like values are the confusable class. detect-secrets additionally requires the first character to be M, N or O, which follows from base64 of a digit string.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#646 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/646/README.md). The three-shape acceptance was added in [redact-secret#670](https://github.com/redact-secret/redact-secret/issues/670).
- **Open caveat:** Discord documents no grammar (one legacy-shape example only); the 26/6/38 and 24/6/38 widths rest on dated empirical reports and third-party code; no freshly issued token has been measured.

## Candidates that are not families yet

- Discord OAuth2 client secrets and webhook URLs are separate credentials; no research issue exists.

## Open questions

1. One fresh token would confirm 26/6/38, the digit-decoding of segment 1 and the absence of `=`.
2. Are legacy 24/6/27 tokens still valid after reset windows? Discord states nothing.
3. [redact-secret-benchmarks#128](https://github.com/redact-secret/redact-secret-benchmarks/issues/128) recorded that the corpus asserted a same-detection under a prefix-change mutation that core's rule correctly refuses; the residual conflict was closed 2026-09-22.

## Research log

- [redact-secret#646](https://github.com/redact-secret/redact-secret/issues/646) — T1 hunt: NOT FOUND, exhaustive (2026-09-23); nearest miss is the API-reference example. T2 corroboration recorded 2026-09-24 in the benchmarks decision.
- [redact-secret-benchmarks#159](https://github.com/redact-secret/redact-secret-benchmarks/issues/159) — benchmarks promotion intake.
- [redact-secret#670](https://github.com/redact-secret/redact-secret/issues/670) — product fix for the 26/6/38 and 24/6/38 shapes.
- [redact-secret-benchmarks#128](https://github.com/redact-secret/redact-secret-benchmarks/issues/128) — corpus regeneration for two ground-truth conflicts (docker-token shape 1, discord same-detection).
