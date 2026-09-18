# Boundary cases

Status: evaluation method definition v1

## Purpose

Test the exact edges at which a valid credential begins, ends, or becomes
invalid. Boundary evaluation catches off-by-one ranges, accidental substring
matches, truncation, and delimiter handling that a canonical positive cannot.

## Inputs

- A reviewed canonical value and contract.
- Authored cases for minimum and maximum documented length, adjacent valid and
  invalid characters, start/end of file, and relevant token delimiters.
- Exact secret spans and optional envelopes whose widening has a stated policy
  reason.

## Procedure

1. Derive one boundary dimension at a time from the contract.
2. Create cases immediately inside and outside each boundary.
3. Include UTF-8, CRLF, no-final-newline, and neighboring-token cases where
   byte boundaries can differ from character boundaries.
4. Classify each case before scanner execution as positive, control, policy, or
   pending.
5. Run all cases with identical scanner settings.

## Assertions

- Inside-boundary positives must be covered without leaked bytes.
- Outside-boundary controls must remain clean.
- Reported ranges must align to valid UTF-8 boundaries.
- Findings beyond an authored envelope are `OVERBROAD`, not equivalent passes.

## Reporting

Group outcomes by boundary dimension and distance from the boundary. Preserve
the exact input, expected range, envelope, observed ranges, and contract clause
that defines each edge.

## Exit criteria

Every documented length, delimiter, and character boundary has at least one
inside and one outside case, or an explicit explanation of why that pairing is
not meaningful.
