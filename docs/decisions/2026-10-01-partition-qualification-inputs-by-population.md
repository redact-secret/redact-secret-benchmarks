---
decision_id: decision-partition-qualification-inputs
status: accepted
scope: benchmarks
title: Partition Redact Secret qualification inputs by population, and keep evidence class and support status on separate axes
decided_at: 2026-10-01
---

# Partition Redact Secret qualification inputs by population, and keep evidence class and support status on separate axes

## Context

#603 (part of #602). The Next app is the first consumer of credential-evidence and credential-eval, with the
legacy site as the oracle. Today `loadCases()` reads this repository's development and regression partitions
together, and the policy-qualified category sits in the development partition, so one classifier pools populations
with different owners and different publication rules. After the split, the public evidence snapshot (Beta.12 pin
done in #600/#601; evidence release `snapshot-2026.10.01.2`) is only one input. Product regression, policy and
protected evidence stay product-owned, and credential-eval measures without emitting a support status.

## Decision

1. **Five populations, each with its own owner, run class, pin and denominator:** `public-evidence-snapshot`,
   `regression-corpus`, `policy-corpus`, `candidate-regression-inputs`, `protected-holdout`. They are recorded in
   `benchmarks/qualification-inputs.json` and described in `docs/specs/qualification-inputs.md`. Populations are
   never concatenated into one denominator; counts are reported side by side with their population id.
2. **Dispositions.** The development partition migrates to credential-evidence (the legacy copy stays as the
   oracle until #608). The regression corpus, the policy corpus and candidate inputs remain product-owned: no
   product regression or policy fixture is forced into credential-evidence. The protected holdout is specialized
   and outside credential-eval. The review ledger, fixture index, peer snapshots, pin manifest and legacy suite
   pins are compatibility-only for the new path.
3. **Run class** is a property of the run: `public` for published-release runs, `internal` for candidate,
   unreleased and protected runs. Candidate and protected populations never carry `public`.
4. **Evidence class is not support status.** The route (T1 documented, T2 empirical, T3 policy-qualified) is read
   from the product-owned overlays, not from the evidence class of a snapshot fixture. An empirically-qualified
   stable family whose public evidence is now project-policy keeps qualifying on its empirical corroboration, and
   its fixtures count in the public denominator with their new class.
5. **No silent status change.** A T2/T3 migration change, fixture override or population move cannot alter a
   family's route or status without a `supportStatusChanges` entry carrying an explicit product-policy reason, a
   decision record and the product policy revision. The checked-in list is empty.
6. **Identity re-key** from legacy ids to canonical ids via the pinned release's `legacy-id-map.json` is recorded
   in the manifest and performed in the switch work (#607); the legacy fixture-index digest pin is dropped and the
   public population binds to the release tag plus manifest digest.

## Consequences

- A structure gate, `npm run qualification-inputs:check`, runs in CI. It checks owners, run classes, denominators,
  pins, paths and the superseded-release refusal. It asserts no ledger value and no product behavior.
- #604 fills the pending run artifact and eval protocol pins; #605 fills the product policy revision.
- Not decided here: whether `policy-qualified-credentials` also exists in the public snapshot. If credential-evidence
  carries it, the policy corpus stays a separate population and its snapshot copy is evidence-class data only.
- Rejected: one pooled corpus with a population column (a column does not stop a rate from being summed), and moving
  regression and policy fixtures into credential-evidence (it would make product behavior public evidence).
