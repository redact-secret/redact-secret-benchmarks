# Holdout evaluation

Status: implemented internal lifecycle v1

Implementation and operating procedure: [holdout/README.md](../../holdout/README.md).
Reproducible six-method execution: [Engine v1 qualification](../evaluation-engine-v1.md).

## Purpose

Evaluate a release candidate against cases that were not used to tune detector
implementation or ordinary regression tests. Holdout evidence estimates
generalization within its declared corpus; it does not establish production
accuracy.

## Inputs

- A separately governed, synthetic holdout corpus with reviewed assertions.
- A frozen candidate artifact, scanner configuration, and qualification plan.
- Corpus identity and integrity metadata available without exposing protected
  fixture content in routine development output.

## Procedure

1. Freeze the candidate before revealing or executing holdout cases.
2. Run holdout evaluation through an explicit, non-default workflow.
3. Reuse common scoring and reporting contracts while isolating corpus access
   and lifecycle controls.
4. Publish aggregate and failure evidence at the disclosure level defined by
   the qualification plan.
5. Rotate contaminated cases and record the reason without silently rewriting
   prior results.

## Assertions

- The default development command must not read or execute holdout content.
- Candidate changes after a holdout run require a new qualification run.
- Leaked-span, false-alarm, collateral, and policy results remain separated by
  kind and tier.
- Missing or inaccessible holdout data cannot be reported as a pass.

## Reporting

Report candidate identity, run identity, corpus version and hash, method and
scanner versions, aggregate outcomes, exclusions, and contamination status.
Protected fixture bytes need not appear in public reports.

## Exit criteria

The lifecycle is access-controlled, reproducible by authorized maintainers,
non-default, and has documented rotation and contamination recovery procedures.
