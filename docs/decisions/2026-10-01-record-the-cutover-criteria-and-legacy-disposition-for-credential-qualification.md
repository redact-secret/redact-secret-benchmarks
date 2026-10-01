---
decision_id: decision-record-the-cutover-criteria-and-legacy-disposition-for-credential-qualification
status: accepted
scope: benchmarks
title: Record the cutover criteria and the legacy disposition for credential qualification, and change nothing yet
decided_at: 2026-10-01
---

# Record the cutover criteria and the legacy disposition for credential qualification, and change nothing yet

## Context

#608, part of #602. #607 compared the legacy and the new qualification path at the same release and peer identities
(docs/generated/qualification-parity.md). The epic says the legacy credential evaluator may be retired only after parallel
qualification is demonstrated, and that the existing site is not deleted in the same change as an evaluator cutover unless
#543's UI criteria are met independently. #632 left a question open: does the Next app still read the fixture index and the
review ledger?

## Decision

1. **This record deletes, retires and switches nothing.** It states the cutover criteria and which are met, and gives every
   legacy credential file a disposition. Authority stays with the legacy path.
2. **Seven criteria, all required** (docs/specs/qualification-cutover.md): pinned identities, deterministic official
   artifacts, preserved product populations, no unexplained verdict drift, one release qualified end to end and accepted, Next
   credential pages built from the new outputs, and a rollback path. At this commit criteria 1, 2 and 3 are met; 4 to 7 are
   not.
3. **The authority switch is one committed value, reversible by revert.** `legacy` by default; both pipelines keep running
   in CI while it exists. It is designed here and not built.
4. **Four dispositions per file.** keep (shared with the new path or product-owned), compat-only (read by the legacy path or
   by the Next app until it migrates), other-domain (PII, performance, MCP, the protected holdout), remove-after-cutover (the
   legacy credential measurement). Files the adapter imports are keep, so removing the evaluator cannot remove them.
5. **The Next app's legacy reads are stated.** It reads `benchmarks/fixture-index.json` (catalog service, validated and
   counted against the built catalog) and the committed legacy support-status records, the run reports, the taxonomy, the
   dossiers and the known-gaps file. It does not read the review ledger or the review queue.
6. **A recorded input can be stale against the code.** `qualification-inputs.json` calls the review ledger compatibility-only,
   but the adapter reads it; the record is corrected with the re-key, not here.

## Consequences

- The next steps are decisions, not code: a methods-enabled official configuration, the axis vocabulary of the public
  snapshot, the policy-corpus floors, the twin scope, the re-key. Each is a recommendation in the #607 report.
- Removal can proceed file by file once the criteria are met and the oracle period ends, with each file's callers listed first.
- Non-credential domains cannot be removed by accident: they are named in the disposition.

## Rejected

- Retiring the evaluator on the strength of equal outcomes on the product populations: the verdicts still differ.
- Flipping authority per family: a mixed state has no single oracle and no clean rollback.
- Deleting the legacy site UI with the evaluator: #543 owns it.
