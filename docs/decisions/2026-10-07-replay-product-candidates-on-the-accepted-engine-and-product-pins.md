---
decision_id: decision-replay-product-candidates-on-the-accepted-engine-and-product-pins
status: accepted
scope: benchmarks
title: Replay product candidates on the accepted engine and product pins, against a control copy measured at them
decided_at: 2026-10-07
---

# Replay product candidates on the accepted engine and product pins, against a control copy measured at them

## Context

#657. A product candidate replay runs on the engine the control names (`scripts/candidate-control.mjs`, `engine.tag`) and is compared with the control's archive. For an accepted adoption that was the adoption's own `candidate` block: credential-eval alpha.15 and the published core beta.13. The owner then accepted
the engine and the product measured on the same evidence, alpha.16 and core beta.14 (`engineProductAcceptance`, #808, 2026-10-07), and the run registry and the authority moved to them. A candidate replay dispatched afterwards would still have run on alpha.15 against a beta.13 control: true history, and refused by the
publication freshness binding (decision of 2026-10-07 on publishing from validated artifacts), so a candidate diff at the current pins could not be made with the existing tooling.

## Decision

1. **The control follows the acceptance.** When the adoption is accepted and carries `engineProductAcceptance` for the same evidence release and manifest, `controlFor` returns the accepted engine and the accepted published product as the control, and the control archive is `candidate.replay.acceptedPinsCopy`:
   a replay of the published product at exactly those pins, recorded with its archive release and sha256, the engine tag and the product version it was measured at, its semantic digests and its recorded runs (the scanner roster). A record without an acceptance keeps the earlier rule (`replay.replayCopy`, then `replay.archive`), so every earlier record and test reads as before.
2. **A stale, mismatched or missing control is refused.** A copy for another engine tag or product version than the acceptance is refused as stale; a copy without a release and a sha256 is refused; an acceptance for another evidence release than the adoption is refused; a missing copy is refused with what to record first. With `requireArchive: false` (what the workflow's engine read and the dispatch planning use) the accepted engine is returned without a control, so the engine tag is readable before the control exists.
3. **Nothing accepted is written.** `engineProductAcceptance`, its owner acceptance, the pins, `runs[]`, the ledger, the authority and every support status are not touched. `acceptedPinsCopy` is an additive record beside `replayCopy` (which stays as the alpha.15/beta.13 history). The copy is a measurement, not an acceptance; it is never public evidence.
4. **A candidate registered after the acceptance names the accepted product as its control.** `check-product-candidates` accepts a control version equal to the adoption's product or to the acceptance's product; any other is refused. Earlier candidates keep beta.13.
5. **The publication freshness binding is unchanged.** The control copy is a re-measurement of the accepted release, so its plain and methods semantic digests equal the canonical official runs of the registry; `candidateDiffFreshnessProblems` still requires exactly that, the pinned release as control and a candidate that is not an earlier build.
6. **The first candidate at the current pins is `core-main-f537059f`**, the newest core main commit that passed artifact qualification (run 37622345709): 19 commits after the beta.14 release source `0c62fd38`, changing `packages/javascript` among release close-out, workflow and documentation changes. It was chosen because it is the build the staging publication qualifies, differs from the published bytes and so is the one the Candidate page is about; a replay of it may show an empty diff, which is a valid result and is reported as such. Its tarballs are the ones the product's own qualification attested (core, wasm and the linux-x64 addon, byte-identical after the repack with the product's pack script), uploaded to the release `product-candidate-core-main-f537059f`; the digests in `benchmarks/product-candidates.json` are derived from the files.

## Consequences

The recipe of #801 and #802 is unchanged apart from the engine and control it reads. A later repin that moves the engine or the product again makes `acceptedPinsCopy` stale for the same reason and the refusal names it; a new copy is one dispatch of `official-runs.yml` (about 7 minutes without OpenRedaction, the default since #812).
Spec: `docs/specs/product-candidate-replay.md`.
