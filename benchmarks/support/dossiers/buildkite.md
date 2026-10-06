---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: buildkite
families:
  - id: buildkite:access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/buildkite/agent/blob/4b52e509c730797c2a97487972fdf99477fd07e6/internal/redact/redact.go#L30-L69
        - https://buildkite.com/docs/platform/security/tokens
      issues:
        - redact-secret/redact-secret#1014
        - redact-secret/redact-secret#1105
        - redact-secret/redact-secret-benchmarks#583
      evidence: https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/buildkite.md
      researchedAt: 2026-09-30
    blockedBy: null
---

# Buildkite

Buildkite is a hosted CI/CD platform; its tokens authenticate API access, agents, jobs, packages and portals. An API access token (`bkua_`, sent as `Authorization: Bearer`, or `BUILDKITE_API_ACCESS_TOKEN` in the CLI and MCP server) reads and controls pipelines and builds within its scopes; agent, cluster and registration tokens let a machine join a cluster and pull the secrets and source of every pipeline the queue serves. Handoff: <https://github.com/redact-secret/redact-secret/blob/3b1a5aa9935c57416a026a44f45501fd41ffeac8/docs/audits/evidence/1014/buildkite.md>. Provider docs: <https://buildkite.com/docs/platform/security/tokens>.

## Families

### `buildkite:access-token` — Tokens (bkua_ and sibling role prefixes)

- **Shape:** one of 15 provider-listed prefixes (`bkua_`, `bkur_`, `bktx_`, `bkaa_`, `bkar_`, `bkct_`, `bkcqt_`, `bkaj_`, `bkjat_`, `bkpt_`, `bkrt_`, `bktr_`, `bkat_`, `bkpat_`, `bkps_`) + 24 to 2048 bytes over `[A-Za-z0-9_.-]`. Bodies are bare hex, an org id then `.` then base58, an org id then `_` then hex, or a three-part JWT (`bkjat_`, `bkaj_`).
- **Sources:** T1 under R2: the provider's own redactor (`buildkite/agent` `internal/redact/redact.go`, merged 2026-09-29) lists the prefixes, the alphabet, the floor 24 and the cap 2048; the provider token docs list nine of the prefixes by role, and six rest on the rule and its comments alone. The provider states no per-type length, so none is claimed. The floor of 24 serving as the T1 floor is ruling Q7 (open, recommendation yes); a floor of 38 is a one-constant change. trufflehog `buildkite/v2` reads only `bkua_` + 40 lowercase hex (T2, lag measured).
- **Scoring:** the seven product finding types (api access, oauth, agent, job, packages, pipeline, portal) share this one grammar and are scored on the detector `buildkite-token`; no arrival family is split off, because no role differs in grammar or evidence.
- **Issuance:** not attempted; the handoff records no issuance gate (an optional structure-only check of one API access token and one agent token is described there).
- **Collisions:** the legacy bare 40-hex API token and the unprefixed agent token have no distinctive shape (unclaimed); `bka_` + 40 alphanumerics has one third-party source (unclaimed); a snake_case identifier that begins with a listed prefix and has a body of 24 or more is the accepted false positive; `jwt` also sees the `eyJ` body of `bkjat_` and `bkaj_`, and the prefixed form wins (R7).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (the detector `buildkite-token`, redact-secret#1105, registered on `main` and unreleased). The benchmark contract is `benchmarks/lib/beta8/583e.ts`.

## Candidates that are not families yet

- **Legacy unprefixed API and agent tokens, `bka_` + 40 alphanumerics.** No distinctive shape or one third-party source; unclaimed until a provider source states them.
- **A body of 2049 bytes and a trailing `.`.** The grammar's cap and the detector's trim leave only the span open; authored as unclaimed twins.

## Open questions

1. Q7 (open): may the provider redactor's floor of 24 serve as the T1 floor although real tokens are at least 38 and no alphabet is narrowed? Recommendation yes.
2. Does the detector report one span from the prefix to the last JWT byte for `bkjat_` and `bkaj_` (R7), and does it trim a trailing `.`? The corpus asserts presence and boundary only, not the span.
3. Are the roles of `bkur_`, `bktx_`, `bkcqt_`, `bkrt_`, `bktr_` and `bkat_` (code comments only) stable enough to name in finding types?

## Research log

- redact-secret#1014 — Beta.12 broad-discovery epic; the handoff above is its record for this family (READY, R2).
- redact-secret#1105 — implementation issue (detector on product `main`, unreleased).
- redact-secret-benchmarks#583 — contract and corpus for the second wave (Buildkite is slice 583e: one T1 contract, floor policy under Q7).
