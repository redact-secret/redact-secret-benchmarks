---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: nvidia
families:
  - id: nvidia:ngc-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/NVIDIA-NeMo/nemo-helix/blob/689f7852611b0151cee2748ca2b68e8e163e3b65/plugins/nemo-agents/src/nemo_agents_plugin/skills/agents-secure/resources/pii_scan.py#L229-L232
        - https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/issuance-research/nvidia.md
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#972
        - redact-secret/redact-secret-benchmarks#464
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/nvidia.md
      researchedAt: 2026-09-28
    blockedBy: null
---

# NVIDIA

NVIDIA issues one `nvapi-` key as an NGC Personal key, an NGC Service key or a build.nvidia.com key (`NVIDIA_API_KEY`, `NGC_API_KEY`, `Authorization: Bearer`). It calls hosted NIM inference endpoints on the account's credits and, depending on scopes, pulls private NGC registry artifacts and manages NGC organization resources.

## Families

### `nvidia:ngc-api-key` — API key (nvapi-)

- **Shape:** prefix `nvapi-`, then at least 60 characters of `[A-Za-z0-9_-]`, open-ended; no separator or checksum. The 128-byte upper bound is product policy, not a provider fact.
- **Sources:** prefix T1 (NVIDIA docs, and the ngcsdk constant `SCOPED_KEY_PREFIX` with an executing `startswith`, R1 and R6); alphabet and the floor of 60 T1 under R2 (a provider-authored secret-scanning rule in an NVIDIA-owned organization, added 2026-05-21; a second NVIDIA rule uses a floor of 40 with the same class). No provider source states an exact width.
- **Issuance:** not attempted; a uniform width across the three key kinds would allow an exact-width contract later, as a separate optional change.
- **Collisions:** the peers disagree with the provider grammar: trufflehog's `NVAPI` is an exact 64, and betterleaks is `{60,70}` (tool-only, unpinned). NVAPI SDK and crate names (`nvapi-sys`, `nvapi-rs`) fall below the floor.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row until the Beta.12 detector, redact-secret#972, is merged).
- **Open caveat:** the 128-byte cap is project policy (the Apify precedent), so an over-long run is an intentional false negative, never truncated; bodies with a byte outside the class, and any key class shorter than 60, are accepted false negatives.

## Candidates that are not families yet

- **Legacy NGC key.** 84 non-space characters with no prefix (the `$oauthtoken` registry password); tool-inferred, context-anchored only.

## Open questions

1. What widths do the three key kinds have? Trufflehog expects 64; an issued sample of each would settle whether they are uniform.

## Research log

- redact-secret#860 — epic (open); [issuance-gate research and rulings R9–R10](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337); [final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
- redact-secret#972 — Beta.12 implementation issue (open; no detector code merges to `main` until 0.1.0-beta.11 is released).
- redact-secret-benchmarks#464 — Beta.12 contracts and synthetic corpus for the #860 issuance-research READY families. Corpus work only, no change to the research verdict.
