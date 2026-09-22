# Alphabet mutations

Status: evaluation method definition v1

## Purpose

Probe whether a detector enforces the credential body alphabet rather than
matching only a prefix and approximate length.

## Inputs

- A canonical positive whose allowed alphabet is supported by reviewed
  evidence.
- One-position substitutions drawn from allowed, disallowed, ambiguous, and
  Unicode character classes.
- A deterministic seed and the mutated byte position.

## Procedure

1. Select a body position that is not a structural separator or checksum field
   unless that field is the declared target.
2. Generate one mutation per relevant character class while holding prefix,
   length, and context constant.
3. Mark each variant `preserve`, `invalidate`, or `review-required` from the
   contract before scanning.
4. Run variants through the registered lexical operator and shared engine.
5. Queue ambiguous variants for human review rather than inferring validity
   from scanner agreement.

## Assertions

- `preserve` variants must be covered.
- `invalidate` variants must be clean.
- `review-required` variants have no pass/fail claim and must enter the review
  queue.
- A mutation must not silently alter UTF-8 offsets or another contract field.

## Reporting

Report source case, operator version, seed, position, original and replacement
character classes, expectation strategy, findings, and assertion status.

## Exit criteria

The method covers every evidence-backed alphabet class and produces identical
variants for the same source hash, operator version, and seed.
