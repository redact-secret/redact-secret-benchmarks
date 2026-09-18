# Canonical positive

Status: evaluation method definition v1

## Purpose

Establish that a scanner detects a provider-documented or otherwise reviewed
credential shape in its simplest valid form. This is the seed measurement from
which twins, boundary cases, permutations, and mutations are derived. It proves
fixture-relative coverage; it does not prove that a credential is live or that
production recall is known.

## Inputs

- One synthetic fixture containing at least one authored `secret` span.
- A reviewed format contract, evidence tier, rationale, and target detector.
- Optional `companion` spans and an authored cover envelope.
- Provider evidence for T1, tool or structural corroboration for T2, or an
  explicit project-policy rationale for T3. T0 cases remain observable but
  unscored.

## Procedure

1. Construct a synthetic value that satisfies the pinned format contract.
2. Place it in the smallest representative context, normally a bare value or
   direct assignment.
3. Record exact UTF-8 byte ranges, span roles, evidence, source hash, and
   contract version before running any scanner.
4. Run every selected scanner against identical bytes without exposing the
   expectation or evidence tier to adapters.
5. Score each secret span with the v4 outcome lattice.

## Assertions

- Each secret span must be `EXACT` or `COVERED`.
- `OVERBROAD`, `PARTIAL`, and `MISS` are failures even when some secret bytes
  were found.
- A scanner result must never create or revise ground truth.

## Reporting

Report per-span outcome, leaked bytes, collateral bytes, actual ranges, scanner
version and mode, fixture hash, contract evidence, and run identity. Aggregate
only within the same assertion kind and evidence tier.

## Exit criteria

The case is useful when its construction is reproducible, its contract is
reviewable, and every result can be traced to exact input bytes. Passing this
method alone is not sufficient for a support claim.
