---
decision_id: decision-retire-the-support-matrix-drift-contract-and-keep-the-legacy-rollback
status: accepted
scope: benchmarks
title: Retire the support-matrix drift contract, keep every file the legacy rollback still reaches
decided_at: 2026-10-07
---

# Retire the support-matrix drift contract, keep every file the legacy rollback still reaches

## Context

The oracle exit is recorded and not reopened here
([2026-10-05](2026-10-05-record-the-oracle-exit-and-retire-the-legacy-credential-evaluator.md)). #657 and #658
switched the publication and the Next consumers and handed #660 one removal that no workflow reaches:
`npm run eval:matrix:drift`, which diffed two legacy-shaped support matrices (`supportMatrixProblem`, the
`sourceReport` provenance) and wrote `support-matrix-drift-v1`. Everything else the evaluator owns is reached
through the `legacy` branch of `publish-site.yml`, `legacy-oracle.yml` or `with-authority.mjs legacy`, which the
oracle ADR retains: an oracle exit is not blanket permission to remove rollback.

The caller evidence was recomputed on `develop` for this change (`node scripts/legacy-callers.mjs <file>`, plus a
search of the workflows, `package.json`, `web/`, `scripts/`, `tests/`, docs and the skills):

| File | Callers |
| --- | --- |
| `benchmarks/support-matrix-drift.ts` | `package.json` (`eval:matrix:drift`) only |
| `benchmarks/support/drift.ts` | `benchmarks/support-matrix-drift.ts`, `tests/support-matrix-drift.test.mjs` |
| `schemas/support-matrix-drift-v1.json` | the same two |
| `tests/support-matrix-drift.test.mjs` | its own subject |
| `docs/specs/support-matrix-drift.md` | documentation links only |

No workflow (`publish-site.yml` in either branch, `legacy-oracle.yml`, `validate.yml`), no web service, no script
and no skill calls it; the legacy rollback (`with-authority.mjs legacy`, the legacy export, `check:routes`) does
not either. The only open question #657 left was whether another artifact replaces the contract.

## Decision

1. Remove the five files above, the `eval:matrix:drift` package command, and the live mentions in
   `docs/specs/support-matrix.md`, `ARCHITECTURE.md` and `docs/specs/product-candidate-replay.md`. Historical ADRs
   and `evidence/` keep their text; they describe what was true when they were written.
2. The comparison it offered is carried by artifacts that bind their inputs: the parity report's `matrix` section
   (`qualification:parity`, legacy against view, 0 unexplained) for a release, and `qualification:candidate-diff`
   (with `--verify-tarballs` and the freshness binding) for a product candidate. Neither is a gate this repository
   decides on; the product release workflow owns the verdict.
3. Nothing else is removed. A sweep of every tracked script, schema and benchmark file for zero non-test callers
   found no further evaluator piece: the remaining zero-caller files are evidence-report renderers, frozen
   corpora and other-domain tooling (PII, performance, MCP, calibration) that this issue does not own, and no npm
   dependency is unused. `eval:qualify`, `eval:candidate`, `eval:classify`, `eval:matrix`,
   `scripts/publish-support-matrix.ts` (legacy branch), `credential/{runner,contract,cases,methods,operators}`,
   `lib/reporting`, `lib/baselines`, the legacy loaders in `web/services/`, `web/scripts/check-export*.mjs`, the
   fixture index and the peer observations stay: each has a live caller through the rollback or the oracle, listed
   in the inventory of [qualification-cutover.md](../specs/qualification-cutover.md). Their removal is the
   retirement of the rollback itself, which is the owner's step.
4. credential-eval's compatibility retirement (ADR 0014, credential-eval#33): no reader disappeared. The only real
   reader from this repository is still `benchmarks/qualification/evaluation-evidence.ts` (the four `legacy:*`
   validators); the drift contract never read credential-eval. Its D2 to D6 steps stay in credential-eval.

## Consequences

- `npm run eval:matrix:drift` no longer exists. A release candidate's matrix change is read from the parity report
  or the candidate diff.
- The publication, the view, the view support matrix, the provider dossiers and both Next exports (`new` and
  `legacy`) are byte-identical before and after (hashes in the cutover document).
- The retained rollback is exactly as it was; it is retired only by an owner decision about the `legacy` branch.
