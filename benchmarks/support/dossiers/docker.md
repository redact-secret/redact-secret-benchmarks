---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: docker
families:
  - id: docker:personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.docker.com/reference/api/ai-governance/api.yaml
        - https://docs.docker.com/reference/api/hub/latest.yaml
      issues:
        - redact-secret/redact-secret#648
        - redact-secret/redact-secret#370
        - redact-secret/redact-secret#566
        - redact-secret/redact-secret-benchmarks#128
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/648/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: docker:oauth-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.docker.com/reference/api/ai-governance/api.yaml
        - https://docs.docker.com/reference/api/hub/latest.yaml
      issues:
        - redact-secret/redact-secret#647
        - redact-secret/redact-secret#708
        - redact-secret/redact-secret#566
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/647/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Docker

Docker Hub issues personal access tokens (PAT) and organization access tokens (OAT). The taxonomy labels the second family "OAuth access token"; Docker and GitHub secret scanning both call the `dckr_oat_` credential an *Organization* Access Token, and the prefix is the same, so this dossier treats them as one family. Provider documentation:
the credential table in Docker's [AI Governance API reference](https://docs.docker.com/reference/api/ai-governance/api.yaml).

## Families

### `docker:personal-access-token` — Personal access token

- **Shape:** prefix `dckr_pat_` then a 27-character body from `[A-Za-z0-9_-]`. 69 of 92 distinct non-placeholder public bodies were 27 characters; of those, 27 contained `_` and 19 contained `-`.
- **Sources:** T1 for the prefix (the API reference's `bearerAuth` table lists `dckr_pat_*`, a glob). Length and alphabet: TruffleHog 3.97.4, Nosey Parker, betterleaks, and Docker-owned rules in `docker/mcp-gateway` and `docker/portcullis`; the Docker-owned rules are narrower (no `_`) and contradicted by the public tally. The Hub spec's PAT examples are 15-character placeholders.
- **Issuance:** not attempted. An optional check of one or two fresh PATs is described in the #648 broad-discovery pass.
- **Collisions:** shares the `docker-token` detector and the `dckr_` namespace with the OAT family; the PAT width under the OAT prefix is a boundary case.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row for both Docker families); evidence [#648 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/648/README.md).
- **Open caveat:** The dckr_pat_ prefix is T1; the 27-character body and its alphabet are tool-corroborated only (no Docker page states them).

### `docker:oauth-access-token` — OAuth access token

- **Shape:** prefix `dckr_oat_`. Body: Docker's Hub API example shows 27 alphanumeric characters; TruffleHog 3.97.4 says 32, and the scanners that state 32 trace back to it. Core accepts 27 or 32 since [redact-secret#708](https://github.com/redact-secret/redact-secret/issues/708).
- **Sources:** T1 for the prefix (same table). The 27-versus-32 question is not settled by any Docker statement; every Docker-authored artefact that shows a width shows 27.
- **Issuance:** needs an organization owner on a Team or Business plan; a fresh OAT is the only thing that can settle 27 versus 32 (checklist in the #647 broad-discovery pass).
- **Collisions:** see the PAT family; an OAT-width body under the PAT prefix (or the reverse) is a boundary case; core accepts 27 or 32 body bytes for `dckr_oat_` since #708.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#647 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/647/README.md).
- **Open caveat:** The dckr_oat_ prefix is T1; body width (27 in Docker's example, 32 per TruffleHog) is undecided by the provider and no fresh OAT has been measured.

## Candidates that are not families yet

- Docker Hub legacy password and `docker login` credentials: no lexical shape.

## Open questions

1. OAT body width and alphabet on a freshly issued token.
2. Should the taxonomy label read "Organization access token"? Docker and GitHub both use that name.
3. Whether a PAT-width body under the OAT prefix is a positive; core treats it as one after #708.

## Research log

- [redact-secret#648](https://github.com/redact-secret/redact-secret/issues/648) — PAT T1 evidence: prefix FOUND, body not provider-stated (2026-09-23).
- [redact-secret#647](https://github.com/redact-secret/redact-secret/issues/647) — OAT T1 evidence: prefix FOUND, 27 versus 32 open (2026-09-23).
- [redact-secret#708](https://github.com/redact-secret/redact-secret/issues/708) — product fix: `dckr_oat_` accepts 27 or 32 body bytes (closed 2026-09-24).
- [redact-secret#566](https://github.com/redact-secret/redact-secret/issues/566) — earlier benchmark finding that shape-1 positives asserted lengths the contract denied; its [2026-09-21 comment](https://github.com/redact-secret/redact-secret/issues/566#issuecomment-5765951969) settled the research question: `dckr_pat_` + 32 is not issued (three sources, including osv-scalibr, give 27), the contract was not widened and the fixture was corrected.
- [redact-secret#370](https://github.com/redact-secret/redact-secret/issues/370) — the 2026-09-17 contract freeze that separated PAT and OAT validation.
- [redact-secret-benchmarks#128](https://github.com/redact-secret/redact-secret-benchmarks/issues/128) — corpus regeneration at the frozen 27-byte PAT length.
