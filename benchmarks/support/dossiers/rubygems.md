---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: rubygems
families:
  - id: rubygems:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/rubygems/rubygems.org/blob/d4cfcc961d08cb5f661f2e5dc0081736233b97ec/app/controllers/concerns/api_keyable.rb#L19-L21
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1023
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/rubygems.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# RubyGems.org

RubyGems.org hosts Ruby gems. An API key (`GEM_HOST_API_KEY`, `~/.gem/credentials`) can push and yank gems and manage owners within its scopes, so a leak is a supply-chain risk for every gem the account owns. OIDC-exchanged short-lived keys come from the same generator.

## Families

### `rubygems:api-key` — API key (rubygems_)

- **Shape:** `rubygems_` + exactly 48 lowercase hex (57 in all).
- **Sources:** T1 under R1: `generate_rubygems_key` returns `"rubygems_#{SecureRandom.hex(24)}"`. GitHub partner pattern `rubygems_api_key` with push protection.
- **Issuance:** not attempted; the grammar is T1 from provider sources, so no key is needed.
- **Collisions:** `rubygems_version` and `rubygems_mfa_required` metadata keys fail the body.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (no row on `main` until the Beta.12 detector, redact-secret#1023, is merged).

## Candidates that are not families yet

- **Legacy unprefixed keys.** No distinctive shape; generic context covers `GEM_HOST_API_KEY=` and `:rubygems_api_key:`.

## Open questions

1. None open.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic (open); [handoff index](https://github.com/redact-secret/redact-secret/blob/4f220ea000b58fa2e0e431ad88dea4eccb393fb0/docs/audits/evidence/1014/README.md) ranks 50 candidates and freezes ten handoffs at `4f220ea`, 2026-09-29.
- redact-secret#1023 — Beta.12 implementation issue (open; the detector is on an unmerged product branch).
- redact-secret-benchmarks#528 — Beta.12 contracts and synthetic corpus for the #1014 families. Corpus work only, no change to the research verdict.
