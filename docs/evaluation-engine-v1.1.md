# Evaluation engine v1.1 — differential specification

This is a diff against [`docs/evaluation-engine-v1.md`](evaluation-engine-v1.md)
and the measurement protocol in [`docs/measurement-v4.md`](measurement-v4.md).
Everything not stated here is unchanged. The rationale and the decisions behind
it are in
[`docs/decisions/2026-09-19-tighten-evaluation-accounting-v1-1.md`](decisions/2026-09-19-tighten-evaluation-accounting-v1-1.md).

Status: accepted and implemented (issue #26). The floors and the §12 questions
were settled from a dry run — [`evaluation-engine-v1.1-dry-run.md`](evaluation-engine-v1.1-dry-run.md)
— and the decisions are recorded in the ADR. Where a clause below was refined
by review, the refinement is marked **Decided**.

v1.1 changes **accounting and reporting only**. It does not change the outcome
lattice, envelope semantics, corpus truth, tier assignment, or the adapter
contract. Adapters still receive bytes and identity only, and still never see
expectations or tiers.

---

## 0. Configuration surface

All numeric floors live in `qualification/suite-v1.json` under a new
`accounting` object, so they are covered by `suiteHash` and a change to them is
a reviewable corpus-adjacent change rather than a code edit:

```json
"accounting": {
  "version": "1.1",
  "minDenominator": 5,
  "resolvedRateFloor": { "default": 0.9, "differential": 0 },
  "measurableShareFloor": { "default": 0.7, "policy": 0 },
  "twinCoverageFloor": 0.5,
  "replays": 2,
  "intervalZ": 1.96,
  "intervalPrecision": 6
}
```

A floor is a number, or a map with a `default` and per-key overrides (method
for `resolvedRateFloor`, kind for the other two). **Decided:** the values above
are the reviewed ones (§12); floors gate on the point estimate, publication
reads the bound (§7).

---

## 1. `review-required` consumes denominator

**Today.** `Counts` is `{ pass, fail, 'review-required' }` (`qualify.ts:47`) and
`summaries()` (`reporting.ts:28`) accumulates the same three-way row. Nothing
reads the third field as a constraint. `complete` (`qualify.ts:53`) is
`cases > 0 && generationErrors === 0 && every scanner complete`, plus
`holdout.status === 'complete'`.

**v1.1.** For every summary row and every group:

```
total      = pass + fail + review-required + not-measured
resolved   = pass + fail
resolvedRate = resolved / total          // null when total === 0
```

`resolvedRate` and the raw `unresolved = total - resolved` are emitted on each
row. Qualification adds to `complete`:

```
every scored group has resolvedRate === null || resolvedRate >= resolvedRateFloor
```

A run whose assertions are wholly `review-required` reports `incomplete` with
reason `unresolved-assertions`, listing the offending group keys. Detector
assertion failures keep their v1.0 meaning: visible, and not an infrastructure
malfunction.

**Decided.** T0 strata are unresolved by construction and are charged through
`measurableShare` (§2) and the ledger (§6), so the floor is held over scored
strata; a method that resolves nothing at all is listed as `<method>/*`, which
is how the wholly-`review-required` run is caught.

**Differential interaction.** `differential.ts` queues every disagreement as
`review-required` by design, and that must stay — a disagreement is never
truth. Differential rows therefore carry their own floor key
(`accounting.resolvedRateFloor.differential`, default `0`) so the boundary rule
is preserved while the other five methods are held to the floor. What
differential *does* gain is an aging field: §6.

---

## 2. T0 becomes visible next to the numbers it is absent from

**Today.** `scoring.ts:92` returns the row without `scoreRow()` fields when
`assessment.tier === 'T0'`. `lattice.ts:92` files it under `pending/T0` with
`{ files, scored: false }`. `absolute()` (`assertions.ts:11`) returns
`review-required`. The T0 population never appears in the same view as the
rates it is excluded from.

**v1.1.** T0 rows stay unscored. Each scored `must-redact` / `policy` group
gains:

```
measurableShare = <scored files in this (kind,tier)> /
                  <scored files + T0 files whose *candidate* kind is this kind>
```

The candidate kind is what `classifyFixture()` would have assigned had evidence
been adequate; `assessment.ts` already carries it through `pending()` and
`decide()`, so this needs a field on the T0 assessment record, not a new
classification pass.

When `measurableShare < measurableShareFloor`, the group's rate fields are
emitted as the string `"insufficient-evidence"` rather than a number, and the
UI renders that verbatim. `diagnostics.exact` is unaffected, so the
beta.3 → beta.4 story stays verifiable across the change.

---

## 3. `OVERBROAD` resolves toward the stricter layer

**Today.** Three layers disagree:

| Layer | Location | Treats `OVERBROAD` as |
| --- | --- | --- |
| Absolute assertion | `assertions.ts:15` | fail (not `EXACT`/`COVERED`) |
| Leak accounting | `lattice.ts:52` `isLeaked` | not leaked |
| Twin discrimination | `lattice.ts:126` `isCovered` | discriminated |

**v1.1.** Leak accounting is correct as it stands and does not change:
leakage and overbreadth are deliberately separate axes (measurement-v4 §2.4),
and an overbroad finding genuinely does not leak the secret.

Twin discrimination changes. `lattice.ts:126` currently reads
`row.spanOutcomes!.every(isCovered) && !twin.flagged`. It becomes:

```
row.spanOutcomes!.every(o => o === 'EXACT' || o === 'COVERED') && !twin.flagged
```

so the twin judgement matches `absolute()`. Rationale: a twin pair asks
"did the tool tell these two inputs apart", and a finding that swallows
surrounding bytes has not demonstrated that it did.

`isCovered` is retained for leak-axis use and gains a doc comment stating that
it is not an acceptability predicate.

---

## 4. An unavailable scanner is a measured gap

**Today.** `assertions.ts:32`:

```ts
if (scanner.status !== 'complete') return { scanner: scanner.id, status: scanner.status, variants: [], assertions: [] };
```

The empty `assertions` array means `summaries()` adds nothing for that scanner
— it contributes 0 to numerator *and* denominator.

**v1.1.** The non-complete branch emits one assertion row per variant with
status `not-measured`, carrying the scanner status (`unsupported` /
`unavailable` / `error`) as `reason`. `AssertionStatus` gains `'not-measured'`;
`Counts` gains the matching key; `summaries()` needs no other change.

`not-measured` counts toward `total` and never toward `resolved`, so §1's floor
catches a silently absent scanner. `qualify.ts` already requires every scanner
`complete`, so this changes nothing there — it matters for the discovery
workflow (`npm run eval`) and for `eval:candidate`, where a partially available
tool set is normal and currently under-reported.

---

## 5. Twin coverage is published

**Today.** `lattice.ts:82` computes `positives` and no line reads it — dead
code. The group emits `twins: { positives, pairs, discriminated, rate }` where
`positives` is incremented per row at `lattice.ts:125` and `rate =
discriminated / pairs`. A group with one authored twin out of forty positives
reports a discrimination rate from a denominator of one.

**v1.1.**

```
twins.coverage = pairs / positives         // null when positives === 0
twins.rate     = withheld ("insufficient-coverage") while
                 coverage < twinCoverageFloor || pairs < minDenominator
```

The dead `positives` local at `lattice.ts:82` is either removed or used as the
cross-check that the per-row increments agree with it; the spec prefers the
latter, as a one-line internal consistency assertion.

---

## 6. Unreviewed differential disagreements age

**Today.** `execution.ts` builds `reviewQueue` entries with a content hash
(`hash({ case, source, ...entry })`). Nothing tracks whether an entry was ever
resolved; a disagreement queued months ago is indistinguishable from one
queued this run.

**v1.1.** A checked-in `benchmarks/review-ledger.json` maps queue entry id →
`{ status: 'open' | 'resolved', firstSeenRun, resolvedRun?, note }`. The engine
does not write it; review does, the same way `known-gaps.json` is maintained.
The report gains:

```
review: { open, resolved, unknown, oldestOpenRun }
```

`unknown` counts queue entries with no ledger row — a disagreement nobody has
looked at. Qualification requires `unknown === 0`; it does not require
`open === 0`, because an open, acknowledged disagreement is a legitimate
standing state and forcing it to zero would push reviewers toward closing
disagreements as truth. This is the one place where v1.1 adds a *process*
obligation rather than an arithmetic one.

---

## 7. Rates carry an interval

**Today.** `lattice.ts:71`: `const rate = (n, d) => (d ? n / d : null)`.

**v1.1.** Every published rate becomes an object:

```
{ point: number, bound: number, n: number, direction: 'upper' | 'lower' }
```

`bound` is the Wilson score interval endpoint at `z = accounting.intervalZ`:

```
centre = (p + z²/2n) / (1 + z²/n)
spread = (z / (1 + z²/n)) * sqrt(p(1-p)/n + z²/4n²)
upper  = centre + spread        lower = centre - spread
```

Direction by metric — always the pessimistic side:

| Metric | Direction |
| --- | --- |
| `leakedSpanRate`, `leakedByteRate`, `collateralRatio`, `falseAlarmRate` | upper |
| `twins.rate`, `twins.coverage`, `measurableShare`, `resolvedRate` | lower |

`collateralRatio` is not a proportion — it is `collateralBytes / secretBytes`
and unbounded above (ADR 2026-09-17, decision 2). It therefore reports
`{ point, n }` with `bound: null` and `direction: null`. Applying a binomial
interval to it would be wrong, and the spec says so explicitly so that a later
reader does not "fix" the omission.

`bound` is rounded to `accounting.intervalPrecision` decimal places so report
bytes stay deterministic across platforms. `lattice.ts` stays dependency-free
and closed-form, preserving browser re-verification.

Every comparison surface — `docs/release-comparison.md`, the baselines, the
evaluation UI headline — reads `bound`. `point` stays available and is shown
secondary.

When `n < accounting.minDenominator`, the whole rate object is replaced by the
string `"insufficient-evidence"`, matching §2. A zero denominator stays `null`.

**Decided.** `n` is the number of independent observations, not always the
arithmetic denominator: `leakedByteRate` draws its interval over spans.
`meanFindingsPerFlagged` is an unbounded ratio like `collateralRatio` and
carries `bound: null` too.

---

## 8. Observations are replayed

**Today.** `execution.ts` writes the scratch tree once and calls
`scanner.scan()` once per scanner. The resulting findings are truth for that
run.

**v1.1.** Each scanner is invoked `accounting.replays` times against the same
scratch tree, within the same `try` block, before the tree is removed. Findings
are normalized and compared as sorted `path:start:end[:family]` tuples.

- All replays identical → `status: 'complete'`, findings as today, and
  `replays: { count, agreed: true }`.
- Any disagreement → `status: 'unstable'`, `findings: []`, and
  `replays: { count, agreed: false, divergentPaths: [...] }`. No raw scanner
  output is retained, consistent with the existing suppression rule.

`unstable` behaves exactly like `unavailable` downstream: it produces
`not-measured` assertion rows (§4) and fails `complete` in `qualify.ts`. It is
never a pass and never re-run to obtain a greener result. Re-running a whole
qualification is allowed; selectively re-rolling one unstable scanner is not,
and the report keeps the `unstable` record either way.

Cost: scan wall-clock roughly doubles. Generation, hashing, corpus loading and
holdout lifecycle are untouched.

---

## 9. Dual-scorer transition

For the transition, a v1.1 run scores every group twice — once under v1.0
accounting, once under v1.1 — and emits:

```
accountingDelta: {
  version: "1.0 -> 1.1",
  groups: { "<kind>/<tier>": { v10: {...}, v11: {...}, cause: [...] } }
}
```

`cause` names which v1.1 rule moved the figure: `unresolved`, `t0-share`,
`overbroad-twin`, `not-measured`, `twin-coverage`, `interval`, `unstable`.
**Decided.** `interval` is named only when the rule withholds a figure for
`n < minDenominator`; the bound itself is an addition beside an unchanged
point. The bench report carries the lattice delta per `<kind>/<tier>`; the
discovery report carries the assertion delta (`unresolved`, `not-measured`,
`unstable`) per stratum.

This is the mechanism that keeps "the number got worse" attributable to the
engine rather than to the candidate, and it mirrors the no-op assertion that
proved the v3 → v4 mapping faithful (measurement-v4 §5, phase 2).

The dual-scorer block is removed after one release has been qualified under
v1.1 and the baselines regenerated. Until then, `docs/release-comparison.md`
must state which accounting version produced each column.

---

## 10. Report identity and compatibility

Two version concepts are currently conflated: `execution.ts:79` writes
`{ schemaVersion: 2, engineVersion: 2 }` (integers, discovery report) while
`qualify.ts:59` writes `engineVersion: '1.0.0'` (string, qualification report).
The v1.0 doc calls them independent; v1.1 names them separately instead:

| Field | Meaning | v1.1 value |
| --- | --- | --- |
| `schemaVersion` | report structure | `3` (discovery), `2` (qualification), `5` (bench report and `run.json`), `2` (public evaluation, baselines) |
| `engineVersion` | code milestone label | `'1.1.0'` |
| `accountingVersion` | **new** — comparability key | `'1.1'` |

`accountingVersion` is the only field baselines and comparison tooling read
when deciding whether two runs may be compared. Comparing across accounting
versions is rejected at validation time unless an `accountingDelta` mapping
(§9) is present in one of them. Schemas under `schemas/` are updated and the
Ajv checks in `benchmarks/engine/evidence.ts` extended; unknown fields in the
public holdout structure stay rejected.

---

## 11. Required tests

Land nothing without these; each maps to one clause above.

| Clause | Test |
| --- | --- |
| §1 | An all-`review-required` synthetic result reports `incomplete` with reason `unresolved-assertions`; a differential-only queue does not trip the floor. |
| §2 | A group with a majority T0 candidate population emits `"insufficient-evidence"`; `diagnostics.exact` is byte-identical to v1.0 for the same input. |
| §3 | A twin pair whose positive scores `OVERBROAD` is not discriminated; leak rate for the same row is unchanged from v1.0. |
| §4 | A scanner returning `unavailable` produces one `not-measured` row per variant and moves `resolvedRate`. |
| §5 | `pairs / positives` matches the per-row increments; a single-pair group withholds `rate`. |
| §6 | A queue entry with no ledger row makes qualification fail; an `open` row does not. |
| §7 | Wilson bounds against a fixed table of `(n, k)` values; `collateralRatio` carries `bound: null`; identical report bytes across two runs on the same input. |
| §8 | A stub scanner alternating findings across replays yields `unstable`, empty findings, and a failed `complete`. |
| §9 | For a run with no unresolved, no T0, no overbroad twins and large `n`, every `accountingDelta` group is a no-op — the v1.1 analogue of the v4 phase-2 proof. |
| §10 | A v1.0 baseline compared against a v1.1 report without `accountingDelta` is rejected by validation. |

---

## 12. Review questions — decided

All five are settled in the ADR's *Review decisions* section: floors
(`minDenominator` 5, `resolvedRateFloor` 0.9 over scored strata,
`measurableShareFloor` 0.7 with `policy: 0`, `twinCoverageFloor` 0.5); `policy`
shares the `resolvedRate` floor only; replay disagreement fails the scanner for
the run; the ledger is a new `benchmarks/review-ledger.json`; `holdout`
publishes no intervals. The questions are kept below as asked.

1. **Floor values.** §0 proposes `minDenominator: 5`,
   `resolvedRateFloor: 0.9`, `measurableShareFloor: 0.8`,
   `twinCoverageFloor: 0.5`. All four are guesses pending a dry run against
   the current corpus; the dry run should report what each floor would fail
   today before any of them is enforced.
2. **Does `policy` face the same floors as `must-redact`?** Policy expectations
   are this project's own masking policy (v4 §4). Holding them to the same
   `resolvedRate` may be right; holding them to the same `measurableShare`
   probably is not, since policy groups have no provider evidence to be
   pending on.
3. **Replay disagreement scope.** Quarantine the one unstable case, or fail the
   whole scanner for the run? The spec above fails the scanner, which is the
   conservative reading; quarantine preserves more evidence per run.
4. **Ledger ownership.** §6 puts `review-ledger.json` in this repository
   alongside `known-gaps.json`. The alternative is to reuse the existing
   promotion lifecycle records rather than add a second ledger.
5. **Does `holdout` report intervals at all?** Its output is aggregate-only by
   design; publishing `n` alongside a bound may leak more about corpus size
   than the lifecycle intends.
