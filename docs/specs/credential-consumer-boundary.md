# Credential consumer boundary (#868)

## Owned inputs and derived statistics

The new-authority report consumes the verified qualification view. The engine
owns each recorded scanner outcome, leaked/collateral byte count, flagged state,
finding count, co-detection observation, scanner identity and artifact/run
identity. The evidence owns expected-span metadata, the case stratum and twin
relationship. Benchmarks validates the artifacts and owns population selection,
qualification floors/gates, taxonomy/ledger joins and support classification.
This change does not score a scanner's ranges, execute a scanner or derive a
support verdict in the presentation consumer.

`benchmarks/consumer/credential-metrics.ts` derives presentation groups from
those recorded observations. Its DTO has no `actual` range or scanner execution
field. It sums outcomes and counts, derives expected-secret byte denominators
from evidence metadata, and applies the existing accounting 1.1 rules. The
consumer's `RecordedCredentialRow`, `RunSummary`, `AccountedGroup` and metric
identities are independent of `benchmarks/types.ts` and the retained evaluator.
`credential-identity.ts` preserves the credential artifact identity byte for
byte. `benchmarks/shared/statistical-primitives.ts` is the byte-identical
relocation of the mathematical primitives, including Wilson endpoints,
rounding, ratio denominators and minimum-evidence rules.

These derived statistics retain their previous semantics:

- PARTIAL and MISS outcomes contribute to leaked spans. Reported leak and
  collateral byte counts are carried unchanged; they are never recalculated
  from range offsets. Companion spans do not enter the secret-byte denominator.
- A selection accounts a group over its own suites. Selected pending T0 rows
  and the selected positives' measured twins travel with it; pending rows in
  another suite do not dilute that group's measurable share.
- Twin coverage uses pairs/positives. Discrimination requires every positive
  outcome to be EXACT or COVERED and an unflagged twin; an OVERBROAD positive
  does not demonstrate discrimination. Co-detection is a separate observation.
- Rates retain numerator, denominator, `n`, rounding and pessimistic Wilson
  direction. Thin groups, inadequate measurable share and inadequate twin
  coverage retain their existing withholding reasons. Ratios remain unbounded.
- The report uses only the population with role `floors-and-gates`. Regression
  and policy populations stay separate. Detector selections overlap and are
  never added together. No population or scanner is pooled with another.
- Unsupported/not-measured scanners and unmeasured cases contribute no invented
  zero row. A pending row remains pending; missing/unusable/unauthorised views
  preserve their existing explicit states and publication failure behavior.

## Runtime and type graph

Before the move the bridge's runtime path was
`credential-bridge -> credential/run-summary -> credential/accounting ->
scoring/lattice`; `credential-source` reached it through `accounting/index`.
The bridge's ScoredRow and RunSummary imports were type-only, but coupled the
current DTO to removable evaluator files. Loading the authority seam also
eagerly loaded the rollback catalog/run modules.

The current metric runtime is:

```
credential-source -> credential-bridge -> consumer/credential-metrics
                                    -> credential-catalog
consumer/credential-metrics -> shared/statistical-primitives
                            -> consumer/credential-identity
```

`credential-catalog.ts` owns unchanged catalog indexing and validated
product-owned taxonomy/detector labels. It has no corpus, fixture-index, old
report or old run reader. Catalog types are imported there directly by the
current bridge/source. `RunLoad`, `MeasuredRun` and row/host types imported from
service modules are type-only and execute no rollback loader. The metric
module's accounting configuration import is also type-only.

The authority seam's `legacySource()` dynamically imports `catalog.ts` and
`run.ts` only when the legacy branch or explicit `loadLegacySource()` oracle is
called. The new branch neither loads old run metadata nor falls back to it.
Artifact validation, current qualification policy/support data, evidence case
metadata validation and review disclosure retain their original boundaries.

## Retained compatibility and removal owners

| Retained path | Reason and owner | Removal prerequisite |
| --- | --- | --- |
| `accounting/shared/primitives.ts` | Compatibility re-export for the retained evaluator/oracle; benchmarks owns the caller migration. | Repoint every inventoried caller to the neutral boundary before deleting the shim; #851/#868. |
| `credential/identity.ts` | Removed after both accounting and the domain composition root switched to `consumer/credential-identity.ts`; the identity remains byte-identical. | The #851 retained-original manifest records the source commit, digest and independently retrieved archive. No evaluator or rollback runner is removed. |
| `credential/run-summary.ts` | The supported oracle's cross-suite summary producer and selection wrapper. Its DTO/schema export resolves to the neutral consumer; its wrapper preserves old range diagnostics. Owner: benchmarks legacy rollback. | Retire/repoint the suite summary writer and supported rollback readers, with exact caller inventory; #851. |
| `credential/accounting.ts`, `scoring/lattice.ts` | Legacy raw-range scorer/diagnostics, dual-accounting transition, supported protected-holdout kernel and oracle outputs. The shared statistic function receives those already computed counts. Owner: benchmarks oracle/holdout maintainers. | Each remaining execution/diagnostic consumer must be repointed or retired under its own recorded gate; this move is not that retirement. |
| `benchmarks/types.ts` metric exports, `catalog.ts` catalog exports | Compatibility DTO/function exports for existing oracle and downstream callers. Current bridge/source use the neutral modules. Owner: benchmarks rollback. | Remove only after the caller inventory is empty; #851/#852. |

The consumer never implements the raw-range scorer. The legacy accounting
wrapper supplies its existing v1.0 counts and range diagnostics to
`accountRecordedCounts`; the current consumer supplies counts derived solely
from engine-recorded observations. Both use one presentation-statistic rule
implementation. Current groups omit range diagnostics because the view does
not carry offsets needed to compute them.

## Verification

`tests/credential-consumer.test.mjs` uses synthetic observations and compares
all groups and selected groups against the retained oracle, including pending
rows in unrelated suites, twins, companion spans, envelopes, OVERBROAD outcomes,
minimum-denominator and coverage/share withholding. It verifies unchanged
rates, bounds and `n`, separate populations, ignored raw-range fields and
fail-closed invalid observations/configuration. Its runtime import guard
traverses the current bridge and rejects evaluator, scorer, legacy accounting
and eager rollback-loader dependencies; type-only imports are excluded from
runtime edges explicitly.

The existing accounting/domain/run-summary tests retain their oracle,
identity and deterministic-output coverage. The existing synthetic bridge,
authority/source, catalog and page tests exercise unchanged current support
verdicts and rollback/missing-view behavior. No test asserts a pinned ledger
count. CI import registration and legacy caller inventories must describe the
neutral modules and retained compatibility callers, and the CI plan must treat
consumer and shared-statistic changes as inputs to both current and oracle
checks/cache identities.
