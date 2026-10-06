---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: sourcegraph
families:
  - id: sourcegraph:access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/sourcegraph/sourcegraph-public-snapshot/blob/c864f15af264f0f456a6d8a83290b5c940715349/internal/accesstoken/personal_access_token.go#L13-L48
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1103
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/sourcegraph.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Sourcegraph

Sourcegraph is a code search platform; a personal access token authenticates the API and `src` CLI. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/sourcegraph.md>.

## Families

### `sourcegraph:access-token` — see the taxonomy row

- **Shape:** `sgp_` + an optional instance identifier (`local`, 16 hex issued, or any alphanumeric run per the 2025-11 validator) + `_` + exactly 40 hex (the generator emits lower case; both validators accept either case).
- **Sources:** T1 (provider generator and validator, R1 and R9). READY for `sgp_`. The benchmark contract and seeded corpus are authored (#583, slice c): positives in the #860 contexts and the provider-native contexts (`Authorization: token`, MCP env block, `src login`, CI env), one-property twins (body length, alphabet, separator, prefix case, boundary) and benign, public-id, placeholder and reference controls. Unclaimed (T0, no assertion): an identifier over 32 bytes (detector policy cap), `sgph_` and `sgd_` + 64 hex (Cody Gateway).
- **Issuance:** not attempted; the handoff records no issuance gate.
- **Collisions:** the bare 40-hex legacy token and git SHAs (a git-SHA control sits in the corpus), `sgp_` placeholders in `src` help text; see the handoff's excluded shapes.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector is registered on `main`, redact-secret#1103, unreleased). The benchmark contract is `benchmarks/lib/beta8/583c.ts` (T1, `sourcegraph-token`), with the corpus in `fixtures/generated/beta8/583c.mjs`. Pinned peers (trufflehog `sourcegraph`, gitleaks `sourcegraph-access-token`) read a 16-hex or `local` identifier and a bare 40-hex; lag on an alphanumeric identifier is measured, not assumed.

## Candidates that are not families yet

- **`sgph_` prefix.** Accepted by both provider validators, but nothing states what issues it; unclaimed until the maintainer confirms.
- **`sgd_` + 64 hex (Cody Gateway user key).** One provider source, a derived token; deferred extension.

## Open questions

1. Does Sourcegraph issue `sgph_` tokens, and does any instance use an identifier longer than 32 bytes? The structure-only issuance checklist in the handoff would settle both.

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family.
- redact-secret#1103 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contracts and corpus for the second wave; contract and seeded corpus authored in slice c (`583c`).
