# Remaining evaluator removal package (#851)

Current consumers are separated by #868 and #869. Normal publication selects
artifact consumption under each independent new authority (#870). The replaced
UI and its dedicated checks are removed independently (#852). These changes do
not reopen the recorded credential oracle exit or grant a PII exit.

## Credential rollback

The credential oracle exit and #660 remain complete. The supported `legacy`
authority still reaches the old strict benchmark, classifier, qualification,
matrix and candidate runners through `publish-site.yml`, `legacy-oracle.yml`,
`web/services/credential-source.ts` and the explicit authority rehearsal. Removing
these callers requires a decision to retire that supported one-value rollback,
not another oracle-exit measurement. The owner-retained protected-holdout kernel,
frozen legacy review queue and current benchmark policy remain separate.

The removal package is the checked file table in
[`qualification-cutover.md`](qualification-cutover.md#file-level-inventory-and-cleanup-order-653),
the current neutral graph in [`credential-consumer-boundary.md`](credential-consumer-boundary.md),
and the explicit producer table in [`publication-producers.md`](publication-producers.md).
Recompute `node scripts/legacy-callers.mjs <file>` before each deletion. Import
edges, type-only references, executable command/workflow callers and inert path
mentions must be considered separately. An implementation-only test is removed
with its implementation and is not a reason to preserve a retired runner.

When rollback retirement is recorded, remove its workflow branches and Next
loaders first, recompute callers, then remove only disconnected runners/scorers
and their dedicated tests and aliases. Keep genuine discovery, performance,
protected-holdout, qualification policy, input validation and ledger readers.
Do not change authority readers or owner authorisation values incidentally.

## Independent PII exit

The current public/synthetic authority is new. The PII oracle removal needs one
further release or candidate measured through both pipelines, a regenerated
dual-run report with **zero unexplained differences**, a fresh rollback rehearsal
against the same target, a reviewed file/caller removal package, and the owner's
exit decision. `2027-01-02` is a review date and deletes nothing automatically.
Protected execution remains pending and does not block current-consumer or UI
separation.

The checked 67-file starting inventory is
`docs/generated/pii-legacy-inventory.json`; the new contract, validation and
product-policy boundaries are in
[`pii-publication-boundary.md`](pii-publication-boundary.md). The explicit
`--bounded-population-oracle` route preserves historical comparisons; the normal
consumer refuses a raw legacy population bundle. Engine measurements retain
their own scorer and population identities and are never relabelled as `b11`
qualification quantities.

Verify the existing recorded prerequisites with:

```sh
npm run authority:check
npm run legacy-inventory:check
npm run pii:authority:check
npm run pii:legacy-inventory:check
npm run pii:migration:check
npm run pii:scorer-basis:check
npm run pii:comparison:check
```

A new target's dual measurement and `pii:authority:rehearse -- --write` belong to
its reviewed exit package. This cleanup does not dispatch additional official
runs, manufacture owner criteria, or overwrite accepted pins and evidence.

## Integration checks

The final removal PR must verify engine consumer identities and honest missing
states, current and supported rollback Next exports, schema and policy gates,
discovery/ledger continuity, and post-merge staging publication. Preserve deleted
originals with immutable source identities and independently retrieved archives,
following [`legacy-ui-retirement.md`](legacy-ui-retirement.md).
