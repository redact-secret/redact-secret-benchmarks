# RunArtifact to qualification adapter

Issue: [#605](https://github.com/redact-secret/redact-secret-benchmarks/issues/605), part of epic
[#602](https://github.com/redact-secret/redact-secret-benchmarks/issues/602).
Decision: [Run credential-eval officially once per population](../decisions/2026-10-01-run-credential-eval-per-population-and-adapt-run-artifacts.md).
Inputs: [official-runs.md](official-runs.md), [qualification-inputs.md](qualification-inputs.md).
Output contract: `schemas/qualification-view-v1.json`. Consumer: the Next app (#606).

The adapter is the one boundary between credential-eval RunArtifacts and Redact Secret qualification. Support status
(`stable`, `provisional`, `pending`, `unsupported`) is computed here, by the existing rules in `benchmarks/support/status.ts`,
and never in credential-eval. This repository measures and records: the adapter asserts no product behavior.

```bash
npm run qualification:view -- --artifacts <dir> [--out public/results/qualification-v1.json] [--holdout-receipt <aggregate.json>]
```

`<dir>/<population>/artifact.json` is one population's artifact (the output of the official-run driver). The file is
written only after it validates against `schemas/qualification-view-v1.json`. Same artifacts and same product inputs
write the same bytes: there is no clock, host or path in it.

## What the adapter does, and refuses to do

It does: validate each artifact's schema tag and the whole document against the vendored RunArtifact v1 schema; bind it
to its population (`manifest.evidence`, engine version and protocol, official run class, every scanner complete); build
per-family and per-scanner counts for each population; combine populations by product policy without pooling; join
product contract, taxonomy, empirical, review-ledger and known-gap data; apply `classifyFamilySupport`; and stamp the
product policy revision.

It does not: re-run the lattice from ranges (it counts `span_outcomes`, `flagged` and the published aggregates), redefine a
scanner outcome, read `non_semantic`, treat a public evidence class as support status, move policy into credential-eval,
or erase the source population. One invalid artifact stops the view; it is never skipped silently.

## Populations combine by role

`benchmarks/support/population-policy.json`:

| Population | Role | Feeds |
| --- | --- | --- |
| `public-evidence-snapshot` | `floors-and-gates` | evidence floors, fixture-profile cells, and the zero-tolerance gates |
| `regression-corpus` | `gates` | the zero-tolerance gates only |
| `policy-corpus` | `policy-route` | the T3 policy-qualified route only |

1. A case is keyed by `(population, case_id)`. The same id in two populations is two rows.
2. Counts are never summed, averaged or pooled. Every population keeps its own denominator (`denominator` equals its id).
3. Floors and cells come from the `floors-and-gates` population alone.
4. A zero-tolerance gate (twin failures, benign false alarms) is evaluated in each gate-bearing population. The classifier
   receives the worst population; `families[].gates` shows every population's value side by side.
5. The route (documented T1, empirical T2, policy-qualified T3) is read from the product contract and empirical overlays,
   never from the `evidence_class` a case carries. A project-policy label on a public fixture changes nothing.
6. A view is `public` only when every artifact is `publication: public` and its population is publishable. One internal
   artifact makes the view `internal`.

## Attribution

The public snapshot names taxonomy families (`provider:family`); the product populations name detector ids. A case belongs
to a product detector family when its `targets` name one, or its `family` is a detector id, or its `family` is a taxonomy
family served by a detector (`benchmarks/support/taxonomy.json`). A case that maps to none is counted under the
population's `unattributed` counts, and its family is listed in `unmappedFamilies`; it is never dropped.

## Derivation of the status inputs

`FamilySupportEvidence` (legacy `benchmarks/support/evidence.ts`) is built from the artifacts as follows. Where the artifact
has no source the field is stated as such.

| Legacy field | Source in the new path |
| --- | --- |
| `family`, `detectors`, `positiveContractTier`, `hasProviderSource` | product contract table (`assessment.ts` `contracts`) |
| observation, corroboration, contradiction, uncertainty, supported-context fields | `benchmarks/support/empirical-observations.json` (product overlay) |
| `evidenceBasis` | derived from the tier and the empirical route, as before |
| `positiveCases`, `positiveAxes`, `totalFixtures`, `contextTwinPairs`, `confusionAxes` | floors population cases of the family: `kind`, `twin_of`, `group`, `twin_mutation_kind`; pending (T0) and not-measured cases fill no cell |
| `benignCases`, `benignAxes`, `benignAxisIds`, `controlAxes` | non-twin controls: axis is `taxonomy` when present, else `group` |
| `twinPairs` | twin controls whose positive was scored, in the floors population |
| `twinFailures` | pairs that did not discriminate (a positive span not EXACT or COVERED, or the twin flagged), worst population |
| `benignFalseAlarms` | flagged non-twin controls, worst population |
| `metamorphicCriticalFailures`, `mutationUnresolvedCritical`, `differentialUnresolvedContractDisagreements` | `S.assertions` and `review_queue[]` joined with the ledger, only when the method ran (`manifest.methods`); otherwise unmeasured |
| `policyQualification` | the policy-route population's cases, the product `expectedAction`, `policyConformance` and `contextAxis` keyed by case id, the holdout receipt, and the criteria of `policy-qualified-credentials.json` |
| `fixtureProfile` | claim from the contract, cells from the floors population |

Unmeasured methods fail closed: if a required method (`metamorphic`, `mutation`, `differential`) is not in the floors
artifact's `manifest.methods`, a family that would be `stable` is held at `provisional` with the reason `methods.notRun`.

## Parity map to the legacy path

| Legacy input or output | New path | State |
| --- | --- | --- |
| support-status inputs | `families[].evidence`, as above | derived from artifacts and product overlays |
| family counts and floors | floors population cells; thresholds are `status-criteria.json` and `fixture-profiles.json`, unchanged | derived; axis vocabulary differs, see Parity gaps |
| twin, benign requirements | per-case twin and benign measurements | derived |
| mutation, metamorphic, differential requirements | assertions and review queue | unmeasured with the official configuration |
| review-ledger joins | occurrence `id` looked up in `review-ledger.json` | needs the re-key (#607): legacy ids are legacy hashes, so a queue entry reads unresolved |
| known-gap evidence joins | `knownGaps[]`: a record's fixtures matched to cases by id in each population | product populations share the legacy ids; public ids differ until the re-key |
| source-report identities | `populations[].artifact` and `policy.revision` | replaces `scannerObservations`, `fixtureIndex`, `revision` |
| status distribution, stable profiles | `distribution`, `stableDistribution` | computed from `families[].status` |

## Parity gaps (for #607, recorded rather than hidden)

Compared against the legacy path, with each difference attributed to a structural cause, in
[qualification-parity.md](qualification-parity.md) and `docs/generated/qualification-parity.md`.

1. **Methods.** The official configuration runs none, so no family can read `stable` through this path until a
   configuration that runs them is pinned (a new `config_hash`) or the policy changes. The legacy path is the oracle.
2. **Axes.** The public snapshot has no benign taxonomy and its group vocabulary is credential-evidence's, so positive
   and control axis counts differ from the legacy fixture axes. The mapping is explicit in `population-policy.json`.
3. **Policy route.** The policy corpus is small (a bounded contract for four families), so its floors can fail where the
   legacy path pooled every T3 fixture targeting the family. Whether the floors or the corpus change is a product policy
   decision.
4. **Disputed properties** (`disputedProperty`) are keyed by legacy fixture ids and are not applied to the public
   population until the re-key.
5. **Taxonomy families with no detector** appear in the public snapshot and are reported in `unmappedFamilies`.
6. **Ledger ids** as above.

## Product policy revision

`policy.revision` is `rs-policy-<adapter version>:sha256:<hex>`: the SHA-256 of the canonical JSON of
`{adapter, components}`, where each component is one benchmark-owned qualification input and its digest is of its parsed
content: `status-criteria.json`, `fixture-profiles.json`, `policy-qualified-credentials.json`,
`empirical-observations.json`, `taxonomy.json`, `population-policy.json`, `review-ledger.json`, and the contract facts of
`assessment.ts` (tiers, provider sources, patterns, supported contexts; validator functions excluded).
Whitespace and key order do not move it. A threshold, route, tier, record, taxonomy entry, ledger decision or population
role does. A re-measurement of unchanged inputs does not. `supportStatusChanges` in `qualification-inputs.json` cite this
stamp (the gate checks its format).

## The view (for the Next app)

Top level: `schema` (`redact-secret/qualification-view/v1`), `adapter`, `publication` (`public`|`internal`), `policy`,
`populations`, `scanners`, `distribution`, `stableDistribution`, `families`, `undetected`, `knownGaps`, `unmappedFamilies`.

- `policy`: `revision`, `components[]` (path, digest), `criteria` (the thresholds as applied), `populations` (roles),
  `methodsRequired`, `rules`.
- `populations[]`: `population`, `role`, `denominator`, `runClass`, `artifact` (digests, engine, protocol, `configHash`,
  `evidence`, publication, `methods`, scanners with version, build, mode and configuration hash), `unattributed[]`
  (per-scanner counts), `aggregates[]` (the engine's published `groups` and `byTarget`, verbatim, withheld figures kept).
- `families[]` (one per scored product detector family, sorted): `taxonomyFamilies[]`, `contract`, `status`
  (`value`, `reasons`, `qualificationProfile`, `evidenceTier`, `evidenceBasis`, `methodsNotRun`), `evidence`
  (`FamilySupportEvidence`), `fixtureProfile`, `gates[]` (per gate-bearing population), and `populations[]` each with
  `scanners[]` of `{scanner, counts}`. `counts` are `cases`, `pending`, `notMeasured`, `positives` (`must-redact`,
  `policy`: spans, outcomes, leaked and collateral bytes), `benign` (`cases`, `flagged`, `findings`) and `twins`
  (`pairs`, `discriminated`, `flagged`, `coDetected`).
- `undetected[]`: taxonomy families with no detector. `knownGaps[]`: the join described above.

A page that shows a count shows it with its population. No field is a sum across populations or scanners.

## Tests

`tests/qualification-adapter.test.mjs` builds synthetic artifacts and asserts the rules relative to what it built:
no ledger value, family count or digest read from the committed tree is asserted, because a repin re-keys them.
