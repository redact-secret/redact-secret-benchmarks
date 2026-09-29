---
decision_id: decision-fix-pii-profile-cost-v2-candidate-artifact-roster
status: accepted
scope: benchmarks
title: Fix the profile-cost v2 candidate-report validator's artifact roster and re-freeze the plan
decided_at: 2026-09-29
---

# Fix the profile-cost v2 candidate-report validator's artifact roster and re-freeze the plan

## Context

The first official `pii-profile-cost-v2` `phase=candidate` dispatch (run 36511964861, head `8757fdd5`) measured all 80 cells and then failed in `validatePiiProfileCostCandidateReport` with `Invalid PII profile-cost candidate report`, before writing a report. Three A/A runs and the threshold freeze had succeeded on that head, and so had `phase=size`.

The v2 producer (`scripts/prepare-pii-profile-cost-linux-v2.mjs`) binds ten artifacts: the eight of v1 plus `browser-full-pii-wasm` and `browser-common-pii-wasm`, the `_pii` builds that redact-secret#937 split out. `scripts/measure-pii-profile-cost-v2.mjs` already expects those ten. The validator in `benchmarks/evaluation/domains/pii/profile-cost-v2.ts` still listed the v1 eight. Only the `candidate` phase calls it with thresholds, and no v2 candidate phase had run to that point, so the mismatch was dormant. This is the same class of defect as the earlier v2 roster and import-attribute fixes.

## Decision

Extend the validator's expected artifact roster to the ten ids the producer and the measure script use. Nothing else in the validator changes: no threshold, sample protocol, verdict rule or cell roster. Re-hash `profile-cost-v2.ts` in `implementationFreeze.files` and recompute the plan `contentCommitment`. The workflow file is not touched.

The plan commitment is embedded in every report, so the earlier A/A, freeze and size runs bind the previous commitment. They are not reused: the official protocol is re-run from `phase=aa` on the new head. The superseded run ids stay in this record only as history: A/A 36509127677, 36509133436, 36509139102; freeze 36511919237; size 36511951031; failed candidate 36511964861.

Before re-dispatching, the fixed validator was run against a report built from the real A/A observations and the real frozen thresholds, and it accepted it. That check is a pre-flight, not evidence.

## Consequences

No measurement is reused or adjusted. The fix cannot change a verdict, since it only widens which artifact ids the candidate report may carry to the ones the producer already writes. A regression test (`tests/pii-profile-cost-v2-roster.test.mjs`) pins the validator, the measure script and the producer to the same ten ids.
