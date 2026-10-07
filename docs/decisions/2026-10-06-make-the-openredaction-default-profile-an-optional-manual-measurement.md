---
decision_id: decision-make-the-openredaction-default-profile-an-optional-manual-measurement
status: accepted
scope: benchmarks
title: Make the OpenRedaction default profile an optional, manual measurement and state plainly when it is not measured
decided_at: 2026-10-06
---

# Make the OpenRedaction default profile an optional, manual measurement and state plainly when it is not measured

## Context

OpenRedaction's default (all-pattern) profile is slow and noisy for credential evaluation: on the accepted snapshot the local exploratory run counted 360,782 findings, of which 1,260 mapped to a credential family and 359,420 were out of scope (personal data, resource identifiers); the methods run reaches 1.79M findings and 40+ minutes. As a required measurement it repeatedly blocked or delayed the results of every other scanner and of core verification (#725: two failed official runs). The owner decided on 2026-10-06 (#723, #763): the default profile becomes an optional, manual measurement, its existing scores stay as history, and its absence from a run is stated explicitly and never blocks anything else. The owner's goal is less CI time and cost, so the existing default profile is not re-measured in full again.

## Decision

1. **A scanner roster in the evaluation contract.** `benchmarks/support/scanner-roster.json` names, per run class (and per population when a population needs its own), the REQUIRED and the OPTIONAL scanners. Official: required `flare-redact`, `gitleaks`, `redact-secret`, `trufflehog`; optional `openredaction` (the default profile). Diagnostic: required `redact-secret`. A run is complete without an optional scanner. A required scanner that is absent or not complete still refuses the view, as before.
2. **Unmeasured is stated, never invented.** The view's `scannerRoster.notMeasured` carries `OpenRedaction default: not measured in this run (optional)`, the reason, and `lastMeasurement`: the newest run of the scanner recorded in `benchmarks/official-runs.json` (run id, engine, configuration hash, scanner version, date; `runs[]`, else `historicalRuns[]`), or `null` when none is recorded. There is no row, count, aggregate, scope accounting or profile effect for the absent scanner, no zero detection and no silent drop. The qualification overview shows the sentence, the reason and the pointer, dashed and muted like every other not-measured fact.
3. **No splice, no side effects.** An optional scanner is in every population of a view or in none (a partial one is refused, as is a methods run whose scanner set differs from its plain run). A credential profile is its own scanner id and never takes the default's slot. Historical default-profile results stay labelled with their run, engine, configuration and date. Dropping an optional scanner changes no other scanner's counts, no family status, no support matrix and no ledger entry: the contract tests build the same synthetic view with and without it and compare. Where something did depend on it, the change is reported: the differential gate reads `gitleaks` and `trufflehog` only (OpenRedaction occurrences were listed per family and never gate-bearing), so the gate, the review queue of the gate peers and the ledger are unchanged; OpenRedaction's own occurrences, its scope accounting and any diagnostic-profile effect against its default are absent for that run and say so.
4. **The roster is not policy.** It names who is measured, not what a status requires. It is not a component of the product policy revision, so `policy.revision` and `npm run authority:check` do not move, and the authority, the pins, the official-runs registry and the engine pin are untouched by this change.
5. **Selecting the omission is explicit.** `omit_optional` (driver `--omit-optional <id>`) runs the official measurement without the scanner, with the engine configuration the roster names for the platform. The driver records `omittedOptionalScanners`, refuses a required scanner, refuses an attribution or candidate run, and checks a retry receipt against the scanner set so a receipt measured with the scanner is never reused without it. The existing configurations and runs stay reproducible: nothing is edited, only added.
6. **Engine side (credential-eval).** The without-OpenRedaction official configurations (`credential-public-v1.without-openredaction.json` and its darwin-arm64 variant) are added beside the existing ones, which are unchanged (credential-eval ADR 0017). They ship with a pre-release that needs the owner's approval to tag and pin. Until then the driver refuses `--omit-optional` against the pinned engine with "engine release pending", and the roster says `engineRelease: pending`.

## Update (#812, 2026-10-07)

Items 5 and 6 are superseded in part by [the default four-scanner selection](2026-10-07-run-the-four-required-scanners-by-default-and-make-openredaction-a-positive-opt-in.md): the without-OpenRedaction configurations shipped with credential-eval v0.1.0-alpha.13 and are in the pinned engine, so no engine release is pending; omitting is now the default, `omit_optional` is deprecated, and OpenRedaction is measured only on the explicit `include_openredaction` opt-in. An attribution or candidate run is no longer refused outright: it must match its control's scanner roster.

## Consequences

- An official run without the default profile can complete, build its view and publish the other scanners and core verification once the engine release is pinned; the pages and reports state the missing optional measurement and link the last one.
- The comparison scanner for credentials is a separately named profile (#764); this decision does not choose it and makes no accuracy claim for any profile.
- Until the engine release exists the benchmarks side is complete except the end-to-end official run, which is pending the tag. Nothing here repins the engine, changes the authority or edits the official-runs registry.
