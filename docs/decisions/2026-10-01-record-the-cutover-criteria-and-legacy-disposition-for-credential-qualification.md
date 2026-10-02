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
   credential pages built from the new outputs, and a rollback path. At the first record criteria 1, 2 and 3 were met and 4 to 7 were
   not; the state after #606, #607 and #638 is under "Amended" below.
3. **The authority switch is one committed value, reversible by revert.** `legacy` by default; both pipelines keep running
   in CI while it exists. It is designed here and not built; its file, schema, readers and rollback verification are now specified
   (see "Amended").
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

## Amended 2026-10-01 (#606, #607, #608 after the official runs, the re-key and the case pages)

Nothing is switched, retired or deleted; the legacy path is unchanged and authoritative. What changed is the evidence and two decisions of how to read it.

- **Criterion 4 is met as worded, and the differences are carried.** 0 unexplained of 35,024 compared, re-run unchanged after the case rows were added. The four
  legacy-stable families that read provisional on the new path (127 against 123) are attributed (one `population-separation`, confirmed; three `twin-scope-vocabulary`, inferred), and
  the criterion is about silent drift, not equal verdicts: demanding equal verdicts would erase the change the comparison measures. An attributed difference is not an accepted one,
  so the question moves to criterion 5 and is not closed.
- **Criterion 5 stays unmet.** The mechanism ran end to end for beta.12 and is deterministic across two CI runs. "Qualified" means the result is accepted as the product's qualification,
  and nobody with the authority has accepted 123 in place of 127. This record does not decide the four: pooling is refused (#603), so sendgrid-token needs a product decision (a fourth
  reviewed public control axis, a product policy on the regression corpus, or acceptance of provisional), and the three twin families need the credential-eval and credential-evidence owners
  to confirm the cause and fix the twin scope, which is a repin and a new official run here.
- **Criterion 6 is met for the qualification surface** ([ADR of the case pages](2026-10-01-carry-per-case-rows-in-the-qualification-view-and-page-them-by-scope.md)): overview, family and case
  pages are built only from the view, with an independent recount of every case row. The legacy report pages are deliberately not re-pointed, because that would remove the oracle.
- **Criterion 7 is specified and exercised at the switch.** The setting is `benchmarks/qualification-authority.json` (`legacy` by default, absent means legacy; `next` only with the policy revision,
  semantic digests, parity report digest and an accepted ADR, checked by an `authority:check`). Rolling back is reverting that commit; the legacy files, services and workflow steps stay untouched and the
  legacy outputs are generated, so nothing is restored. The switch PR must rehearse the rollback on both states before it merges, and the legacy measurement is removed only after a further
  published release has been qualified through the new path and compared with 0 unexplained.
- **Who decides the switch.** The maintainer of this repository, in one reviewed commit with an ADR, after the product and engine owners' decisions on the four families and a rehearsed rollback. No workflow or agent flips it.
