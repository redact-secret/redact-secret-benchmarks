# RunArtifact to qualification adapter

Issue: [#605](https://github.com/redact-secret/redact-secret-benchmarks/issues/605), part of epic
[#602](https://github.com/redact-secret/redact-secret-benchmarks/issues/602).
Decision: [Run credential-eval officially once per population](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-01-run-credential-eval-per-population-and-adapt-run-artifacts.md).
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
3. Floor and cell COUNTS come from the `floors-and-gates` population alone; the axis labels they read are the union across `axisCoverage` populations (below).
4. A zero-tolerance gate (twin failures, benign false alarms) is evaluated in each gate-bearing population. The classifier
   receives the worst population; `families[].gates` shows every population's value side by side.
5. The route (documented T1, empirical T2, policy-qualified T3) is read from the product contract and empirical overlays,
   never from the `evidence_class` a case carries. A project-policy label on a public fixture changes nothing.
6. A view is `public` only when every artifact is `publication: public` and its population is publishable. One internal
   artifact makes the view `internal`.

## The scanner roster

Issue [#763](https://github.com/redact-secret/redact-secret-benchmarks/issues/763), epic #723.
Decision: [Make the OpenRedaction default profile an optional, manual measurement](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-06-make-the-openredaction-default-profile-an-optional-manual-measurement.md).

The evaluation contract names, per run class (and, when needed, per population), the scanners a run MUST measure and the ones it MAY leave unmeasured:
`benchmarks/support/scanner-roster.json` (`required`, `optional`, and for each optional scanner its label, profile, reason, the per-platform engine configuration that leaves it out, and the first engine release that ships it; whether the PINNED engine ships it is read from its checkout by the driver, #812). The
adapter reads it (`benchmarks/qualification/scanner-roster.ts`, `buildQualificationView({ roster, history })`):

- A **required** scanner that is absent from an artifact, or not `complete`, refuses the view, as before. The product (`redact-secret`) is always required.
- An **optional** scanner that is in no artifact is not an error: the run is complete without it. The view's `scannerRoster` section lists it under `notMeasured` with the contract's sentence (`OpenRedaction default: not measured in this run (optional)`), the reason, and `lastMeasurement`: the newest recorded run of that scanner in `benchmarks/official-runs.json` (`runs[]`, else `historicalRuns[]`: run id, engine, configuration hash, scanner version and configuration identity, date), or `null` when no run recorded it. The registry is read, never edited.
- **A retained measurement (#763).** A repin moves the superseded runs out of `runs[]` and need not keep them as `historicalRuns[]`: after the alpha.15 acceptance the registry listed no OpenRedaction run at all, and the pointer read "no earlier measurement is recorded", which is false. The roster therefore keeps `optionalScanners.<id>.retainedMeasurements[]`: facts about the last official measurement (recording date, engine version and revision, the archive release, asset and CI run that hold the artifacts, each run's id, configuration hash, semantic digest, artifact byte digest, scanner version and scanner configuration hash, and whether the runs carry native labels). `lastMeasurement.registry` is `runs`, `historicalRuns` or, only when the registry holds none, `retained` (with `archive` and `nativeLabels`). The record holds no count and no outcome; `validateRoster` refuses a malformed one. The registry always wins when it holds a run of the scanner.
- An optional scanner measured in **some** populations of a view and not in others is refused, and so is a methods run whose scanner set differs from its plain run: an optional scanner is in the whole view or in none of it, never a partial splice.
- Nothing stands in for the absent scanner: no row, no count, no zero detection, no aggregate, no scope accounting and no profile effect (a diagnostic profile has an effect entry only against a default measured on the same population). The scanner is absent from `scanners` and from every per-population list; only `scannerRoster` mentions it.
- A scanner not in the roster is reported as measured, as before. A credential profile (`openredaction-credentials` and the other declared profiles) is its own scanner id, never the default's optional slot, and its results are never spliced with the default's.

What dropping the default changes, stated rather than hidden: the other scanners' counts, every family status and the support matrix are derived from the product and the other scanners and do not move (the contract tests build the same view with and without an optional scanner and compare). The gate peers of the differential are `gitleaks` and `trufflehog`; OpenRedaction occurrences were measured and listed per family but were never gate-bearing, so the gate, the review queue of the gate peers and the ledger are unchanged; its occurrences, and any comparison column or page that listed the default, are absent for that run and say so. A view built from an earlier run keeps its OpenRedaction default results as history labelled with that run, engine, configuration and date.

**The credential profile (#764).** `openredaction-credential-bearing` (the 33 credential-bearing OpenRedaction types) is a separately named optional entry of the roster, `profileOf: openredaction`, with its own label ('OpenRedaction credential profile (33 types)'; the default is 'OpenRedaction default (all patterns)'), statement, detection text and identity (adapter, package, scanner configuration hash, run configuration and its hash). It is optional because no pinned configuration measures it yet; until an official-class measurement exists the view states 'not measured in an official run (local exploratory diagnostics only: see ADR)', with no number and never the default's history. The view's `scannerRoster.profiles` lists every optional scanner, measured or not, so the pages label the two profiles separately and say that both are the same package under different configurations, that results differ by configuration, and that no accuracy claim follows. Two optional entries may not share a label or be the same profile of the same scanner. Decision: [choose the credential profile](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-06-choose-the-openredaction-credential-bearing-profile-as-the-comparison-scanner.md).

The roster is deliberately not a component of the product policy revision (it says who is measured, not what a status requires), so changing it moves no support status and not `policy.revision`; `npm run authority:check` does not see it.

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

A review occurrence settles through `review-ledger.json` by the legacy decision the review-ledger re-key (next section) maps its canonical
id to; an occurrence the mapping does not name is unreviewed and reads unresolved. The differential gate counts only the occurrences of the
peers named in `population-policy.json` `methods.differential.peers` (gitleaks and trufflehog, the peers the legacy gate read); the occurrences
of every other peer are measured and listed per family (`families[].differential`) and are not gate-bearing until reviewed
([ADR](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-01-gate-the-differential-on-the-legacy-peers-and-measure-the-others.md)).

## The review-ledger re-key

The legacy ledger holds decisions keyed by legacy occurrence ids; the methods run's review queue is keyed by canonical ids
(`sha256:<hex>`); neither can be recomputed from the other. `benchmarks/support/public-review-ledger-map.json`
(`npm run qualification:ledger-rekey -- --snapshot <file> --methods-run <artifact.json>`, `--check`, `--validate`) maps a canonical
occurrence to a legacy ledger id, and **only** when both name the same case, peer scanner, disagreement property, variant and bytes: the
legacy fixture is joined to the canonical case by the content join of the parity report (SHA-256 of the content, expected spans, fixture name,
one to one), then the legacy regression fixtures are joined to the cases still unpaired (the evidence release publishes some fixtures the
legacy path held in its regression corpus; this stage only identifies a case and no population count reads it); the legacy
`evidence.input.contentHash` equals the canonical variant's `content_digest`; and the legacy kind `redact-secret-only` is read as the
canonical `reference-only` (the one renamed kind). The mapping holds identity only: the legacy ledger stays the source of every status and
note, an `open` legacy decision stays unresolved, and an occurrence with no mapping is unreviewed. `derivation` counts what did not map, by
reason (a peer the legacy run never scanned, a case the join does not pair, no legacy occurrence of that property, bytes that differ, an
ambiguous key), and the legacy mutation entries, which have no canonical counterpart (the canonical queue holds differential occurrences
only). It is validated (one to one with the ledger, counts reconcile), bound to the snapshot's corpus digest and to the canonical methods run's
semantic digest, and a component of the policy revision
([ADR](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-01-apply-the-legacy-review-decisions-to-canonical-occurrences-by-content.md)).

## The public axis overlay

The classifier counts two axis vocabularies the public snapshot does not carry: the source context of a positive and the reviewed
benign taxonomy of a control (benchmarks/support/fixture-profiles.json `axes`). They are product policy, and the product's authored
fixtures hold them. `benchmarks/support/public-axis-overlay.json` carries them per canonical case id of the pinned snapshot, generated
by `npm run qualification:axis-overlay -- --snapshot <file>` from the legacy development fixtures, joined to the snapshot by the same
ordered content keys as the parity report (never hand-authored). `contexts[id]` is `<legacy category>/<fixture group>`: the whole
value is the axis the legacy `positiveAxes` counted, the group after the first `/` is the fixture-profile cell axis. `controls[id]` is
the legacy control axis of a scored, non-twin control, `null` for one with no reviewed axis. A case the overlay does not name keeps
the snapshot's own group or taxonomy. The overlay also carries `detectors[id]`, the product detectors the legacy path scoped the fixture to
(its `targets`), used only for attribution (below). The overlay names axes and attribution only: it changes no evidence class, outcome or measured count, and a
public evidence class is still never a support status. It is bound to the snapshot by `snapshot.corpusDigest` (the adapter refuses an
artifact of another corpus), it is a component of the policy revision, and the view records it as `policy.axisOverlay`.

## Attribution

The public snapshot names taxonomy families (`provider:family`); the product populations name detector ids. A case belongs
to a product detector family when its `targets` name one, or its `family` is a detector id, or its `family` is a taxonomy
family served by a detector (`benchmarks/support/taxonomy.json`). Where the snapshot names none (some public cases carry neither a family nor a
target), the policy's `attribution.fallback` applies in order: the overlay's `detectors` of the case (the legacy targets; floors population
only), then the detectors of its twin parent. What the snapshot names always wins. A case no step attributes is counted under the
population's `unattributed` counts, and its family is listed in `unmappedFamilies`; it is never dropped. `families[].attribution` counts the
floors cases of a family by source (`snapshot`, `overlay-detectors`, `twin-parent`)
([ADR](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-01-attribute-public-cases-by-the-legacy-targets-and-keep-floors-per-population.md)). Floors stay per population: the legacy
pooled count of a family with regression fixtures is a legitimate difference (`population-separation`), never reproduced by pooling. A
cross-provider twin the snapshot gives no family is scoped by no one in the engine, which reads a finding of another known detector as
flagged; the adapter does not re-score it (`twin-scope-vocabulary`; the twin gate reads its project counterpart, see Twin scope).

## Axis coverage

An axis floor (`positiveAxes`, `controlAxes`, `benignAxes`, `confusionAxes` and the fixture-profile positive-context, control and confusion cells) is judged on the
union of the axis labels across the populations `population-policy.json` `axisCoverage.populations` names (#641,
[ADR](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-02-judge-axis-floors-on-the-union-of-axis-labels-across-populations.md)). Only labels are unioned. `positiveCases`, `benignCases`,
`twinPairs`, `totalFixtures` and every case cell are the floors population's count alone, and the zero-tolerance gates are unchanged. A label is the legacy
classifier's: a control's reviewed axis, a positive's `<category>/<fixture group>` (the fixture group for the cell). The public population gets it from the axis
overlay; a product population from its own case taxonomy and case metadata (`group`, and `axisCategory` for a byte-for-byte copy, which names its original's category so a
copy adds no label). `families[].axisCoverage` lists, per covered axis, the populations that supplied it. The rule applies to every family.

## Twin scope

credential-eval scopes a control by the `family` its case carries. A public cross-provider twin the snapshot gives no family cannot be scoped, so the engine reads a finding of
another known detector as flagged. The project carries the same twins with their parent's family (`twin-scope-regressions`, regression population) and the engine reads
them as co-detected, as the legacy path did. `benchmarks/support/public-twin-scope-map.json` (`npm run qualification:twin-scope -- --snapshot <file>`, `--check`, `--validate`)
maps each such public twin to the project case with the same content (exact content join, one to one, bound to the snapshot's corpus digest, a policy component).
`population-policy.json` `twinScope.scopedBy` names the population that measures them. In the public population's gate row a mapped twin is not gate-bearing: it is shown
(`gates[].twinPairsScopedElsewhere`, `twinFailuresScopedElsewhere`) and the project case is counted in the regression population's own gate row; the classifier still receives the
worst population. The floor counts the public pair as published. The adapter refuses a map that names a case an artifact lacks, a public twin that has a family, or a project case
that has none, and does not re-score any verdict.

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
| `metamorphicCriticalFailures`, `mutationUnresolvedCritical`, `differentialUnresolvedContractDisagreements` | the methods run's `assertions` and `review_queue[]`, attributed through the seed case and joined with the ledger through the re-key mapping (differential: the gate peers only), only when the method is in its `manifest.methods`; otherwise unmeasured |
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
| review-ledger joins | occurrence `id` mapped to a legacy ledger id by `public-review-ledger-map.json`, then looked up in `review-ledger.json` | applied for the peers both paths scanned (#638); the other peers' occurrences are unreviewed |
| known-gap evidence joins | `knownGaps[]`: a record's fixtures matched to cases by id in each population | product populations share the legacy ids; public ids differ until the re-key |
| source-report identities | `populations[].artifact` and `policy.revision` | replaces `scannerObservations`, `fixtureIndex`, `revision` |
| status distribution, stable profiles | `distribution`, `stableDistribution` | computed from `families[].status` |

## Parity gaps (for #607, recorded rather than hidden)

Compared against the legacy path, with each difference attributed to a structural cause, in
[qualification-parity.md](qualification-parity.md) and `docs/generated/qualification-parity.md`.

1. **Methods.** Measured by the methods run (#636). The legacy review decisions apply through the generated mapping, and the differential
   gate reads the legacy peers (#638); the occurrences of the two other pinned peers are unreviewed and reported, not gate-bearing.
2. **Axes.** The public snapshot has no benign taxonomy and its group vocabulary is credential-evidence's. The product axis
   overlay (above) names the legacy axes for the cases it joins; what remains differs because the floors population is the
   public snapshot alone (the legacy path pooled the regression and policy fixtures), because pending fixtures are not scored,
   or because a fixture is attributed to another family.
3. **Policy route.** The policy corpus is small (a bounded contract for four families), so its floors can fail where the
   legacy path pooled every T3 fixture targeting the family. Whether the floors or the corpus change is a product policy
   decision.
4. **Disputed properties** (`disputedProperty`) are keyed by legacy fixture ids and are not applied to the public
   population until the legacy-id re-key of known gaps and fixtures (the review ledger has its own mapping).
5. **Taxonomy families with no detector** appear in the public snapshot and are reported in `unmappedFamilies`.
6. **Ledger ids** are mapped by content (above); the known-gap and fixture ids still wait for the evidence release id map.
7. **Counts per population, axes by union, twin scope.** A family whose legacy floor pooled regression fixtures reads its public-snapshot COUNTS (`population-separation`)
   but its axis coverage across populations (#641). A cross-provider twin the snapshot gives no family still reads flagged in the public population where the legacy twin read co-detected
   (`twin-scope-vocabulary`, confirmed): the twin gate reads the project twin-scope case instead. Both are attributed in the parity report.

## Product policy revision

`policy.revision` is `rs-policy-<adapter version>:sha256:<hex>`: the SHA-256 of the canonical JSON of
`{adapter, components}`, where each component is one benchmark-owned qualification input and its digest is of its parsed
content: `status-criteria.json`, `fixture-profiles.json`, `policy-qualified-credentials.json`,
`empirical-observations.json`, `taxonomy.json`, `population-policy.json`, `public-axis-overlay.json`, `public-twin-scope-map.json`, `review-ledger.json`, `public-review-ledger-map.json`, and the contract facts of
`assessment.ts` (tiers, provider sources, patterns, supported contexts; validator functions excluded).
Whitespace and key order do not move it. A threshold, route, tier, record, taxonomy entry, ledger decision or population
role does. A re-measurement of unchanged inputs does not. `supportStatusChanges` in `qualification-inputs.json` cite this
stamp (the gate checks its format).

## The view (for the Next app)

Top level: `schema` (`redact-secret/qualification-view/v1`), `adapter`, `publication` (`public`|`internal`), `policy`,
`populations`, `scanners`, `scannerRoster` (#763, optional: absent in a view built without a roster), `distribution`, `stableDistribution`, `families`, `supportMatrix`, `undetected`, `knownGaps`, `unmappedFamilies`.

- `policy`: `revision`, `components[]` (path, digest), `criteria` (the thresholds as applied), `populations` (roles),
  `methodsRequired`, `differentialPeers`, `attributionFallback`, `axisCoverage` (the populations whose axis labels are unioned), `twinScope` (the twin-scope map: id, scoping population, corpus digest, twins mapped), `rules`, `ledgerRekey` (the mapping: id, population, corpus digest, occurrences mapped) and `axisOverlay` (the overlay the floors were counted with: id, population, corpus digest, entry counts).
- `populations[]`: `population`, `role`, `denominator`, `runClass`, `artifact` (digests, engine, protocol, `configHash`,
  `evidence`, publication, `methods`, scanners with version, build, mode and configuration hash), `methodsArtifact` (the same identity
  for the floors population's methods run, when there is one), `unattributed[]`
  (per-scanner counts), `aggregates[]` (the engine's published `groups` and `byTarget`, verbatim, withheld figures kept).
- `families[]` (one per scored product detector family, sorted): `taxonomyFamilies[]`, `contract`, `status`
  (`value`, `reasons`, `qualificationProfile`, `evidenceTier`, `evidenceBasis`, `methodsNotRun`), `evidence`
  (`FamilySupportEvidence`), `fixtureProfile`, `gates[]` (per gate-bearing population, with the twin pairs and failures scoped elsewhere), `axisCoverage` (per covered axis, the supplying populations), `differential` (per peer: occurrences, settled, unresolved, `gateBearing`; null when the methods run did not run differential), `attribution` (floors cases by source), and `populations[]` each with
  `scanners[]` of `{scanner, counts}`. `counts` are `cases`, `pending`, `notMeasured`, `positives` (`must-redact`,
  `policy`: spans, outcomes, leaked and collateral bytes), `benign` (`cases`, `flagged`, `findings`) and `twins`
  (`pairs`, `discriminated`, `flagged`, `coDetected`).
- `populations[].cases[]` (#606, additive within v1): every corpus case of the population, sorted by id, with what the artifact recorded and what each scanner did, for the Next case pages
  (see "Case rows"). No count or status is derived from it.
- `supportMatrix` (#607, additive within v1): the provider x credential-family projection, the same shape as one entry of the legacy `npm run eval:matrix` output, derived from `families[]`, the product taxonomy and the product contracts by `buildViewSupportMatrix` (benchmarks/qualification/support-matrix.ts). It holds `distribution` (status counts over taxonomy families), `stableDistribution` (stable counts by route) and `families[]` (one entry per taxonomy family, sorted by id). An entry carries `provider`, `family` (the taxonomy id), `familyName`, `status`, `evidenceTier`, `evidenceBasis`, `qualificationProfile`, `providerSource`, `corroboratingScanners`, `twinCoverage` (`pairs`, `failures`, `unprobeable`), `unresolvedCriticalItems` (`metamorphic`, `mutation`, `differential`), `empiricalEvidence`, `policyQualification`, `fixtureProfile` (the floor counts), `detectors`, `reason` and `profileCoverage` (the fixture-profile report). Status, reason and evidence are carried from the detector family that decided the entry, broadcast across every taxonomy family it serves; nothing is re-derived, and no entry is a sum across populations. A taxonomy family with no detector keeps the status its taxonomy row records (`unsupported` unless it records `pending`) and the reason the taxonomy gives. A count of a method that did not run for the family is `null`, never `0`. A taxonomy family claimed by two detector families, a detector-bearing one with no scored family, or an undetected one with no note or source refuses the build. The matrix is one view of the families shown above, not an addition to them: a consumer reads it instead of recomputing it, and the parity report compares it with the legacy matrix (docs/specs/qualification-parity.md).
- `undetected[]`: taxonomy families with no detector. `knownGaps[]`: the join described above.

A page that shows a count shows it with its population. No field is a sum across populations or scanners.

## Case rows

`populations[].cases[]` has one row per case of the population's artifact, keyed by `(population, id)` (the same id in two populations is two rows), sorted by id:
`id`, `path`, `kind`, `tier`, `group`, `family` (the corpus's own family, a taxonomy family or detector id, not the product family), `taxonomy`, `evidenceClass`, `targets`, `twinOf`,
`twinMutationKind`, `expected` (start, end, role and the envelope when the corpus records one), `detectors` and `attribution` (the product detector families the case counts under and which
step of the attribution made it: `snapshot`, `overlay-detectors`, `twin-parent` or `none`; empty `detectors` is an unattributed case), and `results[]`, one entry per scanner that ran the population in
`scanners` order.

A result is the artifact's own measurement and is never re-scored: `measurement` (`positive`, `control`, `pending`, `not-measured`), `observed` (findings reported), and only the fields that measurement has:
`outcomes`, `leakedBytes`, `collateralBytes` for a positive; `flagged`, `findings` and `coDetected` for a control; `status` (the scanner status that prevented the measurement) for a case that was not measured. A field that does
not apply is absent, so a pending or unmeasured case never reads as zero. The evidence class is the artifact's label and is never a support status or a route. No case content is carried.

Each result may also carry additive `reported` ranges (#595): only `start`, `end` and an actually recorded action in `redact`, `warn`, `block`, `allow`.
No `family` is relabelled as a scanner rule, and no matched value, mapping or raw scanner output crosses this projection. Older views without `reported` remain
compatible and show an explicit unavailable state. The projection leaves accounting, policy revision, artifact identity and authorisation unchanged; it is
rebuilt from the retained artifact, never by modifying it. [Fixture metadata](fixture-metadata.md#recorded-release-and-reported-actions-595) records the source inventory.

The rows are additive: removing `cases` from a view gives the view the adapter wrote before them, value for value, and the policy revision does not change (`adapter.version` stays 1; the schema tag stays `v1`).
A view without `cases` is refused by the Next reader as incompatible, with the command that rebuilds it. The size is about 6 MB for the canonical populations (about 300 KB compressed), generated and never committed
([ADR](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-01-carry-per-case-rows-in-the-qualification-view-and-page-them-by-scope.md)).

**Who reads the view, and when (#608).** `/evaluation/qualification/…` always. When `benchmarks/qualification-authority.json` says `new`, the Next credential report pages too: `web/services/credential-bridge.ts` reads the
report population's `cases` (the one the population policy gives the floors and gates), `artifact` and `methodsArtifact`, and `distribution` and `stableDistribution`, and only when the view is the one the authorisation names (its
policy revision and every population's semantic digest). No field was added to the view for this; a page that needs a field the view lacks adds it additively and schema-validated, as the case rows were. Read path and rollback:
[`qualification-cutover.md`](qualification-cutover.md#authority-read-path).

## Scope accounting (#724)

The engine (credential-eval ADR 0016, contract v1.8) writes `scope_accounting` per complete scanner with a reviewed disposition table (`openredaction` and its diagnostic profiles). The adapter reads it with `benchmarks/qualification/scope-accounting.ts` and adds, per population, `scope` (plain artifact), `methodsScope` (methods artifact, accounted apart) and `profileEffects` to the view (`schemas/qualification-view-v1.json`, `$defs/scopeEntry`, `$defs/profileEffect`; additive).

- Six always-present dispositions per finding: `mapped_credential`, `credential_related_unmapped`, `out_of_scope`, `ambiguous`, `native_label_unavailable`, `unrecognized_label`. They sum to the retained findings; the adapter refuses an accounting that does not reconcile (also per native label, family-carrying findings and label-less findings).
- State: `accounted`, `legacy-native-label-unavailable` (engine before `0.1.0-alpha.11`: every count null, shown as Unknown, never zero), `not-accounted` (no reviewed table or an engine version this reader does not know), `not-measured`.
- Beside the counts: scanner configuration hash, adapter version, engine version, classification table and accounting version, native-label coverage, per-native-type counts with the reviewed scope and reason, and fixed limits.
- Declared profiles come from `scanners/peer-registry.json` (`diagnosticProfiles`, validated by `peerRegistryProblems`); the build script passes them to the adapter. A profile and its default measured on the same population yield one `profileEffects` entry: `profile - default` deltas of the engine's own outcome counts, benign flags and retained findings, with `denominatorsEqual`. Nothing is excluded, spliced or re-scored; a profile is not a speed-up.
- Per scanner and run, what the recorded artifacts carry is stated in [Observation origin](#observation-origin-724). A scanner the engine has no reviewed table for (every required scanner at engine alpha.16) is `not-accounted`: Unknown, never zero.
- The Next qualification overview shows the block (`ScopeAccounting`, Storybook first) next to the scanner table. Decision: `docs/decisions/2026-10-05-read-the-engines-scope-accounting-and-keep-profiles-as-separate-observations.md`.

## Measurement host (#620, #621)

Where and when the engine ran is provenance too. The adapter reads the artifact's `non_semantic.host` (an OS/architecture string such as `linux-x86_64`), `started_at` and `finished_at` (`engineTelemetry` in `benchmarks/qualification/measurement-host.ts`) and adds, per population, `measurement` (plain artifact) and `methodsMeasurement` (methods artifact, apart). A value outside the expected shape is `null`, never shown. They feed nothing else, and a test holds the rest of the view equal when only `non_semantic` differs. RunArtifact v1 carries nothing more about the host: the OS release, CPU, Node and CI image come from the run driver's record (`runs[].measurementHost`, [official-runs.md](official-runs.md#what-is-recorded)), and the page names the two sources apart. Decision: `docs/decisions/2026-10-07-record-the-measurement-host-at-execution-and-keep-it-out-of-run-identity.md`.

## Observation origin (#724)

Whether a scanner's observation was made in the run or taken from an earlier verified run is PROVENANCE, not evidence. The engine writes it into the artifact's `non_semantic.execution` (`scanners.<id>.origin`, `origin_reason`, and `reuse` with the source and input digests; RunArtifact v1.6), which the semantic digest excludes on purpose: a run that reused an observation and one that scanned it fresh have the same semantic digest. The adapter reads only those fields (`benchmarks/qualification/observation-origin.ts`) and adds, per population, `origins` (plain artifact) and `methodsOrigins` (methods artifact, apart) to the view. They feed no count, outcome, denominator, floor or status, and a test holds the rest of the view equal when only the telemetry differs.

- Three states, never two: `fresh`, `reused` (with the receipt digests when the run recorded them), and `not-recorded`. The engine writes `origin` only for a run that offered observations for reuse, and an artifact of an engine before v1.6 has none; `not-recorded` is what both look like and it is never read as `fresh`. The official driver measures every scanner fresh and refuses reuse (`docs/specs/accuracy-reuse.md`), and the artifact is shown as it records itself.
- The reason is the engine's fixed vocabulary (`compatible`, `forced`, `no-recorded-observation`, `not-prepared`, `changed: <field>[, <field>]`); anything else is dropped, so no scanner output reaches a page through it.
- The bytes are the verified ones: the view job checks each archived artifact against the byte digest `benchmarks/official-runs.json` records, `non_semantic` included. The registry and the run records themselves carry no per-scanner origin (what they carry: artifact digests, determinism runs, the scanner list and `omittedOptionalScanners`).
- An optional scanner left out of a run has no observation and so no origin row; the origin block states it as not measured.
- Availability per run, as read from the recorded artifacts (verified by inspecting them, not asserted by a test): the current engine (alpha.16) artifacts of the four required scanners carry no `origin`, no `reuse`, no `scope_accounting` and no native labels, so their origin is `not-recorded` and their scope state is `not-accounted` (the engine has no reviewed disposition table for these scanners). The retained alpha.5 artifacts of the OpenRedaction default predate both (`legacy-native-label-unavailable`, Unknown counts). Decision: [disclose the optional scanner on every report and keep observation origin apart from scope evidence](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-07-disclose-the-optional-scanner-on-every-report-and-keep-observation-origin-apart-from-scope-evidence.md).

## Tests

`tests/qualification-adapter.test.mjs` builds synthetic artifacts and asserts the rules relative to what it built:
no ledger value, family count or digest read from the committed tree is asserted, because a repin re-keys them. The roster tests (#763) use a synthetic roster and scanner ids: an optional scanner absent, present, partial, required-absent and with or without a recorded last measurement.
