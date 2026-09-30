---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: axiom
families:
  - id: axiom:api-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/axiomhq/axiom-go/blob/ae983c9447003f74f00e55a2ca64ea119b558fb8/internal/config/token.go#L7-L18
        - https://axiom.co/docs/llms-full.txt
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1035
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/axiom.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: axiom:personal-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/axiomhq/axiom-go/blob/ae983c9447003f74f00e55a2ca64ea119b558fb8/internal/config/token.go#L7-L18
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1035
        - redact-secret/redact-secret#1039
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/axiom.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Axiom

Axiom is a log, event and trace store. An API token (`AXIOM_TOKEN`) is ingest-only or carries query and dataset-management rights and doubles as the service-account password; a personal access token has the user's full console and API access, including queries over every ingested log.

## Families

### `axiom:api-token` — API token (xaat-)

- **Shape:** `xaat-` + a lowercase-hex UUID, 8-4-4-4-12 (41 in all).
- **Sources:** prefix T1 under R6 (the SDK runtime check); layout and lowercase hex T1 under R5 (one docs response example plus the SDK fixtures).
- **Issuance:** recommended (structure only): one basic, one advanced and one personal token would confirm the layout and case; it does not block the contract.
- **Collisions:** a bare UUID and `xaat-your-api-token` placeholders are unclaimed; the prefix is load-bearing.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1035, merged in redact-secret#1039 and is unreleased).

### `axiom:personal-token` — Personal access token (xapt-)

- **Shape:** `xapt-` + a lowercase-hex UUID (41 in all), used with an org id.
- **Sources:** prefix T1 under R6 and the docs; layout by the shared SDK fixture layout (R5).
- **Issuance:** recommended, as for the API token.
- **Collisions:** as for the API token.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row on `main`; the Beta.12 detector, redact-secret#1035, merged in redact-secret#1039 and is unreleased).

## Open questions

1. Do advanced API tokens share `xaat-`, and is every body a lowercase UUID? The recommended issuance check answers both.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/378581770a87751d72e27529796c4f790649fd00/docs/audits/evidence/1014/README.md) ranks 50 candidates, freezes ten handoffs and records a step-4 disposition for all 50 (merge commit `3785817`, 2026-09-30; the ten handoffs are unchanged since `4f220ea`, 2026-09-29).
- redact-secret#1035 — Beta.12 implementation issue (detector merged to `main` in redact-secret#1039, unreleased).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
