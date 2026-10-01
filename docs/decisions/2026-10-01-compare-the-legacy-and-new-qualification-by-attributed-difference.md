---
decision_id: decision-compare-the-legacy-and-new-qualification-by-attributed-difference
status: accepted
scope: benchmarks
title: Compare the legacy and the new qualification by attributed difference, not by parity
decided_at: 2026-10-01
---

# Compare the legacy and the new qualification by attributed difference, not by parity

## Context

#607, part of #602. The legacy path pools one development partition per family and classifies from it; the new path runs
credential-eval once per population and qualifies from the artifacts through the adapter (#604, #605). The epic asks for the
two to run in parallel at the same release and peer identities with "every difference explained". The first look at the
canonical linux-x64 artifacts showed a view with no stable family against 127 legacy-stable ones, and an obvious temptation:
adjust the new path until the numbers match. That would measure the legacy path against itself and hide the architecture
change being evaluated.

## Decision

1. **The comparison is not a parity test.** It does not try to make the paths identical. It asks whether values that SHOULD
   be equal are equal, and whether every other difference has a named cause.
2. **Three classes.** Must-equal (release and peer identities, family membership, product-owned facts, per-case scanner
   outcomes on cases present in both paths, known-gap inputs); expected-structural (a difference attributed to a named
   structural change by a rule that checks the data for it); unexplained (a failure to investigate). The causes are a closed
   registry in `benchmarks/qualification/parity.ts`, each `confirmed` or `inferred`. A reclassification of the evidence class
   is never a cause.
3. **Attribution is checked, not assumed.** A count residual is attributed only when the amounts the matched cases show sum to
   it exactly; a dropped status only when every reason the new path adds has a cause; a method that did not run is "not
   measured" even when the numbers are equal.
4. **Per-case outcomes join by content where ids differ.** Product populations share the legacy ids. The public population
   joins by the SHA-256 of the bytes, expected ranges and fixture name, loosened one key at a time, and pairs only a key held
   by one case on each side. Shared content is counted as ambiguous, never guessed. It needs the evidence snapshot the artifact
   ran on, checked against the artifact's corpus digest.
5. **One script, deterministic output.** `npm run qualification:parity` writes `docs/generated/qualification-parity.json` and
   `.md` from the legacy outputs and the canonical artifacts, with no clock, host or path in them. It names each compared
   artifact's recorded run and says so when it is not a canonical run. `--strict` fails on an unexplained difference.
6. **Recommend, do not apply.** The report recommends the product decisions its findings need (a methods-enabled
   configuration, the axis vocabulary, the policy-corpus floors, the twin scope, the re-key). It applies none.
7. **Tests assert logic on synthetic data.** No test asserts a ledger value, a count or a digest read from the committed tree.

## Consequences

- At the canonical runs the report found that the status gap has more than one cause. Only the families held back by the
  unmeasured methods alone would change with a methods-enabled configuration; most are held by the public snapshot's axis
  vocabulary, which no methods run changes. The cutover decision (#608) cannot read the missing stable count as one defect.
- Every scanner's outcome on every regression and policy case equals the legacy outcome. On the public population the
  differences are twin controls whose flagged or co-detected verdict differs and a handful of count residuals; one count
  difference is unexplained and listed.
- The report goes stale with any repin or new run and is regenerated from one command. A methods-enabled run is a new
  comparison, not a re-verification of this one.

## Rejected

- Tuning the adapter or the population policy until the numbers match: it would hide the change under evaluation.
- Comparing only headline counts: two paths can agree on a total and differ on every case.
- Treating any difference as acceptable because the architecture changed: a difference without a recognised cause is a bug
  until shown otherwise.
