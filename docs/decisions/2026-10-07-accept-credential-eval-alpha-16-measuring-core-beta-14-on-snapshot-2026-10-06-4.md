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

New-path view: 116 stable, 27 provisional, 1 pending of 144; the legacy oracle at beta.14 (trufflehog 3.97.4) reads 133 stable. Parity: 43,363 compared, 36,468 equal, 6,895 expected-structural, **0 unexplained**. The first rendering had 10; they were one residual and two engineering rules fixed it, each with tests and no hand-tuning:

1. **Six legacy-stable families the accepted evidence does not carry** (`fly-token`, `pydantic-logfire-token`, `sourcegraph-token`, `square-oauth-application-secret`, `square-token`, `unkey-root-key`). Their evidence figures were already explained as `family-not-in-accepted-evidence`; the status rule now attributes the reasons the new path adds to the same cause under the same guard (new-side fixture total 0, legacy total above 0, no case in any population). The three overview counts follow by the exact-sum rule. These six read provisional on the new path until an evidence snapshot carries their fixtures; that is a property of the evidence, not of beta.14.
2. **Four open legacy differential entries** (`90f8742c…`, `36f30269…`: the `generic-token` warn at [780,790) on `authored-provider-neutral--terraform-apply-sensitive`; `8bca218f…`, `186ceb3a…`: the `generic-token` redact at [12,33) on `exa--exa-api-key-your-key-here-placeholder`, each against gitleaks and trufflehog). Evidence from the two methods artifacts (beta.13 run of 2026-10-06 against this run): on beta.13 `redact-secret` flagged both must-not-flag controls (`measurement.flagged: true`, one finding each) and the review queue held the `reference-only` occurrences; on beta.14 both controls are `flagged: false`, zero findings, and the queue holds no occurrence of those cases. The release resolved the false alarms, so the mapping has nothing to map the entries to (`no-canonical-occurrence`, 4268 legacy entries, 4264 mapped; open entries mapped 15 to 11). New cause `observation-resolved-by-release`, recognised only when every unplaced entry is open and joined and their number equals the difference exactly; a settled decision losing its occurrence stays unexplained.

**Proposal for the owner (not applied):** the four entries remain `open` in `benchmarks/review-ledger.json`. Closing them as `resolved` ("the published beta.14 no longer reports this false alarm; verified in run 37630100920") is a ledger decision for you; the parity does not depend on it. 

The adoption report of `snapshot-2026.10.06.4` stays the alpha.15 acceptance's frozen report (it now states the product from the record, `candidate.product`, not from the registry, and its parity section was re-rendered). `benchmarks/known-gaps.json` was re-checked against the new accepted run (`scripts/verify-known-gaps.ts`; measuredVersion, milestone v0.1.0-beta.14 and reverification updated, no record status changed).

## Decision

OWNER-TO-SET

## Consequences

- Policy revision of the candidate view: `rs-policy-1:sha256:ebd6d5c0440ee9363a3373ce76d089e464b2d5313f34992df34b366cf9e98a15`. It differs from `rs-policy-1:sha256:5ff7e7cd…` named in the #808 decision because the re-keyed ledger map (`benchmarks/support/public-review-ledger-map.json`) is a policy input; that decision does not apply unchanged. It did not move after the parity rules were added.
- The only red gates are the owner-only fields: `authority:check` (policy revision, four semantic digests, release and decision in `benchmarks/qualification-authority.json`, and the oracle exit, which names beta.13 and needs a beta.14 exit with its own rollback rehearsal) and this decision being `proposed`. Setting the values below, in a dry run, left exactly those two problems.
- Rollback: revert, or set `authority` back to `legacy`.
