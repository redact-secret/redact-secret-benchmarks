# Measure benign axis diversity, not just a bare case count

Date: 2026-09-21 · Status: accepted

## Context

[Issue #90](https://github.com/redact-secret/redact-secret-benchmarks/issues/90)
measured that `stable.benign.minimumCases = 5` is satisfied monotonously: of
46 registered families, 23 sat at exactly 5+ benign controls and 23 sat at
exactly 2, and every deficient family's controls were the same
malformed-by-construction near-miss pair (`vercel-token-prefix-only` /
`vercel-token-short-body`, and 22 more like it). Three more `-short-*`
suffixes would clear the bare count for all 23 without proving anything new
about the detector. `status-criteria.json`'s own rationale already stated the
intent the number failed to carry: "Five benign controls is the minimum
sample to claim the detector stays quiet on **adjacent, non-secret shapes**"
— plural, distinct shapes, not five truncations of one shape.

[Issue #91](https://github.com/redact-secret/redact-secret-benchmarks/issues/91),
a hard prerequisite, fixed the axis field the diversity criterion needs to
read: `benchmarks/engine/cases.ts`'s taxonomy regex mislabelled 203 of 274
benign controls as `documentation` because `detector-coverage`'s fixture
`group` is the family name, not a category string the regex could match. #91
replaced the regex with `controlAxis`, a pure sibling of
`classifyControl`'s existing must-not-flag branch (single source of truth,
`benchmarks/lib/assessment.ts`), and is merged as of this work
(`31b2b6f`, PR #96).

## Decision

1. **Add `stable.benign.minimumAxes` alongside `minimumCases`.** A family's
   benign evidence must now clear both: enough cases, *and* enough distinct
   taxonomy axes (`public-identifier`, `placeholder`, `reference`,
   `ordinary-prose`, `near-miss`, `encoded-value`; `pending` is the fail-closed
   marker for an unreviewed T0 control and is never itself evidence of
   diversity, though nothing currently reviewed produces it).
2. **Compute axis diversity where the evidence already lives.**
   `benchmarks/engine/reporting.ts`'s `summaries()` gains a fifth output,
   `axesByDetector: Record<string, string[]>`: for every `benign`-method case
   result, add its `taxonomy` to the set for each of its `targets`. This is
   case-level, not assertion-level — a case's axis does not vary by scanner or
   assertion type — and is computed alongside the existing per-assertion loop
   so it costs one extra `Set` per detector, not a second pass over results.
   `axesByDetector` reaches the discovery report for free the same way
   `byDetector`/`byTaxonomy`/`byOperator` already do
   (`execution.ts`'s `...summary` spread).
3. **`familyEvidence` takes `axesByDetector` as an explicit parameter**
   (`familyEvidence(family, byDetector, axesByDetector, reviewQueue, ledger)`),
   producing `benignAxes: number` and `benignAxisIds: string[]` on
   `FamilySupportEvidence`. `benignAxisIds` is carried through even though
   `stableFailures` only needs the count, so a `benign.minimumAxes` failure
   names which axes are present ("axes present: near-miss") instead of a bare
   number a reader has to go look up separately.
4. **Never touch the summary stratum key.** The stratum
   (`must-not-flag/<tier>`) is the denominator `lattice.ts` and `accounting.ts`
   group on, and `src/model.mjs`'s no-cross-tier-denominator invariant depends
   on its exact shape. Taxonomy axis is carried in a parallel structure
   (`axesByDetector`), never folded into the stratum string, so this change
   cannot manufacture a per-axis denominator nobody decided on.

## Staging the floor

Introducing `minimumAxes: 3` immediately would move families that read
`stable` today backwards, which the acceptance criteria for this issue
explicitly forbid. Measuring with `npm run eval:classify` on this branch
(current HEAD, `2937` cases, `redact-secret`/`gitleaks`/`trufflehog`) gives:

```
Distribution: {"stable":2,"provisional":42,"pending":2,"unsupported":0} of 46 families.
```

The two families reading `stable` today — `gitlab-token` and `npm-token` —
both carry exactly `benignAxes: 2` (`near-miss`, `placeholder`). Across every
family with a registered detector, the axis-count histogram is:

| benignAxes | families |
| --- | --- |
| 1 | 27 |
| 2 | 6 |
| 3 | 11 |
| 4 | 2 |

`minimumAxes` is staged at **2** — the minimum already met by every
currently-stable family — so this lands with zero regressions
(re-running `eval:classify` after setting the value reproduces the identical
`{"stable":2,...}` distribution). Raising it to 3, per the issue's original
target, is deferred to a separate, separately-reviewed change once #90's part
A3 (broader benign corpus coverage, since only 11 of 46 families clear 3
today) lands. `status-criteria.json`'s `rationale` field records the measured
value and cites this ADR for the target and the ratchet plan; it is not
softening the gate, it is the honest floor for the evidence that exists today.

**Rejected alternative**: shipping `minimumAxes` reported-but-unenforced in
the schema without wiring it into `stableFailures`. A threshold that exists
and decides nothing is exactly the defect #90 is correcting for
`minimumCases`; adding a second one of the same shape would be self-defeating.

## The CI question

`.github/workflows/validate.yml`'s `validate` job never runs `npm run
eval:classify` today, and did not before this issue either — `minimumCases`
has had the identical enforcement gap since #504 introduced
`classify-support.ts`. This issue is what surfaces it, and leaving it silently
unenforced (a third option) is worse than deciding either way, so: **this
stays a release-time gate, checked manually via `npm run eval:classify`
before any change to `status-criteria.json` is merged** — exactly how this
change's own floor was staged and verified above — rather than added to the
`validate` job in this change.

Reasons for not folding it into per-push CI here:

- `eval:classify`'s default scanner set is `redact-secret`, `gitleaks` and
  `trufflehog` (`qualification/suite-v1.json`); the `validate` job installs
  neither of the latter two (only `scanner-comparison` does, as pinned,
  checksum-verified binaries). `gitleaks`/`trufflehog` would report
  `unavailable` there, which `stable.benign`/`twin` thresholds tolerate
  (only the `redact-secret` scanner is scored, per `evidence.ts`'s
  `PRODUCT` filter), but a Support-status report with two of three scanners
  silently absent on every ordinary push is a worse artifact than the
  explicit, deliberate one produced today at release time.
- No baseline `support-matrix.json` is checked into this repository yet for
  `support-matrix-drift.ts`/`npm run eval:matrix:drift` to diff against per
  push; that mechanism (A10, #511) is built and used for release-candidate
  comparisons, not wired as a push-time regression gate, and building that
  wiring is out of this issue's scope.
- A push-time run would also need a decision on how to store a growing
  `results-output/support-status.json` per commit (it is `.gitignore`d
  today, generated fresh from the pinned corpus every time) — a decision this
  issue is not the one to make.

Should A3 (#504's finer per-family taxonomy work) or a future issue want this
enforced per push, the mechanism to reuse is already named above: a checked-in
baseline `support-matrix.json` plus `eval:matrix:drift`, not a second baseline
format.

## Consequences

- A family can now regress from `stable` to `provisional` purely by losing
  axis diversity even while its case count holds — e.g. deleting one of two
  distinct-axis controls and adding a same-axis one instead. This is the
  point: the floor is supposed to catch exactly that shape of change.
- `benchmarks/support/evidence.ts`'s `totalWhere`-derived `benignCases` still
  sums pass+fail across every tier, unchanged by this issue; `minimumAxes` is
  an additional, independent floor, not a replacement for the case-count one.
- This repository does not assert product output (`AGENTS.md`); `minimumAxes`
  changes what this benchmark *claims* about a family's benign evidence
  (whether it is diverse enough to trust), never what the product *does*. A
  family moving from `stable` to `provisional` under this floor is a
  statement about measurement completeness, not a detector regression.
