# Support-matrix drift: `support-matrix-drift.json`

Issue: [redact-secret/redact-secret#511](https://github.com/redact-secret/redact-secret/issues/511),
A10, benchmarks-side [#51](https://github.com/redact-secret/redact-secret-benchmarks/issues/51),
downstream of [#509's support matrix](support-matrix.md). Data:
`results-output/support-matrix-drift.json` (generated, gitignored), schema
`schemas/support-matrix-drift-v1.json`, diff logic
`benchmarks/support/drift.ts`, CLI `benchmarks/support-matrix-drift.ts`
(`npm run eval:matrix:drift`).

## Why this exists

Per this repository's boundary rule, nothing here decides a release — it
measures and records. A candidate's support matrix by itself only says what
is true *now*; a release gate needs to know what changed since the last
release it trusted. This closes that gap without this repository ever
asserting whether a change should block anything.

## What it does

`buildSupportMatrixDrift` compares two already-generated support matrices —
a saved baseline and a candidate's, either freshly built
(`results-output/support-matrix.json`) or a previously published artifact
(`public/results/support-matrix-v1.json`; both share one schema, so either
path works) — family by family, and reports exactly four things:

- **regressions**: a family that carried `stable` in the baseline and does
  not in the candidate, with the reason the candidate now gives;
- **improvements**: a family that reaches `stable` in the candidate having
  not carried it in the baseline, with the full evidence bundle
  (`evidenceTier`, `providerSource`, `corroboratingScanners`, `twinCoverage`,
  `unresolvedCriticalItems`, `detectors`) that earned it;
- **newAndUnclassified**: a family the candidate carries that the baseline
  has no entry for at all — a taxonomy addition, not a status change, so it
  is never compared against a status that does not exist;
- **staleProviderProvenance**: a family whose status did not cross the
  `stable` boundary in either direction (including no status change at all)
  but whose `providerSource` differs between the two matrices — the evidence
  under an unchanged status moved and nobody has looked at it since.

It never re-derives or second-guesses a status carried by either matrix, and
a family present in the baseline but dropped from the candidate (a taxonomy
family retired) is out of scope: `buildSupportMatrixDrift` only walks the
candidate's families, so this can only be reached if the candidate is
missing one, which its own schema already forbids.

## Determinism and no network access

Both inputs are local files; nothing here fetches, clones, or resolves a
commit. `npm run eval:matrix:drift -- --baseline=<path>
[--candidate=results-output/support-matrix.json]
[--output=results-output/support-matrix-drift.json]` validates each input
against `support-matrix-v1.json` (the same check `eval:publish:matrix` runs)
before diffing, so drift is never computed from a malformed or stale matrix.
Obtaining the baseline file itself — copying it from a previous release, a
tagged published artifact, or wherever the caller keeps it — is the caller's
job; this script only ever reads a path it is given.

## No secret material

Every field is a status, a count, a URL, a date, or free-text reason already
present in one of the two input matrices — no fixture content or credential
value is read.

## Consuming this

```ts
import { buildSupportMatrixDrift } from '../benchmarks/support/drift.ts';
```

The CLI always exits `0` once the diff is computed, whatever it finds; it
exits non-zero only when an input is missing or fails schema validation.
`summary.regressions`, `.improvements`, `.newAndUnclassified`, and
`.staleProviderProvenance` are counts a gate can check without parsing the
arrays; the arrays carry the detail. Per the boundary rule, deciding what a
non-zero `summary.regressions` means for a release stays product-side — this
repository's job ends at emitting the record.
