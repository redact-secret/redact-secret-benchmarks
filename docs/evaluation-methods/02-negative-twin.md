# Negative twin

Status: evaluation method definition v1

## Purpose

Measure whether a scanner distinguishes a canonical positive from a minimally
different invalid or public lookalike. A twin pair prevents an overly broad
detector from improving its apparent performance merely by matching more text.

## Inputs

- One reviewed canonical positive with at least one `secret` span.
- One authored negative fixture with no secret span and `twinOf` pointing to
  the positive.
- Exactly one declared mutation, classified as `prefix`, `length`, `alphabet`,
  `boundary`, `public-prefix`, or another reviewed single property.

## Procedure

1. Copy the canonical fixture without changing its surrounding context.
2. Change one structural property and document the exact before/after values.
3. Prove from the contract or policy why the mutated value is not a secret
   positive.
4. Run both fixtures in the same engine run and scanner configuration.
5. Evaluate the pair as one unit.

## Assertions

- The positive must be `EXACT` or `COVERED`.
- The negative twin must be clean.
- A positive failure, twin false alarm, or both are reported distinctly.
- Multi-property changes are not valid twins and belong in another method.

## Reporting

Report pair ID, positive and twin hashes, mutation kind and explanation,
per-side findings, and pair status. The aggregate is twin discrimination:
pairs with a covered positive and clean twin divided by all eligible pairs.
Untwinned positives are a coverage gap, not an implicit pass.

## Exit criteria

The pair is accepted when the byte difference is minimal and reviewable, the
negative rationale is independent of scanner output, and both sides execute in
one reproducible run.
