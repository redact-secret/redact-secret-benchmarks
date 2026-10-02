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

`<dir>/<population>/artifact.json` is one population's artifact (the output of the official-run driver). The floors
population also carries its methods run, `<dir>/<population>/methods/artifact.json`, when one was made (below). The file is
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

## The methods run

The metamorphic, mutation and differential gates are measured by a second official run of the floors population (docs/specs/official-runs.md,
"The methods run"), supplied to the adapter as `methodsBytes` of that population. Its cases are generated variants
(`<case id>--<method>--<variant>`), so it never feeds a floor: the floors come from the plain artifact, whose cases are the corpus
cases, and a plain artifact that lists methods is refused. The adapter validates the methods artifact the same way (schema, evidence
binding, official run class, every scanner complete) and also requires that it measured the same scanners as the plain run (equal
version, configuration hash and build per scanner) and lists at least one method. A family's methods evidence is attributed through
the seed case of each row: an assertion or review occurrence is keyed by the evaluation case id `<case id>--<method>`, and counts for a
family when its seed case id is one of the family's floors cases. A required method the methods run does not list is unmeasured
(`methods.notRun`); with no methods run, all three are. The view records the methods artifact as `populations[].methodsArtifact`.

A review occurrence settles through `review-ledger.json` by its canonical id. The ledger is keyed by legacy ids, so no canonical
occurrence reads settled until the ledger is re-keyed; a family with a differential occurrence therefore reads
`differential.unresolvedContractDisagreements`. This is recorded rather than worked around (parity cause `review-occurrence-identity`).

## The public axis overlay

The classifier counts two axis vocabularies the public snapshot does not carry: the source context of a positive and the reviewed
benign taxonomy of a control (benchmarks/support/fixture-profiles.json `axes`). They are product policy, and the product's authored
fixtures hold them. `benchmarks/support/public-axis-overlay.json` carries them per canonical case id of the pinned snapshot, generated
by `npm run qualification:axis-overlay -- --snapshot <file>` from the legacy development fixtures, joined to the snapshot by the same
ordered content keys as the parity report (never hand-authored). `contexts[id]` is `<legacy category>/<fixture group>`: the whole
value is the axis the legacy `positiveAxes` counted, the group after the first `/` is the fixture-profile cell axis. `controls[id]` is
the legacy control axis of a scored, non-twin control, `null` for one with no reviewed axis. A case the overlay does not name keeps
the snapshot's own group or taxonomy. The overlay names axes only: it changes no evidence class, outcome or measured count, and a
public evidence class is still never a support status. It is bound to the snapshot by `snapshot.corpusDigest` (the adapter refuses an
artifact of another corpus), it is a component of the policy revision, and the view records it as `policy.axisOverlay`.

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
| `positiveCases`, `positiveAxes`, `totalFixtures`, `contextTwinPairs`, `confusionAxes` | floors population cases of the family: `kind`, `twin_of`, `group` (the overlay's context axis, else `group`), `twin_mutation_kind`; pending (T0) and not-measured cases fill no cell |
| `benignCases`, `benignAxes`, `benignAxisIds`, `controlAxes` | non-twin controls: axis is the overlay's control axis, else `taxonomy` when present, else `group` |
| `twinPairs` | twin controls whose positive was scored, in the floors population |
| `twinFailures` | pairs that did not discriminate (a positive span not EXACT or COVERED, or the twin flagged), worst population |
| `benignFalseAlarms` | flagged non-twin controls, worst population |
| `metamorphicCriticalFailures`, `mutationUnresolvedCritical`, `differentialUnresolvedContractDisagreements` | the methods run's `assertions` and `review_queue[]`, attributed through the seed case and joined with the ledger, only when the method is in its `manifest.methods`; otherwise unmeasured |
| `policyQualification` | the policy-route population's cases, the product `expectedAction`, `policyConformance` and `contextAxis` keyed by case id, the holdout receipt, and the criteria of `policy-qualified-credentials.json` |
| `fixtureProfile` | claim from the contract, cells from the floors population |

Unmeasured methods fail closed: if a required method (`metamorphic`, `mutation`, `differential`) is not in the methods run's
`manifest.methods` (or there is no methods run), a family that would be `stable` is held at `provisional` with the reason
`methods.notRun`.

## Parity map to the legacy path

| Legacy input or output | New path | State |
| --- | --- | --- |
| support-status inputs | `families[].evidence`, as above | derived from artifacts and product overlays |
| family counts and floors | floors population cells; thresholds are `status-criteria.json` and `fixture-profiles.json`, unchanged | derived; axis vocabulary differs, see Parity gaps |
| twin, benign requirements | per-case twin and benign measurements | derived |
| mutation, metamorphic, differential requirements | the methods run's assertions and review queue | measured by the methods run (#636); unmeasured without one |
| review-ledger joins | occurrence `id` looked up in `review-ledger.json` | needs the re-key (#607): legacy ids are legacy hashes, so a queue entry reads unresolved |
| known-gap evidence joins | `knownGaps[]`: a record's fixtures matched to cases by id in each population | product populations share the legacy ids; public ids differ until the re-key |
| source-report identities | `populations[].artifact` and `policy.revision` | replaces `scannerObservations`, `fixtureIndex`, `revision` |
| status distribution, stable profiles | `distribution`, `stableDistribution` | computed from `families[].status` |

## Parity gaps (for #607, recorded rather than hidden)

Compared against the legacy path, with each difference attributed to a structural cause, in
[qualification-parity.md](qualification-parity.md) and `docs/generated/qualification-parity.md`.

1. **Methods.** Measured by the methods run (#636). The remaining gap is the review ledger: a differential occurrence is keyed by a
   canonical id and the legacy ledger holds legacy ids, and the methods run covers peers the legacy run never scanned, so a
   family with a differential occurrence stays provisional until the ledger is re-keyed and the peer set for the gate is decided.
2. **Axes.** The public snapshot has no benign taxonomy and its group vocabulary is credential-evidence's. The product axis
   overlay (above) names the legacy axes for the cases it joins; what remains differs because the floors population is the
   public snapshot alone (the legacy path pooled the regression and policy fixtures), because pending fixtures are not scored,
   or because a fixture is attributed to another family.
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
`empirical-observations.json`, `taxonomy.json`, `population-policy.json`, `public-axis-overlay.json`, `review-ledger.json`, and the contract facts of
`assessment.ts` (tiers, provider sources, patterns, supported contexts; validator functions excluded).
Whitespace and key order do not move it. A threshold, route, tier, record, taxonomy entry, ledger decision or population
role does. A re-measurement of unchanged inputs does not. `supportStatusChanges` in `qualification-inputs.json` cite this
stamp (the gate checks its format).

## The view (for the Next app)

Top level: `schema` (`redact-secret/qualification-view/v1`), `adapter`, `publication` (`public`|`internal`), `policy`,
`populations`, `scanners`, `distribution`, `stableDistribution`, `families`, `undetected`, `knownGaps`, `unmappedFamilies`.

- `policy`: `revision`, `components[]` (path, digest), `criteria` (the thresholds as applied), `populations` (roles),
  `methodsRequired`, `rules`, and `axisOverlay` (the overlay the floors were counted with: id, population, corpus digest, entry counts).
- `populations[]`: `population`, `role`, `denominator`, `runClass`, `artifact` (digests, engine, protocol, `configHash`,
  `evidence`, publication, `methods`, scanners with version, build, mode and configuration hash), `methodsArtifact` (the same identity
  for the floors population's methods run, when there is one), `unattributed[]`
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
