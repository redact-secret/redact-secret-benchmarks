---
decision_id: decision-measure-an-unpublished-product-build-as-an-exploratory-candidate-replay-on-the-engine-candidate
status: accepted
scope: benchmarks
title: Measure an unpublished product build as an exploratory candidate replay on the engine candidate, never as an accepted run
decided_at: 2026-10-04
---

# Measure an unpublished product build as an exploratory candidate replay on the engine candidate, never as an accepted run

## Context

#698, part of #690. Core redact-secret#1204 (merge 1e45cecf674344726e59bd35a37f28ba1966a06e) fixes three false positives and settles the 82 root causes redact-secret#1203 collected. It is unpublished, so no official run can measure it: the engine refuses a scanner without a registry pin as `official`. The earlier candidate verification (core 0ecf3e59) was a local darwin run of the product scanner alone, which is not the corpus, peer and method setting of the control.

## Decision

1. **A registered candidate.** `benchmarks/product-candidates.json` names an unpublished build by commit and holds the tarballs' size and sha256 (a release of this repository). `npm run product-candidates:check` (`--bindings` against the release) refuses a candidate that is published, official or public, a non-full commit, or a control that is not the engine candidate's product pin.
2. **Same setting, one difference.** The replay runs `official-runs.yml` with the `candidate` input: the adoption's engine candidate, the accepted evidence, the three populations and the floors methods run, all five scanners, the engine's own configuration, linux-x64, two engine runs each with equal semantic digests. The candidate's packages are extracted over the shim's published install after their digests are verified and the shim must load the candidate's version; the receipt of every installed file is kept. The control is the engine candidate's own replay of the published build (its archive), so only the product build differs.
3. **Exploratory and internal.** The class is `exploratory` and the publication `internal`; the run script checks the artifact for exactly that and a run record carries the candidate identity. It is never recorded in `runs[]`, never public evidence, and `official-runs.yml` stays read-only.
4. **A report, not a verdict.** `candidate-replay-report.ts` states, per population and for the methods run, the cases fixed, worse, changed and still failing with both builds' findings, actions, UTF-8 byte ranges and a sanitized view, the peers' unchanged check and the repeat-run agreement. "Worse" is only a pass that now fails, more leaked or collateral bytes, a control now flagged or an assertion now failing. No ledger row, status or evidence expectation changes; the adopted snapshot is not edited and evidence changes stay proposals (`evidenceProposal`).
5. **One command for the manual steps.** `scripts/run-candidate-replay.mjs` dispatches, waits, downloads, archives (`candidate-runs-<run id>`, round-trip verified), writes the generated data and the registry receipt and opens the draft pull request; the workflow stays `contents: read`.
6. **The product's scope is recorded as the product states it.** `scanners/product-scope.json` (#622) restates the product's own out-of-scope decisions at a named product revision, validated like the peer registry, and the scanner page shows them with the revision its detector count was read at.

## Consequences

A fix in an unreleased core build can be measured on the exact corpus and peers before a release, and a release decision sees the effect without a number being restored by it. The first use is core-main-1e45cecf: `docs/generated/evidence-adoption/product-core-main-1e45cecf/`. Spec: `docs/specs/product-candidate-replay.md`.
