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
  "families": [
    {
      "provider": "github",
      "family": "github:classic-personal-access-token",
      "familyName": "Classic personal access token",
      "status": "provisional",
      "evidenceTier": "T1",
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

`evidenceTier`, `providerSource`, `corroboratingScanners`, `twinCoverage` and
`unresolvedCriticalItems` are all `null` (and `detectors: []`) exactly when the
family has no detector — there is no contract or evidence to carry. `reason`
is `null` only when `status` is `stable`; every `pending` or `unsupported`
entry carries one, enforced by `buildSupportMatrix` itself.

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
status this artifact cannot (see [support-ui.md](support-ui.md)), and `npm run
eval:matrix:drift` diffs a candidate's matrix against a saved baseline (see
[support-matrix-drift.md](support-matrix-drift.md)).
