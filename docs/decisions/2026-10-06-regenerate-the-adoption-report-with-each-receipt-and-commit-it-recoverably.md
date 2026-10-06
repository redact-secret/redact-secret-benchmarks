---
decision_id: decision-regenerate-the-adoption-report-with-each-receipt-and-commit-it-recoverably
status: accepted
scope: benchmarks
title: Regenerate the adoption report when a deployment receipt is recorded, commit the files with a journal, and gate the active report's freshness
decided_at: 2026-10-06
---

# Regenerate the adoption report when a deployment receipt is recorded, commit the files with a journal, and gate the active report's freshness

## Context

Recording the staging and production receipts of `snapshot-2026.10.06.4` changed `benchmarks/evidence-adoption.json`; the comparison state and the Markdown report that quote the receipts were then edited by hand in separate pull requests (#782, #784), and nothing checked that the three agreed. `--from-comparison` also applied the record's state to any comparison it was given. #792 and #793 (epic #785) close both gaps without a new evaluator, a scanner run or an owner decision.

## Decision

- **One command updates the three files.** `record-deployment-receipt.mjs` keeps its verification (run, branch, commit, pages) and then stages the updated record, renders the comparison and the Markdown with the unchanged `compare-adoption-views.ts --from-comparison` from the original inputs, validates them, and commits all three together. Measurements, attribution, counts and owner fields are frozen (`frozenProblems`); only the scope line and the receipts may change. Without `--write` it renders and validates and writes nothing. The same run again keeps the recorded receipt and repairs a stale report; another run still needs `--replace`; the other environment's receipt is preserved.
- **Report files are resolved, never globbed.** `candidate.acceptance.{comparison,report,parity}` when present; otherwise the documented legacy names beside `candidate.changeReport` (`<tag>.comparison.json`, `<tag>.md`), and the parity input only where the committed report carries its section. Missing inputs are refused, never replaced by newer files.
- **The seam checks identity.** `--from-comparison` refuses a comparison or change report whose release, adoption key, engine or replay provenance is not the record's.
- **Recoverable commit.** Renames are not a transaction. Every target must still have the digest the update was staged against (a concurrent edit is refused, never overwritten); new contents are written as `<file>.next`; a journal (`benchmarks/.adoption-commit.json`) renamed into place is the commit point; then the targets are renamed and the journal removed. Before the commit point nothing canonical changed; after it, `adoption-report-sync.mjs recover` (and the next receipt command) rolls forward. A target edited meanwhile is reported, not overwritten. `publishArtifactAndIndex` was not reused: it commits one mutable pointer after an immutable artifact, not several mutable files.
- **Freshness gate.** `npm run adoption:check` re-renders the ACTIVE accepted report locally and refuses stale comparison state or Markdown and a pending journal. It reads no remote, runs no scanner, never rewrites a historical report, and skips a candidate's report (made whole by the prepare command). Repair: `node scripts/adoption-report-sync.mjs render`.

## Consequences

A receipt-only update is one small pull request and no measurement job. The parity input is the current `docs/generated/qualification-parity.json`; once a later adoption replaces it, the earlier report is historical and is no longer checked.
