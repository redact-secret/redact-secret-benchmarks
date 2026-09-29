---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: telegram
families:
  - id: telegram:bot-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://core.telegram.org/bots/api
        - https://core.telegram.org/bots/features
        - https://github.com/tdlib/telegram-bot-api/blob/e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1/telegram-bot-api/ClientManager.cpp
      issues:
        - redact-secret/redact-secret#660
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/660/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Telegram

Telegram issues bot tokens through BotFather. Provider documentation:
[Bot API, "Authorizing your bot"](https://core.telegram.org/bots/api), plus the `bots/features` and `bots/tutorial` pages; each shows an example token introduced as "looks something like", never a grammar.

## Families

### `telegram:bot-token` — Bot token

- **Shape:** the bot's numeric user id, a literal `:`, then a secret from `[A-Za-z0-9_-]`. The Bot API server rejects a token that lacks `:`, contains `/`, is longer than 80 characters, starts with `0`, or whose id is not in (0, 2^54). Real ids are usually 8 to 10 digits. Secret width is disputed: all three Telegram examples show 34 characters, while most tools and community reports say 35; two of three Telegram examples and most scanner rules show a leading `AA` or `A`, which no source explains.
- **Sources:** T2. `tdlib/telegram-bot-api` `ClientManager.cpp` (server acceptance code, not documentation), TruffleHog telegrambottoken and detect-secrets (`\d{8,10}:[0-9A-Za-z_-]{35}`). The TDLib maintainer answered in issue 300 on that repo that "everything can completely change in the future", so Telegram deliberately publishes no format.
- **Issuance:** not attempted; a fresh BotFather token would settle width and lead.
- **Collisions:** any short `digits:string` pair; the numeric id part alone is a weak marker, so the secret body carries the discrimination.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#660 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/660/README.md).
- **Open caveat:** Telegram documents only example tokens and says the format may change; the secret width (34 in docs, 35 in tools) and the leading AA are unexplained; no fresh token measured.

## Candidates that are not families yet

- Telegram API id and hash, MTProto session strings: no research issue.
- **Serverless CLI token** `app<id>:<secret>` (documented on core.telegram.org/bots/serverless) and managed-bot tokens: found in the [#660 pass](https://github.com/redact-secret/redact-secret/issues/660#issuecomment-5784935602); no taxonomy entry.

## Open questions

1. Secret length 34 or 35, and does the alphabet ever include `_`?
2. Why do the documented examples and most scanner rules start `AA` after the colon? No empirical report says real tokens do.
3. The contract floor is a 5-digit id and a body of at least 34 characters; no provider source supports the floor.

## Research log

- [redact-secret#660](https://github.com/redact-secret/redact-secret/issues/660) — T1 hunt: NOT FOUND, exhaustive (2026-09-23); T2 corroboration recorded 2026-09-24, and telegram-bot-token counted among the four families the benchmarks decision qualified.
