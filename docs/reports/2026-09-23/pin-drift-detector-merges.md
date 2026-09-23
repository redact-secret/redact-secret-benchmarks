# Pin-drift and detector-only product merges

Research for [#185](https://github.com/redact-secret/redact-secret-benchmarks/issues/185).
Separate from [#180](https://github.com/redact-secret/redact-secret-benchmarks/issues/180)
(peer scanner patch versions); this is about the product pin.

## What fails today

`npm run pins:check` (the `pin-drift` job in `.github/workflows/validate.yml`)
checks two different things and reports both as one red job:

| Check | Where | Needs network | What it protects |
| --- | --- | --- | --- |
| Consistency: `detectors.json` `sourceRevision` = `detector-inventory.json` `redactSecretRevision`; inventory version = `package.json`; `performance-criteria.json` `baseline.sourceCommit` = inventory revision (#150) | `checkPinConsistency` | no (`pins:check:local`) | the three pin files and the baseline describe one product revision |
| Freshness: any file under `crates/secret-scan-core/src/detectors` changed between the pin and product `main` | `checkPinAncestry` | yes (`gh api compare`) | the registry is not describing a stale detector set |

Only the second one goes red on a routine product merge, and it is red for
every branch, including ones that never touched a pin file. The job also
stops at the first failing step, so `promotion:check` (#106), which follows
`pins:check` in the same job, does not run while the pin is stale.

## Measured facts

Product repo `redact-secret`, first-parent merges on `main`. Registry pin
history from `git log -- benchmarks/detectors.json` here.

**Since the registry pin `15fce66` (2026-09-23)**

- 15 product merges; **1 touched detectors** (#709, `44bb3d6`, three files
  under `detectors/`, one of them the shared `pattern.rs`). The 14 others
  changed no detector.
- `1d13d96` and `df0bee6` (benchmarks `main`) and PRs #179, #181, #180's branch
  all failed `validate.yml`; the latest ten runs are failures except two
  still running on `workbench/repin-registry-fdca511`.
- The re-pin that clears it is already open: `2950cc3`, to `fdca511`.

**Since 2026-09-16 (18 registry pin values, 17 re-pins)**

- 175 product merges, **62 touched detectors** (35%).
- Between two consecutive pins there were 0 to 36 detector merges (median 2).
  Every re-pin therefore bundled a small number of detector merges; none of
  them was a no-op for the registry.

**Performance evaluations (workflow dispatch, ~an hour of five toolchain builds)**

| Pin | Run | Verdict | Baseline recalibrated |
| --- | --- | --- | --- |
| `079095e` | 35861463332 | ACCEPTED 46/46 | yes |
| `41fc366` | 35868842776 | ACCEPTED | yes |
| `065ec76` | 35875811051, 35876390241 | **REJECTED** 7/46, then 5/46 | no (deliberately) |
| `15fce66` | 35878900954 | ACCEPTED 46/46 against the unchanged `41fc366` criteria | yes |

Five runs and three recalibrations in about one day, for 38 product merges
(15 with detectors).

**The load-bearing observation.** The `065ec76` rejection was a real
regression: `scale-logs` throughput on rust-core, cli and node fell to about
half of baseline (`evidence/683/`, redact-secret#683, fixed by #684).
`git diff 41fc366 065ec76 -- crates` shows the range changed
`detectors/datadog.rs`, `mailgun.rs`, `okta.rs`, `mod.rs` and a 35-line change
in `policy.rs`; the fix (#684, `15fce66`) changed only `detectors/pattern.rs`.
This research did not bisect which of those merges caused the drop, so it does
not claim the detector files alone did. It does show that the fix lived under
`detectors/`, and that `detectors/` is not one thing: `pattern.rs` is shared
matching machinery, the provider files are per-detector. "Detector-only" is not
a safe proxy for "cannot change performance".

Also: the `15fce66` run was ACCEPTED against the criteria that already existed,
yet `f32473f` re-derived every threshold from it. Re-deriving on every
accepted run moves thresholds toward whatever the latest run measured, which
is the same by-construction acceptance the `evidence/683` note refuses for a
rejected run.

## The options

Counts are what each option would have required across the four pins after
`079095e` (`41fc366`, `065ec76`, `15fce66`, and the pending `fdca511`).

| Option | Re-pin PRs | Evaluation runs | Recalibrations | Would it have caught #683? | Verdict |
| --- | --- | --- | --- | --- | --- |
| Status quo | 4, manual | 6 (five so far, one owed), manual | 3, manual | yes | the cost in the issue |
| 1a. Decouple baseline; require an evaluation only for a performance-relevant diff, detectors excluded | 4 | 2 of 3 (`41fc366`: pipeline and assessment changes; `065ec76`: only because `policy.rs` changed alongside the detectors); none for `15fce66` | 2 | only incidentally, through `policy.rs`; the `#684` fix at `15fce66` is `detectors/pattern.rs` only and would have gone unverified | reject |
| 1b. Same, plus "or the evaluated run is older than N detector commits" | 4 | depends on N: N=10 fires at `41fc366` (10 detector merges in its range) and not at `065ec76` (3); N=3 fires on every pin above | 2 to 4 | only for N ≤ 3, which is nearly the status quo | reject as sole change |
| 2. Automation opens the re-pin PR and dispatches the evaluation | 4, automatic | same 6, automatic | 3, still needs a human when REJECTED (by design) | yes | keep |
| 3. `pin-drift` a warning for detector-only PRs, required before release or on a schedule | 4 | 6 | 3 | yes, at the release gate | keep, narrowed (below) |
| 4. Check the base branch's own status before failing a PR | 4 | 6 | 3 | yes | keep as a special case of 3 |

No option removes the measurement itself. What can go is the manual toil and
the red status that unrelated PRs inherit.

## Recommendation

1. **Split the job.** `pin-consistency` runs `pins:check:local` on every push
   and PR and stays required: the three pin files and the baseline agree.
   This is the property #150 exists for and it costs nothing to keep.
   `pin-freshness` (the network compare) becomes non-required: on
   pull requests it reports as an annotation and passes unless the PR itself
   edits a pin file; on `push` to `main` and on a daily schedule it fails, so
   a stale pin is still a visible red signal, just not one every unrelated PR
   inherits. `promotion:check` moves to its own job so a stale pin cannot
   hide it. (options 3 and 4)
2. **Automate the re-pin.** A scheduled workflow, plus `repository_dispatch`
   from the product's `main` when it lands a detector change, opens the
   three-file re-pin PR and dispatches `performance-evaluation.yml` on it. It
   never recalibrates from a REJECTED run. (option 2)
3. **Do not exclude detectors from performance relevance.** Reject 1a; 1b
   only as a secondary backstop.
4. **Stop re-deriving thresholds on ACCEPTED runs.** Keep
   `baseline.sourceCommit` as "the commit the thresholds were derived from"
   and add `baseline.verifiedCommit`, the commit of the latest ACCEPTED run
   against them. The consistency check then requires `verifiedCommit` = pin,
   and an accepted run advances `verifiedCommit` only. Recalibration becomes a
   deliberate act taken when a run is REJECTED and the product decides the new
   level is the accepted one (as in #683), or on a fixed cadence.

The smallest first change is 1: it stops the unrelated red and needs no new
workflow or schema change. 2 and 4 remove the remaining manual work.

## Accepted risk

- After 1, a stale pin can sit on `main` until the daily schedule flags it, and
  PRs merge while it is stale. The registry can then describe an older detector
  set than product `main`. Bounded by the schedule interval, and visible.
- After 2, the automated evaluation is one `ubuntu-latest` run. #683 showed
  runs vary (7/46 then 5/46 failures at the same commit) but the direction was
  stable. A single run can pass a regression close to a threshold; the current
  process has the same exposure.
- After 4, thresholds fixed at an older derivation commit would tolerate a
  slow drift up to their margin across many accepted runs. That is the
  intended reading of a fixed threshold; a stale baseline hides only what
  fits inside the margin.
- None of this changes scoring, gates, or ledger semantics, and performance
  acceptance stays a measurement, not a release gate.

## Where the rule lives

The decision record
[`2026-09-23-decouple-pin-freshness-from-pin-consistency.md`](../../decisions/2026-09-23-decouple-pin-freshness-from-pin-consistency.md)
is the authority. `docs/specs/performance-acceptance.md` carries the
operational description when the implementation issues land. `AGENTS.md`
(boundary rule and agent workflow) and `evidence/` (final measurement output
for core issues) are not the place.

## Follow-up issues

Filed after review of this report; not created by this change.

1. Split `pin-drift` into required `pin-consistency`, non-required
   `pin-freshness` (annotation on PRs, red on `main` and daily), and a
   separate `promotion:check` job.
2. Scheduled and `repository_dispatch` re-pin workflow that opens the
   three-file PR and dispatches the performance evaluation.
3. Add `baseline.verifiedCommit`; change `checkPinConsistency`; advance it
   from an ACCEPTED run without re-deriving thresholds.

Exploratory logs and the interval script are not committed; the numbers above
come from `git log --first-parent <pinA>..<pinB> -- crates/secret-scan-core/src/detectors`
in `redact-secret` and can be re-derived from the pin history in this repo.
