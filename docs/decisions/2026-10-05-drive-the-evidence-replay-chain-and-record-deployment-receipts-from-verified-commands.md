---
decision_id: decision-drive-the-evidence-replay-chain-and-record-deployment-receipts-from-verified-commands
status: accepted
scope: benchmarks
title: Drive the evidence replay chain, the acceptance package and the deployment receipts from verified commands, and make a workflow-opened candidate pull request reviewable
decided_at: 2026-10-05
---

# Drive the evidence replay chain, the acceptance package and the deployment receipts from verified commands

## Context

#690 asks for one documented entry point that adopts a later snapshot with repeatable verified runs, a reviewable delta report, explicit acceptance and deployment receipts. The first uses (snapshot-2026.10.04.3 and snapshot-2026.10.05) proved the verification and the report, and left by hand: the transient replay branch, the `official-runs.yml` dispatch and wait, downloading and recording, the archive and its round trip, the three views and the comparison, the acceptance patch, and the deployment receipts. They also left two things never exercised on a real adoption: the `propose` job of `adopt-evidence-snapshot.yml` and the behaviour of a pull request opened with the workflow token.

`snapshot-2026.10.05.2` (11 changed cases, 0 added, all Polar negatives moved from T3 to T0) was adopted with the existing entry point on the accepted `snapshot-2026.10.05` (engine alpha.5, published beta.13), which exercised both.

## What the first real exercise showed

- **The entry point worked for the part it covers.** Dispatched on `develop` (run 37332215346) with the tag and the manifest digest only: the preflight verified identity and engine compatibility, the `propose` job opened the draft candidate pull request (#727) once, on the branch `adopt-evidence/snapshot-2026.10.05.2-fbbeeca867db`, with the record and the change report, and no pin, run or authority changed. Because the accepted adoption is the active pin, the record was written as `evidenceCandidate` next to it, with the active engine and the published product, without passing either.
- **The workflow-token caveat is real.** The draft had no checks at all (`statusCheckRollup` empty): GitHub starts no `pull_request` or `push` run for work done with the workflow token. The required check `validate` would never have reported without a manual empty commit.
- **Everything after the candidate record was still by hand.**

## Decision

1. **The propose job dispatches the checks.** `validate.yml` accepts `workflow_dispatch` (develop's change plan runs everything on a dispatch; a `workflow_dispatch` run is the one event a workflow-token actor may start). After opening the draft, the propose job runs `gh workflow run validate.yml --ref <branch>`; the required `validate` check then reports on the draft's head commit. The propose job gains `actions: write` for that alone; it still has no other write scope, runs only after a passing preflight and only on `develop`, and a refused dispatch leaves the pull request and a warning that says what to do by hand.
2. **The replay chain is commands.** `scripts/run-evidence-replay.mjs` (control replay, contrast, the chain with the product candidate and its 2x2), `scripts/render-snapshot-contrast.mjs`, and `scripts/prepare-acceptance-package.mjs` do what was by hand, each idempotent and refusing with the reason: one transient branch per adoption key, one run per commit (a run of the same commit that has not failed is reused), every run record checked against the candidate's engine, the replay commit and equal repeat digests, every archive checked by a byte round trip, the transient branch deleted after the archive is kept, the acceptance patch built on a transient worktree. `official-runs.yml` stays `contents: read`; the release, the branch and the record use the maintainer's `gh` credentials. A moved engine or product still needs the by-hand pins and the command says so.
3. **Deployment receipts are recorded only from verification.** `scripts/record-deployment-receipt.mjs` builds `candidate.deployment.<environment>` from the publish run (success, push event, `develop` for staging and `main` for production, at a commit that holds the owner acceptance of this release) and from the deployed pages (the evidence release, the engine, the scanned product and the disclosure in both languages on every listed page). A failed check writes nothing, a candidate that is not deployed has no receipt, and a different receipt already recorded needs `--replace`.
4. **What stays the owner's.** `acceptedBy`, `acceptedOn` and the decision, renewing the authority file, applying the patch, `go-production` and the decision to apply a ledger settlement. The prepared patch is refused by `adoption:check` if it fills an owner field (now also for an evidence candidate), and the gates stay red on the acceptance branch until the owner does.
5. **A report states what the evidence did, not what an added case would.** When a release changes cases without adding any (here, 11 cases moved to an unresolved evidence class), the comparison attributes the outcome move to that change (the cases are pending, in no denominator), lists the status consequence from the floors the remaining scored evidence no longer meets, and the parity report counts such a case under the existing cause `pending-not-scored` when the legacy fixture was scored. Neither restores a status by dropping a floor or counts an unscored case as a miss.

## Consequences

An adoption is: dispatch `adopt-evidence-snapshot.yml`, review the draft (its `validate` check runs), run the chain and the acceptance package, decide. The remaining manual acts are the owner's decisions. The dispatch of `validate.yml` by the propose job is exercised the next time `adopt-evidence-snapshot.yml` opens a pull request after this change merges; until then it is a mechanism whose premise (a dispatch is not suppressed for the workflow token) was observed in documentation and in the absence of the other events on #727, not in a run. Spec: `docs/specs/evidence-adoption.md`.
