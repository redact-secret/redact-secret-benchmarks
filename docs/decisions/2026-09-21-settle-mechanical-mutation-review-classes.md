---
decision_id: decision-settle-mechanical-mutation-review-classes
status: accepted
scope: benchmarks
title: Settle mechanical mutation review classes as `not-assertable`
decided_at: 2026-09-21
---

# Settle mechanical mutation review classes as `not-assertable`

Extends: engine v1.1 review ledger (2026-09-19 decision, "The review ledger is a new `benchmarks/review-ledger.json`")

## Context

`benchmarks/review-ledger.json` held 1,233 open entries. 1,049 of them (85%)
sat in five mechanical operator classes, every one carrying the same
construction note, e.g.:

> Mutation review-required by construction: operator `lexical.length-minus-one`
> removes the last character of the contracted secret value, which breaks the
> fixture's lexical contract. Per the review-required strategy
> (`benchmarks/engine/model.ts`), no negative truth is inferable once a
> contract is broken — a different family or an independent contextual
> credential may still legitimately apply, and scanner silence or a match
> proves nothing either way. Ground truth requires a per-fixture authored
> decision that has not been made.

Not one of these entries had ever been resolved, and none ever could be: the
note is not a per-fixture judgement, it is a statement about the operator,
identical for every instance the operator produces. `mutation.unresolvedCritical
> 0` (`benchmarks/support/status.ts`) blocked 28 of 42 families from `stable`,
10 of them T1 families the parent epic (#61) targets, purely on the strength
of this queue.

**The trap.** `resolved` means a person signed off that one specific
fixture-versus-detector disagreement is acceptable. Bulk-marking these entries
`resolved` would claim 1,049 reviews that never happened, hiding any genuine
false negative among them behind a status that says "checked and fine" — the
opposite of what this repository exists to do (`AGENTS.md`'s boundary rule:
measure and record, never assert).

### Why the construction argument is mechanical, not per-fixture

`benchmarks/operators/lexical.ts`'s `mutate()` is the single generator behind
every lexical and structural operator (`lexicalOperators`, `boundary`, and
`structural` in `benchmarks/operators/structural.ts` all call it). It computes

```ts
const valid = new RegExp(contracts[c.seed.assessment.contract].pattern!).test(replacement);
return { fixture, strategy: valid ? 'derived' : 'review-required', ... };
```

An instance enters the review queue — and so the ledger — only when `valid`
is `false`: the mutated value no longer matches the family's own contracted
pattern. At that point the fixture's authored lexical contract is broken by
construction, and the two things a ground-truth judgement would need — "is
this still the family's shape" and "would a real credential ever look like
this" — are both unanswerable from the corpus alone. That reasoning holds
for every operator built on `mutate()`, independent of which one produced the
instance; the operator identity changes what changed (length, alphabet,
prefix, a delimiter, a whole segment), never why the contract check fails.

## Decision

Add a third ledger status, **`not-assertable`**: *no ground truth is
inferable from this construction, decided once per operator class, not per
fixture.* `benchmarks/support/evidence.ts`'s `unresolved()` treats it as
settled, the same as `resolved`, so it clears `mutation.unresolvedCritical`;
`benchmarks/engine/execution.ts`'s `reviewState()`, both report schemas
(`qualification-report-v1.json`, `evaluation-public-v1.json`), and the
workbench UI (`src/evaluation-model.ts`, `src/pages/workbench/review.ts`) all
carry it as its own counted state — never folded into `resolved`, so a ledger
reader can always tell "a person reviewed this fixture" from "a person
decided this whole class proves nothing."

Every open entry in the following seven operator classes is reclassified
`not-assertable`. All seven are built on `mutate()`'s regex-validity gate
above; the two beyond the original five were verified against that mechanism
directly, not assumed from the pattern. The seven ids are recorded in
`benchmarks/ledger-decisions.json` against this record (#135):

| Operator | Open entries | What it mutates |
| --- | --- | --- |
| `lexical.invalid-alphabet` | 216 | last character to one outside the family's alphabet |
| `lexical.length-minus-one` | 211 | drops the last character (length contract) |
| `lexical.prefix-change` | 210 | first character (namespace/prefix contract) |
| `boundary.remove-delimiter` | 210 | removes one dash/dot delimiter |
| `lexical.length-plus-one` | 202 | appends a character (length contract) |
| `structural.remove-segment` | 43 | drops a whole dash/dot-delimited segment (`sendgrid-token`, `slack-token` only) |
| `lexical.replace-last` | 28 | last character, alphabet-preserving |

1,049 + 43 + 28 = 1,120 entries move from `open` to `not-assertable`. No
entry's `note` text changes — it already states the per-class reasoning this
record ratifies — only `status`.

### `structural.remove-segment` and `lexical.replace-last`

These two were not part of the original 1,049 and needed their own check
rather than inheriting the other five's conclusion by assumption. Reading
`benchmarks/operators/structural.ts`, `boundary` and `structural` both
delegate to the same `mutate()` used by every lexical operator and are gated
by the identical `valid` regex test; `lexical.replace-last`
(`benchmarks/operators/lexical.ts`) is one of the four entries in the shared
`mutations` table that `mutate()` drives. An instance reaches the ledger for
either operator under exactly the same condition as the original five: the
mutated value fails the family's contract pattern. The construction argument
genuinely generalizes here, not by family resemblance but by shared code
path.

### Explicitly not reclassified

- **`t0-pending-fixture` (69 entries).** These are differential
  (redact-secret-vs-trufflehog) disagreements on fixtures whose tier is `T0`
  — ground truth was never authored for the fixture at all. That is a gap in
  the fixture, not in an operator's construction; it needs an authored
  per-fixture decision, which is a different unit of work (fixture
  authoring, tracked in the family-addition issues), not a class-level
  decision this record can make.
- **`classification-granularity-unasserted` (2 entries).** The corpus
  authors byte ranges and role, not a required per-span family label, so
  there is no ground truth this record — or any operator argument — could
  supply; it is a standing policy question about what the corpus asserts,
  left open pending that decision.
- **`confirmed-boundary-false-positive/<family>` (42 entries).** Already
  triaged as confirmed defects with their own destination (issue #64); this
  record does not touch them.

### Gate

`npm run ledger:decisions:check` (`scripts/check-ledger-decisions.mjs`) fails
the build if any ledger entry is `not-assertable` for an operator or decision
class no entry in `benchmarks/ledger-decisions.json` claims (renamed from
`decisions:validate`, and moved off ADR-body markers onto that data file, by
#135). It is the `not-assertable` equivalent of requiring a `resolved` entry
to carry an actual review: a class-level decision needs a checked-in record
just as a fixture-level one needs a human.

## Consequences

- Every review-queue id in these seven classes clears from
  `mutation.unresolvedCritical` for all 14 T1 families this record was
  scoped against: `aws-access-key`, `cloudflare-token`, `digitalocean-token`,
  `github-token`, `gitlab-token`, `jwt`, `npm-token`, `private-key`,
  `pypi-token`, `sendgrid-token`, `shopify-token`, `slack-token`,
  `stripe-token`, `vault-token`.
- For 11 of those 14, that takes `mutation.unresolvedCritical` all the way to
  0. Three retain a small nonzero figure because
  `benchmarks/support/evidence.ts`'s `familyEvidence` also folds in genuine
  `mutation.fail` assertions — real `redact-secret` scanner disagreements,
  never review-required-by-construction, so no operator-class decision
  touches them: `sendgrid-token` 232 → 4, `cloudflare-token` 15 → 3,
  `slack-token` 33 → 3 (all three `policy:T3` cases, `sendgrid-token`'s split
  across `must-not-flag:T2/absent` and `must-redact:T1->must-not-flag:T2/
  must-flip`). Those are candidate product defects, not a ledger
  classification question, and the issue that opened this work says so
  directly for `sendgrid-token`: it needs this record *plus*
  redact-secret/redact-secret#553. Closing any of the three further is out
  of this record's scope.
- `pulumi-access-token` and `terraform-cloud-token` are unaffected: their
  mutation review-queue ids carry no ledger row at all (`unknown`, not
  `open`) — those two families were added to the corpus after this ledger
  was last triaged, and populating their ledger rows is a prerequisite this
  record does not perform.
- The dual-scorer `eval:classify` output before and after this record is
  recorded in `results-output/support-status.before.json` and
  `results-output/support-status.after.json` (not checked in; regenerate
  with `npm run eval:classify`).

## Explicitly out of scope

- Any product-side detector change. This repository measures and records
  (`AGENTS.md`); nothing here fixes `sendgrid-token`'s 4 real failures or
  populates a missing ledger row for a newer family.
- Re-litigating the five original classes' reasoning — restated here from the
  existing ledger notes, not re-derived.
- `structural.remove-segment` and `lexical.replace-last` entries that are not
  currently `open` (there are none today; if either operator's `supports`
  gate ever widens to more families, new instances inherit this decision
  automatically because the class, not the family, is what was decided).
