---
decision_id: decision-bind-product-scope-to-measured-configuration
status: accepted
scope: benchmarks
title: Bind the product's scope statements to a release and mode line, compare them with the measured configuration, and keep the three kinds apart
decided_at: 2026-10-07
---

# Bind the product's scope statements to a release and mode line, compare them with the measured configuration, and keep the three kinds apart

## Context

#622 (part of #543). PR #703 committed `scanners/product-scope.json`: the product's own out-of-scope statements, read at core 422e43e3, owner-confirmed
on 2026-10-05, validated by `npm run peer-rules:check` and shown on `/evaluation/scanner/`. Its regrooming (2026-10-07) asked for more: under
authority `new` the scanner's identity and configuration come from official observations (PR #747), so a static statement must not stand in for the
configuration that was actually measured; each statement and the detector count must name the product revision they were read at; credential scope,
the optional personal-data profile and unmeasured surfaces must be told apart ("not measured by this run" is not "unsupported by the product"); and the
page needs unknown and history states.

## Decision

1. **Schema 2 of `scanners/product-scope.json`.** Each statement is `{ kind, text }` with `kind` one of `product-scope` (the credential scope the product
   documents it does not cover), `optional-profile` (an optional capability, the personal-data profile, selectors and add-ons, off in the measured
   configuration) and `unmeasured-surface` (a product surface this benchmark does not run). The texts are the owner-confirmed ones, unchanged; only the
   kind is added. `ownerConfirmations` is carried over as it was.
2. **`boundTo`.** The release, its commit, the mode line of the configuration the statements describe, and the check that binds them: `readAt` (422e43e3)
   is an ancestor of the v0.1.0-beta.14 tag (0c62fd38), and each product decision record cited in `sources` has the same git blob at both commits
   (checked 2026-10-07 through the GitHub contents API). That is a mechanical check, not a re-review; it is written down so it can be repeated.
3. **The measured configuration is the observation's, never a static override.** The page reads the product's version and mode line from the run the
   page is built from (the official run under `new`, with its configuration hash; the legacy run under the rollback), shows them as "Measured", and
   states the binding: `Current` when the measured release and mode line equal `boundTo`, `History` when they differ (the statements stay as read for
   their release and are said not to be re-read for the measured one), `Unknown` when no observation of the product backs the build. A mismatch is a
   page state, not a CI failure: a repin must not be blocked on a re-read, and the page says what was and was not re-read.
4. **Detector count.** The registered-detector count states the revision `benchmarks/detectors.json` was read at, whether that is the bound release, and,
   when the run measured another release, that the count is of another revision.
5. **Validation.** `productScopeProblems` (schema 2): the kinds, `boundTo` (release version, 40-hex commit, mode line, a bounded check without judgement
   words), at least one `product-scope` statement, bounded statements without judgement words, permalinked sources, and no "unsupported", "not
   supported", "does not support" or "cannot" in an `optional-profile` or `unmeasured-surface` statement. `check-export-comparison.mjs` checks the built
   page states every statement, the binding and the binding state it recomputes from the view.
6. **Reuse.** The peer registry's `outOfScope` (a flat list per peer) is unchanged; the product keeps its own file because it is not a peer and its
   statements restate the product's decisions, not this benchmark's adapter choices. The page renders a peer's list as before and the product's scope as
   binding facts followed by one list per kind.

## Consequences

- When a new product release is measured, the page says `History` until someone repeats the check (or re-reads the sources) and moves `boundTo`.
- Nothing in the ledger, the view or any run identity changes; the file is not an input of a measurement.
