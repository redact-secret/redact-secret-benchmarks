---
decision_id: decision-bind-the-acceptance-package-to-the-controls-scanner-selection
status: accepted
scope: benchmarks
title: Bind the acceptance package to the control replay's scanner selection and refuse a mismatched roster or a stale control
decided_at: 2026-10-07
---

# Bind the acceptance package to the control replay's scanner selection and refuse a mismatched roster or a stale control

## Context

`scripts/prepare-acceptance-package.mjs` assembles the owner's reviewable package (recorded runs, registry-format archive, derived inputs, candidate view, parity report, patch) from the control replay. It was written when every control measured five scanners and checked none of them: the package of a control that omits the optional OpenRedaction default (the retained run 37630100920, and every default Full run since #813) had never been prepared (#773; "wait for the run-registry shape decision" is settled by #763 and #812). The scanner set was therefore implicit in five different surfaces, and a control of another roster, or a control whose archive no longer matched the adoption record, would have produced a plausible package.

## Decision

1. **One reading of the control's scanner set.** `scripts/acceptance-roster.mjs` takes it from the control's recorded case counts (and checks the recorded `scannerSelection`, when present, against them). The package is prepared for the four required scanners by default; the OpenRedaction default needs the explicit `--include-openredaction`, the same positive opt-in as everywhere else (#813). A control of another roster, one lacking a required scanner, naming an unknown one or contradicting its own record is refused before anything is built, with the two ways out the replay tooling already names.
2. **Every surface is reconciled, and a mismatch refuses the package.** The archive's run records against the adoption record (a stale control), the recorded runs, the archive file, the derived-input receipt, the view (`scannerRoster.measured` and a `notMeasured` statement for each omitted optional scanner) and the strict parity report, by scanner set, digest and configuration hash.
3. **The package records the identity it was prepared under** as `candidate.acceptance.scannerSelection`, and `adoption:check` binds it to the control replay without I/O. A package prepared before this decision records none and is accepted as it was.
4. **Authority boundaries are unchanged.** The package never fills `acceptedBy`, `acceptedOn` or the decision status, never reads or writes `benchmarks/qualification-authority.json`, changes no pin, run, ledger row or support status, and applies nothing. The selection block is identity only.

## Consequences

- A without-OpenRedaction control backs a package exactly as a five-scanner one did; the view says OpenRedaction default was not measured and the parity report explains its absent side as `optional-scanner-not-measured`, as before.
- Regression evidence is bounded: `tests/acceptance-package-roster.test.mjs` with a retained slice of run 37630100920 and synthetic surfaces. No replay, dispatch or scanner is needed.
- A historical five-scanner control is still preparable with `--include-openredaction`.
