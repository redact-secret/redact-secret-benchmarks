---
decision_id: decision-accept-credential-eval-alpha-16-measuring-core-beta-14-on-snapshot-2026-10-06-4
status: proposed
scope: benchmarks
title: Accept credential-eval v0.1.0-alpha.16 measuring the published @redact-secret/core 0.1.0-beta.14 on snapshot-2026.10.06.4 as the credential qualification evidence
decided_at: OWNER-TO-SET
---

# Accept credential-eval alpha.16 measuring core beta.14 on snapshot-2026.10.06.4

**PROPOSED, NOT DECIDED.** Prepared for #808 / PR #809. Status stays `proposed`; the Decision and the owner statement are the owner's to write.
No agent wrote `benchmarks/qualification-authority.json`.

## Context

PR #809 repins the benchmarks to the published `@redact-secret/core` 0.1.0-beta.14. The credential new path read beta.13 (engine alpha.15, runs of 2026-10-06), so the legacy oracle (beta.14, 133 stable) and the new path (116 stable) differed by 27 unexplained values. The engine pinned beta.13 in its immutable `v0.1.0-alpha.15` configuration, so it could not measure beta.14.

- credential-eval PR #67 (ADR 0021) pinned beta.14 (integrity `sha512-1h5NxUto…Cnag==`) and cut `v0.1.0-alpha.16` at `66db9b53f2232eec5af9b7160da21be879143e6e`. Pin-only: no `crates/*/src` change; protocol, contract revision 1.9 and run-artifact schema (`sha256:cd80c3df…`) unchanged; no tag moved.
- One transient replay branch (`replay/808-beta14-alpha16`, `3a37c38b`: engine alpha.16, product beta.14, `runs: []`; patch kept as data) and the official run `37630100920` (`mode=full`, `omit_optional=openredaction` as the accepted runs). An earlier dispatch, `37623004791`, omitted that input, so OpenRedaction made the methods step run 41 minutes and it was cancelled; nothing from it is recorded.
- Evidence unchanged: `snapshot-2026.10.06.4`, manifest `sha256:d2e966e6…`, corpus `sha256:2319e440…`. Peers gitleaks 8.30.1, trufflehog 3.97.4.

## Facts of the replay

| Population | Semantic digest | Config hash |
|---|---|---|
| policy-corpus | `sha256:47854ffd…` | `sha256:660d8f90…` |
| public-evidence-snapshot | `sha256:4bec6e53…` | `sha256:660d8f90…` |
| public-evidence-snapshot+methods | `sha256:b39f4231…` | `sha256:f469f8d0…` |
| regression-corpus | `sha256:afedeab6…` | `sha256:660d8f90…` |

Each recorded run has two engine runs with equal semantic digests. The archive is release `official-runs-registry-37630100920`, fetched back and verified against the registry.

New-path view: 116 stable, 27 provisional, 1 pending of 144; the legacy oracle at beta.14 reads 133 stable. Parity: 43,363 compared, 36,468 equal, 6,885 expected-structural, **10 unexplained** (not 0). They are one residual:
six legacy-stable beta.14 families (`fly-token`, `pydantic-logfire-token`, `sourcegraph-token`, `square-oauth-application-secret`, `square-token`, `unkey-root-key`) have no case in the accepted evidence, so the new path cannot count them; their evidence differences are explained as `family-not-in-accepted-evidence`, but the status rule in `compareFamilies` does not attribute their reasons to that cause (`causeOfReason`, `parity.ts`); three overview counts follow from them; and four legacy differential ledger entries (4,268 against 4,264 mapped) no longer map to a canonical occurrence of the beta.14 methods run.

## Decision

OWNER-TO-SET

## Consequences

- Policy revision of the candidate view: `rs-policy-1:sha256:ebd6d5c0440ee9363a3373ce76d089e464b2d5313f34992df34b366cf9e98a15`. It differs from `rs-policy-1:sha256:5ff7e7cd…` named in the #808 decision, because the re-keyed ledger map (`benchmarks/support/public-review-ledger-map.json`) is a policy input. That decision does not apply unchanged.
- `authority:check` stays red until the owner renews the authorisation; `adoption:check` needs the accepted record and the adoption report regenerated for the new engine and product.
- Rollback: revert, or set `authority` back to `legacy`.
