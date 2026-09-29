---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: runpod
families:
  - id: runpod:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/runpod/runpod-mcp/blob/09a565a6adef8932f044dfa65243e7bc41cbdf2d/src/alp/scrub.ts#L36
        - https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/runpod.md
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#974
        - redact-secret/redact-secret-benchmarks#464
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/runpod.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# RunPod

RunPod rents GPU pods and serverless endpoints. An API key (`RUNPOD_API_KEY`, `Authorization: Bearer` to the REST and GraphQL APIs) is scoped All or Read Only; an All key creates, stops and terminates pods and endpoints on the account's balance and reads templates, network volumes and their environment variables. Both scopes share the `rpa_` prefix.

## Families

### `runpod:api-key` — API key (rpa_)

- **Shape:** prefix `rpa_`, then at least 31 alphanumeric characters `[A-Za-z0-9]`, open-ended. The floor of 31 (ruling R10) and the 128-byte cap are project policy; the provider floor is 16.
- **Sources:** prefix T1 (the RunPod blog on scoped keys, 2024-11) and alphabet and provider floor of 16 T1 under R2 (a provider-authored scrubber in `runpod/runpod-mcp`, 2026-09-16). The 46-byte body and the 40-uppercase/6-mixed layout are tool (betterleaks) and empirical facts, not part of the contract.
- **Issuance:** not attempted; a uniform 46 across an All key and a Read Only key would allow an exact-width contract later, as a separate optional change.
- **Collisions:** a floor of 16 would claim Redirect.pizza's `rpa_` + 30 tokens, so R10 raises it to 31; a longer Redirect.pizza token, if one exists, would read as RunPod (misattributed, still redacted). `rps_` S3-compatible secrets are another credential.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row until the Beta.12 detector, redact-secret#974, is merged).
- **Open caveat:** the floor and the cap are policy; a RunPod key with a body of 16 to 30 (none known) is an accepted false negative; legacy unprefixed keys and `rps_` secrets are outside the family.

## Candidates that are not families yet

- **S3-compatible `rps_` secrets and access keys.** A different credential; no shape researched.
- **Legacy unprefixed keys (before 2024-11).** No prefix; generic context covers `RUNPOD_API_KEY=`.

## Open questions

1. Is the body a uniform 46 across key scopes? An issued All key and Read Only key would show whether an exact-width contract is possible.

## Research log

- redact-secret#860 — epic (open); [issuance-gate research and rulings R9–R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337); [final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret#974 — Beta.12 implementation issue (open; no detector code merges to `main` until 0.1.0-beta.11 is released).
- redact-secret-benchmarks#464 — Beta.12 contracts and synthetic corpus for the #860 issuance-research READY families. Corpus work only, no change to the research verdict.
