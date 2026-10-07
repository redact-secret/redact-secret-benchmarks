---
decision_id: decision-read-the-release-candidate-page-from-the-candidate-diff-under-the-new-authority
status: accepted
scope: benchmarks
title: Read the release-candidate page from the candidate diff under the new authority, and record every retained legacy consumer with an owner and a rollback reason
decided_at: 2026-10-07
---

# Read the release-candidate page from the candidate diff under the new authority, and record every retained legacy consumer with an owner and a rollback reason

## Context

#658 (C6 of #651), after the publish switch of #657 (PR #819). Under the committed `new` authority `publish-site.yml` no longer runs `eval:candidate`, so `candidate-evidence-v1.json` is not written and the `/evaluation/rc/` page
(`web/services/candidate.ts`) always said "No release candidate is recorded", even when a candidate replay exists: the artifact-based candidate diff (`qualification:candidate-diff`, an internal projection kept under
`results-output/`) had no reader in the Next app. The ADR of the publish switch left the choice to this issue: feed the page from the projection, which needs a publication decision, or retire the page.

Three further questions were open: which legacy imports and legacy file reads the Next app keeps, and who answers for each (the previous guard recorded only a role); whether the evaluation pages still depend on the legacy catalog files under `new` (they
did: `loadCatalogSources` parsed `fixture-index.json`, `fixture-detectors.json` and `scenarios.json` only to get the corpus hashes the evaluation bundle is checked against); and what the holdout page's "not measured" text tells a reader to run now that the
new publication embeds no qualification.

## Decision

1. **The page is fed from the candidate diff under `new`, and is not retired.** `web/services/candidate.ts` reads `results-output/candidate-diff-from-artifacts.json` (override `WEB_CANDIDATE_DIFF_FILE`), validates it with the artifact validator
   (`candidateDiffArtifactProblems`: internal, exploratory, counts that add up), and binds it to the pins of this checkout with `candidateDiffFreshnessProblems`, now in `benchmarks/qualification/candidate-freshness.ts` so the publication seam and the page cannot disagree.
   States: `recorded`; `not-recorded` (the file is absent, the normal state: most commits have no replay); `invalid` (not JSON, another schema, a public or non-exploratory projection, counts that do not add up); `stale` (a diff whose control is
   an earlier release, whose control runs are not the registry's canonical ones, or whose candidate is an earlier build: history, never a statement about the current release). The legacy evidence is never read under `new` and the diff is never read under `legacy`; nothing falls back across the authority.
2. **What the page publishes is counts and labels, nothing finer.** Per population: cases, regressed, improved, other change, unchanged and still failing, each population on its own row and no sum across populations; the candidate's registered id, commit, declared version and the tarball
   digests it was registered at; the control release, its evidence archive and digest. No case id, no family, no fixture link, no span and no byte is shown: the projection stays internal, its rows stay in `results-output/`, and the page is HTML built from it on staging only (production never has a candidate). The
   methods run is bound by digest only and shows no count. The page says it is an exploratory replay and not a recorded run, and words nothing as approval or a gate.
3. **A bug in the freshness binding is fixed.** `qualification:candidate-diff` writes `baseline.archive` as only the release and archive digest; the control's semantic digests are on each population and on `methods`. The binding read `baseline.archive.semanticDigests`, which a real
   diff never has, so a correct current diff would have been refused. It now reads the digests where the diff records them (and still honours an explicit `archive.semanticDigests`); a test builds the real shape.
4. **The legacy page reading is split off and owned.** `web/services/candidate-legacy.ts` and the legacy half of `web/resolvers/rc.ts` read `candidate-evidence-v1.json` and `baselines/<version>.json` for the `legacy` rollback and are removed with it (#660). The artifact reading (`candidate.ts`, `rc-artifact.ts`,
   `rc-common.ts`) imports nothing of the legacy evidence model (a test).
5. **The evaluation pages no longer read the legacy catalog files.** `loadCorpusHashes()` reads `benchmarks/categories.json` and the corpora and nothing else; `web/services/evaluation.ts` uses it. `fixture-index.json`, `fixture-detectors.json` and `scenarios.json` are read only by the legacy catalog under `legacy`
   (a test builds the hashes with the three removed).
6. **Every retained legacy import and file read has an owner and a reason, enforced.** `web/tests/unit/legacy-imports.test.ts` is the allowlist: each entry that is not `keep` names an owner (`legacy-rollback`, `pii`, `performance`, `discovery-evaluation`, `relocation`) and a reason of at least a sentence; an `oracle`
   entry is allowed only in a file the `legacy` authority reaches; a service that reads a legacy data file by name fails until the read is listed; there is no `replace` role any more. The inventory of the generators and callers is the section "The consumers after the publish switch (#658)" of `docs/specs/qualification-cutover.md`.
7. **The holdout "not measured" text is corrected.** `QUALIFY_COMMANDS` no longer says the publication embeds a qualification: under `new` the publication runs none and the page reads the frozen report; `eval:qualify` is the protected-holdout lifecycle the owner kept, and `eval:publish --qualification` is the rollback's.
8. **Nothing is removed here.** The legacy branch is the one-value rollback. The one caller-free removal (the matrix drift contract) and the all-or-nothing set that leaves with the rollback are handed to #660 with caller evidence.

## Consequences

Staging shows "No release candidate is recorded" until a candidate replay and its control copy exist at the current pins (maintainer dispatch of `official-runs.yml`, product access; #657). When one is registered the page shows its counts without a further change. The decision
asserts no product output, changes no pin, authority, ledger, threshold or support status, and runs no measurement.
