---
decision_id: decision-record-an-engine-and-product-candidate-on-identical-evidence-and-separate-its-effects-by-an-attribution-run
status: accepted
scope: benchmarks
title: Record an engine and product candidate on identical evidence next to the accepted adoption, and separate its effects with an attribution run
decided_at: 2026-10-04
---

# Record an engine and product candidate on identical evidence next to the accepted adoption, and separate its effects with an attribution run

## Context

#697, part of #690 and #680. The accepted adoption measures `snapshot-2026.10.04.3` with credential-eval alpha.4, whose adapters pin `@redact-secret/core` beta.12. credential-eval v0.1.0-alpha.5 pins beta.13 by registry integrity and ships the beta.12 pair for attribution. The evidence is unchanged, so the adoption entry point answered `already-pinned`, and a candidate record requires the candidate not to be the active pin.

## Decision

1. **Record it as `engineCandidate`, next to the accepted adoption.** The accepted record, the active registry, runs and authority stay as they are; the candidate carries `ownerAcceptance: null` and the gate enforces identical evidence, a compatible engine and an existing report. `--supersede` replaces a recorded one. This repository never accepts it.
2. **Replay with an attribution run.** The workflow takes an `attribution` input (the registry's `attributionRuns`, the engine's own beta.12 configuration and Node shim directory, always together). Candidate (alpha.5, beta.13) against attribution (alpha.5, beta.12) is the product effect; attribution against the accepted run (alpha.4, beta.12) is the engine and configuration effect. Attribution artifacts are archived apart and never recorded as runs.
3. **Zero unexplained differences.** `compare-replay-effects.ts` matches by semantic key and calls a path identity (engine, configuration or product version, integrity, digests, occurrence ids derived from them) or outcome; any other path is unexplained.
4. **Pins ride on a transient branch**, kept as a patch; nothing merges the candidate's pins.
5. **Triage is rules over recorded evidence; the review ledger is not edited.** Proposals are data. A restored status would rest on maintainer-only and project-policy evidence and is the owner's decision.

## Consequences

The replay of snapshot-2026.10.04.3 on alpha.5 and beta.13 differs from the accepted runs in identity fields only, in all four artifacts; no status moves, so the beta.13 identity can be accepted or not without changing a number. Production remains on hold and no deployment receipt is recorded. Spec: `docs/specs/evidence-adoption.md`, report `docs/generated/evidence-adoption/snapshot-2026.10.04.3.engine-alpha.5.md`.
