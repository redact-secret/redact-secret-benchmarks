---
decision_id: decision-judge-axis-floors-on-the-union-of-axis-labels-across-populations
status: accepted
scope: benchmarks
title: Judge axis floors on the union of axis labels across the product's populations, and sum no count
decided_at: 2026-10-02
---

# Judge axis floors on the union of axis labels across the product's populations, and sum no count

## Context

#641, part of #602, refs #607, #608, #636 and #638. After #638 one legacy-stable family was held by a floor on the new path:
sendgrid-token reads `documented.minimumControlAxes: 3 < 4`. The family's public control cases name three axes; the legacy pooled
count of the same family had four, because the legacy classifier read the development and the regression fixtures in one
denominator. #603 forbids that denominator: no report, adapter or page adds two populations' counts into one rate.

#638 read the difference as a gap the product cannot close ("a fourth reviewed control axis in the public snapshot, or a policy on the
regression corpus"). That framing treated credential-evidence as the only evidence. It is not: Redact Secret is qualified by credential-eval
on credential-evidence data plus the project's own data (the regression and policy populations of #603), and the project can supply its own
evidence without asking another repository.

The two things a pooled floor mixes are different in kind. A **count** (cases, controls, twin pairs, fixtures) is a denominator: summing
populations' counts changes the rate the floor reads, and regression fixtures, each authored to pin one defect, would inflate it. An **axis
label** (the source context of a positive, the reviewed benign taxonomy of a control, the mutation kind of a twin) is a name. An axis floor asks
how many distinct kinds of evidence the family has. That is a property of the set of labels, and a set of labels can be taken across
populations without summing anything.

## Decision

1. **An axis floor is judged on coverage: the union of the axis labels across the populations that `population-policy.json` `axisCoverage`
   names** (the public snapshot, the regression corpus and the policy corpus, the populations the legacy path pooled). It covers the positive
   context axes (`positiveAxes` and the fixture-profile positive-context cell), the benign control axes (`controlAxes`, `benignAxes`) and the
   confusion axes (`confusionAxes`, the control axes and the twin mutation kinds).
2. **Counts stay per population.** `positiveCases`, `benignCases`, `twinPairs`, `totalFixtures` and every fixture-profile case cell are the
   floors population's own, exactly as before. A product population contributes labels only. The twin and benign zero-tolerance gates are
   unchanged (worst population, never a sum). `axisCoverage` is in `rs-policy-1`'s digest as part of `population-policy.json`.
3. **One vocabulary.** A label is the legacy classifier's: a control's reviewed axis (`controlAxis`), a positive's `<category>/<fixture group>`
   (the fixture group alone for the profile cell). The public population gets it from the product axis overlay (#636), a product population from
   its own case taxonomy and case metadata. A product population that holds a byte-for-byte copy of a fixture (the twin-scope corpus,
   [ADR](2026-10-02-gate-cross-provider-twins-through-a-project-twin-scope-corpus.md)) names its original's category (`axisCategory`), so a copy
   adds no label of its own.
4. **Visible.** `families[].axisCoverage` lists every covered axis with the populations that supplied it, in the view (additive: the schema stays
   `v1`, the Next app reads none of it). A report or page that shows an axis count can show who supplied it.
5. **Every family, one rule.** The rule is the policy's, applied to every family; there is no sendgrid-token case in the code. The effect is read
   from the data (below), not chosen.

## Consequences

Measured on the canonical public, policy and regression artifacts, relative to #638 (123 stable on the new path):

- Exactly one family changes status because of this decision: **sendgrid-token** (provisional to stable). Its covered control axes are
  near-miss (public, regression), ordinary-prose (regression), placeholder (regression), public-identifier (public) and the snapshot's own
  `sendgrid-near-miss-values` (public). The four labels the legacy path counted are all covered; the fifth is public cases with no legacy
  counterpart (`canonical-evidence-membership`), so the new path counts five where the legacy path counted four, and the report says so.
- Four more families cover more axes and keep their status: aws-access-key (stable before and after), bearer-token, connection-string and
  generic-token (provisional before and after: the T3 policy route's own gates, which read the policy corpus alone and are not changed here). Every other family has no product-population case in
  an axis the public snapshot lacks, and reads the same numbers as before.
- No count changes for any family, so nothing here moves a denominator, a rate or a zero-tolerance gate.

## Rejected

- **Pooling counts** (the legacy denominator): contradicts #603, lets defect-pinning regression fixtures inflate a floor.
- **A sendgrid-token rule** (a family-specific exception or a lowered threshold): the next family with the same shape would need its own, and
  the thresholds are `status-criteria.json`'s and are not changed here.
- **Waiting for a fourth public axis in credential-evidence**: the evidence exists in the product's own corpora; asking another repository for
  it is a dependency this project does not have.
- **A union over every population including candidate or protected ones**: internal populations are never mixed into a public result
  (#603 denominator rule 5); `axisCoverage` names populations explicitly and the policy validator refuses an unknown one.
