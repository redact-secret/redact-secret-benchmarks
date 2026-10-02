---
decision_id: decision-gate-cross-provider-twins-through-a-project-twin-scope-corpus
status: accepted
scope: benchmarks
title: Gate cross-provider twins through a project twin-scope corpus that carries the parent's family
decided_at: 2026-10-02
---

# Gate cross-provider twins through a project twin-scope corpus that carries the parent's family

## Context

#641, part of #602, refs #607, #608 and #638. Three families (anthropic-admin01-key, anthropic-api01-key, elevenlabs-api-key) read
`twinFailures: 2` on the new path and were held at provisional (`twin-scope-vocabulary`). The public snapshot gives a cross-provider twin (a
value wearing another provider's key class with the parent's body) no family, so credential-eval cannot scope it and reads a finding of another
known detector as flagged. The legacy path scoped the twin by its parent's contract and read the same finding as co-detected. #638 recorded
the cause as inferred and left it to credential-evidence or credential-eval. The project does not need to wait: it can carry the same
twins itself and measure them.

## Experiment

The six twins (two per family) were taken from the legacy authored fixtures (`beta8-384a`, `beta8-384c`), the same bytes the public snapshot
publishes, and carried with their parents in a project-owned category, `twin-scope-regressions`. A twin's family is the contract of the
positive it twins, which is how the legacy fixtures declare it. credential-eval v0.1.0-alpha.1 was run on the regression population with the
pinned engine and the pinned gitleaks 8.30.1 and trufflehog 3.97.4 (a local darwin-arm64 run, verification only, never compared with a
canonical run). Result: all six twins read `flagged: false, co_detected: true`, and all six positives read EXACT, so every pair
discriminates. The legacy path read the same twins as co-detected, and the parity report compares all five scanners' outcome on the twelve
cases with the development originals: equal. The inferred cause is confirmed: giving the twin its parent's family fixes the verdict.

## Decision

1. **The twin-scope corpus is a product regression-corpus addition, qualification-only.** `fixtures/generated/twin-scope.mjs` selects the
   twelve fixtures from the authored builders by id (nothing is re-authored); `corpora/regression/manifest.json` lists the category under
   `qualificationCategories`. It is not a generated corpus file, a legacy partition category or a catalog entry, so the legacy path, fixture
   index and report neither load nor count it (the legacy oracle reads the same 18,573 cases). It is a case population of the regression
   population, with its own denominator; it is never mixed into the public population's denominator. The regression population's corpus digest
   and release tag change, so it has a new pin and a new canonical run.
2. **A generated map names which public twin each project case stands for.** `benchmarks/support/public-twin-scope-map.json`
   (`npm run qualification:twin-scope`, `--check`, `--validate`) is derived by an exact content join (content, expected spans, fixture name,
   one to one) between the public twins the snapshot gives no family and the project twin cases that carry one. Six of the 22 family-less public
   twins map. It is bound to the public corpus digest and is a component of the `rs-policy-1` digest.
3. **The twin gate reads the project case for a mapped twin.** In the public population's gate row, a mapped twin is taken out of
   `twinFailures`; its engine verdict is shown (`twinPairsScopedElsewhere`, `twinFailuresScopedElsewhere`) and is not gate-bearing. The project
   case is counted in the regression population's own gate row, and the classifier still receives the worst population, so a project twin that
   fails still blocks the family. A family-less public twin the map does not name keeps counting. The floor still counts the public twin pair as
   published; nothing is summed. The adapter refuses a map naming a case an artifact lacks, a public twin that has a family, or a project case
   that has none.
4. **Public evidence is untouched.** The public measurement, the evidence class and the snapshot are unchanged; the public engine verdict on
   the unscoped copy stays a reported difference (`twin-scope-vocabulary`, now confirmed). A request to credential-evidence to give such a twin
   its parent's family is filed as an improvement at the source; the qualification does not depend on it.

## Consequences

- anthropic-admin01-key, anthropic-api01-key and elevenlabs-api-key read stable (no gate reason remains), with no change to any threshold.
- The regression population grows by twelve cases (six pairs); the public population and the policy population are unchanged.
- When the evidence release gives such twins a family, the map regenerates to fewer or no entries and the project copies become redundant
  but harmless.

## Rejected

- Adding the category to `categories.json` and the regression partition: it would put the copies into the legacy loader, the fixture index,
  the pin manifest, the peer snapshots and the review ledger, changing the oracle for no measurement gain.
- Dropping the public twins' failures from the gate without a counterpart: it hides a verdict nobody re-measured; the map requires a
  content-identical project case and the case decides.
- Re-scoring the twin in the adapter from findings: the adapter does not recompute an engine verdict.
- Waiting for credential-evidence or credential-eval: the project has the data and can measure the claim itself.
