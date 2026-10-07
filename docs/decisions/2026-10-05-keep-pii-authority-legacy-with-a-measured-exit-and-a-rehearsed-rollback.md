---
decision_id: decision-keep-pii-authority-legacy-with-a-measured-exit-and-a-rehearsed-rollback
status: accepted
scope: benchmarks
title: Record PII authority as its own committed value, keep it legacy until a measured exit holds, and rehearse the rollback
decided_at: 2026-10-05
---

# Record PII authority as its own committed value, keep it legacy until a measured exit holds, and rehearse the rollback

> Superseded for the public/synthetic lane by [the 2026-10-07 switch to pii-eval](2026-10-07-switch-the-public-synthetic-pii-measurement-authority-to-pii-eval.md). The mechanism below stands; the value `legacy` and the single exit list do not.

## Context

#666, part of #652; after #664 (the four benchmark populations through the oracle and pii-eval) and #665 (the consumer, the support matrix, the UI, the repin). The credential analogue is
[the credential authority switch](2026-10-02-switch-credential-qualification-authority-to-the-new-path.md): one committed value, a gate, one reader, the legacy path kept as the oracle for a bounded period.
The issue asks for the same shape for PII, and says a credential authority setting is not sufficient authorisation for PII.

What the evidence supports today, stated before any value is chosen:

- The dual run has zero unexplained differences, but only over the 1,032 of 1,188 case memberships whose authored identity is valid or invalid. 156 memberships have an authored identity of `not-established`, which neither the oracle nor `pii-eval`
  can state; the benchmark scorer alone still scores them. The acceptance is `accepted-representable-cases`.
- Every population run is `exploratory`; none is an official run. The artifacts were built by a local darwin engine; the canonical linux engine now reproduces them byte for byte
  ([the linux replay](2026-10-05-accept-the-linux-engine-replay-of-the-four-pii-populations-as-verification.md)), which settles the platform question and nothing else.
- The benchmark scorer (`b11ScoreTable`) and `pii-v1` accounting are different scorers; their numbers are not compared, and no decision says which defines the PII metric values the qualification uses.
- No live protected path exists (no custodian catalog or transport, no production v2 signing key, no `worker-result/1` emission). The synthetic conformance consumer is `supportClaims=false`.
- No owner has accepted a measured PII verdict for an explicitly frozen release or candidate.

## Decision

1. **PII authority is its own committed value.** `benchmarks/pii-authority.json`, validated by `schemas/pii-authority-v1.json` and the `pii:authority:check` gate in `validate-sources`, holds `authority: "legacy" | "new"`. It shares no file, reader or code with
   `benchmarks/qualification-authority.json`: neither names the other, and a test holds that. A credential setting is not authorisation for PII, and a PII setting is not one for credentials.
2. **The value is `legacy`.** The evidence above does not support `new`: a switch would make an exploratory, representable-cases-only measurement the authority while the benchmark scorer still scores 156 memberships nothing else can,
   with no decision on which scorer defines the numbers, no official run, no protected path and no owner acceptance. Choosing `new` would assert a product verdict the repository has no basis for (the boundary rule). `legacy` is not a failure state: it is the
   recorded state until the exit holds.
3. **The exit is measured, not argued.** The file lists eight exit criteria. Six are `computed`: the gate recomputes each from the committed tree and fails when the recorded state differs, so a criterion cannot be marked met by hand and cannot stay unmet after its
   evidence lands. Two are `owner` decisions the repository never records on the owner's behalf. Criteria: `population-dual-run-complete`, `linux-engine-replay-equal`, `official-mode-measurement`, `protected-path-live`,
   `legacy-callers-inventoried`, `rollback-rehearsed-for-target`, `scorer-basis-decided`, `owner-accepted-verdict`. At this decision `linux-engine-replay-equal`, `legacy-callers-inventoried` and `rollback-rehearsed-for-target` hold; the other five do not.
4. **`new` is allowed only with an owner authorisation and a fresh tree.** While `authority` is `new` the gate requires the recorded authorisation (release or candidate, date, who accepted, an accepted decision, engine commit, policy digest and each population's semantic digest), every
   criterion met, and every part unchanged: a repin, a policy change or a changed population makes it stale until it is authorised again in a reviewed commit. `new` is never accepted without an authorisation record, and the Next service refuses it too; under `new` the page never falls back to the legacy evaluation.
5. **The legacy PII measurement is the oracle for a bounded period, decided by the owner.** The oracle period ends when the owner has authorised `new` for an explicitly frozen release or candidate, that target has been measured through both pipelines with the dual-run report regenerated and 0 unexplained differences, the rollback has been rehearsed again against it,
   and a removal PR lists each legacy file's callers first and is reviewed. It is reviewed, not ended, on 2027-01-02. A lapse of time removes nothing. Nothing is removed by this decision.
6. **One reader in the app.** `web/services/pii-authority.ts` is the only reader; `PII_AUTHORITY_READERS` lists every file allowed to name the file and the gate fails on any other. Every PII evaluation carries a stamp (the authority, the legacy source, the criteria still unmet, who decides, the review date), shown as the last row of the first status group on `/evaluation/pii/`.
7. **The rollback is rehearsed against the pinned target and recorded.** `scripts/rehearse-pii-authority-rollback.mjs` flips the one value in the working tree, rebuilds the PII support publication (the reviewed protected route and the five bound pii-eval artifacts) and runs the gate under each value, then restores the file.
   The record is `docs/generated/pii-authority-rehearsal.json`; the publication is byte-identical under both values and across the rollback, `new` is refused without an authorisation, and the file is restored byte for byte. The rehearsal is against the engine commit and the four population digests; a repin makes it stale and criterion `rollback-rehearsed-for-target` unmet until it is repeated.
   Unit tests in `web/tests/unit/pii-authority.test.ts` show the same on the evaluation the pages read.
8. **A caller inventory names every removal candidate.** `scripts/pii-legacy-inventory.mjs` writes `docs/generated/pii-legacy-inventory.json`: 67 files in five groups (generic engine, oracle behaviour tests, files to split, the benchmark scorer, product policy), each with its owner after retirement, its callers and its prerequisite. The gate compares the candidates and the callers
   that would block a removal (not test callers), so a new script, workflow, page or service that uses a candidate fails until it is listed. Product-owned evidence and policy are `retain`, never candidates; the benchmark scorer is `retain-until-criterion`.
9. **PII migration work leaves the legacy credential measurement out of unrelated pull requests, and no required check is weakened.** `scripts/ci-plan.mjs` treats the pii-eval consumer, the dual-run, replay, authority and inventory scripts and the committed pins and artifacts as PII migration inputs (`PII_MIGRATION`): a change to only those does not select the legacy oracle
   (the engine exercise, the four-scanner comparison and the legacy export and browser checks). The PII oracle domain code, the product policy and the PII publication code remain legacy inputs. Every PII gate (`pii:artifact:check`, `pii:artifact-source:check`, `pii:custodian:check`, `pii:migration:check`,
   `pii:authority:check`, `pii:legacy-inventory:check`) runs unconditionally in `validate-sources`, the root unit tests (which include every PII test) run on every change, and the site is still built and tested for a PII data change. The PII measurement workflows are dispatch-only or run on a push to `develop` or `main`;
   `tests/pii-ci-lanes.test.mjs` holds all of this, including that no file the legacy oracle runs depends on a carved-out file (checked through the import graph).
10. **Documentation and commands point at the active owners.** [`docs/specs/pii-authority.md`](../specs/pii-authority.md) is the spec; `AGENTS.md` and `docs/specs/pii-eval-integration.md` name the commands and the owners.

## Consequences

- PII authority is `legacy`, recorded, with five unmet criteria that each name their evidence, and the page says so. #666 stays open: its acceptance (an authoritative pipeline with real data, legacy removals meeting the agreed exit) is not met, and this decision does not pretend otherwise.
- The next step is the owner's: decide `scorer-basis-decided`, and either extend the engine contract for the 156 memberships or decide to drop them; the rest are measurements (an official run, a live protected path) owned by `pii-eval`, the custodian and the owner.
- A repin of `pii-eval`, a changed population or a changed policy recomputes the criteria; the gate then fails until the record is updated in a reviewed commit. That is the intended friction.
- No legacy file is removed, and none can be until the exit holds.

## Alternatives rejected

- **Reuse the credential authority file for PII.** The issue forbids it, and the two pipelines have different evidence, owners and readiness.
- **Switch to `new` now with the representable cases.** It would drop 156 memberships from the authority silently, on an exploratory run, with no owner acceptance.
- **Make a time-based exit.** The credential decision rejected it; so does this one.
- **Record owner criteria as met from the dual-run report.** The repository never writes an acceptance on the owner's behalf.
- **Move the PII measurement out of every pull request build, including `validate-sources`.** That would weaken the required checks; only the legacy credential measurement a PII-only change cannot reach is skipped.
