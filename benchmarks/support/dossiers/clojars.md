---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: clojars
families:
  - id: clojars:deploy-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/clojars/clojars-web/blob/442eb895e7ab3449161848d8c368d4783c5f0067/src/clojars/db.clj#L799-L853
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1025
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/clojars.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Clojars

Clojars is the Clojure artifact repository. A deploy token is the password for deploying artifacts (`CLOJARS_PASSWORD`, `~/.lein/credentials`, Maven `settings.xml`), optionally scoped to a group or artifact; a leak is a supply-chain risk.

## Families

### `clojars:deploy-token` — Deploy token (CLOJARS_)

- **Shape:** `CLOJARS_` (uppercase, case-sensitive) + exactly 60 lowercase hex (68 in all).
- **Sources:** T1 under R1: the generator and the server validator `#"^CLOJARS_[0-9a-f]{60}$"` agree.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** `CLOJARS_USERNAME`/`CLOJARS_PASSWORD`/`CLOJARS_ENVIRONMENT` variable names fail the body.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row on `main` until the Beta.12 detector, redact-secret#1025, is merged).

## Candidates that are not families yet

- **Legacy account passwords.** No shape; generic context only.

## Open questions

1. None open.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/README.md) ranks 50 candidates and freezes ten handoffs at `4f220ea`, 2026-09-29.
- redact-secret#1025 — Beta.12 implementation issue (open; the detector is on an unmerged product branch).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
