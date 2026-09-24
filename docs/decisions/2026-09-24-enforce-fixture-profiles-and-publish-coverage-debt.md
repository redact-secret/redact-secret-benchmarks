---
decision_id: decision-enforce-fixture-profiles-and-publish-coverage-debt
status: accepted
scope: benchmarks
title: Enforce fixture profiles by claim and publish per-family coverage debt
decided_at: 2026-09-24
---

# Enforce fixture profiles by claim and publish per-family coverage debt

## Context

[Issue #206](https://github.com/redact-secret/redact-secret-benchmarks/issues/206)
(part of #114 and #177) replaces the single small-sample floor with explicit
fixture profiles so that a total fixture count cannot hide an empty evidence
cell. `status-criteria.json` counts pass rates over whatever evidence exists;
nothing stated how much of each kind must exist.

Before any status changed, the profiles were measured against the registered
families with pinned peers (TruffleHog 3.97.4, `npm run eval:classify`, 57
families: 34 stable, 21 provisional, 2 pending). Cells are counted from the
corpus alone. Result, in `docs/generated/fixture-profile-coverage.md`:

- 1 of 57 families meets the 24-fixture arrival cells.
- **0 of the 34 stable families meet the 24-fixture documented cells.** Their
  debt is mostly positive/context cases (25), non-twin benign controls (28),
  positive-context axes (27) and control axes (29); most stable families are
  twin-heavy with 5 benign controls and one positive context.
- 0 families meet either empirical profile.

## Decision

- Criteria are `benchmarks/support/fixture-profiles.json`, versioned
  (`schemaVersion`, `profilesVersion`), validated against
  `schemas/fixture-profiles-v1.json`. Every profile requires every base cell
  (total, positive/context cases, non-twin benign controls, twin pairs), so no
  cell can be empty, plus axis counts. Floors follow the issue: 24 / 24 / 40 / 48.
- A family **claims** a profile in its contract (`fixtureProfile`); a T1
  provider-documented family implicitly claims `stable-documented`.
  `classifyFamilySupport` refuses `stable` to a family that misses a *binding*
  claim, naming each short cell, and fails closed on a missing measurement. A
  claim is binding when it is explicit, or when the profile's own
  `enforcement` is `enforced`.
- `arrival-provisional` and `stable-documented` ship with `enforcement:
  reported`. Enforcing them today would move all 34 stable families to
  provisional with no detector regression, contradicting the beta.8 epic's
  invariant that no previously stable family regresses. The debt is published
  instead, and flipping `enforcement` is the ratchet (the same mechanism as
  `benign.minimumAxes`), taken when #207/#209 raise the families.
- `stable-empirical` and `context-constrained-empirical` are `enforced` from the
  start and require T2 evidence, so a T2 family is never relabelled T1 to fit
  and T3 policy families cannot satisfy them. They also carry pending gates
  (observation records #205, corroboration #177): until the classifier enforces
  those, a claim of either profile can never reach `stable`.
- Debt (cells, axis counts, remaining shortfall against the family's target
  profile) is carried in `support-status.json`, the support matrix and the
  support page. `npm run profiles:generate` writes the scanner-independent
  report and the spec's criteria table; `npm run profiles:check` in CI rejects
  drift in either.
- Wilson bounds are described as corpus-relative in the spec and the UI copy.

## Consequences

- No status changes in this decision: the measured distribution is identical
  before and after.
- Axis definitions are deliberately simple and versioned. Positive-context axes
  are the fixture `group` values; a coarse group under-counts real context
  diversity, which shows as debt rather than a false pass.
- The observation/corroboration gates (#177, #205) remain the work that makes an
  empirical claim satisfiable.
