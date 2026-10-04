---
decision_id: decision-adopt-evidence-snapshots-as-a-candidate-then-an-owner-accepted-repin
status: accepted
scope: benchmarks
title: Adopt evidence snapshots as a candidate first, then an owner-accepted repin that keeps previous runs as historical receipts
decided_at: 2026-10-03
---

# Adopt evidence snapshots as a candidate first, then an owner-accepted repin that keeps previous runs as historical receipts

## Context

#690 asks for a repeatable intake of a published credential-evidence snapshot. The #680 pilot found three gaps: the pinned engine (`v0.1.0-alpha.1`) refuses `snapshot-2026.10.03`
because 75 added cases carry no `content`; `official-runs:check` rejects any run whose evidence is not the population's current pin; and `authority:check` goes red when a
canonical run digest changes without a renewed authorisation.

## Decision

1. **Verify before anything changes.** An adoption first checks the immutable release (manifest digest, listed asset digest and size, source and schema identity, case count) and then that
   the pinned engine can read the snapshot, by validating every case against the engine's own corpus-snapshot schema at the pinned tag. An unreadable snapshot ends in an incompatibility
   report by rule and semantic id; no pin changes and no pull request opens. The snapshot is never altered or filtered here, because its bytes are verified against the manifest and a derived corpus is not an official run.
2. **A candidate state sits in front of the repin.** `benchmarks/evidence-adoption.json` records a verified candidate and its change report while the active pins, runs and authority are untouched, so develop's gates stay green and the old public numbers stay in force.
3. **Previous accepted runs are kept as `historicalRuns[]`**, separate from `runs[]` (which must match the pins), marked historical with what superseded them. The authority check keeps reading `runs[]` only.
4. **The workflow never writes the authority file and never writes an owner acceptance.** Acceptance is an owner-authored commit; `adoption:check` refuses a candidate that carries one.
5. **Idempotent and minimal.** The key is the snapshot and manifest digests plus the engine, configuration and scanner pins; one branch per key; one run at a time; dispatch only; write permissions only in the propose job after a passing preflight. No schedule.

## Consequences

Adoption takes two reviewed changes (candidate, then accepted repin with replay) instead of one, in exchange for a develop that is never red between them. Spec: `docs/specs/evidence-adoption.md`.
