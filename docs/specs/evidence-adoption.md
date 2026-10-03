# Evidence adoption

How a published credential-evidence snapshot becomes the evidence this repository measures (#690). Decision:
[adopt evidence snapshots as a candidate, then an owner-accepted repin](../decisions/2026-10-03-adopt-evidence-snapshots-as-a-candidate-then-an-owner-accepted-repin.md).
This repository measures and records (the boundary rule): the workflow verifies, reports and prepares; it never asserts a product result and never accepts on the owner's behalf.

## States

`benchmarks/evidence-adoption.json` (gate: `npm run adoption:check`) records the one adoption in flight.

| State | Meaning | Active pins, runs and authority |
| --- | --- | --- |
| `none` | nothing in flight | unchanged |
| `candidate` | a verified, engine-readable snapshot with its change report; `ownerAcceptance` is `null` | **unchanged**: develop's `official-runs:check` and `authority:check` stay green and the old public numbers stay in force |
| `accepted` | the candidate is the active pin and carries the owner's acceptance (`acceptedBy`, `acceptedOn`, an existing ADR) | repinned, replayed, authority renewed by the owner |

The candidate state is the intermediate state: nothing a gate reads changes until the owner accepts. Only one candidate exists at a time; a second adoption stops with `conflict` until the first is accepted or withdrawn (delete the record: `{"schema": "redact-secret/evidence-adoption/v1", "state": "none"}`).

## Entry point

Dispatch `.github/workflows/adopt-evidence-snapshot.yml` with `tag` and `manifest_digest` (the digest `release:verify` in credential-evidence prints for the release manifest), or run the same command locally:

```bash
node scripts/adopt-evidence-snapshot.mjs prepare --tag snapshot-YYYY.MM.DD --manifest-digest sha256:<64 hex> \
  --engine-schema <credential-eval>/schemas/corpus-snapshot-v1.schema.json --out preflight-report.json --summary summary.md
```

`preflight` (the first half of `prepare`) changes nothing and ends with one of these outcomes and exit codes:

| Outcome | Exit | Meaning |
| --- | --- | --- |
| `ready` | 0 | identity verified and the pinned engine can read the snapshot |
| `already-pinned`, `already-prepared` | 0 | idempotent no-op (same tag and manifest digest as the pin, or same adoption key as the recorded candidate) |
| `identity-failed` | 3 | the manifest digest, the tag, the listed snapshot asset digest and size, the source/schema/records-tree identity or the case count disagree. **Not** an engine problem |
| `incompatible` | 4 | the pinned engine cannot read the snapshot: a report names each violated rule, how many cases and which semantic ids. No pin changes, no pull request |
| `conflict` | 5 | a different candidate is still recorded |

**Engine compatibility.** The pinned engine refuses a snapshot that does not satisfy its closed corpus-snapshot v1 contract, so every case is validated against the engine's own schema at the pinned tag (the workflow fetches it with the existing read-only engine App token; `schemas/credential-eval-corpus-snapshot-v1.json` is the vendored copy used offline and the report says when they differ). A snapshot cannot be repaired here: its bytes are verified against the manifest, and a derived corpus would not be an official run. Expected-incompatible example: `snapshot-2026.10.03` against `v0.1.0-alpha.1` (75 of 504 added cases carry no `content`; #680). The decision is the owner's: an engine-readable evidence release or an engine change.

**Idempotence.** The adoption key is the digest of the tag, manifest digest, snapshot digest and the engine, configuration and scanner pins. The branch is `adopt-evidence/<tag>-<first 12 hex of the key>`; the propose job skips when that branch or an open pull request exists. The workflow runs one at a time (`concurrency`, no cancellation). Releasing a snapshot stays manual; there is no schedule.

**Permissions.** Dispatch only. The preflight job has `contents: read` and the engine token (`contents: read` on credential-eval only). Only the propose job, after a passing preflight and only on `develop`, has `contents: write` and `pull-requests: write`. A pull request opened with the workflow token does not start the repository checks; push an empty commit or close and reopen it. If the repository forbids Actions from creating pull requests, the branch is still pushed and the log says so.

## What a candidate pull request holds

`benchmarks/evidence-adoption.json` and `docs/generated/evidence-adoption/<tag>.json`, keyed by stable semantic case ids: cases added, removed and changed (which of content, expected spans, grouping, twin, path), evidence-class transitions, added cases by kind, evidence class and group, new providers and families. Authored-base versus generated counts are the `group` split; where the evidence source does not mark generation, the report does not invent it. The scope line is fixed: corpus evidence only, scanner, engine and configuration pins unchanged, so the first replay changes evidence and nothing else. Product-version comparisons use the same corpus and configuration.

Review state, assertable versus unresolved expectations, and representation support come from the evidence release (the materialized manifest and records bundle), not from this repository. Draft is not non-assertable, and merged or released is not reviewed: use the release's recorded review state and the eligibility policy of the qualification inputs (`docs/specs/qualification-inputs.md`). A `T0` case is `measurement.type: pending`, outside TP/FN/FP and the denominators; a scanner that did not measure is `not-measured`. Neither becomes zero detections. A representation the engine cannot yet read (decoded, fragment, input validity) is reported as unsupported, never scored (credential-eval#34, credential-evidence#150).

## From candidate to accepted

1. **Replay.** After the owner decides to proceed, open the acceptance branch from the candidate PR's branch and run `node scripts/adopt-evidence-snapshot.mjs repin --superseded-on YYYY-MM-DD`. It moves the floors population's pins in `official-runs.json` and `qualification-inputs.json` to the candidate and moves that population's existing runs (plain and methods) into `historicalRuns[]` as `status: "historical"` receipts with `supersededBy`. They are never relabelled as evidence of the new pin. `official-runs:check` accepts `historicalRuns[]` (a receipt that is really a run of the current pin is refused), and the authority check reads `runs[]` only.
2. Dispatch `official-runs.yml` on the exact reviewed commit (plain and methods drivers, pinned engine, scanners, configuration, linux-x64, two runs with equal semantic digests) and record the runs (`official-runs:record`, archive). Add outcome drift to the change report with `node scripts/adopt-evidence-snapshot.mjs compare-runs --report <report> --old <old artifact> --new <new artifact>`: common-case drift apart from added-case outcomes, and unmeasured counts.
3. **Owner acceptance.** The owner renews the authority file in a reviewed commit (the gate `authority:check` is red on the acceptance branch until then, by design; the file is never rewritten automatically) and sets `state: accepted` with `ownerAcceptance` (an ADR). `adoption:check` refuses an acceptance without one.
4. **Staging.** Merge to `develop`; the push publishes `staging.benchmarks.redactsecret.dev`. Verify the stamps (evidence release, run digest) and that `develop` is green. Staging also needs the pii-eval App installation (#689).
5. **Production.** `npm run go-production` when the measurement is ready to be public. Record the staging and production receipts under `candidate.deployment`.
6. **Done** only when the record holds the snapshot tag, the manifest and snapshot digests, the run identities and digests, the deployment receipts and the disposition (accepted or withdrawn).
7. **Upstream acknowledgement.** Comment on credential-evidence#142 (the consumption issue) with the tag, digests, run ids and disposition.

## Rollback

Before acceptance: nothing changed; withdraw by resetting the record to `none`. After acceptance: revert the acceptance PR (the pins and the historical receipts return to `runs[]` with it), or set the authority back to `legacy` (one value, rehearsed in `qualification-cutover.md`). Old public numbers stay usable until the new results are accepted.
