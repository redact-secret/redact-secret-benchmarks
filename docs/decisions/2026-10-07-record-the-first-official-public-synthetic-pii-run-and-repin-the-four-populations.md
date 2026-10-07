---
decision_id: decision-record-the-first-official-public-synthetic-pii-run-and-repin-the-four-populations
status: accepted
scope: benchmarks
title: Record the first official public/synthetic PII execution as evidence and read the four populations from it
decided_at: 2026-10-07
---

# Record the first official public/synthetic PII execution as evidence and read the four populations from it

## Context

#796, part of #652 and #666; #665 consumes the result. #804 adopted pii-eval `b1c097e4` (schema 1.4) and left the four populations exploratory: replays of the frozen Beta.13 observation, equal byte for byte under the canonical linux engine,
but no scanner had been launched. The owner accepted the #795 scorer basis (2026-10-06, decision [2026-10-07](2026-10-07-propose-the-pii-scorer-basis-and-metric-semantics.md)) and approved one dispatch of a reviewed workflow that executes `pii-eval run --config`
in official mode against the pinned scanner package (#796 comment of 2026-10-06; the cost gate waived for exactly that one dispatch). The approval does not cover a verdict, a PII authority switch, `new.authorisation`, `owner-accepted-verdict`, a protected path or `main`.

## Decision

1. **The candidate identity of an execution is the tree digest of the package it launches**, not the artifact-set commitment of the frozen observation. They are different constructs over different bytes (`docs/specs/pii-official-execution-plan.md`), so a fresh manifest is rebuilt for the tree digest;
   the snapshot, roster, cases, configuration and activation digests stay identical. The source commit still binds the product (`candidateSourceCommit`).
2. **The run is `.github/workflows/pii-official-run.yml`** (dispatch only, no inputs, least privilege, SHA-pinned actions, tokens absent from every step that runs product code). It ran once, on `develop` at `e97a9152`, run 37559349070, and succeeded at the first attempt:
   canonical engine binary, linux-x64, all four populations official, two agreeing replays each, `pii-eval validate` of every public and run artifact, the production consumer complete under the derived pins. No fix and no second dispatch were needed.
3. **It is recorded, not accepted.** `scripts/record-pii-official-run.mjs` derives from the run (GitHub's record of it and its artifact, the archive checked against the digest GitHub recorded) the durable public copies and receipt under `benchmarks/pii-eval-official-run/`, the record that binds them to the run,
   and the consumer pins: the head of each population pin is that run's artifact, `projection.mode` is `official`, the candidate is the tree digest, and the exploratory replays' digests are retired by the pins (what a repin does). The replays stay committed as the oracle parity evidence of the dual run.
   Durable copies are committed beside the Actions artifact, which expires (no new storage system; coordinated with #785 by not adding any).
4. **`official-mode-measurement` is computed from the record**, not from a flag: the pins are official and `officialRecordProblems` holds (provenance, receipt, pinned engine, durable copies equal to the run's bytes, the exploratory replay retired, the production consumer over the committed copies).
5. **Nothing else moves.** PII authority stays `legacy`; `new.authorisation` stays null; `owner-accepted-verdict` stays unmet; no threshold, tolerance, membership, suppression or support verdict changes (the matrix families and distribution are byte-equal with and without the measurement). The page says what an official-mode population is: evidence, not a qualification verdict.

## Consequences

- The exit state of #666 is recomputed against the new pins: official-mode-measurement and scorer-basis-decided are met; protected-path-live and owner-accepted-verdict are not. The rollback is rehearsed again against the pinned official digests.
- The official execution and the exploratory replay agree on every metric cell of every family and view row (240 cells, 0 differing): descriptive evidence in the receipt, not a decision. The official run's artifacts differ from the replays in the scanner capabilities (`sanitized-output`, output verification) and in the identity digests, by construction.
- A new official run needs a new owner decision on cost; the workflow is not scheduled and takes no input.

## Not decided here

Whether the owner accepts a release or candidate verdict from this run (`owner-accepted-verdict`, `new.authorisation`), the #666 exit and any authority switch, protected-path items (custodian #71 and #72, ledger), and anything on `main`.
