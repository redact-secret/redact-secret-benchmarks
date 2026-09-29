---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: helicone
families:
  - id: helicone:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/Helicone/helicone/tree/067d9290acb4f1fc9320e902fc67b4b399b50363
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#907
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/helicone.md
      researchedAt: 2026-09-28
    blockedBy: null
  - id: helicone:write-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/Helicone/helicone/tree/067d9290acb4f1fc9320e902fc67b4b399b50363
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#907
        - redact-secret/redact-secret-benchmarks#434
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/helicone.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# Helicone

Helicone is an LLM gateway and observability proxy that sits in agent traffic (`Helicone-Auth: Bearer <key>`). It issues read-write (`sk-`) and write-only (`pk-`) keys with the same structure. The provider's own worker validation regexes, duplicated in its Jawn server, and the key generators are the source; both were unchanged when re-checked on 2026-09-28.

## Families

Shared grammar: role `sk` or `pk`, then `-helicone`, then optional `-eu` and then `-rl` segments, then `-` and four groups of exactly 7 characters from `[a-z0-9]` joined by `-`. Standard length is 43, 46 with one of `-eu`/`-rl`, 49 with both. The generator's library emits base32 (`[a-z2-7]`), but ruling R8 rejects narrowing the alphabet from a third-party library, so the provider's own wider class is the grammar.

### `helicone:api-key` — Read-write key (sk-helicone-)

- **Shape:** the shared grammar with role `sk`, plus a proxy key form `sk-helicone-proxy-` + the four groups + `-` + a lowercase 8-4-4-4-12 UUID (86 in total), T1 under R1 from the server generator.
- **Sources:** T1 (worker validator regexes and generators; the `-rl` segment was added 2025-04-29). The role is documented.
- **Issuance:** not attempted; the checklist also asks whether `-gov` combinations are accepted.
- **Collisions:** the legacy bare `sk-` + 4 groups of 7 (34 bytes, no `helicone`) is unattributable and overlaps the generic `sk-` space. Portal keys (`sk-cp-`) carry no provider token.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `helicone:write-api-key` — Write-only key (pk-helicone-)

- **Shape:** the shared grammar with role `pk`.
- **Sources:** T1, same validator and generators. The handoff treats `pk-` as a credential: Helicone documents it as an API key with write permission and no provider source calls it public (unlike PostHog `phc_`). The docs allow placing it in a URL path, a transport convenience that does not make it public.
- **Collisions:** none beyond the legacy bare and portal shapes above.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Legacy bare `sk-` keys and customer-portal `sk-cp-` / `pk-...-cp-` keys.** No provider token; not attributable.
- **`-gov` combinations.** Produced by the dashboard generator but matched by no worker regex; whether they are accepted is unresolved.

## Open questions

1. Are `-gov` keys accepted by the validator? Only an issuance check on one would say.
2. Whether a policy should treat `pk-` as warn rather than redact is a product choice, recorded in the handoff, not a research fact.

## Research log

- redact-secret#860 — epic (open); [research table #34](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386967); [Tier A handoffs](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871361534); [ruling R1](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852413851), [ruling R8](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275).
- redact-secret#907 — implementation issue for both key types (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret-benchmarks#434 — Beta.11 contracts and synthetic corpus for the #860 Tier A READY families; closed 2026-09-28. Corpus work only, no change to the research verdict.
