---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: browserbase
families:
  - id: browserbase:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/browserbase/cookbook/blob/eff9eca8e61e16ea1635e9e75e043c7a765c5f88/scripts/verify.py#L383
        - https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/browserbase.md
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#973
        - redact-secret/redact-secret-benchmarks#464
        - redact-secret/redact-secret#1012
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/browserbase.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Browserbase

Browserbase runs headless browser sessions for agents. An API key (`BROWSERBASE_API_KEY`, sent as the `X-BB-API-Key` header) creates and drives sessions for a project on the account's usage budget, reads session recordings and logs, and reuses stored browser contexts, which hold the cookies and logins of the sites an agent visited.

## Families

### `browserbase:api-key` — API key (bb_live_)

- **Shape:** prefix `bb_live_`, then at least 20 alphanumeric characters `[A-Za-z0-9]`, open-ended; boundaries on both sides. The 128-byte upper bound is product policy. `bb_test_` is excluded.
- **Sources:** prefix T1 (docs placeholders `bb_live_...` under R4 and a provider redaction regex in `browserbase/stagehand` under R2); alphabet and the floor of 20 T1 under R2 (a provider-authored CI hygiene gate in `browserbase/cookbook`, 2026-09-25, whose author is a public Browserbase-organization member; no public scanner has a Browserbase rule). The stagehand redactor also admits `_` and `-`; the contract keeps the gate's alphanumeric class.
- **Issuance:** not attempted; one issued `bb_live_` key, and whether a `bb_test_` key can be created, would narrow it.
- **Collisions:** `bb_live_session_…` and other snake_case identifiers (the glued `_` rejects), `bb_<timestamp>` cookie names and project-ID UUIDs are not keys. The two provider rules disagree on a glued `-`; the handoff decides both.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row until the Beta.12 detector, redact-secret#973, is merged).
- **Open caveat:** the 128-byte cap is project policy; a key whose body contains `_` or `-` is an accepted false negative; every `bb_test_` key is outside the family.

## Candidates that are not families yet

- **`bb_test_` keys.** Issuance-gated: only a floor-5 regex and a T2 comment exist; a record with the same body grammar would let it join as a second prefix.

## Open questions

1. Can a `bb_test_` key be created, and does it share the `bb_live_` body grammar? The redact-secret#1012 re-research (2026-09-29, BLOCKED) found Browserbase's docs have no test-key, sandbox or test-mode concept, and the only new length source is a Kingfisher rule (`bb_(live|test)_` + exactly 27 of `[A-Za-z0-9_-]`) that existed from 2026-07-10 to 2026-08-21 and was deleted; provider code gives a floor of 5 for `bb_test_` (stagehand redactor), the cookbook CI gate covers `bb_live_` only, and a cookbook example comment says "bb_live_" or "bb_test_" followed by "a unique string". Only a dashboard check settles it: if a test key can be created, record prefix, body length and whether `_` or `-` occurs, then revoke; if it cannot, drop the `bb_test_` shape from scope. `bb_live_` is unaffected.

## Research log

- redact-secret#1012 — 2026-09-29 re-research of `bb_test_`
  ([evidence](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1012/browserbase-bb-test.md)):
  BLOCKED on whether customers are issued `bb_test_` keys at all, then on the floor; no new provider source. `bb_test_` stays excluded from the family and has no taxonomy row of its own.
- redact-secret#860 — epic (open); [issuance-gate research and rulings R9–R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337); [final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret#973 — Beta.12 implementation issue (open; no detector code merges to `main` until 0.1.0-beta.11 is released).
- redact-secret-benchmarks#464 — Beta.12 contracts and synthetic corpus for the #860 issuance-research READY families. Corpus work only, no change to the research verdict.
