---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: sonarqube
families:
  - id: sonarqube:user-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/SonarSource/sonarqube/blob/9ec5e86425011f6c1ffa0eb2db08880e3b347271/server/sonar-webserver-auth/src/main/java/org/sonar/server/usertoken/TokenGeneratorImpl.java#L29-L46
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1021
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/sonarqube.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: sonarqube:analysis-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/SonarSource/sonarqube/blob/9ec5e86425011f6c1ffa0eb2db08880e3b347271/server/sonar-db-dao/src/main/java/org/sonar/db/user/TokenType.java#L24-L27
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1021
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/sonarqube.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# SonarQube

SonarQube Server tokens (`SONAR_TOKEN`) authenticate API calls and analysis uploads. A user token acts as the user, including administration for an administrator; a global analysis token can submit analysis for any project; a project analysis token is limited to one project. Leaks are common in CI configs and in `sonar-scanner -Dsonar.token=…` commands.

## Families

### `sonarqube:user-token` — User token (squ_)

- **Shape:** `squ_` + exactly 40 lowercase hex (44 in all).
- **Sources:** T1 under R1 from the provider token generator and token-type enum.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** the 40-hex body alone is SHA-1 shaped, so the prefix is load-bearing; `sqb_` badge tokens are public (Q5).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row on `main` until the Beta.12 detector, redact-secret#1021, is merged).

### `sonarqube:analysis-token` — Analysis tokens (sqa_, sqp_)

- **Shape:** `sqa_` (global) or `sqp_` (project) + exactly 40 lowercase hex (44 in all).
- **Sources:** T1 under R1 from the same generator and enum.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** as for the user token; `sqx_` with an unknown type letter is not issued.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row on `main` until the Beta.12 detector, redact-secret#1021, is merged).

## Candidates that are not families yet

- **Project badge token (`sqb_`).** Read-only and published in README badge URLs by design (Q5).
- **Unprefixed legacy tokens (before SonarQube 9.5).** 40 hex, SHA-1 shaped; generic context (`SONAR_TOKEN=`, `sonar.login=`) is the only safe signal.
- **SonarQube Cloud `sqco_` tokens.** A different product with no provider grammar found; a separate candidate.

## Open questions

1. Does SonarQube Cloud publish a grammar for `sqco_` tokens?

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/README.md) ranks 50 candidates and freezes ten handoffs at `4f220ea`, 2026-09-29.
- redact-secret#1021 — Beta.12 implementation issue (open; the detector is on an unmerged product branch).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
