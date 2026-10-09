# Support matrix: `support-matrix.json`

Issue: [#509](https://github.com/redact-secret/redact-secret/issues/509), part of
[Epic A](https://github.com/redact-secret/redact-secret/issues/500). Data:
`results-output/support-matrix.json` (generated, gitignored), schema
`schemas/support-matrix-v1.json`, build logic `benchmarks/support/matrix.ts`,
CLI `benchmarks/generate-support-matrix.ts` (`npm run eval:matrix`).

## Why this exists

Per this repository's boundary rule, nothing here asserts product output — it
measures, records, and emits the one artifact the product repository then
publishes. Before this issue, no single generated file existed that a product
docs projection or a qualification gate could depend on; this closes that gap.

## What it does

`buildSupportMatrix` projects [A3's per-detector evidence](support-status.md)
(`results-output/support-status.json`) onto the [provider x credential-family
taxonomy](taxonomy.md) (`benchmarks/support/taxonomy.json`) — 79 families
across 34 providers plus 6 non-provider-specific formats as of 2026-09-21
(`taxonomy.json` is the source of truth; `providerCount` and `familyCount`
below are read from it, never typed), the unit a reader actually cares
about. It never re-derives a status: a detector's `status` and
`reasons`, decided once by `classifyFamilySupport`, are broadcast verbatim
across every taxonomy family that detector serves (`taxonomyFamilies`, from
`familiesForDetector`). A zero-detector taxonomy family (`detectors: []`)
becomes `unsupported`, with its reason built from the taxonomy entry's own
`note` and `sources` — never invented.

## Shape

```jsonc
{
  "schemaVersion": 1,
  "taxonomySchemaVersion": 1,
  // Carried through verbatim from support-status.json, never re-stamped here:
  // a format change upstream or a stale evaluation run surfaces as staleness
  // in this field, not as a silently wrong status.
  "sourceReport": { "schemaVersion": 1, "generatedAt": "...", "runId": "...", "revision": "...", "dirty": false, "criteriaSchemaVersion": 1 },
  "providerCount": 34,
  "familyCount": 79,
  "distribution": { "stable": 0, "provisional": 0, "pending": 0, "unsupported": 0 },
  "stableDistribution": { "documented": 0, "empirical": 0 },
  "families": [
    {
      "provider": "github",
      "family": "github:classic-personal-access-token",
      "familyName": "Classic personal access token",
      "status": "provisional",
      "evidenceTier": "T1",
      "evidenceBasis": "provider-documented",
      "qualificationProfile": null,
      "providerSource": { "url": "...", "observedAt": "...", "formatVersion": "...", "covers": "..." },
      "corroboratingScanners": ["gitleaks 8.30.1", "trufflehog 3.97.4"],
      "twinCoverage": { "pairs": 0, "failures": 0, "unprobeable": null },
      "unresolvedCriticalItems": { "metamorphic": 0, "mutation": 0, "differential": 0 },
      "detectors": ["github-token"],
      "reason": "minimumTwinPairs: 0 < 5 — ..."
    }
  ]
}
```

`evidenceTier`, `evidenceBasis`, `qualificationProfile`, `providerSource`,
`corroboratingScanners`, `twinCoverage`, `empiricalEvidence`, `fixtureProfile`
and `unresolvedCriticalItems` preserve provenance, qualification, uncertainty,
coverage cells and failures separately. Evidence objects are `null` (and
`detectors: []`) exactly when the
family has no detector — there is no contract or evidence to carry. `reason`
is `null` only when `status` is `stable`; every `pending` or `unsupported`
entry carries one, enforced by `buildSupportMatrix` itself.

`fixtureProfile` (#206, `docs/specs/support-status.md`) carries the family's
measured fixture cells, axis counts, the profiles whose cells are met, and the
remaining debt against its target profile; `null` when no detector exists, and
absent from artifacts generated before profiles existed.

## Finding-type key (#647)

Every family carries `findingTypes`, the `(detector, type, basis)` pairs its evidence covers, so a shared detector joins to its
rows per finding type. A matrix row is keyed by a detector id that is a registered product detector or an arrival family the
adapter labels by finding type; 16 registered detectors emit several types, and two rows can share one detector.

| Row | `findingTypes` | `basis` |
| --- | --- | --- |
| No detector | `[]` (nothing is emitted) | none |
| `detectors[0]` is the value of `arrivalFindingTypes[d][t]` (`scanners/families.mjs`) | `[{ detector: d, type: t }]` | `arrival-finding-type-table` |
| `detectors[0]` is a registered detector with one finding type | that type | `sole-type-of-detector` |
| `detectors[0]` is a registered detector with several types | the types `arrivalFindingTypes[detector]` does not take away, which `findingFamily` leaves under the detector id | `remaining-types-of-detector` |
| none of the above | `null`: unset, never guessed | none |

Sources are `benchmarks/detector-finding-types.json` (the core's `docs/coverage/detector-inventory.json` at one recorded
revision, `findingTypeSource` in the matrix) and the reviewed `arrivalFindingTypes` table
([decision](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-24-map-product-finding-types-to-arrival-families.md)). Fixture content and scanner output
are not sources. At the Beta.12 revision `4227160c` all 129 detector-bearing rows are grounded (104 sole, 25 table, 23
remainder) and the 141 finding types are all owned by some row; no row is unset. Rows that share a detector carry the same
remainder. Refresh the snapshot with `node scripts/refresh-detector-finding-types.mjs --core=<checkout> --revision=<sha>`
whenever `benchmarks/detectors.json` moves to a new product revision; `--check` fails when it is stale.

The key is added by `benchmarks/generate-support-matrix.ts`, not by `buildSupportMatrix`, so the qualification view's matrix
(compared leaf by leaf in the parity report) is unchanged.

## PII rows (#647)

`piiQualification`, `piiDistribution` and `piiFamilies` carry the six opt-in PII families beside the credential families. They are
never counted in `providerCount`, `familyCount`, `distribution` or `stableDistribution` (the PII domain keeps its own
denominator), and no page renders them.

- **Source.** The reviewed `pii-v1` projection `benchmarks/evaluation/domains/pii/protected-support-bindings-v1.json` (entry
  `beta11-8b6a5fd-pii-protected`), checked field by field against the published aggregate protected disposition
  `evidence/901/428/core-8b6a5fde52ec/pii-beta11-protected-disposition-v2.json` and the freeze next to it
  (`benchmarks/support/pii-families.ts`). A disagreement throws. The binder `bindPiiProtectedSupport` is not called: it re-derives the
  disposition from the sealed protected partition, which the matrix generator never opens.
- **Statuses.** `provisional` for network-address, email, payment-card, IBAN and phone (country code `+1`, NANP, only); `pending` for
  us-ssn (United States only), failed gate `protected-partition` with reason `protected-gates-not-met:identity-only-classification`.
  Each row also carries the 20 public gates met, the accepted `profile-cost` tradeoff, and the epoch, aggregate and trust commitments.
  None is `stable`; the schema fixes `stable` and `unsupported` at 0.
- **Identity.** `piiQualification.qualifiedAt` is core `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`, epoch `17dae942ee4b` (the name of
  the sealed partition's record, read as a string), population plan set `b11-population-v2`; `benchmarks.recordRevision` is the
  benchmarks merge `be0fb9f3` that put the record on `develop`, and `freezeBaseRevision` is the benchmarks revision the freeze was
  built on.
- **Not re-qualified.** `requalification.state` is `not-requalified` and `requalifiedOnCoreCommit` is `null`. The statuses describe
  the Beta.11 code; the core email, IBAN, phone, payment-card and us-ssn code changed afterwards. Re-qualification on a later core
  commit sets the commit and the state together, and the model refuses one without the other.

## Failing loudly

`buildSupportMatrix` throws, rather than defaulting an unclassifiable entry to
a friendly status, when:

- a detector-bearing taxonomy family has no matching result in
  `support-status.json` (the input is stale relative to the taxonomy);
- two different detector results claim the same taxonomy family id (an
  ambiguity the taxonomy's "rare; none currently" many-to-many case would
  introduce — resolved by a taxonomy fix, never by silently picking one);
- a zero-detector taxonomy family carries no `note` or `sources` (blocked
  upstream by a taxonomy test, checked again here).

## Determinism

`npm run eval:matrix` reads `results-output/support-status.json`,
`benchmarks/support/taxonomy.json` and `benchmarks/lib/assessment.ts`'s
`contracts`, and writes only what those inputs and `Array.prototype.sort`
determine — no timestamp, random id or network call. Regenerating from an
unchanged `support-status.json` reproduces `support-matrix.json` byte for
byte; the wall-clock `generatedAt`/`runId` a fresh `eval:classify` run
produces belongs to that upstream input changing, not to this step.

## No secret material

Every field here is a count, a URL, a date, a scanner name or free-text
review prose already reviewed into `benchmarks/lib/assessment.ts` — no fixture
content or credential value is ever read by this generator.

## Consuming this

```ts
import { buildSupportMatrix } from '../benchmarks/support/matrix.ts';
```

`npm run eval:classify` must run first to produce
`results-output/support-status.json`; `npm run eval:matrix` then reads it.
Downstream, #510 (A9, benchmark UI projection) and #511 (A10, qualification-side
matrix drift) consume `results-output/support-matrix.json` — never a status
re-derived or hand-adjusted from it. Both have landed: `npm run
eval:publish:matrix` copies this file to `public/results/support-matrix-v1.json`
and `/support` renders it, with a CI gate that fails if the site carries a
status this artifact cannot (see [support-ui.md](support-ui.md)). The
`eval:matrix:drift` command that once diffed a candidate's matrix against a saved
baseline was removed in #660: the drift between two matrices is the parity report's
`matrix` section (`qualification:parity`) and, for a product candidate, the candidate
diff (`qualification:candidate-diff`).

### Current target beside historical qualification

Optional `piiCurrentQualification` records the exact prepared source commit independently of the historical
`piiQualification`, `piiDistribution` and `piiFamilies`. Older matrices without it remain valid. The generator
adds it through `buildPiiMatrixSection`; it does not change credential rows, measured-product provenance,
provider/family denominators or stable counts. The historical `not-requalified` identity remains unchanged.

`benchmarks/support/pii-current-qualification.ts` validates the separate public comparison plan, receipt and
eight baseline/candidate population artifacts with `loadPiiCandidateComparison` before projecting evidence.
Absent evidence yields `prepared` with `not-recorded` measurement and null artifact identities. Malformed,
incomplete or mismatched evidence yields `invalid`; it cannot retain a claimed measured identity. A verified
package yields `recorded` with its receipt digest, exact candidate package-tree digest, baseline source and
engine binary digest. This state records public measurement only, with `qualified: false` and
`supportClaims: false`, never owner acceptance or an authority change.

Current family rows stay `pending`: public qualification gates are not evaluated by this comparison, the
product validator primitive seam is unmeasured, exact-target runtime/package, size and profile cost are
unmeasured, and protected execution is pending/not run. Their reason codes are derived from those gate
states, not copied from historical protected results. The current distribution counts its own rows only.
The strict schema and semantic validator reject qualification, cost acceptance, invented fields, wrong current
targets, inconsistent membership/distributions or omitted reasons. The publisher and support UI source gate
reconcile a present current section against the verified comparison package again.

[Protected readiness preparation](pii-protected-requalification-readiness.md) preserves the prerequisite
checklist and the distinction between local historical custody and the unready new operational path. Public
measurement can proceed while that protected path remains pending. Core consumers must keep historical and
current qualification separate, bind the current source revision explicitly and retain the credential
measurement's recorded release identity when vendoring this additive contract.

The NEW authority projection (`support-matrix-view-v1.json`) carries the same optional
`piiCurrentQualification` section. `build-view-support-matrix.ts` derives it from the verified
comparison package, `viewMatrixProblems` applies the shared strict section validator, and both
publishing paths rederive the projection before accepting its bytes. Credential family counts,
canonical population identities and historical PII disposition remain separate.
