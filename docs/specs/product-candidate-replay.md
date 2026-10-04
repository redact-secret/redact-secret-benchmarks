# Product candidate replay

How an unpublished product build is measured on the adopted evidence before a release (#698, #690). Decision:
[measure an unpublished product build as an exploratory candidate replay](../decisions/2026-10-04-measure-an-unpublished-product-build-as-an-exploratory-candidate-replay-on-the-engine-candidate.md).
This repository measures and records (the boundary rule): the replay reports an effect and decides nothing.

## What is measured

The registered candidate (`benchmarks/product-candidates.json`) on the adoption's engine candidate (`benchmarks/evidence-adoption.json` `engineCandidate`), the accepted evidence, the plain runs of the floors, regression and policy populations and the floors methods run (metamorphic, mutation, differential), all five scanners, the engine's own configuration, linux-x64, two engine runs each with equal semantic digests. The control is the engine candidate's replay of the published build (`engineCandidate.replay.archive`), so the product build is the only difference.

| Class | Value |
| --- | --- |
| run class | `exploratory` (the engine refuses an unpinned build as official) |
| publication | `internal` |
| recorded in `runs[]` | never |
| public evidence | never |

## Registry

`candidates[]`: `id`, `product` (repository, full commit, version, `published: false`, the PRs, the build description, the CI run the addon came from), `control` (the published pin), `platform`, `runClass`, `publication`, `release` (the release of this repository that holds the tarballs) and `packages[]` (name, file, sha256, size, platform). The core and wasm packages are platform-neutral; the node addon is the one built for the replay platform. After a replay the candidate carries `replay` (the CI run, the archive release and digest, the benchmark revision, the verdict counts, `repeatRunsEqual`). Gate: `npm run product-candidates:check` (`--bindings` also checks the release assets).

Registering a candidate: build the three packages from the exact commit (the core with `npm pack` after `js:build`, the addon and wasm from the commit's own CI run), upload them to a release of this repository, record the digests. Nothing is published.

## Install and refusal

`scripts/install-product-candidate.mjs` downloads each registered tarball, refuses unless its size and sha256 are the registered ones, empties `node_modules/<package>` of the shim and extracts the tarball over it. The shim must then load the candidate and report its version. The run script (`scripts/run-official-credential-eval.ts --candidate <id>`) does this before anything is measured and refuses when the engine checkout is not the engine candidate's revision, a configuration pin differs, an artifact is not exploratory and internal, or the two runs disagree. The receipt (`product-candidate-receipt.json`: the digest of every installed file) is kept with the run.

## Report

`scripts/candidate-replay-report.ts` and `scripts/compare-replay-effects.ts` (strict: every difference is an identity field or a per-case outcome keyed by semantic ids) produce `candidate-effect.json/.md`, `effect.json`, `triage.json/.md`. Per population: cases fixed, regressed (worse), changed, unchanged and still failing, with the findings of both builds (UTF-8 byte ranges, family, action), the sanitized view of every differing plain case, the peers' unchanged check (every peer's case results equal) and the repeat-run agreement of both sides. Worse is only: a pass that now fails, more leaked or collateral bytes, a control that is now flagged, an assertion that now fails or a new review occurrence. `worsened` is the one flag.

The triage rules (`benchmarks/qualification/triage-decisions.ts`, `triage-core-1203.ts`) take the product's classification of the base cases from redact-secret#1203 and claim a fix only for a case the candidate replay shows passing. An `evidenceProposal` is a proposed change to credential-evidence, kept apart from the disposition; the adopted snapshot is never edited here.

## One command

```bash
node scripts/run-candidate-replay.mjs all --candidate core-main-1e45cecf   # on a pushed, clean feature branch
```

`dispatch` (checks the push, the registry and its release, dispatches `official-runs.yml` with `candidate`, finds the run), `wait`, `collect` (downloads the artifacts and the report, checks each run record is exploratory, internal, this candidate and repeat-equal, archives them as `candidate-runs-<run id>`, fetches the archive by its digest and compares every artifact byte, writes `docs/generated/evidence-adoption/product-<id>/` and the registry receipt) and `propose` (commit, push, draft pull request) can be run alone; each is idempotent and refuses with the reason. The workflow stays `contents: read`; the release and the pull request use the maintainer's `gh` credentials.

## Product scope (#622)

`scanners/product-scope.json` holds the product's own out-of-scope statements, read at a named product revision and validated by `npm run peer-rules:check` (no judgement words, bounded, permalinked sources). The scanner page shows them for redact-secret and states the revision the registered-detector count was read at.
