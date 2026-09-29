---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: posthog
families:
  - id: posthog:personal-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/PostHog/posthog/blob/658715dd3b434e0a5ada471981d4053b70e72034/posthog/models/utils.py
        - https://github.com/PostHog/posthog/pull/52495
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#906
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/posthog.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: posthog:project-secret-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/PostHog/posthog/blob/658715dd3b434e0a5ada471981d4053b70e72034/posthog/models/utils.py
        - https://github.com/PostHog/posthog/pull/52495
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#906
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/posthog.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# PostHog

PostHog is a product analytics platform. It issues a project token (`phc_`, public by design, "ok to be public"), a personal API key (`phx_`, acts as the user across every reachable organization) and a project secret API key (`phs_`, project-scoped, used for feature-flag evaluation). Personal and secret keys share one generator and body. The `phc_` token is a non-secret and no dossier family claims it.

## Families

Shared grammar (T1 under R1 from the `posthog/models/utils.py` generator and its unit tests, last changed 2026-09-16 and unchanged in relevant parts on 2026-09-28): the prefix, then a body whose length and alphabet depend on the era, all of which can still be live because rotation is optional.

| Era | Body length | Alphabet |
| --- | --- | --- |
| since 2026-03-30 ([PR 52495](https://github.com/PostHog/posthog/pull/52495)) | 48 or 49 | base57 (base62 without `0 1 O I l`) |
| until 2026-03-30 (35-byte base62) | at most 48 | `[0-9A-Za-z]` |
| earlier (32-byte base62) | at most 43 | `[0-9A-Za-z]` |

The handoff contract is the union of these: 42 to 49 alphanumeric characters after the prefix. The floor of 42 keeps the roughly 1.6 percent of 32-byte-era keys that render at 42; shorter renderings are under 0.03 percent of any era. Per-length shares are derived from the T1 algorithm, not observed. Scanner rules lag (trufflehog stops at 48; GitLab uses 43 only) and were not used.

### `posthog:personal-api-key` — Personal API key (phx_)

- **Shape:** `phx_` + 42 to 49 alphanumerics, no separator or checksum.
- **Sources:** prefix T1 from docs and code (an SDK error string also states "prefixed with `phx_`"); alphabet and algorithm T1 from code and unit tests.
- **Issuance:** not attempted; optional check of one key issued today (expect 48 or 49, none of `0 1 O I l`).
- **Collisions:** the era-1 unprefixed personal key (43 characters of urlsafe Base64) has no anchor. `phc_` must stay unclaimed.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `posthog:project-secret-api-key` — Project secret API key (phs_)

- **Shape:** `phs_` + the same body band as `phx_`.
- **Sources:** T1, same generator; a secret by the provider's docs.
- **Collisions:** as above.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`phc_` project token.** Public by design; must stay benign. GitLab's ruleset flags it, a false positive under this repository's policy.
- **`pha_` and `phr_` OAuth access and refresh tokens, `phh_` heatmap tokens.** T1 in code but short-lived and outside the #860 candidate.
- **Era-1 unprefixed personal keys.** Not lexically attributable.

## Open questions

1. Is a `phs_` key issued today 48 or 49 characters, like `phx_`? Optional check.
2. Should OAuth tokens (`pha_`, `phr_`) become families?

## Research log

- redact-secret#860 — epic (open); [research table #38](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386967); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534).
- redact-secret#906 — implementation issue for both key types (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
