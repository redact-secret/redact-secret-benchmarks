# Regression freeze

Status: evaluation method definition v1

## Purpose

Convert an accepted failure or release result into a durable comparison point
so later changes cannot silently reintroduce leaked spans, false alarms,
overbreadth, or measurement drift.

## Inputs

- A complete, schema-valid evaluation run from a clean or explicitly recorded
  revision.
- A named release or qualification version.
- Reviewed decisions for intentional behavior changes.

## Procedure

1. Confirm the run is complete and all reports share one run ID.
2. Freeze fixture hashes, scanner versions and modes, outcome codes, engine and
   report schemas, lockfile hash, revision, and dirty state.
3. Store the baseline under `baselines/<version>.json`.
4. Compare future complete runs by stable fixture and scanner identity.
5. Require a reviewed explanation for every changed row before replacing a
   released baseline.

## Assertions

- New `PARTIAL` or `MISS` outcomes fail the freeze.
- New false alarms on `must-not-flag` controls fail the freeze.
- Increased collateral or an `EXACT`/`COVERED` result becoming `OVERBROAD`
  fails unless an authored policy change explains it.
- Missing cases, stale source hashes, incompatible schemas, or incomplete runs
  invalidate the comparison rather than passing it.
- Improvements are reported but do not erase the historical baseline.

## Reporting

Publish changed rows only, with old and new outcomes, leaked and collateral
byte deltas, input hashes, versions, run IDs, and the approving decision for
intentional changes. Keep historical baselines immutable.

## Exit criteria

A clean checkout can reproduce the candidate run, the comparison accounts for
every baseline row, and no unexplained regression remains.
