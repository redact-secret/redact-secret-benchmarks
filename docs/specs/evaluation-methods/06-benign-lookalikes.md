# Benign lookalikes

Status: evaluation method definition v1

## Purpose

Measure false alarms on values that resemble secrets but are documented public
identifiers, placeholders, examples, prose fragments, malformed shapes, or
other non-secret controls.

## Inputs

- Synthetic or public, non-live fixtures with no authored `secret` span.
- A taxonomy such as public identifier, documentation literal, placeholder,
  wrong prefix, wrong length, prose, checksum failure, or redacted mask.
- Evidence supporting `must-not-flag`, or an explicit T3 policy rationale.

## Procedure

1. Author the benign rationale independently of every scanner result.
2. Keep each fixture close enough to a real credential to test a specific
   source of overmatching.
3. Separate source-backed controls from project-policy cases.
4. Run controls with the same scanner modes used for positive cases.
5. Record every finding, including multiple findings in one file.

## Assertions

- A strict `must-not-flag` fixture passes only when no finding is emitted.
- Policy cases use the same mechanics but never share a denominator with
  source-backed controls.
- T0 cases are inspectable but unscored.

## Reporting

Report false-alarm rate, flagged-control count, mean findings per flagged
control, taxonomy, evidence tier, observed ranges, scanner version, and input
hash. Never relabel a control because a competitor flags it.

## Exit criteria

Every control has a specific benign rationale and taxonomy, contains no live
credential, and can be reproduced without external secrets or network access.
