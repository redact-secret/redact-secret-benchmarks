---
decision_id: decision-preserve-completed-stages-as-artifacts-and-retry-per-stage
status: accepted
scope: benchmarks
title: Upload each completed official-run stage as its own receipted artifact, keep a finished engine output when later checks fail, and retry per stage on an identical identity
decided_at: 2026-10-06
---

# Upload each completed official-run stage as its own receipted artifact, keep a finished engine output when later checks fail, and retry per stage on an identical identity

## Context

Two official replays of #725 lost finished work. Run 37383784272 ran the plain stage of the public population, then its methods step died with exit 143 (runner shutdown). Retry 37401116147 printed `plain=reuse` and downloaded `official-run-<population>`, which is only uploaded at the end of the job, so the plain stage was measured again (about 5 minutes) although `early-plain-<population>` (6.9 MB) existed and was never read. The engine finished at 02:08:23Z and the methods step was cancelled at 02:09:16Z during post-run verification; as the job upload ran on `!cancelled()`, the finished engine output was discarded. The owner (#762, #723, 2026-10-06) wants less CI time and cost: a late failure must not cost a full re-measurement, and verification must not need repeated 30-60 minute runs.

## Decision

1. **Each finished stage is its own artifact, at once.** After the plain stage and after the methods stage, `scripts/stage-receipts.mjs` writes `stage-receipt.json` (stage, population, platform, engine revision, protocol, evidence corpus digest, configuration hash, run class, candidate/attribution/evidence release, methods selection, sha256 of `artifact.json` and `run-record.json`, determinism, the run that measured it) and the workflow uploads `stage-plain-<population>` and `stage-methods-<population>` (14 days). `early-plain-*` is no longer written; the retry still reads it for earlier runs.
2. **A retry resolves a stage from any artifact that holds it and reuses it only on identical identity.** `scripts/retry-receipts.mjs` lists the earlier run's artifacts and offers, best first, the stage artifact, `early-plain-*` and the job-end artifact (its `methods/` directory for the methods stage). The driver checks each offered directory whole (incomplete marker, stage receipt, run-record identity, scanner set, digest, determinism, then the pins of this commit) and takes the first that holds. A mismatch is logged with its reason and the directory is never partly used; no stage is ever assembled from two identities. An absent or expired artifact is an explicit `fresh` with the reason.
3. **A finished engine output survives later failure, and the run says INCOMPLETE.** The driver writes `stage-incomplete.json` as soon as the engine output exists and removes it only when the stage verifies. Final and stage uploads run on `always()`, so a failed or cancelled verification leaves the output and the marker in the artifact, the job names the stage INCOMPLETE as an error and in its summary, and the retry refuses the directory. It is never a success. Re-running only the post-engine checks on a kept output is not offered: it would need its own identity rules and is left to a later issue.
4. **Verification without a full OpenRedaction run.** `populations` (`regression-corpus`, `policy-corpus` only) with `rehearse_post_step_failure` rehearses the path on the cheap populations: measure the plain stage, upload it, fail on purpose; a retry of that run must reuse the stage and log the receipt. A rehearsal builds no qualification view and is exclusive with the other modes. The public population is never part of it.
5. **No change for runs that succeed.** The final `official-run-<population>` artifact, the view's inputs, the registry and every pin are unchanged.

## Consequences

- A late failure costs the failed stage, not the finished ones. A stage upload of the methods artifact adds a compressed copy (level 1) of a few hundred MB per full run; the retry avoids repeating a 40+ minute stage.
- The incomplete output is evidence for people, not a result: it is named, kept, and never counted or reused.
