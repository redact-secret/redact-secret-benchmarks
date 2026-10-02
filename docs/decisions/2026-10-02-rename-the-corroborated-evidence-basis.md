---
decision_id: decision-rename-the-corroborated-evidence-basis
status: accepted
scope: benchmarks
title: Rename the corroborated evidence basis from independently-corroborated to corroborated
decided_at: 2026-10-02
---

# Rename the corroborated evidence basis from independently-corroborated to corroborated

## Context

#648, from the core repository's detection-support audit (`redact-secret/redact-secret#1067`). The evidence basis a T2 family
carries when it qualifies through the corroborated route was `independently-corroborated`, shown as "Independent tool/community
corroboration". "Independent" reads as third-party validation. The comparison is run, and its sources are chosen, by this
project, so the word claims more than the evidence is. Changing only the display label would leave the same word in the JSON
that consumers read.

## Decision

1. The `evidenceBasis` value `independently-corroborated` becomes `corroborated`, and its display label becomes "Corroborated".
   The value is changed in the type and the derivation (`benchmarks/support/status.ts`), the model that validates a published
   matrix (`src/support-model.ts`), the enums of `schemas/support-matrix-v1.json`, `schemas/support-status-report-v1.json` and
   `schemas/qualification-view-v1.json`, the Next story data, the tests and the live specs.
2. Wherever the label is explained there is one legend line: "Corroborated: checked against other tools and community sources;
   the comparison is run by this project." It is on the Support page legend and is the definition of the "Stable by empirical
   route" overview number.
3. No status, tier, profile or count changes. The regenerated matrix equals the previous one with the value substituted, except
   for `generatedAt`, `runId` and the scanner observation timestamps of the run.
4. The schema file keeps its name and `schemaVersion` 1, as the earlier enum changes did (`qualification-profile` gained
   `policy-qualified`, commit `a66dbef9`): this repository carries no schema revision counter for the matrix, and a
   consumer pins the commit of `schemas/support-matrix-v1.json`. A matrix carrying the old value fails the new schema, and a
   matrix carrying the new value fails the old one, so a consumer that has not re-pinned fails closed.

## Consequences

- Frozen records keep the value they were written with: `evidence/`, `docs/reports/` and the earlier decision records name
  `independently-corroborated`. They are history, not a live contract, and a matrix generated before this change does not
  validate against the new schema.
- `benchmarks/support/status-criteria.json` and `benchmarks/support/fixture-profiles.json` still mention independent corroboration
  in rationale prose. Both are components of the qualification policy revision, so editing the prose moves
  `benchmarks/qualification-authority.json`'s authorised policy revision and needs the reviewed re-authorisation that
  [`docs/specs/qualification-cutover.md`](../specs/qualification-cutover.md) describes. This record does not do that; the words
  are a follow-up for the same commit that re-authorises.
- The core repository re-pins the schema and the matrix and updates its generator, drift check, their tests and
  `docs/specs/evidence-and-gates.md`.

## Rejected

- Renaming only the label: the JSON consumers read would keep the word.
- Aliasing both values in the enum: a matrix would then carry either spelling for the same basis, and the drift check would read
  a pure rename as a change.
